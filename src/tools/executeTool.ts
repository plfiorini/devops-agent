import type { Tool, ToolResultMessage } from "../types.ts";

export async function executeTool(
	id: string,
	name: string,
	input: unknown,
	tools: Map<string, Tool>,
): Promise<ToolResultMessage> {
	try {
		const tool = tools.get(name);
		if (!tool) {
			throw new Error(`Tool not found: ${name}`);
		}
		const validatedArgs = tool.inputSchema.parse(input);
		const rawResult = await tool.execute(validatedArgs);
		const validatedResult = tool.outputSchema.parse(rawResult);
		return {
			role: "tool",
			toolCallId: id,
			toolName: name,
			content: JSON.stringify(validatedResult),
		};
	} catch (error) {
		return {
			role: "tool",
			toolCallId: id,
			toolName: name,
			content: JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
			}),
			isError: true,
		};
	}
}

export async function executeToolFromJsonArgs(
	id: string,
	name: string,
	argumentsJson: string,
	tools: Map<string, Tool>,
): Promise<ToolResultMessage> {
	let input: unknown;
	try {
		input = JSON.parse(argumentsJson);
	} catch {
		return {
			role: "tool",
			toolCallId: id,
			toolName: name,
			content: JSON.stringify({ error: "Invalid JSON in tool arguments" }),
			isError: true,
		};
	}
	return executeTool(id, name, input, tools);
}
