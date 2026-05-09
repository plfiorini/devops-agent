import { OpenAI } from "openai";
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OllamaConfig } from "../config.ts";
import logger from "../logger.ts";
import type { Provider, Request, Response, Tool } from "../types.ts";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function getOllamaTools(appTools: Tool[]): ChatCompletionTool[] {
	return appTools.map((tool) => {
		const jsonSchema = zodToJsonSchema(tool.inputSchema);
		const parameters = jsonSchema as Record<string, unknown>;

		return {
			type: "function",
			function: {
				name: tool.name,
				description: tool.description,
				parameters,
			},
		};
	});
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
		const toolExecutors = new Map(
			this.tools.map((tool) => [tool.name, tool.execute]),
		);

		try {
			const messages = this.convertMessagesToOllamaFormat(request);
			const ollamaTools = getOllamaTools(this.tools);

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

			if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
				const toolResults = await Promise.all(
					responseMessage.tool_calls.map(async (call) => {
						try {
							if (!toolSchemas.has(call.function.name)) {
								throw new Error(`Tool not found: ${call.function.name}`);
							}

							const tool = toolSchemas.get(call.function.name);
							if (!tool) {
								throw new Error(`Tool not found: ${call.function.name}`);
							}
							const executor = toolExecutors.get(call.function.name);

							if (tool && executor) {
								const args = JSON.parse(call.function.arguments);
								const validatedArgs = tool.inputSchema.parse(args);
								const rawResult = await executor(validatedArgs);
								const validatedResult = tool.outputSchema.parse(rawResult);

								return {
									tool_call_id: call.id,
									role: "tool" as const,
									content: JSON.stringify(validatedResult),
								};
							}

							throw new Error(
								`Tool executor not found for: ${call.function.name}`,
							);
						} catch (error) {
							return {
								tool_call_id: call.id,
								role: "tool" as const,
								content: JSON.stringify({
									error: error instanceof Error ? error.message : String(error),
								}),
							};
						}
					}),
				);

				const followUpMessages = [...messages, responseMessage, ...toolResults];

				const followUpCompletion = await this.client.chat.completions.create({
					model: this.model,
					messages: followUpMessages,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
				});

				const followUpResponse = followUpCompletion.choices[0]?.message;
				if (!followUpResponse?.content) {
					throw new Error("No follow-up response from Ollama");
				}

				return { content: followUpResponse.content };
			}

			if (!responseMessage.content) {
				throw new Error("Empty response from Ollama");
			}

			return { content: responseMessage.content };
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
			messages.push({
				role: msg.role === "assistant" ? "assistant" : "user",
				content: msg.content,
			});
		}

		return messages;
	}
}
