import { describe, expect, it, mock } from "bun:test";
import type { AzureOpenAIConfig } from "../config.ts";

// Mock openai before importing azure_openai
function* emptyStream() {
	yield { choices: [{ delta: { content: "Hello!" } }] };
}

const mockChatCreate = mock(async () => ({
	[Symbol.asyncIterator]: () => emptyStream(),
}));

const mockModelsList = mock(async () => ({ data: [{ id: "gpt-4" }] }));

mock.module("openai", () => ({
	default: class MockOpenAI {
		models = { list: mockModelsList };
		chat = { completions: { create: mockChatCreate } };
	},
	AzureOpenAI: class MockAzureOpenAI {
		models = { list: mockModelsList };
		chat = { completions: { create: mockChatCreate } };
	},
}));

const { AzureOpenAIProvider } = await import("./azure_openai.ts");

const validConfig: AzureOpenAIConfig = {
	enabled: true,
	endpoint: "https://example.openai.azure.com",
	deployment_name: "gpt4-deployment",
	api_key: "azure-key",
	api_version: "2024-10-21",
};

describe("AzureOpenAIProvider constructor", () => {
	it("throws when endpoint is missing", () => {
		expect(
			() =>
				new AzureOpenAIProvider(
					{ ...validConfig, endpoint: "" },
					[],
				),
		).toThrow("Azure OpenAI endpoint is required");
	});

	it("throws when deployment_name is missing", () => {
		expect(
			() =>
				new AzureOpenAIProvider(
					{ ...validConfig, deployment_name: "" },
					[],
				),
		).toThrow("Azure OpenAI deployment name is required");
	});

	it("constructs successfully with valid config", () => {
		expect(() => new AzureOpenAIProvider(validConfig, [])).not.toThrow();
	});
});

describe("AzureOpenAIProvider methods", () => {
	it("getProviderName returns 'azure_openai'", () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		expect(provider.getProviderName()).toBe("azure_openai");
	});

	it("getModelName returns the deployment name", () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		expect(provider.getModelName()).toBe("gpt4-deployment");
	});

	it("getMessagesCount returns 0 initially", () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("clearMessages resets message history", () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		provider.clearMessages();
		expect(provider.getMessagesCount()).toBe(0);
	});

	it("setModelName throws because Azure routes by deployment name", () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		expect(() => provider.setModelName("gpt-4o")).toThrow(
			"Azure OpenAI routes requests by deployment name",
		);
	});

	it("getSupportedModels returns empty array to bypass switchModel validation", async () => {
		const provider = new AzureOpenAIProvider(validConfig, []);
		const models = await provider.getSupportedModels();
		expect(models).toEqual([]);
	});
});
