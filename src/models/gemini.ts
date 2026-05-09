import {
	type Content,
	type Tool as GeminiTool,
	type GenerativeModel,
	GoogleGenerativeAI,
	type Part,
	SchemaType,
} from "@google/generative-ai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GeminiConfig } from "../config.ts";
import logger from "../logger.ts";
import { executeTool } from "../tools/executeTool.ts";
import type {
	Message,
	Provider,
	Request,
	Response,
	Tool,
	ToolResultMessage,
} from "../types.ts";
import { MAX_TOOL_ITERATIONS } from "../types.ts";

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

		try {
			const lastMessage = request.messages[request.messages.length - 1];
			if (!lastMessage || lastMessage.role !== "user") {
				throw new Error("Last message must be from user");
			}

			const history = this.convertMessagesToHistory(
				request.messages.slice(0, -1),
			);
			const generatedMessages: Message[] = [];

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

			let result = await chat.sendMessage(lastMessage.content);
			let toolCallIdCounter = 0;
			for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
				const response = result.response;
				const functionCalls = response.functionCalls();

				if (functionCalls && functionCalls.length > 0) {
					if (iteration === MAX_TOOL_ITERATIONS) {
						throw new Error(
							`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
						);
					}

					const textContent = getGeminiText(response);
					const toolCallIds = functionCalls.map(
						() => `gemini_tool_${toolCallIdCounter++}`,
					);
					const assistantMessage: Message = {
						role: "assistant",
						content: textContent,
						toolCalls: functionCalls.map((call, i) => ({
							id: toolCallIds[i] ?? "",
							name: call.name,
							arguments: call.args,
						})),
					};
					generatedMessages.push(assistantMessage);

					const toolResults: ToolResultMessage[] = [];
					for (let i = 0; i < functionCalls.length; i++) {
						const call = functionCalls[i];
						if (!call) continue;
						const toolResult = await executeTool(
							toolCallIds[i] ?? "",
							call.name,
							call.args,
							toolSchemas,
						);
						generatedMessages.push(toolResult);
						toolResults.push(toolResult);
					}

					result = await chat.sendMessage(
						toolResults.map(toolResultToGeminiPart),
					);
					continue;
				}

				const content = response.text();
				const finalMessage: Message = {
					role: "assistant",
					content,
				};
				return { content, messages: [...generatedMessages, finalMessage] };
			}

			throw new Error(
				`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
			);
		} catch (error) {
			logger.error("Gemini API error:", error);
			throw new Error(
				`Failed to get response from Gemini: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private convertMessagesToHistory(messages: Message[]): Content[] {
		const history: Content[] = [];

		for (let index = 0; index < messages.length; index++) {
			const msg = messages[index];
			if (!msg) {
				continue;
			}

			if (msg.role === "tool") {
				const parts: Part[] = [];
				while (messages[index]?.role === "tool") {
					parts.push(
						toolResultToGeminiPart(messages[index] as ToolResultMessage),
					);
					index++;
				}
				index--;
				history.push({ role: "function", parts });
				continue;
			}

			if (msg.role === "assistant" && "toolCalls" in msg) {
				const parts: Part[] = [];
				if (msg.content) {
					parts.push({ text: msg.content });
				}
				parts.push(
					...msg.toolCalls.map((toolCall) => ({
						functionCall: {
							name: toolCall.name,
							args: toolCall.arguments as Record<string, unknown>,
						},
					})),
				);
				history.push({ role: "model", parts });
				continue;
			}

			history.push({
				role: msg.role === "assistant" ? "model" : "user",
				parts: [{ text: msg.content }],
			});
		}

		return history;
	}
}

function toolResultToGeminiPart(message: ToolResultMessage): Part {
	return {
		functionResponse: {
			name: message.toolName,
			response: safeParseJson(message.content),
		},
	};
}

function safeParseJson(content: string): object {
	try {
		const value = JSON.parse(content);
		return value && typeof value === "object" ? value : { result: value };
	} catch {
		return { result: content };
	}
}

function getGeminiText(response: { text: () => string }): string {
	try {
		return response.text();
	} catch (error) {
		logger.warn("Failed to extract text from Gemini response:", error);
		return "";
	}
}
