import { OpenAI } from "openai";
import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ChatCompletionToolMessageParam,
} from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OllamaConfig } from "../config.ts";
import logger from "../logger.ts";
import { executeToolFromJsonArgs } from "../tools/executeTool.ts";
import type {
	Message,
	Provider,
	Request,
	Response,
	Tool,
	ToolResultMessage,
} from "../types.ts";
import { MAX_TOOL_ITERATIONS } from "../types.ts";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function getOllamaTools(appTools: Tool[]): ChatCompletionTool[] {
	return appTools.map((tool) => {
		const jsonSchema = zodToJsonSchema(tool.inputSchema);
		// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility.
		const { properties = {}, required = [] } = jsonSchema as any;

		return {
			type: "function",
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					type: "object",
					properties,
					required,
				},
			},
		};
	});
}

function toOllamaToolMessage(
	message: ToolResultMessage,
): ChatCompletionToolMessageParam {
	return {
		tool_call_id: message.toolCallId,
		role: "tool",
		content: message.content,
	};
}

function toOllamaAssistantToolMessage(
	content: string,
	toolCalls: ChatCompletionMessageToolCall[],
): Message {
	return {
		role: "assistant",
		content,
		toolCalls: toolCalls.map((call) => ({
			id: call.id,
			name: call.function.name,
			arguments: safeParseArguments(call.function.arguments),
		})),
	};
}

function safeParseArguments(argumentsJson: string): unknown {
	try {
		return JSON.parse(argumentsJson);
	} catch {
		return argumentsJson;
	}
}

function toOllamaToolCalls(message: Message): ChatCompletionMessageToolCall[] {
	if (message.role !== "assistant" || !("toolCalls" in message)) {
		return [];
	}

	return message.toolCalls.map((toolCall) => ({
		id: toolCall.id,
		type: "function" as const,
		function: {
			name: toolCall.name,
			arguments:
				typeof toolCall.arguments === "string"
					? toolCall.arguments
					: JSON.stringify(toolCall.arguments),
		},
	}));
}

export class OllamaProvider implements Provider {
	private client: OpenAI;
	private model: string;
	private tools: Tool[] = [];
	private temperature: number;
	private maxTokens: number;

	constructor(config: OllamaConfig, tools: Tool[]) {
		if (!config.model) {
			throw new Error("Ollama model is required");
		}

		const baseURL = `${config.base_url ?? DEFAULT_BASE_URL}/v1`;

		this.client = new OpenAI({
			apiKey: "ollama",
			baseURL,
		});

		this.model = config.model;
		this.tools = tools;

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 2) {
			throw new Error("temperature must be between 0 and 2");
		}

		this.maxTokens = config.max_tokens ?? DEFAULT_MAX_TOKENS;
		if (this.maxTokens <= 0) {
			throw new Error("max_tokens must be greater than 0");
		}
		if (this.maxTokens > 4096) {
			logger.warn(
				"max_tokens is set to a value greater than 4096, which may lead to unexpected behavior.",
			);
		}
	}

	async chatBot(request: Request): Promise<Response> {
		const toolSchemas = new Map(this.tools.map((tool) => [tool.name, tool]));

		try {
			const messages = this.convertMessagesToOllamaFormat(request);
			const generatedMessages: Message[] = [];
			const ollamaTools = getOllamaTools(this.tools);

			for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
				const chatCompletion = await this.client.chat.completions.create({
					model: this.model,
					messages,
					tools: ollamaTools.length > 0 ? ollamaTools : undefined,
					tool_choice: ollamaTools.length > 0 ? "auto" : undefined,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
				});

				const responseMessage = chatCompletion.choices[0]?.message;
				if (!responseMessage) {
					throw new Error("No response from Ollama");
				}

				if (
					responseMessage.tool_calls &&
					responseMessage.tool_calls.length > 0
				) {
					if (iteration === MAX_TOOL_ITERATIONS) {
						throw new Error(
							`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
						);
					}

					const assistantMessage = toOllamaAssistantToolMessage(
						responseMessage.content ?? "",
						responseMessage.tool_calls,
					);
					generatedMessages.push(assistantMessage);
					messages.push({
						role: "assistant",
						content: responseMessage.content ?? null,
						tool_calls: responseMessage.tool_calls,
					});

					for (const call of responseMessage.tool_calls) {
						const toolResult = await executeToolFromJsonArgs(
							call.id,
							call.function.name,
							call.function.arguments,
							toolSchemas,
						);
						generatedMessages.push(toolResult);
						messages.push(toOllamaToolMessage(toolResult));
					}

					continue;
				}

				if (!responseMessage.content) {
					throw new Error("Empty response from Ollama");
				}

				const finalMessage: Message = {
					role: "assistant",
					content: responseMessage.content,
				};
				return {
					content: responseMessage.content,
					messages: [...generatedMessages, finalMessage],
				};
			}

			throw new Error(
				`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
			);
		} catch (error) {
			logger.error("Ollama API error:", error);
			throw new Error(
				`Failed to get response from Ollama: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private convertMessagesToOllamaFormat(
		request: Request,
	): Array<ChatCompletionMessageParam> {
		const messages: ChatCompletionMessageParam[] = [
			{
				role: "system",
				content: request.systemPrompt,
			},
		];

		for (const msg of request.messages) {
			if (msg.role === "tool") {
				messages.push(toOllamaToolMessage(msg));
				continue;
			}

			if (msg.role === "assistant" && "toolCalls" in msg) {
				const assistantMessage: ChatCompletionAssistantMessageParam = {
					role: "assistant",
					content: msg.content || null,
					tool_calls: toOllamaToolCalls(msg),
				};
				messages.push(assistantMessage);
				continue;
			}

			if (msg.role === "system") {
				messages.push({
					role: "system",
					content: msg.content,
				});
				continue;
			}

			messages.push({
				role: msg.role,
				content: msg.content,
			});
		}

		return messages;
	}
}
