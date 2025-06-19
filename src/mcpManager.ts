import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import type {
	MCPClient,
	MCPPrompt,
	MCPResource,
	MCPServerConfig,
	MCPTool,
} from "./types/mcp.js";

export class MCPManager {
	private clients: Map<string, MCPClient> = new Map();

	/**
	 * Connect to an MCP server
	 */
	async connectServer(
		serverId: string,
		config: MCPServerConfig,
	): Promise<void> {
		if (this.clients.has(serverId)) {
			console.warn(`MCP server ${serverId} is already connected`);
			return;
		}

		try {
			console.log(`Connecting to MCP server: ${config.name}`);

			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: config.env,
			});

			const client = new Client(
				{
					name: "devops-agent",
					version: packageJson.version,
				},
				{
					capabilities: {
						tools: {},
						resources: {},
						prompts: {},
					},
				},
			);

			await client.connect(transport);

			console.log(`Connected to MCP server: ${config.name}`);

			this.clients.set(serverId, {
				name: config.name,
				client,
				transport,
				config,
				connected: true,
			});
		} catch (error) {
			console.error(`Failed to connect to MCP server ${serverId}:`, error);
			throw error;
		}
	}

	/**
	 * Disconnect from an MCP server
	 */
	async disconnectServer(serverId: string): Promise<void> {
		const mcpClient = this.clients.get(serverId);
		if (!mcpClient) {
			console.warn(`MCP server ${serverId} is not connected`);
			return;
		}

		try {
			await mcpClient.client.close();
			this.clients.delete(serverId);
			console.log(`Disconnected from MCP server: ${mcpClient.name}`);
		} catch (error) {
			console.error(`Failed to disconnect from MCP server ${serverId}:`, error);
		}
	}

	/**
	 * Disconnect from all MCP servers
	 */
	async disconnectAll(): Promise<void> {
		const disconnectPromises = Array.from(this.clients.keys()).map((serverId) =>
			this.disconnectServer(serverId),
		);
		await Promise.all(disconnectPromises);
	}

	/**
	 * Get all available tools from connected MCP servers
	 */
	async getAvailableTools(): Promise<MCPTool[]> {
		const tools: MCPTool[] = [];

		for (const [serverId, mcpClient] of this.clients) {
			if (!mcpClient.connected) continue;

			try {
				const response = await mcpClient.client.listTools();
				for (const tool of response.tools) {
					tools.push({
						serverId,
						serverName: mcpClient.name,
						name: tool.name,
						description: tool.description || "",
						inputSchema: tool.inputSchema,
					});
				}
			} catch (error) {
				console.error(
					`Failed to get tools from MCP server ${serverId}:`,
					error,
				);
			}
		}

		return tools;
	}

	/**
	 * Get all available resources from connected MCP servers
	 */
	async getAvailableResources(): Promise<MCPResource[]> {
		const resources: MCPResource[] = [];

		for (const [serverId, mcpClient] of this.clients) {
			if (!mcpClient.connected) continue;

			try {
				const response = await mcpClient.client.listResources();
				for (const resource of response.resources) {
					resources.push({
						serverId,
						serverName: mcpClient.name,
						uri: resource.uri,
						name: resource.name,
						description: resource.description,
						mimeType: resource.mimeType,
					});
				}
			} catch (error) {
				console.error(
					`Failed to get resources from MCP server ${serverId}:`,
					error,
				);
			}
		}

		return resources;
	}

	/**
	 * Get all available prompts from connected MCP servers
	 */
	async getAvailablePrompts(): Promise<MCPPrompt[]> {
		const prompts: MCPPrompt[] = [];

		for (const [serverId, mcpClient] of this.clients) {
			if (!mcpClient.connected) continue;

			try {
				const response = await mcpClient.client.listPrompts();
				for (const prompt of response.prompts) {
					prompts.push({
						serverId,
						serverName: mcpClient.name,
						name: prompt.name,
						description: prompt.description,
						arguments: prompt.arguments,
					});
				}
			} catch (error) {
				console.error(
					`Failed to get prompts from MCP server ${serverId}:`,
					error,
				);
			}
		}

		return prompts;
	}

	/**
	 * Call a tool on an MCP server
	 */
	async callTool(
		serverId: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const mcpClient = this.clients.get(serverId);
		if (!mcpClient || !mcpClient.connected) {
			throw new Error(`MCP server ${serverId} is not connected`);
		}

		try {
			const response = await mcpClient.client.callTool({
				name: toolName,
				arguments: args,
			});
			return response.content;
		} catch (error) {
			console.error(
				`Failed to call tool ${toolName} on MCP server ${serverId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Read a resource from an MCP server
	 */
	async readResource(serverId: string, uri: string): Promise<unknown> {
		const mcpClient = this.clients.get(serverId);
		if (!mcpClient || !mcpClient.connected) {
			throw new Error(`MCP server ${serverId} is not connected`);
		}

		try {
			const response = await mcpClient.client.readResource({ uri });
			return response.contents;
		} catch (error) {
			console.error(
				`Failed to read resource ${uri} from MCP server ${serverId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Get a prompt from an MCP server
	 */
	async getPrompt(
		serverId: string,
		promptName: string,
		args?: Record<string, string>,
	): Promise<unknown> {
		const mcpClient = this.clients.get(serverId);
		if (!mcpClient || !mcpClient.connected) {
			throw new Error(`MCP server ${serverId} is not connected`);
		}

		try {
			const response = await mcpClient.client.getPrompt({
				name: promptName,
				arguments: args,
			});
			return response.messages;
		} catch (error) {
			console.error(
				`Failed to get prompt ${promptName} from MCP server ${serverId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Get connected servers info
	 */
	getConnectedServers(): Array<{
		id: string;
		name: string;
		config: MCPServerConfig;
	}> {
		return Array.from(this.clients.entries()).map(([id, client]) => ({
			id,
			name: client.name,
			config: client.config,
		}));
	}

	/**
	 * Check if a server is connected
	 */
	isServerConnected(serverId: string): boolean {
		const client = this.clients.get(serverId);
		return client?.connected || false;
	}
}
