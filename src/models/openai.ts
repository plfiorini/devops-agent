import { AzureOpenAI, type ClientOptions, OpenAI } from "openai";
import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ChatCompletionToolMessageParam,
} from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAIConfigType } from "../config.ts";
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

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function getOpenAITools(appTools: Tool[]): ChatCompletionTool[] {
	return appTools.map((tool) => {
		// Convert the Zod schema to a JSON schema
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

function toOpenAIToolMessage(
	message: ToolResultMessage,
): ChatCompletionToolMessageParam {
	return {
		tool_call_id: message.toolCallId,
		role: "tool",
		content: message.content,
	};
}

function toOpenAIAssistantToolMessage(
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

function toOpenAIToolCalls(message: Message): ChatCompletionMessageToolCall[] {
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

export class OpenAIProvider implements Provider {
	private client: OpenAI | AzureOpenAI;
	private model: string;
	private tools: Tool[] = [];
	private temperature: number;
	private maxTokens: number;

	constructor(config: OpenAIConfigType, tools: Tool[]) {
		if ("model" in config) {
			if (!config.api_key) {
				throw new Error("OpenAI API key is required");
			}

			if (!config.model) {
				throw new Error("OpenAI model is required");
			}

			const clientConfig: ClientOptions = {
				apiKey: config.api_key,
			};

			if (config.organization) {
				clientConfig.organization = config.organization;
			}

			if (config.base_url) {
				clientConfig.baseURL = config.base_url;
			}

			this.client = new OpenAI(clientConfig);

			this.model = config.model;
		} else if ("deployment_name" in config) {
			if (!config.api_key) {
				throw new Error("Azure OpenAI API key is required");
			}

			if (!config.endpoint) {
				throw new Error("Azure OpenAI endpoint is required");
			}

			if (!config.deployment_name) {
				throw new Error("Azure OpenAI deployment name is required");
			}

			this.client = new AzureOpenAI({
				apiKey: config.api_key,
				endpoint: config.endpoint,
				apiVersion: config.api_version || "2024-02-15-preview",
			});

			this.model = config.deployment_name;
		} else {
			throw new Error("Invalid OpenAI configuration type");
		}

		this.tools = tools;

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 2) {
			throw new Error("temperature must be between 0 and 2");
		}

		this.maxTokens = config.max_tokens ?? DEFAULT_MAX_TOKENS;
		if (this.maxTokens && this.maxTokens <= 0) {
			throw new Error("max_tokens must be greater than 0");
		}
		if (this.maxTokens && this.maxTokens > 4096) {
			logger.warn(
				"max_tokens is set to a value greater than 4096, which may lead to unexpected behavior.",
			);
		}
	}

	async chatBot(request: Request): Promise<Response> {
		if (!this.client) {
			throw new Error("OpenAI client is not initialized");
		}

		const toolSchemas = new Map(this.tools.map((tool) => [tool.name, tool]));

		try {
			const messages = this.convertMessagesToOpenAIFormat(request);
			const generatedMessages: Message[] = [];
			const openAITools = getOpenAITools(this.tools);

			for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
				const chatCompletion = await this.client.chat.completions.create({
					model: this.model,
					messages,
					tools: openAITools.length > 0 ? openAITools : undefined,
					tool_choice: openAITools.length > 0 ? "auto" : undefined,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
				});

				const responseMessage = chatCompletion.choices[0]?.message;
				if (!responseMessage) {
					throw new Error("No response from OpenAI");
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

					const assistantMessage = toOpenAIAssistantToolMessage(
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
						messages.push(toOpenAIToolMessage(toolResult));
					}

					continue;
				}

				if (!responseMessage.content) {
					throw new Error("Empty response from OpenAI");
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
			logger.error("OpenAI API error:", error);
			throw new Error(
				`Failed to get response from OpenAI: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private convertMessagesToOpenAIFormat(
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
				messages.push(toOpenAIToolMessage(msg));
				continue;
			}

			if (msg.role === "assistant" && "toolCalls" in msg) {
				const assistantMessage: ChatCompletionAssistantMessageParam = {
					role: "assistant",
					content: msg.content || null,
					tool_calls: toOpenAIToolCalls(msg),
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
