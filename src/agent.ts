import { config } from "./config.ts";
import logger from "./logger.ts";
import { MCPManager } from "./mcpManager.ts";
import { AnthropicProvider } from "./models/anthropic.ts";
import { GeminiProvider } from "./models/gemini.ts";
import { OpenAIProvider } from "./models/openai.ts";
import { SystemPrompt } from "./systemPrompt.ts";
import loadTools from "./tools.ts";
import { MCPListPromptsTool, MCPListResourcesTool, MCPListToolsTool, MCPServerStatusTool } from "./tools/mcpManagementTools.ts";
import { MCPToolProxy } from "./tools/mcpToolProxy.ts";
import type { Message, Provider, Tool } from "./types.ts";

export class Agent {
	private provider?: Provider = undefined;
	private conversationHistory: Message[] = [];
	private tools: Tool[] = [];
	private mcpManager: MCPManager = new MCPManager();

	public getAvailableTools(): Tool[] {
		return this.tools;
	}

	/**
	 * Get conversation history
	 */
	getConversationHistory(): Message[] {
		return [...this.conversationHistory];
	}

	/**
	 * Clear conversation history but keep system prompt
	 */
	clearConversationHistory(): void {
		this.conversationHistory = [];
	}

	/**
	 * Create LLM provider and add tools to the agent.
	 */
	async initialize(): Promise<void> {
		this.tools = await loadTools();

		// Initialize MCP servers and tools
		await this.initializeMCP();

		// Initialize provider based on default_provider configuration
		const defaultProvider = config.default_provider;

		if (defaultProvider === "gemini" && config.providers.gemini?.enabled) {
			logger.debug("Initializing with Gemini provider (default)");
			this.provider = new GeminiProvider(config.providers.gemini, this.tools);
		} else if (
			defaultProvider === "azure_openai" &&
			config.providers.azure_openai?.enabled
		) {
			logger.debug("Initializing with Azure OpenAI provider (default)");
			this.provider = new OpenAIProvider(
				config.providers.azure_openai,
				this.tools,
			);
		} else if (
			defaultProvider === "openai" &&
			config.providers.openai?.enabled
		) {
			logger.debug("Initializing with OpenAI provider (default)");
			this.provider = new OpenAIProvider(config.providers.openai, this.tools);
		} else if (
			defaultProvider === "anthropic" &&
			config.providers.anthropic?.enabled
		) {
			logger.debug("Initializing with Anthropic provider (default)");
			this.provider = new AnthropicProvider(
				config.providers.anthropic,
				this.tools,
			);
		} else {
			// Fallback to any enabled provider if default is not available
			if (config.providers.gemini?.enabled) {
				logger.debug("Initializing with Gemini provider (fallback)");
				this.provider = new GeminiProvider(config.providers.gemini, this.tools);
			} else if (config.providers.azure_openai?.enabled) {
				logger.debug("Initializing with Azure OpenAI provider (fallback)");
				this.provider = new OpenAIProvider(
					config.providers.azure_openai,
					this.tools,
				);
			} else if (config.providers.openai?.enabled) {
				logger.debug("Initializing with OpenAI provider (fallback)");
				this.provider = new OpenAIProvider(config.providers.openai, this.tools);
			} else if (config.providers.anthropic?.enabled) {
				logger.debug("Initializing with Anthropic provider (fallback)");
				this.provider = new AnthropicProvider(
					config.providers.anthropic,
					this.tools,
				);
			} else {
				throw new Error("No enabled provider configuration found");
			}
		}
	}

	/**
	 * Initialize MCP servers and add MCP tools
	 */
	private async initializeMCP(): Promise<void> {
		// Connect to configured MCP servers
		if (config.mcp?.servers) {
			console.debug("Initializing MCP servers...");

			for (const [serverId, serverConfig] of Object.entries(
				config.mcp.servers,
			)) {
				if (serverConfig.enabled) {
					try {
						await this.mcpManager.connectServer(serverId, serverConfig);
						console.log(`✓ Connected to MCP server: ${serverConfig.name}`);
					} catch (error) {
						console.error(
							`✗ Failed to connect to MCP server ${serverId}:`,
							error,
						);
					}
				}
			}

			// Add MCP management tools
			this.tools.push(new MCPListToolsTool(this.mcpManager));
			this.tools.push(new MCPListResourcesTool(this.mcpManager));
			this.tools.push(new MCPListPromptsTool(this.mcpManager));
			this.tools.push(new MCPServerStatusTool(this.mcpManager));

			// Get available tools from MCP servers and create proxy tools
			try {
				const mcpTools = await this.mcpManager.getAvailableTools();
				for (const mcpTool of mcpTools) {
					const proxyTool = new MCPToolProxy(
						this.mcpManager,
						mcpTool.serverId,
						mcpTool.serverName,
						mcpTool.name,
						mcpTool.description,
						mcpTool.inputSchema,
					);
					this.tools.push(proxyTool);
				}
				console.debug(`✓ Added ${mcpTools.length} MCP tools`);
			} catch (error) {
				console.error("Failed to get MCP tools:", error);
			}
		}
	}

	/**
	 * Process a user message and potentially execute tools
	 */
	async processMessage(userMessage: string): Promise<string> {
		if (!this.provider) {
			throw new Error(
				"Agent provider is not initialized. Call initialize() first.",
			);
		}

		try {
			// Add user message to history
			this.conversationHistory.push({
				role: "user",
				content: userMessage,
			});

			// Create request with system prompt and conversation history
			const request = {
				systemPrompt: SystemPrompt,
				messages: this.conversationHistory,
			};

			// Get response from provider
			const response = await this.provider.chatBot(request);

			// Add assistant response to history
			this.conversationHistory.push({
				role: "assistant",
				content: response.content,
			});

			return response.content;
		} catch (error) {
			logger.error("Agent processing error:", error);
			throw new Error(
				`Failed to process message: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get information about available providers
	 */
	getProviderInfo(): { name: string; enabled: boolean; isDefault: boolean }[] {
		const providers: { name: string; enabled: boolean; isDefault: boolean }[] =
			[];

		if (config.providers.gemini) {
			providers.push({
				name: "Gemini",
				enabled: config.providers.gemini.enabled || false,
				isDefault: config.default_provider === "gemini",
			});
		}

		if (config.providers.azure_openai) {
			providers.push({
				name: "Azure OpenAI",
				enabled: config.providers.azure_openai.enabled || false,
				isDefault: config.default_provider === "azure_openai",
			});
		}

		if (config.providers.openai) {
			providers.push({
				name: "OpenAI",
				enabled: config.providers.openai.enabled || false,
				isDefault: config.default_provider === "openai",
			});
		}

		return providers;
	}

	/**
	 * Cleanup resources, disconnect from MCP servers
	 */
	async cleanup(): Promise<void> {
		console.log("Cleaning up agent resources...");
		await this.mcpManager.disconnectAll();
	}

	/**
	 * Get MCP manager instance for advanced operations
	 */
	getMCPManager(): MCPManager {
		return this.mcpManager;
	}
}
