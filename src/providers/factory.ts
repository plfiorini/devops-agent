import type { Config, Provider as ConfigProvider } from "../config.ts";
import type { ProviderInterface, Tool } from "../types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { AzureOpenAIProvider } from "./azure_openai.ts";
import { GeminiProvider } from "./gemini.ts";
import { OllamaProvider } from "./ollama.ts";
import { OpenAIProvider } from "./openai.ts";

export function createProvider(
	config: Config,
	provider: ConfigProvider,
	tools: Tool[],
): ProviderInterface {
	switch (provider) {
		case "gemini":
			if (!config.providers.gemini) throw new Error("Gemini provider is not configured");
			return new GeminiProvider(config.providers.gemini, tools);
		case "openai":
			if (!config.providers.openai) throw new Error("OpenAI provider is not configured");
			return new OpenAIProvider(config.providers.openai, tools);
		case "azure_openai":
			if (!config.providers.azure_openai) throw new Error("Azure OpenAI provider is not configured");
			return new AzureOpenAIProvider(config.providers.azure_openai, tools);
		case "anthropic":
			if (!config.providers.anthropic) throw new Error("Anthropic provider is not configured");
			return new AnthropicProvider(config.providers.anthropic, tools);
		case "ollama":
			if (!config.providers.ollama) throw new Error("Ollama provider is not configured");
			return new OllamaProvider(config.providers.ollama, tools);
	}
}
