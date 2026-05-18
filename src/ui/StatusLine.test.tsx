import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import type { AgentStatus } from "../agent.ts";
import { StatusLine } from "./StatusLine.tsx";

const baseStatus: AgentStatus = {
	initialized: true,
	activeProviderName: "ollama",
	activeModelName: "llama3",
	providers: [],
	toolCount: 3,
	conversationCount: 5,
};

describe("StatusLine", () => {
	it("shows 'ready' state when initialized and not processing", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: false }),
		);
		expect(lastFrame()).toContain("ready");
	});

	it("shows 'working' state when processing", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: true }),
		);
		expect(lastFrame()).toContain("working");
	});

	it("shows 'offline' state when not initialized", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, {
				status: { ...baseStatus, initialized: false },
				isProcessing: false,
			}),
		);
		expect(lastFrame()).toContain("offline");
	});

	it("displays the active provider name", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: false }),
		);
		expect(lastFrame()).toContain("ollama");
	});

	it("displays the active model name", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: false }),
		);
		expect(lastFrame()).toContain("llama3");
	});

	it("displays tool count", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: false }),
		);
		expect(lastFrame()).toContain("3");
	});

	it("displays conversation count", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, { status: baseStatus, isProcessing: false }),
		);
		expect(lastFrame()).toContain("5");
	});

	it("shows em dash when provider name is not set", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, {
				status: { ...baseStatus, activeProviderName: undefined },
				isProcessing: false,
			}),
		);
		expect(lastFrame()).toContain("—");
	});

	it("shows em dash when model name is not set", () => {
		const { lastFrame } = render(
			React.createElement(StatusLine, {
				status: { ...baseStatus, activeModelName: undefined },
				isProcessing: false,
			}),
		);
		expect(lastFrame()).toContain("—");
	});
});
