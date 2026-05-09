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

const fallbackOrder: ConfigProvider[] = [
	"ollama",
	"gemini",
	"azure_openai",
	"openai",
	"anthropic",
];

type ProviderResult = { provider: Provider; modelName: string };
type ProviderFactory = (
	config: Config,
	tools: Tool[],
	model?: string,
) => ProviderResult;

const providerFactories: Record<ConfigProvider, ProviderFactory> = {
	gemini: (config, tools, model) => {
		const cfg = model
			? { ...config.providers.gemini!, model }
			: config.providers.gemini!;
		return { provider: new GeminiProvider(cfg, tools), modelName: cfg.model };
	},
	azure_openai: (config, tools, model) => {
		// azure_openai uses deployment_name instead of model
		const cfg = model
			? { ...config.providers.azure_openai!, deployment_name: model }
			: config.providers.azure_openai!;
		return {
			provider: new OpenAIProvider(cfg, tools),
			modelName: cfg.deployment_name,
		};
	},
	openai: (config, tools, model) => {
		const cfg = model
			? { ...config.providers.openai!, model }
			: config.providers.openai!;
		return { provider: new OpenAIProvider(cfg, tools), modelName: cfg.model };
	},
	anthropic: (config, tools, model) => {
		const cfg = model
			? { ...config.providers.anthropic!, model }
			: config.providers.anthropic!;
		return {
			provider: new AnthropicProvider(cfg, tools),
			modelName: cfg.model,
		};
	},
	ollama: (config, tools, model) => {
		const cfg = model
			? { ...config.providers.ollama!, model }
			: config.providers.ollama!;
		return { provider: new OllamaProvider(cfg, tools), modelName: cfg.model };
	},
};

export class Agent {
	private provider?: Provider = undefined;
	private providerKey?: ConfigProvider = undefined;
	private providerName?: string = undefined;
	private modelName?: string = undefined;
	private initialized = false;
	private providerInfo: ProviderInfo[] = [];
	private conversationHistory: Message[] = [];
	private tools: Tool[] = [];

	public getAvailableTools(): Tool[] {
		return this.tools;
	}

	getConversationHistory(): Message[] {
		return [...this.conversationHistory];
	}

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

		const defaultProvider = config.default_provider;
		let resolvedKey: ConfigProvider | undefined;

		if (defaultProvider === "gemini" && config.providers.gemini?.enabled) {
			resolvedKey = "gemini";
		} else if (
			defaultProvider === "azure_openai" &&
			config.providers.azure_openai?.enabled
		) {
			resolvedKey = "azure_openai";
		} else if (
			defaultProvider === "openai" &&
			config.providers.openai?.enabled
		) {
			resolvedKey = "openai";
		} else if (
			defaultProvider === "anthropic" &&
			config.providers.anthropic?.enabled
		) {
			resolvedKey = "anthropic";
		} else if (
			defaultProvider === "ollama" &&
			config.providers.ollama?.enabled
		) {
			resolvedKey = "ollama";
		} else {
			for (const key of fallbackOrder) {
				if (config.providers[key]?.enabled) {
					resolvedKey = key;
					break;
				}
			}
		}

		if (!resolvedKey) {
			throw new Error("No enabled provider configuration found");
		}

		logger.debug(`Initializing with ${providerLabels[resolvedKey]} provider`);
		this.instantiateProvider(resolvedKey, config);
		this.initialized = true;
	}

	/**
	 * Switch the active provider at runtime. Clears conversation history.
	 */
	async switchProvider(providerKey: string, model?: string): Promise<void> {
		const { config } = await import("./config.ts");

		const knownProviders = Object.keys(providerLabels) as ConfigProvider[];
		if (!knownProviders.includes(providerKey as ConfigProvider)) {
			throw new Error(
				`Unknown provider "${providerKey}". Valid: ${knownProviders.join(", ")}`,
			);
		}

		const key = providerKey as ConfigProvider;
		if (!config.providers[key]?.enabled) {
			throw new Error(
				`Provider "${providerKey}" is not enabled in config.yaml`,
			);
		}

		this.instantiateProvider(key, config, model);
		this.conversationHistory = [];
	}

	/**
	 * Change the model for the current provider. Does not clear conversation history.
	 */
	async switchModel(model: string): Promise<void> {
		if (!this.providerKey) {
			throw new Error("No active provider to change model for");
		}
		const { config } = await import("./config.ts");
		this.instantiateProvider(this.providerKey, config, model);
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
			this.conversationHistory.push({
				role: "user",
				content: userMessage,
			});

			const request = {
				systemPrompt: SystemPrompt,
				messages: this.conversationHistory,
			};

			const response = await this.provider.chatBot(request);
			this.conversationHistory.push(...response.messages);
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

	private instantiateProvider(
		key: ConfigProvider,
		config: Config,
		model?: string,
	): void {
		const { provider, modelName } = providerFactories[key](
			config,
			this.tools,
			model,
		);
		this.provider = provider;
		this.modelName = modelName;
		this.providerKey = key;
		this.providerName = providerLabels[key];
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
