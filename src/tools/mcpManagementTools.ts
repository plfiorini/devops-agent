import type { MCPManager } from "../mcpManager.js";
import type { Tool } from "../types.js";

export class MCPListToolsTool implements Tool {
	name = "mcp_list_tools";
	description = "List all available tools from connected MCP servers";
	inputSchema = [];
	outputSchema = [];

	constructor(private mcpManager: MCPManager) {}

	async execute(): Promise<unknown> {
		try {
			const tools = await this.mcpManager.getAvailableTools();
			return {
				tools: tools.map((tool) => ({
					server: tool.serverName,
					name: tool.name,
					description: tool.description,
				})),
				total: tools.length,
			};
		} catch (error) {
			throw new Error(
				`Failed to list MCP tools: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

export class MCPListResourcesTool implements Tool {
	name = "mcp_list_resources";
	description = "List all available resources from connected MCP servers";
	inputSchema = [];
	outputSchema = [];

	constructor(private mcpManager: MCPManager) {}

	async execute(): Promise<unknown> {
		try {
			const resources = await this.mcpManager.getAvailableResources();
			return {
				resources: resources.map((resource) => ({
					server: resource.serverName,
					name: resource.name,
					uri: resource.uri,
					description: resource.description,
					mimeType: resource.mimeType,
				})),
				total: resources.length,
			};
		} catch (error) {
			throw new Error(
				`Failed to list MCP resources: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

export class MCPListPromptsTool implements Tool {
	name = "mcp_list_prompts";
	description = "List all available prompts from connected MCP servers";
	inputSchema = [];
	outputSchema = [];

	constructor(private mcpManager: MCPManager) {}

	async execute(): Promise<unknown> {
		try {
			const prompts = await this.mcpManager.getAvailablePrompts();
			return {
				prompts: prompts.map((prompt) => ({
					server: prompt.serverName,
					name: prompt.name,
					description: prompt.description,
					arguments: prompt.arguments,
				})),
				total: prompts.length,
			};
		} catch (error) {
			throw new Error(
				`Failed to list MCP prompts: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

export class MCPServerStatusTool implements Tool {
	name = "mcp_server_status";
	description = "Show status of connected MCP servers";
	inputSchema = [];
	outputSchema = [];

	constructor(private mcpManager: MCPManager) {}

	async execute(): Promise<unknown> {
		try {
			const servers = this.mcpManager.getConnectedServers();
			return {
				servers: servers.map((server) => ({
					id: server.id,
					name: server.name,
					command: server.config.command,
					args: server.config.args,
					enabled: server.config.enabled,
					connected: this.mcpManager.isServerConnected(server.id),
				})),
				total: servers.length,
			};
		} catch (error) {
			throw new Error(
				`Failed to get MCP server status: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
