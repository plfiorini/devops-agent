import { AzureOpenAI, type ClientOptions, OpenAI } from "openai";
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAIConfigType } from "../config.ts";
import logger from "../logger.ts";
import type { Provider, Request, Response, Tool } from "../types.ts";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function getOpenAITools(appTools: Tool[]): ChatCompletionTool[] {
	return appTools.map((tool) => {
		// Convert the Zod schema to a JSON schema
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
		const toolExecutors = new Map(
			this.tools.map((tool) => [tool.name, tool.execute]),
		);

		try {
			// Convert messages to OpenAI format
			const messages = this.convertMessagesToOpenAIFormat(request);

			// Conver t tools to OpenAI format
			const openAITools = getOpenAITools(this.tools);

			// Make the API call
			const chatCompletion = await this.client.chat.completions.create({
				model: this.model,
				messages: messages,
				tools: openAITools,
				tool_choice: openAITools.length > 0 ? "auto" : undefined,
				temperature: this.temperature,
				max_tokens: this.maxTokens,
			});

			const responseMessage = chatCompletion.choices[0]?.message;
			if (!responseMessage) {
				throw new Error("No response from OpenAI");
			}

			// Check if the model wants to call tools
			if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
				// Execute tool calls
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

				// Make a follow-up call with tool results
				const followUpMessages = [...messages, responseMessage, ...toolResults];

				const followUpCompletion = await this.client.chat.completions.create({
					model: this.model,
					messages: followUpMessages,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
				});

				const followUpResponse = followUpCompletion.choices[0]?.message;
				if (!followUpResponse?.content) {
					throw new Error("No follow-up response from OpenAI");
				}

				return { content: followUpResponse.content };
			}

			// Return direct response if no tools were called
			if (!responseMessage.content) {
				throw new Error("Empty response from OpenAI");
			}

			return { content: responseMessage.content };
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

		// Convert conversation messages
		for (const msg of request.messages) {
			messages.push({
				role: msg.role === "assistant" ? "assistant" : "user",
				content: msg.content,
			});
		}

		return messages;
	}
}
