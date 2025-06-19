import type { MCPManager } from "../mcpManager.js";
import { ToolSchemaType } from "../types.js";
import type { Tool, ToolProperty, ToolSchema } from "../types.js";

export class MCPToolProxy implements Tool {
	schema: ToolSchema;
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
		this.schema = {
			name: `mcp_${serverId}_${toolName}`,
			description: `[${serverName}] ${description}`,
			parameters: this.convertMCPSchema(inputSchema),
		};
	}

	private convertMCPSchema(inputSchema: Record<string, unknown>): {
		properties: Record<string, ToolProperty>;
		required: string[];
	} {
		const properties: Record<string, ToolProperty> = {};
		const required: string[] = [];

		// Handle JSON Schema format from MCP
		if (inputSchema.type === "object" && inputSchema.properties) {
			const props = inputSchema.properties as Record<string, unknown>;
			const requiredProps = (inputSchema.required as string[]) || [];

			for (const [propName, propDef] of Object.entries(props)) {
				const propDefObj = propDef as Record<string, unknown>;
				const toolProperty: ToolProperty = {
					type: this.mapJsonSchemaType(propDefObj.type as string),
					description: (propDefObj.description as string) || "",
				};

				if (propDefObj.enum && Array.isArray(propDefObj.enum)) {
					toolProperty.enum = propDefObj.enum as string[];
				}

				properties[propName] = toolProperty;
			}

			required.push(...requiredProps);
		}

		return { properties, required };
	}

	private mapJsonSchemaType(jsonSchemaType: string): ToolSchemaType {
		switch (jsonSchemaType) {
			case "string":
				return ToolSchemaType.STRING;
			case "number":
				return ToolSchemaType.NUMBER;
			case "integer":
				return ToolSchemaType.INTEGER;
			case "boolean":
				return ToolSchemaType.BOOLEAN;
			default:
				return ToolSchemaType.STRING;
		}
	}

	async run(args: object): Promise<unknown> {
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
}
