import type { Config, Provider as ConfigProvider } from "./config.ts";
import logger from "./logger.ts";
import { AnthropicProvider } from "./models/anthropic.ts";
import { GeminiProvider } from "./models/gemini.ts";
import { OllamaProvider } from "./models/ollama.ts";
import { OpenAIProvider } from "./models/openai.ts";
import { SystemPrompt } from "./systemPrompt.ts";
import loadTools from "./tools.ts";
import type { Message, Provider, Tool } from "./types.ts";

export type ProviderInfo = {
	name: string;
	enabled: boolean;
	isDefault: boolean;
};

export type AgentStatus = {
	initialized: boolean;
	activeProviderName?: string;
	activeModelName?: string;
	providers: ProviderInfo[];
	toolCount: number;
	conversationCount: number;
};

const providerLabels: Record<ConfigProvider, string> = {
	gemini: "Gemini",
	azure_openai: "Azure OpenAI",
	openai: "OpenAI",
	anthropic: "Anthropic",
	ollama: "Ollama",
};

export class Agent {
	private provider?: Provider = undefined;
	private providerName?: string = undefined;
	private modelName?: string = undefined;
	private initialized = false;
	private providerInfo: ProviderInfo[] = [];
	private conversationHistory: Message[] = [];
	private tools: Tool[] = [];

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
		const { config } = await import("./config.ts");
		this.providerInfo = this.buildProviderInfo(config);

		// Initialize provider based on default_provider configuration
		const defaultProvider = config.default_provider;

		if (defaultProvider === "gemini" && config.providers.gemini?.enabled) {
			logger.debug("Initializing with Gemini provider (default)");
			this.provider = new GeminiProvider(config.providers.gemini, this.tools);
			this.providerName = providerLabels.gemini;
			this.modelName = config.providers.gemini.model;
		} else if (
			defaultProvider === "azure_openai" &&
			config.providers.azure_openai?.enabled
		) {
			logger.debug("Initializing with Azure OpenAI provider (default)");
			this.provider = new OpenAIProvider(
				config.providers.azure_openai,
				this.tools,
			);
			this.providerName = providerLabels.azure_openai;
			this.modelName = config.providers.azure_openai.deployment_name;
		} else if (
			defaultProvider === "openai" &&
			config.providers.openai?.enabled
		) {
			logger.debug("Initializing with OpenAI provider (default)");
			this.provider = new OpenAIProvider(config.providers.openai, this.tools);
			this.providerName = providerLabels.openai;
			this.modelName = config.providers.openai.model;
		} else if (
			defaultProvider === "anthropic" &&
			config.providers.anthropic?.enabled
		) {
			logger.debug("Initializing with Anthropic provider (default)");
			this.provider = new AnthropicProvider(
				config.providers.anthropic,
				this.tools,
			);
			this.providerName = providerLabels.anthropic;
			this.modelName = config.providers.anthropic.model;
		} else if (
			defaultProvider === "ollama" &&
			config.providers.ollama?.enabled
		) {
			logger.debug("Initializing with Ollama provider (default)");
			this.provider = new OllamaProvider(config.providers.ollama, this.tools);
			this.providerName = providerLabels.ollama;
			this.modelName = config.providers.ollama.model;
		} else {
			// Fallback to any enabled provider if default is not available
			if (config.providers.ollama?.enabled) {
				logger.debug("Initializing with Ollama provider (fallback)");
				this.provider = new OllamaProvider(config.providers.ollama, this.tools);
				this.providerName = providerLabels.ollama;
				this.modelName = config.providers.ollama.model;
			} else if (config.providers.gemini?.enabled) {
				logger.debug("Initializing with Gemini provider (fallback)");
				this.provider = new GeminiProvider(config.providers.gemini, this.tools);
				this.providerName = providerLabels.gemini;
				this.modelName = config.providers.gemini.model;
			} else if (config.providers.azure_openai?.enabled) {
				logger.debug("Initializing with Azure OpenAI provider (fallback)");
				this.provider = new OpenAIProvider(
					config.providers.azure_openai,
					this.tools,
				);
				this.providerName = providerLabels.azure_openai;
				this.modelName = config.providers.azure_openai.deployment_name;
			} else if (config.providers.openai?.enabled) {
				logger.debug("Initializing with OpenAI provider (fallback)");
				this.provider = new OpenAIProvider(config.providers.openai, this.tools);
				this.providerName = providerLabels.openai;
				this.modelName = config.providers.openai.model;
			} else if (config.providers.anthropic?.enabled) {
				logger.debug("Initializing with Anthropic provider (fallback)");
				this.provider = new AnthropicProvider(
					config.providers.anthropic,
					this.tools,
				);
				this.providerName = providerLabels.anthropic;
				this.modelName = config.providers.anthropic.model;
			} else {
				throw new Error("No enabled provider configuration found");
			}
		}

		this.initialized = true;
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
		return [...this.providerInfo];
	}

	getStatus(): AgentStatus {
		return {
			initialized: this.initialized,
			activeProviderName: this.providerName,
			activeModelName: this.modelName,
			providers: this.getProviderInfo(),
			toolCount: this.tools.length,
			conversationCount: this.conversationHistory.length,
		};
	}

	private buildProviderInfo(config: Config): ProviderInfo[] {
		const providers: ProviderInfo[] = [];

		for (const provider of Object.keys(providerLabels) as ConfigProvider[]) {
			const providerConfig = config.providers[provider];
			if (!providerConfig) {
				continue;
			}

			providers.push({
				name: providerLabels[provider],
				enabled: providerConfig.enabled || false,
				isDefault: config.default_provider === provider,
			});
		}

		return providers;
	}
}
