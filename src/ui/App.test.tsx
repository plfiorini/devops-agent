import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import type { AgentStatus } from "../agent.ts";
import type { Tool } from "../types.ts";
import { type AgentClient, DevOpsAgentApp } from "./App.tsx";

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

	async switchProvider(providerKey: string, model?: string): Promise<void> {
		this.#status = { ...this.#status, activeProviderName: providerKey };
		if (model) {
			this.#status = { ...this.#status, activeModelName: model };
		}
	}

	async switchModel(model: string): Promise<void> {
		this.#status = { ...this.#status, activeModelName: model };
	}
}

test("renders the Ink TUI shell", async () => {
	const instance = render(<DevOpsAgentApp agent={new FakeAgent()} />);

	await waitForRender();

	const frame = stripAnsi(instance.lastFrame() ?? "");
	expect(frame).toMatch(/DevOps Agent/);
	expect(frame).toMatch(/Gemini/);
	expect(frame).toMatch(/Tools: 1/);
	expect(frame).toMatch(/Enter send/);

	instance.unmount();
});

test("Composer accumulates characters typed in rapid succession", async () => {
	const instance = render(<DevOpsAgentApp agent={new FakeAgent()} />);
	await waitForRender();

	// Type "abc" without waiting for a render between characters.
	instance.stdin.write("a");
	instance.stdin.write("b");
	instance.stdin.write("c");

	await waitForRender();

	const frame = stripAnsi(instance.lastFrame() ?? "");
	expect(frame).toMatch(/abc/);

	instance.unmount();
});

test("Composer deletes one character per Backspace even when fired rapidly", async () => {
	const instance = render(<DevOpsAgentApp agent={new FakeAgent()} />);
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
	expect(frame).toMatch(/Type a message or \/help/);

	instance.unmount();
});

test("Composer clears on Esc", async () => {
	const instance = render(<DevOpsAgentApp agent={new FakeAgent()} />);
	await waitForRender();

	instance.stdin.write("hello");
	await waitForRender();
	expect(stripAnsi(instance.lastFrame() ?? "")).toMatch(/hello/);

	instance.stdin.write("\x1b"); // Esc
	await waitForRender();
	expect(stripAnsi(instance.lastFrame() ?? "")).toMatch(/Type a message or \/help/);

	instance.unmount();
});

function waitForRender() {
	return new Promise((resolve) => setTimeout(resolve, 30));
}

function stripAnsi(value: string): string {
	return value.replace(ansiPattern, "");
}
