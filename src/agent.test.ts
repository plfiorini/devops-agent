import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Message, ProviderInfo, ProviderInterface } from "./types.ts";
import type { Tool } from "./types.ts";

// Mock config before agent.ts is imported
const mockConfig = {
	default_provider: "ollama",
	providers: {
		gemini: { enabled: true, api_key: "g", model: "gemini-pro" },
		openai: { enabled: false, api_key: "o", model: "gpt-4" },
		azure_openai: undefined,
		anthropic: { enabled: false, api_key: "a", model: "claude-3" },
		ollama: { enabled: true, model: "llama3" },
	},
};

mock.module("./config.ts", () => ({ getConfig: async () => mockConfig }));

// Mock tools module
const mockTool: Tool = {
	name: "execute_command",
	description: "Run a shell command",
	inputSchema: {} as never,
	outputSchema: {} as never,
	execute: mock(async () => ({})),
};

mock.module("./tools.ts", () => ({
	loadTools: mock(async () => [mockTool]),
}));

// Build a minimal mock provider
function makeMockProvider(name = "ollama", model = "llama3"): ProviderInterface {
	return {
		getProviderName: mock(() => name),
		getModelName: mock(() => model),
		setModelName: mock((_: string) => {}),
		getSupportedModels: mock(async () => ["llama3", "mistral"]),
		getMessagesCount: mock(() => 2),
		clearMessages: mock(() => {}),
		agentLoop: mock(async function* (prompt: string): AsyncGenerator<Message> {
			yield { role: "assistant", content: `echo: ${prompt}` } as Message;
		}),
	};
}

// Mock createProvider to return a controllable mock
const mockProvider = makeMockProvider();
const mockCreateProvider = mock(() => mockProvider);

mock.module("./providers/factory.ts", () => ({
	createProvider: mockCreateProvider,
}));

const { Agent } = await import("./agent.ts");

describe("Agent", () => {
	let agent: InstanceType<typeof Agent>;

	beforeEach(() => {
		agent = new Agent();
		mockCreateProvider.mockClear();
	});

	describe("initial state", () => {
		it("getStatus reflects uninitialized state", () => {
			const status = agent.getStatus();
			expect(status.initialized).toBe(false);
			expect(status.toolCount).toBe(0);
			expect(status.conversationCount).toBe(0);
		});

		it("getAvailableTools returns empty before initialize", () => {
			expect(agent.getAvailableTools()).toEqual([]);
		});
	});

	describe("initialize", () => {
		it("sets initialized to true", async () => {
			await agent.initialize();
			expect(agent.getStatus().initialized).toBe(true);
		});

		it("loads tools", async () => {
			await agent.initialize();
			expect(agent.getAvailableTools().length).toBe(1);
			expect(agent.getAvailableTools()[0]?.name).toBe("execute_command");
		});

		it("creates the default provider", async () => {
			await agent.initialize();
			expect(mockCreateProvider).toHaveBeenCalledTimes(1);
		});

		it("sets toolCount in status", async () => {
			await agent.initialize();
			expect(agent.getStatus().toolCount).toBe(1);
		});

		it("sets activeProviderName from provider", async () => {
			await agent.initialize();
			// agent.ts maps the raw provider key through providerLabels
			expect(agent.getStatus().activeProviderName).toBe("Ollama");
		});

		it("sets activeModelName from provider", async () => {
			await agent.initialize();
			expect(agent.getStatus().activeModelName).toBe("llama3");
		});
	});

	describe("getSupportedProviders", () => {
		it("returns only enabled provider keys", async () => {
			await agent.initialize();
			const providers = await agent.getSupportedProviders();
			// Only providers with enabled: true in the mock config should be returned.
			expect(providers).toContain("gemini");
			expect(providers).toContain("ollama");
			// Disabled providers should not appear.
			expect(providers).not.toContain("openai");
			expect(providers).not.toContain("anthropic");
			// Unconfigured providers should not appear.
			expect(providers).not.toContain("azure_openai");
		});
	});

	describe("getSupportedModels", () => {
		it("throws when no provider is active", async () => {
			await expect(agent.getSupportedModels()).rejects.toThrow(
				"No active provider",
			);
		});

		it("returns models from the active provider", async () => {
			await agent.initialize();
			const models = await agent.getSupportedModels();
			expect(models).toContain("llama3");
		});
	});

	describe("switchProvider", () => {
		it("throws for unknown provider key", async () => {
			await agent.initialize();
			await expect(agent.switchProvider("invalid-provider")).rejects.toThrow(
				"Unknown provider",
			);
		});

		it("throws when provider is not enabled", async () => {
			await agent.initialize();
			await expect(agent.switchProvider("openai")).rejects.toThrow(
				'Provider "openai" is not enabled',
			);
		});

		it("switches to an enabled provider", async () => {
			await agent.initialize();
			mockCreateProvider.mockClear();
			await agent.switchProvider("gemini");
			expect(mockCreateProvider).toHaveBeenCalledTimes(1);
		});

		it("switches provider and sets model when provided", async () => {
			await agent.initialize();
			// mockProvider.getSupportedModels already returns ["llama3", "mistral"]
			await agent.switchProvider("ollama", "llama3");
			expect((mockProvider.setModelName as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(0);
		});
	});

	describe("switchModel", () => {
		it("throws when no provider is active", async () => {
			await expect(agent.switchModel("llama3")).rejects.toThrow(
				"No active provider",
			);
		});

		it("throws for unsupported model", async () => {
			await agent.initialize();
			await expect(agent.switchModel("nonexistent-model")).rejects.toThrow(
				"is not supported by provider",
			);
		});

		it("sets model name for a supported model", async () => {
			await agent.initialize();
			(mockProvider.setModelName as ReturnType<typeof mock>).mockClear();
			await agent.switchModel("llama3");
			expect(mockProvider.setModelName).toHaveBeenCalledWith("llama3");
		});

		it("skips model-list validation and propagates setModelName error when getSupportedModels returns []", async () => {
			// Simulates Azure: getSupportedModels() returns [] so the generic
			// "Model X is not supported" error is never shown; setModelName() throws
			// its own descriptive error instead.
			await agent.initialize();
			(
				mockProvider.getSupportedModels as ReturnType<typeof mock>
			).mockImplementation(async () => []);
			(mockProvider.setModelName as ReturnType<typeof mock>).mockImplementation(
				() => {
					throw new Error("use /provider to switch deployments");
				},
			);
			await expect(agent.switchModel("any-model")).rejects.toThrow(
				"use /provider to switch deployments",
			);
			// Restore original mock behaviour for subsequent tests
			(
				mockProvider.getSupportedModels as ReturnType<typeof mock>
			).mockImplementation(async () => ["llama3", "mistral"]);
			(mockProvider.setModelName as ReturnType<typeof mock>).mockImplementation(
				(_: string) => {},
			);
		});
	});

	describe("clearMessages", () => {
		it("does not throw before initialization", () => {
			expect(() => agent.clearMessages()).not.toThrow();
		});

		it("delegates to provider after initialization", async () => {
			await agent.initialize();
			(mockProvider.clearMessages as ReturnType<typeof mock>).mockClear();
			agent.clearMessages();
			expect(mockProvider.clearMessages).toHaveBeenCalledTimes(1);
		});
	});

	describe("chat", () => {
		it("throws when provider is not initialized", async () => {
			const gen = agent.chat("hello");
			await expect(gen.next()).rejects.toThrow("Provider not initialized");
		});

		it("yields messages from provider agentLoop", async () => {
			await agent.initialize();
			const messages: Message[] = [];
			for await (const msg of agent.chat("hello")) {
				messages.push(msg);
			}
			expect(messages.length).toBeGreaterThan(0);
		});
	});

	describe("getStatus provider info", () => {
		it("builds provider info with enabled and isDefault flags", async () => {
			await agent.initialize();
			const { providers } = agent.getStatus();

			const ollamaInfo = providers.find(
				(p: ProviderInfo) => p.name === "Ollama",
			);
			expect(ollamaInfo?.enabled).toBe(true);
			expect(ollamaInfo?.isDefault).toBe(true);

			const openaiInfo = providers.find(
				(p: ProviderInfo) => p.name === "OpenAI",
			);
			expect(openaiInfo?.enabled).toBe(false);
			expect(openaiInfo?.isDefault).toBe(false);
		});
	});
});
