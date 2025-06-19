import * as util from "node:util";
import {
	type FunctionDeclaration,
	type FunctionDeclarationSchemaProperty,
	type GenerativeModel,
	GoogleGenerativeAI,
	SchemaType,
} from "@google/generative-ai";
import type { GeminiConfig } from "../config.js";
import logger from "../logger.js";
import {
	type Message,
	type Provider,
	type Request,
	type Response,
	type Tool,
	type ToolProperty,
	ToolSchemaType,
} from "../types.js";

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;

function convertToolProperties(
	properties: Record<string, ToolProperty>,
): Record<string, FunctionDeclarationSchemaProperty> {
	const converted: Record<string, FunctionDeclarationSchemaProperty> = {};
	for (const [key, prop] of Object.entries(properties)) {
		switch (prop.type) {
			case ToolSchemaType.STRING:
				converted[key] = {
					type: SchemaType.STRING,
					description: prop.description,
				};
				break;
			case ToolSchemaType.NUMBER:
				converted[key] = {
					type: SchemaType.NUMBER,
					description: prop.description,
				};
				break;
			case ToolSchemaType.INTEGER:
				converted[key] = {
					type: SchemaType.INTEGER,
					description: prop.description,
				};
				break;
			case ToolSchemaType.BOOLEAN:
				converted[key] = {
					type: SchemaType.BOOLEAN,
					description: prop.description,
				};
				break;
			default:
				throw new Error(`Unsupported tool property type: ${prop.type}`);
		}
	}
	return converted;
}

function convertTool(tool: Tool): FunctionDeclaration {
	return {
		name: tool.schema.name,
		description: tool.schema.description,
		parameters: {
			type: SchemaType.OBJECT,
			properties: convertToolProperties(tool.schema.parameters.properties),
			required: tool.schema.parameters.required,
		},
	};
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

		// logger.debug("Tools", tools);
		const functionDeclarations = tools.map((tool) => convertTool(tool));
		// logger.debug("Function declarations:", functionDeclarations);

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
			tools: [{ functionDeclarations }],
			generationConfig: {
				temperature: this.temperature,
				maxOutputTokens: this.maxTokens,
			},
		});
		this.tools = tools;
	}

	async chatBot(request: Request): Promise<Response> {
		if (!this.model) {
			throw new Error("Gemini model is not initialized");
		}

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
							for (const tool of this.tools) {
								if (tool.schema.name === call.name) {
									logger.log(
										`Executing tool ${util.styleText("bold", tool.schema.name)} with args:`,
										call.args,
									);
									const toolResult = await tool.run(call.args);
									return {
										name: call.name,
										result: toolResult,
									};
								}
							}

							throw new Error(`Tool not found: ${call.name}`);
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
