import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { Agent } from "../agent.ts";
import type { Message, Provider, Tool } from "../types.ts";
import { OpenAIProvider } from "./openai.ts";

type ChatCreateParams = {
	messages: unknown[];
	tools?: unknown[];
	tool_choice?: unknown;
};

type FakeOpenAIClient = {
	chat: {
		completions: {
			create: (params: ChatCreateParams) => Promise<unknown>;
		};
	};
};

const inspectTool: Tool = {
	name: "inspect",
	description: "Inspect a path",
	inputSchema: z.object({ path: z.string() }),
	outputSchema: z.object({ value: z.string() }),
	execute: ({ path }: { path: string }) => ({ value: `read ${path}` }),
};

function toolCall(id: string, path: string) {
	return {
		id,
		type: "function",
		function: {
			name: "inspect",
			arguments: JSON.stringify({ path }),
		},
	};
}

function createProviderWithResponses(responses: unknown[]) {
	const calls: ChatCreateParams[] = [];
	const provider = new OpenAIProvider(
		{ enabled: true, api_key: "test", model: "fake-model" },
		[inspectTool],
	);
	const fakeClient: FakeOpenAIClient = {
		chat: {
			completions: {
				create: async (params) => {
					calls.push(params);
					const response = responses.shift();
					assert.ok(response, "fake response is available");
					return response;
				},
			},
		},
	};

	(provider as unknown as { client: FakeOpenAIClient }).client = fakeClient;
	return { provider, calls };
}

test("OpenAI provider runs multiple tool rounds and persists generated messages", async () => {
	const { provider, calls } = createProviderWithResponses([
		{
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [toolCall("call_1", "one")],
					},
				},
			],
		},
		{
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [toolCall("call_2", "two")],
					},
				},
			],
		},
		{ choices: [{ message: { role: "assistant", content: "done" } }] },
	]);

	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect twice" }],
	});

	assert.equal(result.content, "done");
	assert.equal(calls.length, 3);
	assert.ok(calls[1]?.tools, "tools are included on the second model turn");
	assert.ok(calls[2]?.tools, "tools are included on the final model turn");
	assert.equal(result.messages.length, 5);
	assert.equal(result.messages[0]?.role, "assistant");
	assert.ok("toolCalls" in result.messages[0]);
	assert.equal(result.messages[1]?.role, "tool");
	assert.equal(result.messages[2]?.role, "assistant");
	assert.equal(result.messages[3]?.role, "tool");
	assert.deepEqual(result.messages[4], { role: "assistant", content: "done" });
});

test("OpenAI provider returns tool execution errors to the model", async () => {
	const failingTool: Tool = {
		...inspectTool,
		execute: () => {
			throw new Error("boom");
		},
	};
	const provider = new OpenAIProvider(
		{ enabled: true, api_key: "test", model: "fake-model" },
		[failingTool],
	);
	const responses = [
		{
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: [toolCall("call_1", "one")],
					},
				},
			],
		},
		{ choices: [{ message: { role: "assistant", content: "handled" } }] },
	];
	const fakeClient: FakeOpenAIClient = {
		chat: {
			completions: {
				create: async () => {
					const response = responses.shift();
					assert.ok(response, "fake response is available");
					return response;
				},
			},
		},
	};

	(provider as unknown as { client: FakeOpenAIClient }).client = fakeClient;
	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect" }],
	});

	const toolResult = result.messages[1];
	assert.equal(toolResult?.role, "tool");
	assert.equal(toolResult.isError, true);
	assert.match(toolResult.content, /boom/);
});

test("Agent stores provider tool-call and tool-result messages in history", async () => {
	const toolCallMessage: Message = {
		role: "assistant",
		content: "",
		toolCalls: [{ id: "call_1", name: "inspect", arguments: { path: "one" } }],
	};
	const toolResultMessage: Message = {
		role: "tool",
		toolCallId: "call_1",
		toolName: "inspect",
		content: JSON.stringify({ value: "read one" }),
	};
	const finalMessage: Message = { role: "assistant", content: "done" };
	const fakeProvider: Provider = {
		chatBot: async () => ({
			content: "done",
			messages: [toolCallMessage, toolResultMessage, finalMessage],
		}),
	};
	const agent = new Agent();
	(agent as unknown as { provider: Provider }).provider = fakeProvider;

	await agent.processMessage("inspect");

	assert.deepEqual(agent.getConversationHistory(), [
		{ role: "user", content: "inspect" },
		toolCallMessage,
		toolResultMessage,
		finalMessage,
	]);
});
