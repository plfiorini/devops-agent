import { expect, test } from "vitest";
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
					expect(response, "fake response is available").toBeTruthy();
				return response;
			},
		},
	};

	(provider as unknown as { client: FakeAnthropicClient }).client = fakeClient;
	const result = await provider.chatBot({
		systemPrompt: "system",
		messages: [{ role: "user", content: "inspect twice" }],
	});

	expect(result.content).toBe("done");
	expect(calls.length).toBe(3);
	const inputSchema = calls[0]?.tools?.[0]?.input_schema as
		| { type?: string; properties?: unknown; parse?: unknown }
		| undefined;
	expect(inputSchema?.type).toBe("object");
	expect(inputSchema?.properties).toBeTruthy();
	expect(inputSchema?.parse).toBeUndefined();
	expect(calls[1]?.tools, "tools are included after tool results").toBeTruthy();
	expect(result.messages.length).toBe(5);
	expect(result.messages[0]?.role).toBe("assistant");
	expect("toolCalls" in result.messages[0]).toBeTruthy();
	expect(result.messages[1]?.role).toBe("tool");
	expect(result.messages[2]?.role).toBe("assistant");
	expect(result.messages[3]?.role).toBe("tool");
	expect(result.messages[4]).toEqual({ role: "assistant", content: "done" });
});
