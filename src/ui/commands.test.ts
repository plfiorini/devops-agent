import { expect, test } from "vitest";
import { parseInput } from "./commands.ts";

test("parseInput maps slash commands", () => {
	expect(parseInput("/tools")).toEqual({ type: "command", name: "tools" });
	expect(parseInput("/status")).toEqual({ type: "command", name: "status" });
	expect(parseInput("/clear")).toEqual({ type: "command", name: "clear" });
	expect(parseInput("/exit")).toEqual({ type: "command", name: "exit" });
});

test("parseInput keeps prompts intact", () => {
	expect(parseInput("Deploy this service")).toEqual({
		type: "prompt",
		prompt: "Deploy this service",
	});
	expect(parseInput("ask How do I roll back?")).toEqual({
		type: "prompt",
		prompt: "ask How do I roll back?",
	});
	expect(parseInput("help me debug Kubernetes")).toEqual({
		type: "prompt",
		prompt: "help me debug Kubernetes",
	});
	expect(parseInput("help")).toEqual({
		type: "prompt",
		prompt: "help",
	});
	expect(parseInput("exit")).toEqual({
		type: "prompt",
		prompt: "exit",
	});
});

test("parseInput rejects unknown slash commands", () => {
	expect(parseInput("/deploy")).toEqual({
		type: "invalid",
		message: 'Unknown command "/deploy". Type /help for commands.',
	});
});
