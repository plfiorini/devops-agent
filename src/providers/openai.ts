import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAIConfig } from "../config.ts";
import { logger } from "../logger.ts";
import { SystemPrompt } from "../systemPrompt.ts";
import type {
	AssistantToolCallMessage,
	Message,
	ProviderInterface,
	TextMessage,
	Tool,
	ToolResultMessage,
} from "../types.ts";

type OpenAIMessage = OpenAI.Chat.ChatCompletionMessageParam;
type OpenAITool = OpenAI.Chat.ChatCompletionTool;

const DEFAULT_TEMPERATURE = 0.65;
const DEFAULT_MAX_TOKENS = 4096;

export class OpenAIProvider implements ProviderInterface {
	protected client: OpenAI;
	protected model: string;
	private availableModels: string[] = [];
	protected executableTools: Tool[] = [];
	protected tools: OpenAITool[] = [];
	protected temperature: number;
	protected maxTokens: number;
	protected systemPromptMessage: OpenAIMessage = {
		role: "system",
		content: SystemPrompt,
	};
	protected messages: OpenAIMessage[] = [];

	constructor(config: OpenAIConfig, tools: Tool[]) {
		if (!config.api_key) {
			throw new Error("OpenAI API key is required");
		}
		if (!config.model) {
			throw new Error("OpenAI model is required");
		}

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 2) {
			throw new Error("temperature must be between 0 and 2");
		}

		this.maxTokens = config.max_tokens ?? DEFAULT_MAX_TOKENS;
		if (this.maxTokens <= 0) {
			throw new Error("max_tokens must be greater than 0");
		}

		this.client = new OpenAI({
			apiKey: config.api_key,
			baseURL: config.base_url,
			organization: config.organization,
		});

		this.model = config.model;
		this.executableTools = tools;
		this.tools = this.convertTools(tools);

		this.clearMessages();
	}

	getProviderName(): string {
		return "openai";
	}

	getModelName(): string {
		return this.model;
	}

	setModelName(model: string): void {
		this.model = model;
	}

	async getSupportedModels(): Promise<string[]> {
		if (this.availableModels.length > 0) {
			return this.availableModels;
		}

		try {
			const response = await this.client.models.list();
			this.availableModels = response.data.map((m) => m.id).sort();
			return this.availableModels;
		} catch (error) {
			logger.error("Failed to fetch available models from OpenAI:", error);
			return [];
		}
	}

	getMessagesCount(): number {
		return this.messages.length;
	}

	clearMessages(): void {
		this.messages = [];
	}

	async *agentLoop(prompt: string): AsyncGenerator<Message> {
		try {
			this.messages.push({ role: "user", content: prompt });

			while (true) {
				const stream = await this.client.chat.completions.create({
					model: this.model,
					messages: [this.systemPromptMessage, ...this.messages],
					tools: this.tools.length > 0 ? this.tools : undefined,
					stream: true,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
				});

				let content = "";
				// Map from index -> accumulated tool call
				const toolCallsAcc: Map<
					number,
					{ id: string; name: string; arguments: string }
				> = new Map();

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (delta?.content) {
						content += delta.content;
					}
					if (delta?.tool_calls) {
						for (const tc of delta.tool_calls) {
							const idx = tc.index;
							if (!toolCallsAcc.has(idx)) {
								toolCallsAcc.set(idx, {
									id: tc.id ?? "",
									name: tc.function?.name ?? "",
									arguments: "",
								});
							}
							const acc = toolCallsAcc.get(idx)!;
							if (tc.id) {
								acc.id = tc.id;
							}
							if (tc.function?.name) {
								acc.name += tc.function.name;
							}
							if (tc.function?.arguments) {
								acc.arguments += tc.function.arguments;
							}
						}
					}
				}

				const toolCalls = Array.from(toolCallsAcc.values());

				if (content || toolCalls.length > 0) {
					const assistantMsg: OpenAIMessage =
						toolCalls.length > 0
							? {
									role: "assistant",
									content,
									tool_calls: toolCalls.map((tc) => ({
										id: tc.id,
										type: "function" as const,
										function: { name: tc.name, arguments: tc.arguments },
									})),
								}
							: { role: "assistant", content };

					this.messages.push(assistantMsg);
					yield this.convertMessageFromOpenAI(assistantMsg);
				}

				if (toolCalls.length === 0) {
					break;
				}

				for (const tc of toolCalls) {
					const tool = this.executableTools.find((t) => t.name === tc.name);

					let resultContent: string;
					let displayContent: string | undefined;
					let isError = false;
					if (tool) {
						let args: Record<string, unknown> = {};
						try {
							args = JSON.parse(tc.arguments) as Record<string, unknown>;
						} catch {
							args = {};
						}
						const result = await tool.execute(args);
						resultContent =
							typeof result === "string" ? result : JSON.stringify(result);
						displayContent = tool.formatResult?.(result);
						if (tool.isError?.(result)) {
							isError = true;
						}
					} else {
						resultContent = "Unknown tool";
						isError = true;
					}

					const toolMsg: OpenAIMessage = {
						role: "tool",
						tool_call_id: tc.id,
						content: resultContent,
					};
					this.messages.push(toolMsg);

					yield {
						role: "tool",
						toolCallId: tc.id,
						toolName: tc.name,
						content: resultContent,
						displayContent,
						isError,
					} as ToolResultMessage;
				}
			}
		} catch (error) {
			logger.error("OpenAI streaming error:", error);
			throw error;
		}
	}

	protected convertTools(tools: Tool[]): OpenAITool[] {
		return tools.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: zodToJsonSchema(tool.inputSchema) as Record<string, unknown>,
			},
		}));
	}

	protected convertMessageFromOpenAI(msg: OpenAIMessage): Message {
		if (msg.role === "system" || msg.role === "user") {
			return {
				role: msg.role,
				content: typeof msg.content === "string" ? msg.content : "",
			} as TextMessage;
		} else if (msg.role === "assistant") {
			const toolCalls =
				msg.tool_calls
					?.filter(
						(tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall =>
							tc.type === "function",
					)
					.map((tc) => ({
						id: tc.id,
						name: tc.function.name,
						arguments: (() => {
							try {
								return JSON.parse(tc.function.arguments) as unknown;
							} catch {
								return tc.function.arguments;
							}
						})(),
					})) ?? [];

			return {
				role: "assistant",
				content: typeof msg.content === "string" ? msg.content : "",
				toolCalls,
			} as AssistantToolCallMessage;
		} else if (msg.role === "tool") {
			return {
				role: "tool",
				toolCallId: msg.tool_call_id,
				toolName: "",
				content: typeof msg.content === "string" ? msg.content : "",
			} as ToolResultMessage;
		} else {
			throw new Error(`Unsupported OpenAI message role: ${msg.role}`);
		}
	}
}
