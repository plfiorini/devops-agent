import Anthropic from "@anthropic-ai/sdk";
import type {
	Tool as AnthropicTool,
	ContentBlockParam,
	MessageParam,
	ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AnthropicConfig } from "../config.ts";
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

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function convertTool(tool: Tool): AnthropicTool {
	const jsonSchema = zodToJsonSchema(tool.inputSchema);
	// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility.
	const { properties = {}, required = [] } = jsonSchema as any;
	return {
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: "object",
			properties: properties as AnthropicTool.InputSchema["properties"],
			required: required as string[],
		},
	};
}

function toAnthropicToolResult(
	message: ToolResultMessage,
): ToolResultBlockParam {
	return {
		type: "tool_result",
		tool_use_id: message.toolCallId,
		content: message.content,
		is_error: message.isError,
	};
}

function toAnthropicAssistantToolMessage(
	textContent: string,
	toolUseBlocks: Anthropic.ToolUseBlock[],
): Message {
	return {
		role: "assistant",
		content: textContent,
		toolCalls: toolUseBlocks.map((toolUse) => ({
			id: toolUse.id,
			name: toolUse.name,
			arguments: toolUse.input,
		})),
	};
}

export class AnthropicProvider implements Provider {
	private client: Anthropic;
	private model: string;
	private tools: Tool[] = [];
	private temperature: number;
	private maxTokens: number;

	constructor(config: AnthropicConfig, tools: Tool[]) {
		if (!config.api_key) {
			throw new Error("Anthropic API key is required");
		}

		if (!config.model) {
			throw new Error("Anthropic model is required");
		}

		const clientConfig: ConstructorParameters<typeof Anthropic>[0] = {
			apiKey: config.api_key,
		};

		if (config.base_url) {
			clientConfig.baseURL = config.base_url;
		}

		this.client = new Anthropic(clientConfig);
		this.model = config.model;
		this.tools = tools;

		this.temperature = config.temperature || DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 1) {
			throw new Error("temperature must be between 0 and 1");
		}

		this.maxTokens = config.max_tokens || DEFAULT_MAX_TOKENS;
		if (this.maxTokens && this.maxTokens <= 0) {
			throw new Error("max_tokens must be a positive integer");
		}
		if (this.maxTokens && this.maxTokens > 4096) {
			logger.warn(
				"max_tokens is set to a value greater than 4096, which may lead to unexpected behavior.",
			);
		}
	}

	async chatBot(request: Request): Promise<Response> {
		if (!this.client) {
			throw new Error("Anthropic client is not initialized");
		}

		const toolSchemas = new Map(this.tools.map((tool) => [tool.name, tool]));

		try {
			// Convert messages to Anthropic format
			const messages = this.convertMessagesToAnthropicFormat(request);
			const generatedMessages: Message[] = [];

			// Prepare tools for Anthropic format
			const anthropicTools = this.tools.map((tool) => convertTool(tool));

			for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
				const response = await this.client.messages.create({
					model: this.model,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
					system: request.systemPrompt,
					messages,
					tools: anthropicTools.length > 0 ? anthropicTools : undefined,
				});

				const toolUseBlocks = response.content.filter(
					(content): content is Anthropic.ToolUseBlock =>
						content.type === "tool_use",
				);

				const textContent = response.content
					.filter(
						(content): content is Anthropic.TextBlock =>
							content.type === "text",
					)
					.map((content) => content.text)
					.join("");

				if (toolUseBlocks.length > 0) {
					if (iteration === MAX_TOOL_ITERATIONS) {
						throw new Error(
							`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
						);
					}

					const assistantMessage = toAnthropicAssistantToolMessage(
						textContent,
						toolUseBlocks,
					);
					generatedMessages.push(assistantMessage);
					messages.push({
						role: "assistant",
						content: response.content,
					});

					const toolResults: ToolResultBlockParam[] = [];
					for (const toolUse of toolUseBlocks) {
						const toolResult = await executeTool(
							toolUse.id,
							toolUse.name,
							toolUse.input,
							toolSchemas,
						);
						generatedMessages.push(toolResult);
						toolResults.push(toAnthropicToolResult(toolResult));
					}

					messages.push({
						role: "user",
						content: toolResults,
					});

					continue;
				}

				if (!textContent) {
					throw new Error("No text content in response from Anthropic");
				}

				const finalMessage: Message = {
					role: "assistant",
					content: textContent,
				};
				return {
					content: textContent,
					messages: [...generatedMessages, finalMessage],
				};
			}

			throw new Error(
				`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`,
			);
		} catch (error) {
			logger.error("Anthropic API error:", error);
			throw new Error(
				`Failed to get response from Anthropic: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private convertMessagesToAnthropicFormat(request: Request): MessageParam[] {
		const messages: MessageParam[] = [];

		for (let index = 0; index < request.messages.length; index++) {
			const msg = request.messages[index];
			if (!msg || msg.role === "system") {
				continue;
			}

			if (msg.role === "tool") {
				const toolResults: ToolResultBlockParam[] = [];
				while (request.messages[index]?.role === "tool") {
					toolResults.push(
						toAnthropicToolResult(request.messages[index] as ToolResultMessage),
					);
					index++;
				}
				index--;
				messages.push({
					role: "user",
					content: toolResults,
				});
				continue;
			}

			if (msg.role === "assistant" && "toolCalls" in msg) {
				const content: ContentBlockParam[] = [];
				if (msg.content) {
					content.push({ type: "text", text: msg.content });
				}
				content.push(
					...msg.toolCalls.map((toolCall) => ({
						type: "tool_use" as const,
						id: toolCall.id,
						name: toolCall.name,
						input: toolCall.arguments,
					})),
				);
				messages.push({ role: "assistant", content });
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
