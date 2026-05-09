import assert from "node:assert/strict";
import test from "node:test";
import { render } from "ink-testing-library";
import React from "react";
import type { AgentStatus } from "../agent.ts";
import type { Tool } from "../types.ts";
import { type AgentClient, DevOpsAgentApp } from "./App.ts";

const ansiPattern = new RegExp(
	`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
	"g",
);

class FakeAgent implements AgentClient {
	#status: AgentStatus = {
		initialized: false,
		activeProviderName: undefined,
		providers: [
			{ name: "Gemini", enabled: true, isDefault: true },
			{ name: "OpenAI", enabled: false, isDefault: false },
		],
		toolCount: 1,
		conversationCount: 0,
	};

	async initialize(): Promise<void> {
		this.#status = {
			...this.#status,
			initialized: true,
			activeProviderName: "Gemini",
		};
	}

	async processMessage(prompt: string): Promise<string> {
		this.#status = {
			...this.#status,
			conversationCount: this.#status.conversationCount + 2,
		};
		return `Response for ${prompt}`;
	}

	clearConversationHistory(): void {
		this.#status = { ...this.#status, conversationCount: 0 };
	}

	getAvailableTools(): Tool[] {
		return [
			{
				name: "execute_command",
				description: "Execute a shell command on the system",
				inputSchema: undefined as never,
				outputSchema: undefined as never,
				execute: () => "ok",
			},
		];
	}

	getProviderInfo() {
		return this.#status.providers;
	}

	getStatus(): AgentStatus {
		return this.#status;
	}
}

test("renders the Ink TUI shell", async () => {
	const instance = render(
		React.createElement(DevOpsAgentApp, { agent: new FakeAgent() }),
	);

	await waitForRender();

	const frame = stripAnsi(instance.lastFrame() ?? "");
	assert.match(frame, /DevOps Agent/);
	assert.match(frame, /Gemini/);
	assert.match(frame, /Tools: 1/);
	assert.match(frame, /Enter send/);

	instance.unmount();
});

test("Composer accumulates characters typed in rapid succession", async () => {
	const instance = render(
		React.createElement(DevOpsAgentApp, { agent: new FakeAgent() }),
	);
	await waitForRender();

	// Type "abc" without waiting for a render between characters.
	instance.stdin.write("a");
	instance.stdin.write("b");
	instance.stdin.write("c");

	await waitForRender();

	const frame = stripAnsi(instance.lastFrame() ?? "");
	assert.match(frame, /abc/);

	instance.unmount();
});

test("Composer deletes one character per Backspace even when fired rapidly", async () => {
	const instance = render(
		React.createElement(DevOpsAgentApp, { agent: new FakeAgent() }),
	);
	await waitForRender();

	instance.stdin.write("a");
	instance.stdin.write("b");
	instance.stdin.write("c");
	await waitForRender();

	// Three rapid Backspace events (\x7f) should remove all three characters.
	instance.stdin.write("\x7f");
	instance.stdin.write("\x7f");
	instance.stdin.write("\x7f");
	await waitForRender();

	const frame = stripAnsi(instance.lastFrame() ?? "");
	// Buffer is empty — the placeholder should be visible.
	assert.match(frame, /Type a message or \/help/);

	instance.unmount();
});

test("Composer clears on Esc", async () => {
	const instance = render(
		React.createElement(DevOpsAgentApp, { agent: new FakeAgent() }),
	);
	await waitForRender();

	instance.stdin.write("hello");
	await waitForRender();
	assert.match(stripAnsi(instance.lastFrame() ?? ""), /hello/);

	instance.stdin.write("\x1b"); // Esc
	await waitForRender();
	assert.match(
		stripAnsi(instance.lastFrame() ?? ""),
		/Type a message or \/help/,
	);

	instance.unmount();
});

function waitForRender() {
	return new Promise((resolve) => setTimeout(resolve, 30));
}

function stripAnsi(value: string): string {
	return value.replace(ansiPattern, "");
}
