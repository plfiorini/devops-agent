import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { AnthropicConfig } from "../config.ts";
import { z } from "zod";

// Mocks must be declared with mock-prefixed names so bun hoists them
// above the import of AnthropicProvider.

const mockModelsList = mock(async () => ({
	data: [
		{ id: "claude-opus-4" },
		{ id: "claude-sonnet-4-5" },
		{ id: "claude-haiku-4-5" },
	],
}));

const mockFinalMessage = mock(async () => ({
	content: [{ type: "text", text: "Hello from Claude!" }],
	stop_reason: "end_turn",
}));

const mockMessagesStream = mock(() => ({ finalMessage: mockFinalMessage }));

mock.module("@anthropic-ai/sdk", () => ({
	default: class MockAnthropic {
		models = { list: mockModelsList };
		messages = { stream: mockMessagesStream };
	},
}));

const { AnthropicProvider } = await import("./anthropic.ts");

const validConfig: AnthropicConfig = {
	enabled: true,
	api_key: "test-key",
	model: "claude-opus-4",
	temperature: 0.5,
	max_tokens: 2048,
};

describe("AnthropicProvider constructor", () => {
	it("throws when api_key is missing", () => {
		expect(
			() => new AnthropicProvider({ ...validConfig, api_key: "" }, []),
		).toThrow("Anthropic API key is required");
	});

	it("throws when model is missing", () => {
		expect(
			() => new AnthropicProvider({ ...validConfig, model: "" }, []),
		).toThrow("Anthropic model is required");
	});

	it("throws when temperature is out of range", () => {
		expect(
			() => new AnthropicProvider({ ...validConfig, temperature: 1.5 }, []),
		).toThrow("temperature must be between 0 and 1");
	});

	it("throws when max_tokens is <= 0", () => {
		expect(
			() => new AnthropicProvider({ ...validConfig, max_tokens: 0 }, []),
		).toThrow("max_tokens must be greater than 0");
	});

	it("constructs successfully with valid config", () => {
		expect(() => new AnthropicProvider(validConfig, [])).not.toThrow();
	});
});

describe("AnthropicProvider methods", () => {
	let provider: InstanceType<typeof AnthropicProvider>;

	beforeEach(() => {
		provider = new AnthropicProvider(validConfig, []);
		mockModelsList.mockClear();
		mockMessagesStream.mockClear();
		mockFinalMessage.mockClear();
	});

	it("getProviderName returns 'anthropic'", () => {
		expect(provider.getProviderName()).toBe("anthropic");
	});

	it("getModelName returns configured model", () => {
		expect(provider.getModelName()).toBe("claude-opus-4");
	});

	it("setModelName updates the model", () => {
		provider.setModelName("claude-sonnet-4-5");
		expect(provider.getModelName()).toBe("claude-sonnet-4-5");
	});

	it("getMessagesCount returns 0 initially", () => {
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("clearMessages resets message count", async () => {
		const gen = provider.agentLoop("test");
		await gen.next();
		provider.clearMessages();
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("getSupportedModels fetches models from the API", async () => {
		const models = await provider.getSupportedModels();
		expect(models).toContain("claude-opus-4");
		expect(models).toContain("claude-sonnet-4-5");
		expect(mockModelsList).toHaveBeenCalledTimes(1);
	});

	it("getSupportedModels caches result on second call", async () => {
		await provider.getSupportedModels();
		await provider.getSupportedModels();
		expect(mockModelsList).toHaveBeenCalledTimes(1);
	});

	it("getSupportedModels returns empty array on error", async () => {
		mockModelsList.mockImplementationOnce(() => {
			throw new Error("API error");
		});
		const freshProvider = new AnthropicProvider(validConfig, []);
		const models = await freshProvider.getSupportedModels();
		expect(models).toEqual([]);
	});

	describe("agentLoop", () => {
		it("yields a TextMessage for a plain text response", async () => {
			const messages: unknown[] = [];
			for await (const msg of provider.agentLoop("Hello")) {
				messages.push(msg);
			}
			expect(messages.length).toBe(1);
			expect((messages[0] as { role: string }).role).toBe("assistant");
			expect((messages[0] as { content: string }).content).toBe(
				"Hello from Claude!",
			);
		});

		it("increments message count after interaction", async () => {
			for await (const _ of provider.agentLoop("ping")) {
				// consume
			}
			expect(provider.getMessagesCount()).toBeGreaterThan(0);
		});

		it("yields an AssistantToolCallMessage when stop_reason is tool_use", async () => {
			mockFinalMessage.mockResolvedValueOnce({
				content: [
					{ type: "text", text: "" },
					{
						type: "tool_use",
						id: "tu_001",
						name: "execute_command",
						input: { command: "ls" },
					},
				],
				stop_reason: "tool_use",
			});
			// Second call returns end_turn so the loop terminates
			mockFinalMessage.mockResolvedValueOnce({
				content: [{ type: "text", text: "Done" }],
				stop_reason: "end_turn",
			});

			const mockTool = {
				name: "execute_command",
				description: "runs commands",
				inputSchema: z.object({ command: z.string() }),
				outputSchema: z.object({ output: z.string() }),
				execute: mock(async () => ({ output: "file.txt" })),
			};

			const p = new AnthropicProvider(validConfig, [mockTool]);
			const messages: unknown[] = [];
			for await (const msg of p.agentLoop("list files")) {
				messages.push(msg);
			}

			const toolCallMsg = messages.find(
				(m) =>
					(m as { role: string }).role === "assistant" &&
					"toolCalls" in (m as object),
			) as { toolCalls: unknown[] } | undefined;
			expect(toolCallMsg).toBeDefined();
			expect(toolCallMsg?.toolCalls.length).toBeGreaterThan(0);

			const toolResultMsg = messages.find(
				(m) => (m as { role: string }).role === "tool",
			);
			expect(toolResultMsg).toBeDefined();
		});
	});
});
