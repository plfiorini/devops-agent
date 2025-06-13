import * as util from "node:util";
import { OpenAI } from "openai";
import { OpenAIConfig } from "../config.js";
import {
    Provider,
    Request,
    Response,
    Tool,
    ToolProperty
} from "../types.js";

function convertToolProperties(
    properties: Record<string, ToolProperty>
): Record<string, any> {
    const converted: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties)) {
        const property: any = {
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

function convertTool(tool: Tool): any {
    return {
        type: "function",
        function: {
            name: tool.schema.name,
            description: tool.schema.description,
            parameters: {
                type: "object",
                properties: convertToolProperties(tool.schema.parameters.properties),
                required: tool.schema.parameters.required,
            },
        },
    };
}

export class OpenAIProvider implements Provider {
    private client: OpenAI;
    private model: string;
    private tools: Tool[] = [];

    constructor(config: OpenAIConfig, tools: Tool[]) {
        if (!config.api_key) {
            throw new Error("OpenAI API key is required");
        }

        if (!config.model) {
            throw new Error("OpenAI model is required");
        }

        const clientConfig: any = {
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
        this.tools = tools;
    }

    async chatBot(request: Request): Promise<Response> {
        if (!this.client) {
            throw new Error("OpenAI client is not initialized");
        }

        try {
            // Convert messages to OpenAI format
            const messages = this.convertMessagesToOpenAIFormat(request);

            // Prepare tools for OpenAI format
            const openAITools = this.tools.map((tool) => convertTool(tool));

            // Make the API call
            const chatCompletion = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                tools: openAITools.length > 0 ? openAITools : undefined,
                tool_choice: openAITools.length > 0 ? "auto" : undefined,
            });

            const responseMessage = chatCompletion.choices[0]?.message;
            if (!responseMessage) {
                throw new Error("No response from OpenAI");
            }

            // Check if the model wants to call tools
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // Execute tool calls
                const toolResults = await Promise.all(
                    responseMessage.tool_calls.map(async (toolCall) => {
                        try {
                            const tool = this.tools.find(
                                (t) => t.schema.name === toolCall.function.name
                            );

                            if (!tool) {
                                throw new Error(`Tool not found: ${toolCall.function.name}`);
                            }

                            console.log(
                                `Executing tool ${util.styleText("bold", tool.schema.name)} with args:`,
                                toolCall.function.arguments
                            );

                            const args = JSON.parse(toolCall.function.arguments);
                            const toolResult = await tool.run(args);

                            return {
                                tool_call_id: toolCall.id,
                                role: "tool" as const,
                                content: JSON.stringify(toolResult),
                            };
                        } catch (error) {
                            return {
                                tool_call_id: toolCall.id,
                                role: "tool" as const,
                                content: JSON.stringify({
                                    error: error instanceof Error ? error.message : String(error),
                                }),
                            };
                        }
                    })
                );

                // Make a follow-up call with tool results
                const followUpMessages = [
                    ...messages,
                    responseMessage,
                    ...toolResults,
                ];

                const followUpCompletion = await this.client.chat.completions.create({
                    model: this.model,
                    messages: followUpMessages,
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
            console.error("OpenAI API error:", error);
            throw new Error(
                `Failed to get response from OpenAI: ${error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private convertMessagesToOpenAIFormat(request: Request): any[] {
        const messages: any[] = [
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
