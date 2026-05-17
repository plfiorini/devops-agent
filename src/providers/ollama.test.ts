import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { OllamaConfig } from "../config.ts";

// Streaming chunk generator for Ollama chat
async function* makeOllamaStream(
	chunks: Array<{ content?: string; thinking?: string; tool_calls?: unknown[] }>,
) {
	for (const chunk of chunks) {
		yield { message: { content: chunk.content ?? "", thinking: chunk.thinking ?? "", tool_calls: chunk.tool_calls } };
	}
}

const mockOllamaList = mock(async () => ({
	models: [{ name: "llama3:latest" }, { name: "mistral:7b" }],
}));

const mockOllamaChat = mock(async () =>
	makeOllamaStream([{ content: "Hello from Ollama!" }]),
);

mock.module("ollama", () => ({
	Ollama: class MockOllama {
		list = mockOllamaList;
		chat = mockOllamaChat;
	},
}));

const { OllamaProvider } = await import("./ollama.ts");

const validConfig: OllamaConfig = {
	enabled: true,
	model: "llama3",
	base_url: "http://localhost:11434",
	temperature: 0.5,
};

describe("OllamaProvider constructor", () => {
	it("throws when model is missing", () => {
		expect(
			() => new OllamaProvider({ ...validConfig, model: "" }, []),
		).toThrow("Ollama model is required");
	});

	it("throws when temperature is out of range", () => {
		expect(
			() => new OllamaProvider({ ...validConfig, temperature: 2.5 }, []),
		).toThrow("temperature must be between 0 and 2");
	});

	it("constructs successfully with valid config", () => {
		expect(() => new OllamaProvider(validConfig, [])).not.toThrow();
	});

	it("constructs with num_predict when provided", () => {
		expect(
			() => new OllamaProvider({ ...validConfig, num_predict: 1024 }, []),
		).not.toThrow();
	});

	it("uses default host when base_url is not provided", () => {
		expect(
			() => new OllamaProvider({ ...validConfig, base_url: undefined }, []),
		).not.toThrow();
	});
});

describe("OllamaProvider methods", () => {
	let provider: InstanceType<typeof OllamaProvider>;

	beforeEach(() => {
		provider = new OllamaProvider(validConfig, []);
		mockOllamaList.mockClear();
		mockOllamaChat.mockClear();
	});

	it("getProviderName returns 'ollama'", () => {
		expect(provider.getProviderName()).toBe("ollama");
	});

	it("getModelName returns configured model", () => {
		expect(provider.getModelName()).toBe("llama3");
	});

	it("setModelName updates the model", () => {
		provider.setModelName("mistral:7b");
		expect(provider.getModelName()).toBe("mistral:7b");
	});

	it("getMessagesCount returns 0 initially", () => {
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("clearMessages resets message count", () => {
		provider.clearMessages();
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("getSupportedModels returns model names", async () => {
		const models = await provider.getSupportedModels();
		expect(models).toContain("llama3:latest");
		expect(models).toContain("mistral:7b");
	});

	it("getSupportedModels caches results", async () => {
		await provider.getSupportedModels();
		await provider.getSupportedModels();
		expect(mockOllamaList).toHaveBeenCalledTimes(1);
	});

	it("getSupportedModels returns empty on error", async () => {
		mockOllamaList.mockImplementationOnce(() => {
			throw new Error("connection refused");
		});
		const fresh = new OllamaProvider(validConfig, []);
		const models = await fresh.getSupportedModels();
		expect(models).toEqual([]);
	});

	describe("agentLoop", () => {
		it("yields an assistant message for plain text response", async () => {
			const messages: unknown[] = [];
			for await (const msg of provider.agentLoop("hello")) {
				messages.push(msg);
			}
			expect(messages.length).toBeGreaterThan(0);
			const first = messages[0] as { role: string; content: string };
			expect(first.role).toBe("assistant");
			expect(first.content).toBe("Hello from Ollama!");
		});

		it("increments message count after interaction", async () => {
			for await (const _ of provider.agentLoop("ping")) {
				// consume
			}
			expect(provider.getMessagesCount()).toBeGreaterThan(0);
		});

		it("passes num_predict to ollama chat options when configured", async () => {
			const providerWithLimit = new OllamaProvider(
				{ ...validConfig, num_predict: 512 },
				[],
			);
			for await (const _ of providerWithLimit.agentLoop("hello")) {
				// consume
			}
			expect(mockOllamaChat).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({ num_predict: 512 }),
				}),
			);
		});

		it("omits num_predict from chat options when not configured", async () => {
			for await (const _ of provider.agentLoop("hello")) {
				// consume
			}
			const callArg = mockOllamaChat.mock.calls[0]?.[0] as {
				options?: Record<string, unknown>;
			};
			expect(callArg?.options).not.toHaveProperty("num_predict");
		});
	});
});
