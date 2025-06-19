import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export interface MCPServerConfig {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
	enabled: boolean;
	description?: string;
}

export interface MCPClient {
	name: string;
	client: Client;
	transport: Transport;
	config: MCPServerConfig;
	connected: boolean;
}

export interface MCPTool {
	serverId: string;
	serverName: string;
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface MCPResource {
	serverId: string;
	serverName: string;
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
}

export interface MCPPrompt {
	serverId: string;
	serverName: string;
	name: string;
	description?: string;
	arguments?: Array<{
		name: string;
		description?: string;
		required?: boolean;
	}>;
}
