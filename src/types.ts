import type z from "zod/v4";

export type ProviderInfo = {
	name: string;
	enabled: boolean;
	isDefault: boolean;
};

export type ToolCall = {
	id: string;
	name: string;
	arguments: unknown;
};

export type TextMessage = {
	role: "user" | "assistant" | "system";
	content: string;
	options?: Record<string, unknown>;
};

export type AssistantToolCallMessage = {
	role: "assistant";
	thinking?: string;
	content: string;
	toolCalls: ToolCall[];
};

export type ToolResultMessage = {
	role: "tool";
	toolCallId: string;
	toolName: string;
	content: string;
	displayContent?: string;
	isError?: boolean;
};

export type Message =
	| TextMessage
	| AssistantToolCallMessage
	| ToolResultMessage;

export interface ProviderInterface {
	getProviderName(): string;
	getModelName(): string;
	setModelName(model: string): void;
	getSupportedModels(): Promise<string[]>;
	getMessagesCount(): number;
	clearMessages(): void;
	agentLoop(prompt: string): AsyncGenerator<Message>;
}

/*
 * Tools
 */

// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility in the tool's schema type.
export type ToolSchema = z.ZodType<any, any>;

export interface GenericTool<
	Input extends ToolSchema,
	Output extends ToolSchema,
> {
	name: string;
	description: string;
	inputSchema: Input;
	outputSchema: Output;
	execute: (args: z.infer<Input>) => Promise<z.infer<Output>> | z.infer<Output>;
	isError?: (result: z.infer<Output>) => boolean;
	formatResult?: (result: z.infer<Output>) => string;
}

// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility in the tool's schema type.
export type Tool = GenericTool<any, any>;
