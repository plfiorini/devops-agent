import type { MCPManager } from "../mcpManager.js";
import type { Tool } from "../types.ts";

export class MCPToolProxy implements Tool {
	name = "";
	description = "";
	inputSchema: unknown[] = [];
	outputSchema = [];

	private mcpManager: MCPManager;
	private serverId: string;
	private toolName: string;

	constructor(
		mcpManager: MCPManager,
		serverId: string,
		serverName: string,
		toolName: string,
		description: string,
		inputSchema: Record<string, unknown>,
	) {
		this.mcpManager = mcpManager;
		this.serverId = serverId;
		this.toolName = toolName;

		// Convert MCP schema to our tool schema format
		this.name = `mcp_${serverId}_${toolName}`;
		this.description = `[${serverName}] ${description}`;
		this.inputSchema = this.convertMCPSchema(inputSchema);
	}

	async execute(args: object): Promise<unknown> {
		try {
			return await this.mcpManager.callTool(
				this.serverId,
				this.toolName,
				args as Record<string, unknown>,
			);
		} catch (error) {
			throw new Error(
				`MCP tool ${this.toolName} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private convertMCPSchema(inputSchema: Record<string, unknown>): unknown[] {
		// Convert MCP schema format to tool schema format
		return Object.entries(inputSchema).map(([key, value]) => ({
			name: key,
			type: typeof value,
			description: `Parameter ${key}`,
			required: true, // Assume all parameters are required for simplicity
		}));
	}
}
