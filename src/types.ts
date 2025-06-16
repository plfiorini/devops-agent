/*
 * Providers
 */

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

export enum ToolSchemaType {
	/** String type. */
	STRING = "string",
	/** Number type. */
	NUMBER = "number",
	/** Integer type. */
	INTEGER = "integer",
	/** Boolean type. */
	BOOLEAN = "boolean",
}

export type ToolProperty = {
	/** The type of the parameter. */
	type: ToolSchemaType;
	/** A description of the parameter. */
	description: string;
	/** An optional enum for the parameter. */
	enum?: string[];
};

export type ToolSchema = {
	/** Unique name of the tool. */
	name: string;
	/** Description of what the tool does. */
	description: string;
	/** The schema for the tool's parameters. */
	parameters: {
		/** The list of properties of the tool. */
		properties: Record<string, ToolProperty>;
		/** A list of required parameters for the tool. */
		required: string[];
	};
};

export type ToolCall = {
	name: string;
	args: Record<string, unknown>;
};

export type ToolResult = {
	name: string;
	result: unknown;
	error?: string;
};

export interface Tool {
	schema: ToolSchema;

	run(args: object): Promise<unknown>;
}
