import { expect, test } from "vitest";
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
			expect(response, "fake response is available").toBeTruthy();
			return response as FakeResult;
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

	expect(result.content).toBe("done");
	expect(sentMessages.length).toBe(3);
	expect(result.messages.length).toBe(5);
	expect(result.messages[0]?.role).toBe("assistant");
	expect("toolCalls" in result.messages[0]).toBeTruthy();
	expect(result.messages[1]?.role).toBe("tool");
	expect(result.messages[2]?.role).toBe("assistant");
	expect(result.messages[3]?.role).toBe("tool");
	expect(result.messages[4]).toEqual({ role: "assistant", content: "done" });
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

	expect(result.messages.length).toBe(4);
	const assistantMsg = result.messages[0];
	expect(assistantMsg && "toolCalls" in assistantMsg).toBeTruthy();
	const toolResult0 = result.messages[1];
	const toolResult1 = result.messages[2];
	expect(toolResult0?.role).toBe("tool");
	expect(toolResult1?.role).toBe("tool");
	expect(toolResult0?.toolCallId).toBe(
		(assistantMsg as Extract<typeof assistantMsg, { toolCalls: unknown[] }>).toolCalls[0]?.id,
	);
	expect(toolResult1?.toolCallId).toBe(
		(assistantMsg as Extract<typeof assistantMsg, { toolCalls: unknown[] }>).toolCalls[1]?.id,
	);
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
	expect(toolResult?.role).toBe("tool");
	expect((toolResult as Extract<typeof toolResult, { isError: unknown }>)?.isError).toBe(true);
	expect((toolResult as Extract<typeof toolResult, { content: string }>)?.content).toMatch(/boom/);
});
