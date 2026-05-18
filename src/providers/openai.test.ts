import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { OpenAIConfig } from "../config.ts";

// Build an async iterable from an array of chunks
async function* makeStream(
	chunks: Array<{ content?: string }>,
): AsyncGenerator<{ choices: Array<{ delta: { content?: string; tool_calls?: unknown } }> }> {
	for (const chunk of chunks) {
		yield { choices: [{ delta: { content: chunk.content } }] };
	}
}

const mockModelsList = mock(async () => ({
	data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
}));

const mockChatCreate = mock(async () => makeStream([{ content: "Hello from OpenAI!" }]));

mock.module("openai", () => ({
	default: class MockOpenAI {
		models = { list: mockModelsList };
		chat = {
			completions: {
				create: mockChatCreate,
			},
		};
	},
}));

import { OpenAIProvider } from "./openai.ts";

const validConfig: OpenAIConfig = {
	enabled: true,
	api_key: "test-key",
	model: "gpt-4",
	temperature: 0.7,
	max_tokens: 2048,
};

describe("OpenAIProvider constructor", () => {
	it("throws when api_key is missing", () => {
		expect(
			() => new OpenAIProvider({ ...validConfig, api_key: "" }, []),
		).toThrow("OpenAI API key is required");
	});

	it("throws when model is missing", () => {
		expect(
			() => new OpenAIProvider({ ...validConfig, model: "" }, []),
		).toThrow("OpenAI model is required");
	});

	it("throws when temperature is out of range", () => {
		expect(
			() => new OpenAIProvider({ ...validConfig, temperature: 3.0 }, []),
		).toThrow("temperature must be between 0 and 2");
	});

	it("throws when max_tokens is <= 0", () => {
		expect(
			() => new OpenAIProvider({ ...validConfig, max_tokens: 0 }, []),
		).toThrow("max_tokens must be greater than 0");
	});

	it("constructs successfully with valid config", () => {
		expect(() => new OpenAIProvider(validConfig, [])).not.toThrow();
	});
});

describe("OpenAIProvider methods", () => {
	let provider: InstanceType<typeof OpenAIProvider>;

	beforeEach(() => {
		provider = new OpenAIProvider(validConfig, []);
		mockModelsList.mockClear();
		mockChatCreate.mockClear();
	});

	it("getProviderName returns 'openai'", () => {
		expect(provider.getProviderName()).toBe("openai");
	});

	it("getModelName returns configured model", () => {
		expect(provider.getModelName()).toBe("gpt-4");
	});

	it("setModelName updates the model", () => {
		provider.setModelName("gpt-3.5-turbo");
		expect(provider.getModelName()).toBe("gpt-3.5-turbo");
	});

	it("getMessagesCount returns 0 initially", () => {
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("clearMessages resets history", () => {
		provider.clearMessages();
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("getSupportedModels returns model list", async () => {
		const models = await provider.getSupportedModels();
		expect(models).toContain("gpt-4");
		expect(models).toContain("gpt-3.5-turbo");
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
		const fresh = new OpenAIProvider(validConfig, []);
		const models = await fresh.getSupportedModels();
		expect(models).toEqual([]);
	});

	describe("agentLoop", () => {
		it("yields assistant message for plain text response", async () => {
			const messages: unknown[] = [];
			for await (const msg of provider.agentLoop("hi")) {
				messages.push(msg);
			}
			expect(messages.length).toBeGreaterThan(0);
			const first = messages[0] as { role: string };
			expect(first.role).toBe("assistant");
		});

		it("increments message count after interaction", async () => {
			for await (const _ of provider.agentLoop("ping")) {
				// consume
			}
			expect(provider.getMessagesCount()).toBeGreaterThan(0);
		});
	});
});
