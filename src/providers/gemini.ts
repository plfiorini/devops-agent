import {
	type Content,
	type FunctionCall as GeminiFunctionCall,
	type Tool as GeminiTool,
	GoogleGenAI,
	type Part,
} from "@google/genai";
import type { GeminiConfig } from "../config.ts";
import logger from "../logger.ts";
import { SystemPrompt } from "../systemPrompt.ts";
import type {
	AssistantToolCallMessage,
	Message,
	ProviderInterface,
	TextMessage,
	Tool,
	ToolCall,
	ToolResultMessage,
} from "../types.ts";

const DEFAULT_TEMPERATURE = 0.65;
const DEFAULT_MAX_TOKENS = 1024;

export class GeminiProvider implements ProviderInterface {
	private genAI: GoogleGenAI;
	private model: string;
	private availableModels: string[] = [];
	private temperature: number;
	private maxTokens: number;
	private executableTools: Tool[] = [];
	private tools: GeminiTool[] = [];
	private messages: Content[] = [];

	constructor(config: GeminiConfig, tools: Tool[]) {
		if (!config.api_key) {
			throw new Error("Google API key is required");
		}
		if (!config.model) {
			throw new Error("Gemini model is required");
		}

		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		if (this.temperature < 0 || this.temperature > 1) {
			throw new Error("temperature must be between 0 and 1");
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

		this.genAI = new GoogleGenAI({ apiKey: config.api_key });

		this.model = config.model;
		this.executableTools = tools;
		this.tools = this.convertTools(tools);

		this.clearMessages();
	}

	getProviderName(): string {
		return "gemini";
	}

	getModelName(): string {
		return this.model;
	}

	setModelName(model: string): void {
		this.model = model;
	}

	getMessagesCount(): number {
		return this.messages.length;
	}

	clearMessages(): void {
		this.messages = [];
	}

	async getSupportedModels(): Promise<string[]> {
		if (this.availableModels.length > 0) {
			return this.availableModels;
		}

		try {
			const pager = await this.genAI.models.list({
				config: { pageSize: 10 },
			});
			let page = pager.page;
			while (true) {
				for (const model of page) {
					if (model.name) {
						// Gemini returns names as "models/gemini-1.5-pro"; strip the prefix
						// so the identifier matches what users pass to /model and config.yaml.
						const name = model.name.startsWith("models/")
							? model.name.slice("models/".length)
							: model.name;
						this.availableModels.push(name);
					}
				}
				if (!pager.hasNextPage()) {
					break;
				}
				page = await pager.nextPage();
			}
			return this.availableModels;
		} catch (error) {
			logger.error("Failed to fetch available models from Gemini:", error);
			return [];
		}
	}

	async *agentLoop(prompt: string): AsyncGenerator<Message> {
		try {
			// Add user message to history
			this.messages.push({ role: "user", parts: [{ text: prompt }] });

			while (true) {
				const stream = await this.genAI.models.generateContentStream({
					model: this.model,
					contents: this.messages,
					config: {
						systemInstruction: SystemPrompt,
						temperature: this.temperature,
						maxOutputTokens: this.maxTokens,
						tools: this.tools.length > 0 ? this.tools : undefined,
					},
				});

				let text = "";
				const functionCalls: GeminiFunctionCall[] = [];

				for await (const chunk of stream) {
					if (chunk.text) {
						text += chunk.text;
					}
					if (chunk.functionCalls?.length) {
						functionCalls.push(...chunk.functionCalls);
					}
				}

				// Build model content from accumulated parts
				const parts: Part[] = [];
				if (text) {
					parts.push({ text });
				}
				for (const fc of functionCalls) {
					parts.push({ functionCall: fc });
				}

				if (parts.length > 0) {
					const modelContent: Content = { role: "model", parts };
					this.messages.push(modelContent);

					if (functionCalls.length > 0) {
						const toolCalls: ToolCall[] = functionCalls.map((fc) => ({
							id: fc.id ?? crypto.randomUUID(),
							name: fc.name ?? "",
							arguments: fc.args ?? {},
						}));
						yield {
							role: "assistant",
							content: text,
							toolCalls,
						} as AssistantToolCallMessage;
					} else {
						yield { role: "assistant", content: text } as TextMessage;
					}
				}

				if (functionCalls.length === 0) {
					break;
				}

				// Execute tools and collect responses
				const responseParts: Part[] = [];
				for (const fc of functionCalls) {
					const toolName = fc.name ?? "";
					const toolId = fc.id ?? crypto.randomUUID();
					const tool = this.executableTools.find((t) => t.name === toolName);

					let resultContent: string;
					let displayContent: string | undefined;
					let isError = false;
					if (tool) {
						const args = (fc.args ?? {}) as Record<string, unknown>;
						const validatedArgs = tool.inputSchema.parse(args);
						if (!validatedArgs) {
							throw new Error("Invalid tool arguments");
						}
						const result = await tool.execute(validatedArgs);
						const validatedResult = tool.outputSchema.parse(result);
						if (!validatedResult) {
							throw new Error("Invalid tool result");
						}
						resultContent =
							typeof result === "string" ? result : JSON.stringify(result);
						displayContent = tool.formatResult?.(result);
						if (tool.isError?.(result)) {
							isError = true;
						}
					} else {
						resultContent = "Unknown tool";
						isError = true;
					}

					responseParts.push({
						functionResponse: {
							id: toolId,
							name: toolName,
							response: { output: resultContent },
						},
					});

					yield {
						role: "tool",
						toolCallId: toolId,
						toolName,
						content: resultContent,
						displayContent,
						isError,
					} as ToolResultMessage;
				}

				// Add all tool responses as a single user content
				this.messages.push({ role: "user", parts: responseParts });
			}
		} catch (error) {
			logger.error("Gemini streaming error:", error);
			throw error;
		}
	}

	private convertTools(tools: Tool[]): GeminiTool[] {
		if (!tools?.length) {
			return [];
		}

		const functionDeclarations = tools
			.map((tool) => {
				if (!tool?.name) {
					return null;
				}

				const schema = tool.inputSchema;

				const declaration: Record<string, unknown> = {
					name: tool.name,
					description: tool.description || "",
				};

				if (schema) {
					declaration.parametersJsonSchema =
						this.mapZodTypeToJSONSchemaType(schema);
				}

				return declaration;
			})
			.filter((d): d is Record<string, unknown> => d !== null);

		if (!functionDeclarations.length) {
			return [];
		}

		return [{ functionDeclarations } as GeminiTool];
	}

	private mapZodTypeToJSONSchemaType(schema: unknown): unknown {
		if (!schema) {
			return { type: "object", properties: {} };
		}

		const s = schema as Record<string, unknown> & {
			_def?: {
				typeName?: string;
				type?: unknown;
				shape?: unknown;
				values?: unknown[];
				innerType?: unknown;
			};
			toJSON?: () => unknown;
			type?: string;
		};

		if (typeof s.toJSON === "function") {
			return s.toJSON();
		}

		if (s._def?.typeName) {
			const typeName: string = s._def.typeName as string;

			if (typeName.endsWith("String")) {
				return { type: "string" };
			}

			if (typeName.endsWith("Number")) {
				return { type: "number" };
			}

			if (typeName.endsWith("Boolean")) {
				return { type: "boolean" };
			}

			if (typeName.endsWith("Array")) {
				return {
					type: "array",
					items: this.mapZodTypeToJSONSchemaType(s._def.type),
				};
			}

			if (typeName.endsWith("Enum")) {
				return {
					type: "string",
					enum: s._def.values || [],
				};
			}

			if (typeName.endsWith("Optional") || typeName.endsWith("Nullable")) {
				return this.mapZodTypeToJSONSchemaType(s._def.innerType);
			}

			if (typeName.endsWith("Object")) {
				const shape =
					typeof s._def.shape === "function"
						? (s._def.shape as () => Record<string, unknown>)()
						: (s._def.shape as Record<string, unknown>) || {};
				const properties: Record<string, unknown> = {};
				const required: string[] = [];

				for (const [key, value] of Object.entries(shape)) {
					properties[key] = this.mapZodTypeToJSONSchemaType(value);
					const valueDef = (value as { _def?: { typeName?: string } })?._def
						?.typeName;
					const isOptional =
						typeof valueDef === "string" &&
						(valueDef.endsWith("Optional") || valueDef.endsWith("Default"));
					if (!isOptional) {
						required.push(key);
					}
				}

				return {
					type: "object",
					properties,
					...(required.length > 0 ? { required } : {}),
				};
			}
		}

		if (typeof s === "object" && s.type) {
			return s;
		}

		return { type: "object", properties: {} };
	}
}
