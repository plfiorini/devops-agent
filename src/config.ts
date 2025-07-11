import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";

export type Provider = "gemini" | "openai" | "azure_openai" | "anthropic";

export type GeminiConfig = {
	enabled: boolean;
	api_key: string;
	model: string;
	temperature?: number;
	max_tokens?: number;
};

export type OpenAIConfig = {
	enabled: boolean;
	api_key: string;
	model: string;
	organization?: string;
	base_url?: string;
	temperature?: number;
	max_tokens?: number;
};

export type AzureOpenAIConfig = {
	enabled: boolean;
	api_key: string;
	endpoint: string;
	deployment_name: string;
	api_version?: string;
	temperature?: number;
	max_tokens?: number;
};

export type AnthropicConfig = {
	enabled: boolean;
	api_key: string;
	model: string;
	base_url?: string;
	temperature?: number;
	max_tokens?: number;
};

export type OpenAIConfigType = OpenAIConfig | AzureOpenAIConfig;

type ProvidersConfig = {
	gemini?: GeminiConfig;
	openai?: OpenAIConfig;
	azure_openai?: AzureOpenAIConfig;
	anthropic?: AnthropicConfig;
};

type Config = {
	default_provider?: Provider;
	providers: ProvidersConfig;
};

function loadConfig(configPath?: string): Config {
	const defaultConfigPath = path.join(process.cwd(), "config.yaml");
	const filePath = configPath || defaultConfigPath;

	try {
		const fileContents = fs.readFileSync(filePath, "utf8");
		const config = YAML.parse(fileContents);

		if (!config.providers) {
			throw new Error("Provider configuration is missing");
		}

		// Validate that at least one provider is configured and enabled
		const hasEnabledProvider =
			config.providers.gemini?.enabled ||
			config.providers.azure_openai?.enabled ||
			config.providers.openai?.enabled ||
			config.providers.anthropic?.enabled;
		if (!hasEnabledProvider) {
			throw new Error("At least one provider must be configured and enabled");
		}

		// Set default provider if not specified
		if (!config.default_provider) {
			if (config.providers.gemini?.enabled) {
				config.default_provider = "gemini";
			} else if (config.providers.azure_openai?.enabled) {
				config.default_provider = "azure_openai";
			} else if (config.providers.openai?.enabled) {
				config.default_provider = "openai";
			} else if (config.providers.anthropic?.enabled) {
				config.default_provider = "anthropic";
			} else {
				throw new Error("No enabled provider found to set as default");
			}
		}

		// Validate that the default provider is actually enabled
		if (
			config.default_provider === "gemini" &&
			!config.providers.gemini?.enabled
		) {
			throw new Error("Default provider 'gemini' is not enabled");
		}
		if (
			config.default_provider === "azure_openai" &&
			!config.providers.azure_openai?.enabled
		) {
			throw new Error("Default provider 'azure_openai' is not enabled");
		}
		if (
			config.default_provider === "openai" &&
			!config.providers.openai?.enabled
		) {
			throw new Error("Default provider 'openai' is not enabled");
		}
		if (
			config.default_provider === "anthropic" &&
			!config.providers.anthropic?.enabled
		) {
			throw new Error("Default provider 'anthropic' is not enabled");
		}

		return config as Config;
	} catch (error) {
		throw new Error(`Failed to load config from ${filePath}: ${error}`);
	}
}

export const config: Config = loadConfig();
