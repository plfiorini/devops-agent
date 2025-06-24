import {
	type Tool as GeminiTool,
	type GenerativeModel,
	GoogleGenerativeAI,
	SchemaType,
} from "@google/generative-ai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GeminiConfig } from "../config.ts";
import logger from "../logger.ts";
import type { Message, Provider, Request, Response, Tool } from "../types.ts";

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;

function getGeminiTools(tools: Tool[]): GeminiTool[] {
	return [
		{
			functionDeclarations: tools.map((tool) => {
				// Convert the Zod schema to a JSON schema
				const jsonSchema = zodToJsonSchema(tool.inputSchema);
				// The zodToJsonSchema function returns a complex object, we need to extract the properties.
				// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility.
				const { properties = {}, required = [] } = jsonSchema as any;
				return {
					name: tool.name,
					description: tool.description,
					parameters: {
						type: SchemaType.OBJECT,
						properties,
						required,
					},
				};
			}),
		},
	];
}

export class GeminiProvider implements Provider {
	private genAI: GoogleGenerativeAI;
	private model: GenerativeModel;
	private tools: Tool[] = [];
	private temperature: number;
	private maxTokens: number;

	constructor(config: GeminiConfig, tools: Tool[]) {
		if (!config.api_key) {
			throw new Error("Google API key is required");
		}

		this.tools = tools;

		this.temperature = config.temperature || DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 1) {
			throw new Error("temperature must be between 0 and 1");
		}

		this.maxTokens = config.max_tokens || DEFAULT_MAX_TOKENS;
		if (this.maxTokens && this.maxTokens <= 0) {
			throw new Error("max_tokens must be greater than 0");
		}
		if (this.maxTokens && this.maxTokens > 4096) {
			logger.warn(
				"max_tokens is set to a value greater than 4096, which may lead to unexpected behavior.",
			);
		}

		this.genAI = new GoogleGenerativeAI(config.api_key);
		this.model = this.genAI.getGenerativeModel({
			model: config.model || "gemini-1.5-pro",
			tools: getGeminiTools(this.tools),
			generationConfig: {
				temperature: this.temperature,
				maxOutputTokens: this.maxTokens,
			},
		});
	}

	async chatBot(request: Request): Promise<Response> {
		if (!this.model) {
			throw new Error("Gemini model is not initialized");
		}

		const toolSchemas = new Map(this.tools.map((tool) => [tool.name, tool]));
		const toolExecutors = new Map(
			this.tools.map((tool) => [tool.name, tool.execute]),
		);

		try {
			// Convert messages to Gemini format
			const history = this.convertMessagesToHistory(request.messages);

			// Start chat session with system prompt and history
			const chat = this.model.startChat({
				history: [
					{
						role: "user",
						parts: [{ text: request.systemPrompt }],
					},
					{
						role: "model",
						parts: [
							{
								text: "I understand. I'm ready to help with DevOps tasks using the available tools.",
							},
						],
					},
					...history,
				],
			});

			// Get the last user message
			const lastMessage = request.messages[request.messages.length - 1];
			if (!lastMessage || lastMessage.role !== "user") {
				throw new Error("Last message must be from user");
			}

			// Send message and handle potential tool calls
			const result = await chat.sendMessage(lastMessage.content);
			const response = result.response;

			// Check if the model wants to call functions
			const functionCalls = response.functionCalls();
			if (functionCalls && functionCalls.length > 0) {
				// Execute tool calls
				const toolResults = await Promise.all(
					functionCalls.map(async (call) => {
						try {
							if (!toolSchemas.has(call.name)) {
								throw new Error(`Tool not found: ${call.name}`);
							}

							const tool = toolSchemas.get(call.name);
							if (!tool) {
								throw new Error(`Tool not found: ${call.name}`);
							}
							const executor = toolExecutors.get(call.name);

							if (tool && executor) {
								const validatedArgs = tool.inputSchema.parse(call.args);
								const rawResult = await executor(validatedArgs);
								const validatedResult = tool.outputSchema.parse(rawResult);

								return {
									name: call.name,
									result: validatedResult,
								};
							}

							throw new Error(`Tool executor not found for: ${call.name}`);
						} catch (error) {
							return {
								name: call.name,
								result: null,
								error: error instanceof Error ? error.message : String(error),
							};
						}
					}),
				);

				// Send tool results back to model
				const toolResultsForModel = toolResults.map((toolResult) => ({
					functionResponse: {
						name: toolResult.name,
						response: toolResult.error
							? { error: toolResult.error }
							: { result: toolResult.result },
					},
				}));

				const followUpResult = await chat.sendMessage(toolResultsForModel);
				return { content: followUpResult.response.text() };
			}

			return { content: response.text() };
		} catch (error) {
			logger.error("Gemini API error:", error);
			throw new Error(
				`Failed to get response from Gemini: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private convertMessagesToHistory(messages: Message[]) {
		return messages.slice(0, -1).map((msg) => ({
			role: msg.role === "assistant" ? "model" : "user",
			parts: [{ text: msg.content }],
		}));
	}
}
