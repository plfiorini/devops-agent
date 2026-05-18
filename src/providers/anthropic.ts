import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AnthropicConfig } from "../config.ts";
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

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicTool = Anthropic.Tool;

const DEFAULT_TEMPERATURE = 0.65;
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements ProviderInterface {
	private client: Anthropic;
	private model: string;
	private availableModels: string[] = [];
	private executableTools: Tool[] = [];
	private tools: AnthropicTool[] = [];
	private temperature: number;
	private maxTokens: number;
	private messages: AnthropicMessage[] = [];

	constructor(config: AnthropicConfig, tools: Tool[]) {
		if (!config.api_key) {
			throw new Error("Anthropic API key is required");
		}
		if (!config.model) {
			throw new Error("Anthropic model is required");
		}

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 1) {
			throw new Error("temperature must be between 0 and 1");
		}

		this.maxTokens = config.max_tokens ?? DEFAULT_MAX_TOKENS;
		if (this.maxTokens <= 0) {
			throw new Error("max_tokens must be greater than 0");
		}

		this.client = new Anthropic({
			apiKey: config.api_key,
			baseURL: config.base_url,
		});

		this.model = config.model;
		this.executableTools = tools;
		this.tools = this.convertTools(tools);

		this.clearMessages();
	}

	getProviderName(): string {
		return "anthropic";
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
			logger.error("Failed to fetch available models from Anthropic:", error);
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
				const stream = this.client.messages.stream({
					model: this.model,
					max_tokens: this.maxTokens,
					system: SystemPrompt,
					temperature: this.temperature,
					tools: this.tools.length > 0 ? this.tools : undefined,
					messages: this.messages,
				});

				const response = await stream.finalMessage();

				this.messages.push({ role: "assistant", content: response.content });

				const text = response.content
					.filter((b): b is Anthropic.TextBlock => b.type === "text")
					.map((b) => b.text)
					.join("");

				const toolUseBlocks = response.content.filter(
					(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
				);

				if (toolUseBlocks.length > 0) {
					yield {
						role: "assistant",
						content: text,
						toolCalls: toolUseBlocks.map((b) => ({
							id: b.id,
							name: b.name,
							arguments: b.input,
						})),
					} as AssistantToolCallMessage;
				} else {
					yield { role: "assistant", content: text } as TextMessage;
				}

				if (response.stop_reason !== "tool_use") {
					break;
				}

				// Execute tools and collect all results before the next turn
				const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

				for (const toolUse of toolUseBlocks) {
					const tool = this.executableTools.find(
						(t) => t.name === toolUse.name,
					);

					let resultContent: string;
					let displayContent: string | undefined;
					let isError = false;
					if (tool) {
						const args = toolUse.input as Record<string, unknown>;
						const validatedArgs = tool.inputSchema.parse(args);
						if (!validatedArgs) {
							throw new Error("Invalid tool arguments");
						}
						const result = await tool.execute(validatedArgs);
						const validatedResult = tool.outputSchema.parse(result);
						if (!validatedResult) {
							throw new Error("Invalid tool result");
						}
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

					toolResultBlocks.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: resultContent,
						is_error: isError,
					});

					yield {
						role: "tool",
						toolCallId: toolUse.id,
						toolName: toolUse.name,
						content: resultContent,
						displayContent,
						isError,
					} as ToolResultMessage;
				}

				// Anthropic requires all tool results in a single user message
				this.messages.push({ role: "user", content: toolResultBlocks });
			}
		} catch (error) {
			logger.error("Anthropic streaming error:", error);
			throw error;
		}
	}

	private convertTools(tools: Tool[]): AnthropicTool[] {
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: zodToJsonSchema(tool.inputSchema) as AnthropicTool["input_schema"],
		}));
	}
}
