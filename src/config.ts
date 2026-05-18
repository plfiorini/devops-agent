import * as path from "node:path";
import z from "zod";
import { loadConfig as zodLoadConfig } from "zod-config";
import { yamlAdapter } from "zod-config/yaml-adapter";

const providerSchema = z.enum([
	"gemini",
	"openai",
	"azure_openai",
	"anthropic",
	"ollama",
]);
export type Provider = z.infer<typeof providerSchema>;

const geminiSchema = z.object({
	enabled: z.boolean(),
	api_key: z.string(),
	model: z.string(),
	temperature: z.number().min(0).max(2).optional(),
	max_tokens: z.number().optional(),
});
export type GeminiConfig = z.infer<typeof geminiSchema>;

const openaiSchema = z.object({
	enabled: z.boolean(),
	api_key: z.string(),
	model: z.string(),
	organization: z.string().optional(),
	base_url: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	max_tokens: z.number().optional(),
});
export type OpenAIConfig = z.infer<typeof openaiSchema>;

const azureOpenAISchema = z.object({
	enabled: z.boolean(),
	api_key: z.string().optional(),
	endpoint: z.string(),
	deployment_name: z.string(),
	api_version: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	max_tokens: z.number().optional(),
});
export type AzureOpenAIConfig = z.infer<typeof azureOpenAISchema>;

const anthropicSchema = z.object({
	enabled: z.boolean(),
	api_key: z.string(),
	model: z.string(),
	base_url: z.string().optional(),
	temperature: z.number().min(0).max(1).optional(),
	max_tokens: z.number().optional(),
});
export type AnthropicConfig = z.infer<typeof anthropicSchema>;

const ollamaSchema = z.object({
	enabled: z.boolean(),
	base_url: z.string().optional(),
	model: z.string(),
	temperature: z.number().min(0).max(2).optional(),
	num_predict: z.number().int().optional(),
});
export type OllamaConfig = z.infer<typeof ollamaSchema>;

const providersConfigSchema = z.object({
	gemini: geminiSchema.optional(),
	openai: openaiSchema.optional(),
	azure_openai: azureOpenAISchema.optional(),
	anthropic: anthropicSchema.optional(),
	ollama: ollamaSchema.optional(),
});
export type ProvidersConfig = z.infer<typeof providersConfigSchema>;

const configSchema = z.object({
	default_provider: providerSchema.default("ollama"),
	providers: providersConfigSchema,
});
export type Config = z.infer<typeof configSchema>;

export async function loadConfig(configPath?: string): Promise<Config> {
	const defaultConfigPath = path.join(process.cwd(), "config.yaml");
	const filePath = configPath || defaultConfigPath;

	try {
		const config = await zodLoadConfig({
			schema: configSchema,
			adapters: yamlAdapter({ path: filePath }),
		});

		if (!config.providers) {
			throw new Error("Provider configuration is missing");
		}

		// Validate that the default provider is actually enabled
		const defaultProviderConfig = config.providers[config.default_provider];
		if (!defaultProviderConfig) {
			throw new Error(
				`Default provider "${config.default_provider}" is not configured under "providers" in config.yaml`,
			);
		}
		if (!defaultProviderConfig.enabled) {
			throw new Error(
				`Default provider "${config.default_provider}" has "enabled: false" in config.yaml. Set it to "enabled: true" or choose a different default_provider.`,
			);
		}

		return config as Config;
	} catch (error) {
		throw new Error(`Failed to load config from ${filePath}: ${error}`);
	}
}

/**
 * Lazily load and cache the config. The config file is only read from disk on
 * the first call; subsequent calls return the cached result. This avoids
 * top-level await that would eagerly perform I/O at module-import time,
 * making the module safe to import in tests and environments without a
 * config.yaml.
 */
let _cachedConfig: Config | undefined;
export async function getConfig(): Promise<Config> {
	if (_cachedConfig === undefined) {
		_cachedConfig = await loadConfig();
	}
	return _cachedConfig;
}
