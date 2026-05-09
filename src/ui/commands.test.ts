import assert from "node:assert/strict";
import test from "node:test";
import { parseInput } from "./commands.ts";

test("parseInput maps slash commands", () => {
	assert.deepEqual(parseInput("/tools"), { type: "command", name: "tools" });
	assert.deepEqual(parseInput("/status"), { type: "command", name: "status" });
	assert.deepEqual(parseInput("/clear"), { type: "command", name: "clear" });
	assert.deepEqual(parseInput("/exit"), { type: "command", name: "exit" });
});

test("parseInput keeps prompts intact", () => {
	assert.deepEqual(parseInput("Deploy this service"), {
		type: "prompt",
		prompt: "Deploy this service",
	});
	assert.deepEqual(parseInput("ask How do I roll back?"), {
		type: "prompt",
		prompt: "ask How do I roll back?",
	});
	assert.deepEqual(parseInput("help me debug Kubernetes"), {
		type: "prompt",
		prompt: "help me debug Kubernetes",
	});
	assert.deepEqual(parseInput("help"), {
		type: "prompt",
		prompt: "help",
	});
	assert.deepEqual(parseInput("exit"), {
		type: "prompt",
		prompt: "exit",
	});
});

test("parseInput rejects unknown slash commands", () => {
	assert.deepEqual(parseInput("/deploy"), {
		type: "invalid",
		message: 'Unknown command "/deploy". Type /help for commands.',
	});
});
