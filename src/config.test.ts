import { describe, expect, it, mock } from "bun:test";

// Mock zod-config before config.ts is imported so the top-level
// `await loadConfig()` in config.ts uses our fake data.
const mockLoadConfig = mock(async () => ({
	default_provider: "ollama",
	providers: {
		ollama: { enabled: true, model: "llama3", temperature: 0.5 },
		anthropic: {
			enabled: true,
			api_key: "test-key",
			model: "claude-opus-4",
		},
	},
}));

mock.module("zod-config", () => ({ loadConfig: mockLoadConfig }));
mock.module("zod-config/yaml-adapter", () => ({
	yamlAdapter: (opts: unknown) => opts,
}));

// Dynamic import ensures our mocks are in place before config.ts executes
const { getConfig } = await import("./config.ts");
const config = await getConfig();

describe("config module", () => {
	it("loads config with the default provider", () => {
		expect(config.default_provider).toBe("ollama");
	});

	it("exposes provider configurations", () => {
		expect(config.providers).toBeDefined();
		expect(config.providers.ollama).toBeDefined();
		expect(config.providers.anthropic).toBeDefined();
	});

	it("default provider has enabled=true", () => {
		expect(config.providers.ollama?.enabled).toBe(true);
	});

	it("preserves model name from config", () => {
		expect(config.providers.ollama?.model).toBe("llama3");
	});

	it("preserves anthropic api_key", () => {
		expect(config.providers.anthropic?.api_key).toBe("test-key");
	});
});

describe("config types", () => {
	it("default_provider is a string", () => {
		expect(typeof config.default_provider).toBe("string");
	});

	it("providers is an object", () => {
		expect(typeof config.providers).toBe("object");
		expect(config.providers).not.toBeNull();
	});
});
