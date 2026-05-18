import type { Config, Provider } from "./config.ts";
import { getConfig } from "./config.ts";
import { createProvider } from "./providers/factory.ts";
import { loadTools } from "./tools.ts";
import type {
	Message,
	ProviderInfo,
	ProviderInterface,
	Tool,
} from "./types.ts";

export type AgentStatus = {
	initialized: boolean;
	activeProviderName?: string;
	activeModelName?: string;
	providers: ProviderInfo[];
	toolCount: number;
	conversationCount: number;
};

const providerLabels: Record<Provider, string> = {
	gemini: "Gemini",
	openai: "OpenAI",
	azure_openai: "Azure OpenAI",
	anthropic: "Anthropic",
	ollama: "Ollama",
};

export class Agent {
	private initialized = false;
	private provider: ProviderInterface | null = null;
	private providerInfo: ProviderInfo[] = [];
	private tools: Tool[] = [];

	getAvailableTools(): Tool[] {
		return this.tools;
	}

	getStatus(): AgentStatus {
		const providerKey = this.provider?.getProviderName();
		return {
			initialized: this.initialized,
			activeProviderName: providerKey
				? (providerLabels[providerKey as Provider] ?? providerKey)
				: undefined,
			activeModelName: this.provider?.getModelName(),
			providers: [...this.providerInfo],
			toolCount: this.tools.length,
			conversationCount: this.provider?.getMessagesCount() ?? 0,
		};
	}

	clearMessages(): void {
		this.provider?.clearMessages();
	}

	async initialize(): Promise<void> {
		this.tools = await loadTools();

		const config = await getConfig();
		this.providerInfo = this.buildProviderInfo(config);

		const defaultProvider = config.default_provider;
		this.provider = createProvider(config, defaultProvider, this.tools);

		this.initialized = true;
	}

	async getSupportedProviders(): Promise<Provider[]> {
		const config = await getConfig();

		return (Object.keys(providerLabels) as Provider[]).filter(
			(provider) => config.providers[provider]?.enabled,
		);
	}

	async getSupportedModels(): Promise<string[]> {
		if (!this.provider) {
			throw new Error("No active provider");
		}

		return this.provider.getSupportedModels();
	}

	async switchProvider(providerKey: string, model?: string): Promise<void> {
		const config = await getConfig();

		const knownProviders = Object.keys(providerLabels) as Provider[];
		if (!knownProviders.includes(providerKey as Provider)) {
			throw new Error(
				`Unknown provider "${providerKey}". Valid: ${knownProviders.join(", ")}`,
			);
		}

		const key = providerKey as Provider;
		if (!config.providers[key]?.enabled) {
			throw new Error(
				`Provider "${providerKey}" is not enabled in config.yaml`,
			);
		}

		this.provider = createProvider(config, key, this.tools);

		if (model) {
			await this.switchModel(model);
		}
	}

	async switchModel(model: string): Promise<void> {
		if (!this.provider) {
			throw new Error("No active provider to change model for");
		}

		const supportedModels = await this.provider.getSupportedModels();
		// Only validate when we successfully retrieved a non-empty list.
		// An empty list may indicate a transient API failure — in that case we
		// let the provider's setModelName() handle its own validation (e.g.,
		// AzureOpenAIProvider throws a descriptive error for unsupported changes).
		if (supportedModels.length > 0 && !supportedModels.includes(model)) {
			throw new Error(
				`Model "${model}" is not supported by provider "${this.provider.getProviderName()}". Supported models: ${supportedModels.join(", ")}`,
			);
		}

		this.provider.setModelName(model);
	}

	async *chat(prompt: string): AsyncGenerator<Message> {
		if (!this.provider) {
			throw new Error("Provider not initialized");
		}

		yield* this.provider.agentLoop(prompt);
	}

	private buildProviderInfo(config: Config): ProviderInfo[] {
		const providers: ProviderInfo[] = [];

		for (const [key, label] of Object.entries(providerLabels) as [
			Provider,
			string,
		][]) {
			const enabled = !!config.providers[key]?.enabled;
			const isDefault = config.default_provider === key;

			providers.push({
				name: label,
				enabled,
				isDefault,
			});
		}

		return providers;
	}
}
