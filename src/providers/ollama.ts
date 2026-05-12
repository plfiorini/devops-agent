import {
	Ollama,
	type Message as OllamaMessage,
	type Tool as OllamaTool,
	type ToolCall as OllamaToolCall,
} from "ollama";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OllamaConfig } from "../config.ts";
import { logger } from "../logger.ts";
import { SystemPrompt } from "../systemPrompt.ts";
import type {
	AssistantToolCallMessage,
	Message,
	ProviderInterface,
	Tool,
	ToolResultMessage,
} from "../types.ts";

const DEFAULT_TEMPERATURE = 0.65;

/**
 * Normalise Ollama tool-call arguments to a plain object.
 * Some Ollama versions return the arguments as a JSON string rather than an
 * already-parsed object; this helper handles both forms consistently.
 */
function normalizeOllamaArgs(args: unknown): Record<string, unknown> {
	if (typeof args === "string") {
		try {
			return JSON.parse(args) as Record<string, unknown>;
		} catch {
			return {};
		}
	}
	return (args as Record<string, unknown>) ?? {};
}

export class OllamaProvider implements ProviderInterface {
	private ollama: Ollama;
	private model: string;
	private availableModels: string[] = [];
	private executableTools: Tool[] = [];
	private tools: OllamaTool[] = [];
	private temperature: number;
	private numPredict: number | undefined;
	private systemPromptMessage: OllamaMessage = {
		role: "system",
		content: SystemPrompt,
	};
	private messages: OllamaMessage[] = [];

	constructor(config: OllamaConfig, tools: Tool[]) {
		if (!config.model) {
			throw new Error("Ollama model is required");
		}

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 2) {
			throw new Error("temperature must be between 0 and 2");
		}

		this.numPredict = config.num_predict;

		this.ollama = new Ollama({
			host: config.base_url ?? "http://localhost:11434",
		});

		this.model = config.model;
		this.executableTools = tools;
		this.tools = this.convertTools(tools);

		this.clearMessages();
	}

	getProviderName(): string {
		return "ollama";
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
			const response = await this.ollama.list();
			this.availableModels = response.models.map((m) => m.name);
			return this.availableModels;
		} catch (error) {
			logger.error("Failed to fetch available models from Ollama:", error);
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
			// Add user message to history
			this.messages.push({ role: "user", content: prompt });

			while (true) {
				const stream = await this.ollama.chat({
					model: this.model,
					messages: [this.systemPromptMessage, ...this.messages],
					tools: this.tools.length > 0 ? this.tools : undefined,
					stream: true,
					think: true,
					options: {
						temperature: this.temperature,
						...(this.numPredict !== undefined && {
							num_predict: this.numPredict,
						}),
					},
				});

				let thinking = "";
				let content = "";
				const toolCalls: OllamaToolCall[] = [];
				let doneThinking = false;

				for await (const chunk of stream) {
					if (chunk.message.thinking) {
						thinking += chunk.message.thinking;
					}
					if (chunk.message.content) {
						if (!doneThinking) {
							doneThinking = true;
						}
						content += chunk.message.content;
					}
					if (chunk.message.tool_calls?.length) {
						toolCalls.push(...chunk.message.tool_calls);
					}
				}

				if (thinking || content || toolCalls.length) {
					this.messages.push({
						role: "assistant",
						thinking,
						content,
						tool_calls: toolCalls,
					});

					// Generate one UUID per tool call so both the yield and the
					// tool-result loop use the same IDs (avoids MD5 hash collisions
					// when the same tool is called with identical arguments).
					const toolCallIds = toolCalls.map((_call, _i) => crypto.randomUUID());

					const agentMessage = {
						role: "assistant",
						thinking,
						content,
						toolCalls: toolCalls.map((call: OllamaToolCall, i: number) => ({
							id: toolCallIds[i],
							name: call.function.name,
							arguments: normalizeOllamaArgs(call.function.arguments),
						})),
					} as AssistantToolCallMessage;
					yield agentMessage;

					if (!toolCalls.length) {
						break;
					}

					for (const [i, call] of toolCalls.entries()) {
						// Search call.function.name from tools and execute the corresponding tool
						const tool = this.executableTools.find(
							(t) => t.name === call.function.name,
						);

						let resultContent: string;
						let displayContent: string | undefined;
						let isError = false;
						if (tool) {
							const args = normalizeOllamaArgs(call.function.arguments);
							const validatedArgs = tool.inputSchema.parse(args);
							const result = await tool.execute(validatedArgs);
							const validatedResult = tool.outputSchema.parse(result);
							resultContent =
								typeof validatedResult === "string"
									? validatedResult
									: JSON.stringify(validatedResult);
							displayContent = tool.formatResult?.(validatedResult);
							if (tool.isError?.(validatedResult)) {
								isError = true;
							}
						} else {
							resultContent = "Unknown tool";
							isError = true;
						}

						this.messages.push({
							role: "tool",
							content: resultContent,
							tool_name: call.function.name,
						});

						yield {
							role: "tool",
							toolCallId: toolCallIds[i],
							toolName: call.function.name,
							content: resultContent,
							displayContent,
							isError,
						} as ToolResultMessage;
					}
				} else {
					break;
				}
			}
		} catch (error) {
			logger.error("Ollama streaming error:", error);
			throw error;
		}
	}

	private convertTools(tools: Tool[]): OllamaTool[] {
		return tools.map((tool: Tool) => {
			return {
				type: "function",
				function: {
					name: tool.name,
					description: tool.description,
					parameters: zodToJsonSchema(tool.inputSchema) as Record<
						string,
						unknown
					>,
				},
			};
		});
	}
}
