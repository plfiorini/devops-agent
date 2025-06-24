import Anthropic from "@anthropic-ai/sdk";
import type {
	Tool as AnthropicTool,
	MessageParam,
} from "@anthropic-ai/sdk/resources";
import type { AnthropicConfig } from "../config.ts";
import logger from "../logger.ts";
import type { Provider, Request, Response, Tool } from "../types.ts";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function convertTool(tool: Tool): AnthropicTool {
	return {
		name: tool.name,
		description: tool.description,
		input_schema: tool.inputSchema,
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
		const toolExecutors = new Map(
			this.tools.map((tool) => [tool.name, tool.execute]),
		);

		try {
			// Convert messages to Anthropic format
			const messages = this.convertMessagesToAnthropicFormat(request);

			// Prepare tools for Anthropic format
			const anthropicTools = this.tools.map((tool) => convertTool(tool));

			// Make the API call
			const response = await this.client.messages.create({
				model: this.model,
				temperature: this.temperature,
				max_tokens: this.maxTokens,
				system: request.systemPrompt,
				messages: messages,
				tools: anthropicTools.length > 0 ? anthropicTools : undefined,
			});

			// Handle tool use
			if (response.content.some((content) => content.type === "tool_use")) {
				const toolUseBlocks = response.content.filter(
					(content): content is Anthropic.ToolUseBlock =>
						content.type === "tool_use",
				);

				// Execute tool calls
				const toolResults = await Promise.all(
					toolUseBlocks.map(async (toolUse) => {
						try {
							if (!toolSchemas.has(toolUse.name)) {
								throw new Error(`Tool not found: ${toolUse.name}`);
							}

							const tool = toolSchemas.get(toolUse.name);
							if (!tool) {
								throw new Error(`Tool not found: ${toolUse.name}`);
							}
							const executor = toolExecutors.get(toolUse.name);

							if (tool && executor) {
								const validatedArgs = tool.inputSchema.parse(
									toolUse.input as object,
								);
								const rawResult = await executor(validatedArgs);
								const validatedResult = tool.outputSchema.parse(rawResult);

								return {
									type: "tool_result" as const,
									tool_use_id: toolUse.id,
									content: JSON.stringify(validatedResult),
								};
							}

							throw new Error(`Tool executor not found for: ${toolUse.name}`);
						} catch (error) {
							return {
								type: "tool_result" as const,
								tool_use_id: toolUse.id,
								content: JSON.stringify({
									error: error instanceof Error ? error.message : String(error),
								}),
								is_error: true,
							};
						}
					}),
				);

				// Make a follow-up call with tool results
				const followUpMessages = [
					...messages,
					{
						role: "assistant" as const,
						content: response.content,
					},
					{
						role: "user" as const,
						content: toolResults,
					},
				];

				const followUpResponse = await this.client.messages.create({
					model: this.model,
					temperature: this.temperature,
					max_tokens: this.maxTokens,
					system: request.systemPrompt,
					messages: followUpMessages,
				});

				// Extract text content from the follow-up response
				const textContent = followUpResponse.content
					.filter(
						(content): content is Anthropic.TextBlock =>
							content.type === "text",
					)
					.map((content) => content.text)
					.join("");

				if (!textContent) {
					throw new Error(
						"No text content in follow-up response from Anthropic",
					);
				}

				return { content: textContent };
			}

			// Extract text content from the initial response
			const textContent = response.content
				.filter(
					(content): content is Anthropic.TextBlock => content.type === "text",
				)
				.map((content) => content.text)
				.join("");

			if (!textContent) {
				throw new Error("No text content in response from Anthropic");
			}

			return { content: textContent };
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

		// Convert conversation messages (skip system prompt as it's handled separately)
		for (const msg of request.messages) {
			if (msg.role !== "system") {
				messages.push({
					role: msg.role === "assistant" ? "assistant" : "user",
					content: msg.content,
				});
			}
		}

		return messages;
	}
}
