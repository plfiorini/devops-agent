import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { Tool } from "../types.ts";
import { AnthropicProvider } from "./anthropic.ts";

type MessageCreateParams = {
	messages: unknown[];
	tools?: Array<{ input_schema?: unknown }>;
};

type FakeAnthropicClient = {
	messages: {
		create: (params: MessageCreateParams) => Promise<unknown>;
	};
};

const inspectTool: Tool = {
	name: "inspect",
	description: "Inspect a path",
	inputSchema: z.object({ path: z.string() }),
	outputSchema: z.object({ value: z.string() }),
	execute: ({ path }: { path: string }) => ({ value: `read ${path}` }),
};

function toolUse(id: string, path: string) {
	return {
		type: "tool_use",
		id,
		name: "inspect",
		input: { path },
	};
}

test("Anthropic provider converts schemas and runs repeated tool rounds", async () => {
	const responses = [
		{ content: [toolUse("toolu_1", "one")] },
		{ content: [toolUse("toolu_2", "two")] },
		{ content: [{ type: "text", text: "done" }] },
	];
	const calls: MessageCreateParams[] = [];
	const provider = new AnthropicProvider(
		{ enabled: true, api_key: "test", model: "fake-model" },
		[inspectTool],
	);
	const fakeClient: FakeAnthropicClient = {
		messages: {
			create: async (params) => {
				calls.push(params);
				const response = responses.shift();
				assert.ok(response, "fake response is available");
				return response;
			},
		},
	};

	(provider as unknown as { client: FakeAnthropicClient }).client = fakeClient;
	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect twice" }],
	});

	assert.equal(result.content, "done");
	assert.equal(calls.length, 3);
	const inputSchema = calls[0]?.tools?.[0]?.input_schema as
		| { type?: string; properties?: unknown; parse?: unknown }
		| undefined;
	assert.equal(inputSchema?.type, "object");
	assert.ok(inputSchema?.properties);
	assert.equal(inputSchema?.parse, undefined);
	assert.ok(calls[1]?.tools, "tools are included after tool results");
	assert.equal(result.messages.length, 5);
	assert.equal(result.messages[0]?.role, "assistant");
	assert.ok("toolCalls" in result.messages[0]);
	assert.equal(result.messages[1]?.role, "tool");
	assert.equal(result.messages[2]?.role, "assistant");
	assert.equal(result.messages[3]?.role, "tool");
	assert.deepEqual(result.messages[4], { role: "assistant", content: "done" });
});
