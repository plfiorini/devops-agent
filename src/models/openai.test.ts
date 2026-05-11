import { expect, test } from "vitest";
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
					expect(response, "fake response is available").toBeTruthy();
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

	expect(result.content).toBe("done");
	expect(calls.length).toBe(3);
	expect(calls[1]?.tools, "tools are included on the second model turn").toBeTruthy();
	expect(calls[2]?.tools, "tools are included on the final model turn").toBeTruthy();
	expect(result.messages.length).toBe(5);
	expect(result.messages[0]?.role).toBe("assistant");
	expect("toolCalls" in result.messages[0]).toBeTruthy();
	expect(result.messages[1]?.role).toBe("tool");
	expect(result.messages[2]?.role).toBe("assistant");
	expect(result.messages[3]?.role).toBe("tool");
	expect(result.messages[4]).toEqual({ role: "assistant", content: "done" });
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
						expect(response, "fake response is available").toBeTruthy();
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
	expect(toolResult?.role).toBe("tool");
	expect((toolResult as Extract<typeof toolResult, { isError: unknown }>)?.isError).toBe(true);
	expect((toolResult as Extract<typeof toolResult, { content: string }>)?.content).toMatch(/boom/);
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

	expect(agent.getConversationHistory()).toEqual([
		{ role: "user", content: "inspect" },
		toolCallMessage,
		toolResultMessage,
		finalMessage,
	]);
});
