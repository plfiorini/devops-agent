/*
 * Providers
 */

import type z from "zod/v4";

export const MAX_TOOL_ITERATIONS = 8;

export type ToolCall = {
	id: string;
	name: string;
	arguments: unknown;
};

export type TextMessage = {
	role: "user" | "assistant" | "system";
	content: string;
};

export type AssistantToolCallMessage = {
	role: "assistant";
	content: string;
	toolCalls: ToolCall[];
};

export type ToolResultMessage = {
	role: "tool";
	toolCallId: string;
	toolName: string;
	content: string;
	isError?: boolean;
};

export type Message =
	| TextMessage
	| AssistantToolCallMessage
	| ToolResultMessage;

export type Request = {
	systemPrompt: string;
	messages: Message[];
};

export type Response = {
	content: string;
	messages: Message[];
};

export interface Provider {
	chatBot(request: Request): Promise<Response>;
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
}

// biome-ignore lint/suspicious/noExplicitAny: We use `any` here to allow flexibility in the tool's schema type.
export type Tool = GenericTool<any, any>;
