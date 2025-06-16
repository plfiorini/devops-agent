import * as util from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import type {
	Tool as AnthropicTool,
	MessageParam,
} from "@anthropic-ai/sdk/resources";
import type { AnthropicConfig } from "../config.js";
import type {
	Provider,
	Request,
	Response,
	Tool,
	ToolProperty,
} from "../types.js";

function convertToolProperties(
	properties: Record<string, ToolProperty>,
): Record<string, unknown> {
	const converted: Record<string, unknown> = {};
	for (const [key, prop] of Object.entries(properties)) {
		const property: Record<string, unknown> = {
			type: prop.type,
			description: prop.description,
		};

		if (prop.enum) {
			property.enum = prop.enum;
		}

		converted[key] = property;
	}
	return converted;
}

function convertTool(tool: Tool): AnthropicTool {
	return {
		name: tool.schema.name,
		description: tool.schema.description,
		input_schema: {
			type: "object",
			properties: convertToolProperties(tool.schema.parameters.properties),
			required: tool.schema.parameters.required,
		},
	};
}

export class AnthropicProvider implements Provider {
	private client: Anthropic;
	private model: string;
	private tools: Tool[] = [];

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
	}

	async chatBot(request: Request): Promise<Response> {
		if (!this.client) {
			throw new Error("Anthropic client is not initialized");
		}

		try {
			// Convert messages to Anthropic format
			const messages = this.convertMessagesToAnthropicFormat(request);

			// Prepare tools for Anthropic format
			const anthropicTools = this.tools.map((tool) => convertTool(tool));

			// Make the API call
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 4096,
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
							const tool = this.tools.find(
								(t) => t.schema.name === toolUse.name,
							);

							if (!tool) {
								throw new Error(`Tool not found: ${toolUse.name}`);
							}

							console.log(
								`Executing tool ${util.styleText("bold", tool.schema.name)} with args:`,
								JSON.stringify(toolUse.input),
							);

							const toolResult = await tool.run(toolUse.input as object);

							return {
								type: "tool_result" as const,
								tool_use_id: toolUse.id,
								content: JSON.stringify(toolResult),
							};
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
					max_tokens: 4096,
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
			console.error("Anthropic API error:", error);
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
