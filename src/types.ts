/*
 * Providers
 */

import type z from "zod/v4";

export type Message = {
	role: "user" | "assistant" | "system";
	content: string;
};

export type Request = {
	systemPrompt: string;
	messages: Message[];
};

export type Response = {
	content: string;
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
