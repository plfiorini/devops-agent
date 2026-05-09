import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { Tool } from "../types.ts";
import { GeminiProvider } from "./gemini.ts";

type FakeResponse = {
	functionCalls: () => Array<{ name: string; args: unknown }> | undefined;
	text: () => string;
};

type FakeResult = {
	response: FakeResponse;
};

type FakeChat = {
	sendMessage: (content: unknown) => Promise<FakeResult>;
};

type FakeModel = {
	startChat: (options: unknown) => FakeChat;
};

const inspectTool: Tool = {
	name: "inspect",
	description: "Inspect a path",
	inputSchema: z.object({ path: z.string() }),
	outputSchema: z.object({ value: z.string() }),
	execute: ({ path }: { path: string }) => ({ value: `read ${path}` }),
};

function makeFakeProvider(
	responses: FakeResult[],
	tools: Tool[] = [inspectTool],
): { provider: GeminiProvider; sentMessages: unknown[] } {
	const sentMessages: unknown[] = [];
	const fakeChat: FakeChat = {
		sendMessage: async (content) => {
			sentMessages.push(content);
			const response = responses.shift();
			assert.ok(response, "fake response is available");
			return response;
		},
	};
	const fakeModel: FakeModel = {
		startChat: () => fakeChat,
	};
	const provider = new GeminiProvider(
		{ enabled: true, api_key: "test", model: "fake-model" },
		tools,
	);
	(provider as unknown as { model: FakeModel }).model = fakeModel;
	return { provider, sentMessages };
}

test("Gemini provider runs multiple tool rounds and persists generated messages", async () => {
	const { provider, sentMessages } = makeFakeProvider([
		{
			response: {
				functionCalls: () => [{ name: "inspect", args: { path: "one" } }],
				text: () => "",
			},
		},
		{
			response: {
				functionCalls: () => [{ name: "inspect", args: { path: "two" } }],
				text: () => "",
			},
		},
		{
			response: {
				functionCalls: () => undefined,
				text: () => "done",
			},
		},
	]);

	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect twice" }],
	});

	assert.equal(result.content, "done");
	assert.equal(sentMessages.length, 3);
	assert.equal(result.messages.length, 5);
	assert.equal(result.messages[0]?.role, "assistant");
	assert.ok("toolCalls" in result.messages[0]);
	assert.equal(result.messages[1]?.role, "tool");
	assert.equal(result.messages[2]?.role, "assistant");
	assert.equal(result.messages[3]?.role, "tool");
	assert.deepEqual(result.messages[4], { role: "assistant", content: "done" });
});

test("Gemini provider uses stable monotonic IDs for tool calls", async () => {
	const { provider } = makeFakeProvider([
		{
			response: {
				functionCalls: () => [
					{ name: "inspect", args: { path: "a" } },
					{ name: "inspect", args: { path: "b" } },
				],
				text: () => "",
			},
		},
		{
			response: {
				functionCalls: () => undefined,
				text: () => "done",
			},
		},
	]);

	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect two paths" }],
	});

	assert.equal(result.messages.length, 4);
	const assistantMsg = result.messages[0];
	assert.ok(assistantMsg && "toolCalls" in assistantMsg);
	const toolResult0 = result.messages[1];
	const toolResult1 = result.messages[2];
	assert.ok(toolResult0?.role === "tool");
	assert.ok(toolResult1?.role === "tool");
	assert.equal(toolResult0.toolCallId, assistantMsg.toolCalls[0]?.id);
	assert.equal(toolResult1.toolCallId, assistantMsg.toolCalls[1]?.id);
});

test("Gemini provider returns tool execution errors to the model", async () => {
	const failingTool: Tool = {
		...inspectTool,
		execute: () => {
			throw new Error("boom");
		},
	};
	const { provider } = makeFakeProvider(
		[
			{
				response: {
					functionCalls: () => [{ name: "inspect", args: { path: "x" } }],
					text: () => "",
				},
			},
			{
				response: {
					functionCalls: () => undefined,
					text: () => "handled",
				},
			},
		],
		[failingTool],
	);

	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect" }],
	});

	const toolResult = result.messages[1];
	assert.equal(toolResult?.role, "tool");
	assert.equal(toolResult.isError, true);
	assert.match(toolResult.content, /boom/);
});
