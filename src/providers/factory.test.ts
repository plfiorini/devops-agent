import { describe, expect, it, mock } from "bun:test";
import type { Config } from "../config.ts";

// Use class mocks so that `new ProviderClass(...)` works correctly.
// mock.module is hoisted, so these classes must be declared before or
// defined inline inside the factory functions below.

class MockGeminiProvider {
	getProviderName = mock(() => "gemini");
	getModelName = mock(() => "gemini-pro");
	setModelName = mock((_m: string) => {});
	getSupportedModels = mock(async () => [] as string[]);
	getMessagesCount = mock(() => 0);
	clearMessages = mock(() => {});
	agentLoop = mock(async function* () {});
}

class MockOpenAIProvider {
	getProviderName = mock(() => "openai");
	getModelName = mock(() => "gpt-4");
	setModelName = mock((_m: string) => {});
	getSupportedModels = mock(async () => [] as string[]);
	getMessagesCount = mock(() => 0);
	clearMessages = mock(() => {});
	agentLoop = mock(async function* () {});
}

class MockAzureOpenAIProvider {
	getProviderName = mock(() => "azure_openai");
	getModelName = mock(() => "gpt4-deployment");
	setModelName = mock((_m: string) => {});
	getSupportedModels = mock(async () => [] as string[]);
	getMessagesCount = mock(() => 0);
	clearMessages = mock(() => {});
	agentLoop = mock(async function* () {});
}

class MockAnthropicProvider {
	getProviderName = mock(() => "anthropic");
	getModelName = mock(() => "claude-opus-4");
	setModelName = mock((_m: string) => {});
	getSupportedModels = mock(async () => [] as string[]);
	getMessagesCount = mock(() => 0);
	clearMessages = mock(() => {});
	agentLoop = mock(async function* () {});
}

class MockOllamaProvider {
	getProviderName = mock(() => "ollama");
	getModelName = mock(() => "llama3");
	setModelName = mock((_m: string) => {});
	getSupportedModels = mock(async () => [] as string[]);
	getMessagesCount = mock(() => 0);
	clearMessages = mock(() => {});
	agentLoop = mock(async function* () {});
}

mock.module("./gemini.ts", () => ({ GeminiProvider: MockGeminiProvider }));
mock.module("./openai.ts", () => ({ OpenAIProvider: MockOpenAIProvider }));
mock.module("./azure_openai.ts", () => ({
	AzureOpenAIProvider: MockAzureOpenAIProvider,
}));
mock.module("./anthropic.ts", () => ({
	AnthropicProvider: MockAnthropicProvider,
}));
mock.module("./ollama.ts", () => ({ OllamaProvider: MockOllamaProvider }));

import { createProvider } from "./factory.ts";

const baseConfig: Config = {
	default_provider: "ollama",
	providers: {
		gemini: {
			enabled: true,
			api_key: "gkey",
			model: "gemini-pro",
		},
		openai: {
			enabled: true,
			api_key: "okey",
			model: "gpt-4",
		},
		azure_openai: {
			enabled: true,
			endpoint: "https://example.azure.com",
			deployment_name: "gpt4",
		},
		anthropic: {
			enabled: true,
			api_key: "akey",
			model: "claude-opus-4",
		},
		ollama: {
			enabled: true,
			model: "llama3",
		},
	},
};

describe("createProvider", () => {
	it("creates a GeminiProvider for 'gemini'", () => {
		const provider = createProvider(baseConfig, "gemini", []);
		expect(provider).toBeInstanceOf(MockGeminiProvider);
	});

	it("creates an OpenAIProvider for 'openai'", () => {
		const provider = createProvider(baseConfig, "openai", []);
		expect(provider).toBeInstanceOf(MockOpenAIProvider);
	});

	it("creates an AzureOpenAIProvider for 'azure_openai'", () => {
		const provider = createProvider(baseConfig, "azure_openai", []);
		expect(provider).toBeInstanceOf(MockAzureOpenAIProvider);
	});

	it("creates an AnthropicProvider for 'anthropic'", () => {
		const provider = createProvider(baseConfig, "anthropic", []);
		expect(provider).toBeInstanceOf(MockAnthropicProvider);
	});

	it("creates an OllamaProvider for 'ollama'", () => {
		const provider = createProvider(baseConfig, "ollama", []);
		expect(provider).toBeInstanceOf(MockOllamaProvider);
	});

	it("throws when gemini is not configured", () => {
		const cfg: Config = {
			...baseConfig,
			providers: { ...baseConfig.providers, gemini: undefined },
		};
		expect(() => createProvider(cfg, "gemini", [])).toThrow(
			"Gemini provider is not configured",
		);
	});

	it("throws when openai is not configured", () => {
		const cfg: Config = {
			...baseConfig,
			providers: { ...baseConfig.providers, openai: undefined },
		};
		expect(() => createProvider(cfg, "openai", [])).toThrow(
			"OpenAI provider is not configured",
		);
	});

	it("throws when azure_openai is not configured", () => {
		const cfg: Config = {
			...baseConfig,
			providers: { ...baseConfig.providers, azure_openai: undefined },
		};
		expect(() => createProvider(cfg, "azure_openai", [])).toThrow(
			"Azure OpenAI provider is not configured",
		);
	});

	it("throws when anthropic is not configured", () => {
		const cfg: Config = {
			...baseConfig,
			providers: { ...baseConfig.providers, anthropic: undefined },
		};
		expect(() => createProvider(cfg, "anthropic", [])).toThrow(
			"Anthropic provider is not configured",
		);
	});

	it("throws when ollama is not configured", () => {
		const cfg: Config = {
			...baseConfig,
			providers: { ...baseConfig.providers, ollama: undefined },
		};
		expect(() => createProvider(cfg, "ollama", [])).toThrow(
			"Ollama provider is not configured",
		);
	});
});
