import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { GeminiConfig } from "../config.ts";

// Streaming chunk generator
async function* makeGeminiStream(chunks: Array<{ text?: string; functionCalls?: unknown[] }>) {
	for (const chunk of chunks) {
		yield chunk;
	}
}

const mockPage = [{ name: "models/gemini-2.0-flash" }, { name: "models/gemini-1.5-pro" }];
const mockPager = {
	page: mockPage,
	hasNextPage: mock(() => false),
	nextPage: mock(async () => []),
};
const mockModelsList = mock(async () => mockPager);

const mockGenerateContentStream = mock(async () =>
	makeGeminiStream([{ text: "Hello from Gemini!" }]),
);

mock.module("@google/genai", () => ({
	GoogleGenAI: class MockGoogleGenAI {
		models = {
			list: mockModelsList,
			generateContentStream: mockGenerateContentStream,
		};
	},
}));

const { GeminiProvider } = await import("./gemini.ts");

const validConfig: GeminiConfig = {
	enabled: true,
	api_key: "gemini-key",
	model: "gemini-2.0-flash",
	temperature: 0.7,
	max_tokens: 1024,
};

describe("GeminiProvider constructor", () => {
	it("throws when api_key is missing", () => {
		expect(
			() => new GeminiProvider({ ...validConfig, api_key: "" }, []),
		).toThrow("Google API key is required");
	});

	it("throws when model is missing", () => {
		expect(
			() => new GeminiProvider({ ...validConfig, model: "" }, []),
		).toThrow("Gemini model is required");
	});

	it("throws when temperature > 1", () => {
		expect(
			() => new GeminiProvider({ ...validConfig, temperature: 1.5 }, []),
		).toThrow("temperature must be between 0 and 1");
	});

	it("constructs successfully with valid config", () => {
		expect(() => new GeminiProvider(validConfig, [])).not.toThrow();
	});

	it("warns when max_tokens > 4096", () => {
		// Should construct without throwing (just logs a warning)
		expect(
			() => new GeminiProvider({ ...validConfig, max_tokens: 8000 }, []),
		).not.toThrow();
	});
});

describe("GeminiProvider methods", () => {
	let provider: InstanceType<typeof GeminiProvider>;

	beforeEach(() => {
		provider = new GeminiProvider(validConfig, []);
		mockModelsList.mockClear();
		mockGenerateContentStream.mockClear();
	});

	it("getProviderName returns 'gemini'", () => {
		expect(provider.getProviderName()).toBe("gemini");
	});

	it("getModelName returns configured model", () => {
		expect(provider.getModelName()).toBe("gemini-2.0-flash");
	});

	it("setModelName updates the model", () => {
		provider.setModelName("gemini-1.5-pro");
		expect(provider.getModelName()).toBe("gemini-1.5-pro");
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
		// The 'models/' prefix returned by the API is stripped for consistency
		// with what users pass to /model and config.yaml.
		expect(models).toContain("gemini-2.0-flash");
		expect(models).toContain("gemini-1.5-pro");
	});

	it("getSupportedModels caches results", async () => {
		await provider.getSupportedModels();
		await provider.getSupportedModels();
		expect(mockModelsList).toHaveBeenCalledTimes(1);
	});

	it("getSupportedModels returns empty on error", async () => {
		mockModelsList.mockImplementationOnce(() => {
			throw new Error("API error");
		});
		const fresh = new GeminiProvider(validConfig, []);
		const models = await fresh.getSupportedModels();
		expect(models).toEqual([]);
	});

	describe("agentLoop", () => {
		it("yields an assistant TextMessage for plain text", async () => {
			const messages: unknown[] = [];
			for await (const msg of provider.agentLoop("hello")) {
				messages.push(msg);
			}
			expect(messages.length).toBeGreaterThan(0);
			const first = messages[0] as { role: string; content: string };
			expect(first.role).toBe("assistant");
			expect(first.content).toBe("Hello from Gemini!");
		});

		it("increments message count", async () => {
			for await (const _ of provider.agentLoop("hi")) {
				// consume
			}
			expect(provider.getMessagesCount()).toBeGreaterThan(0);
		});
	});
});
