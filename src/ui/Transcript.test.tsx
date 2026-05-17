import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { LiveToolCalls, Transcript } from "./Transcript.tsx";
import type { TranscriptEntry, TranscriptToolCall } from "./types.ts";

describe("Transcript", () => {
	it("renders empty transcript without error", () => {
		const { lastFrame } = render(React.createElement(Transcript, { entries: [] }));
		expect(lastFrame()).toBeDefined();
	});

	it("renders a user entry", () => {
		const entries: TranscriptEntry[] = [
			{ id: "1", kind: "user", content: "Hello, world!" },
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("Hello, world!");
		expect(lastFrame()).toContain("You");
	});

	it("renders an assistant entry", () => {
		const entries: TranscriptEntry[] = [
			{ id: "2", kind: "assistant", content: "Hi there!" },
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("Hi there!");
		expect(lastFrame()).toContain("Assistant");
	});

	it("renders a command entry", () => {
		const entries: TranscriptEntry[] = [
			{ id: "3", kind: "command", content: "/clear" },
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("/clear");
	});

	it("renders an error entry", () => {
		const entries: TranscriptEntry[] = [
			{ id: "4", kind: "error", content: "Something went wrong" },
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("Something went wrong");
	});

	it("renders multiple entries", () => {
		const entries: TranscriptEntry[] = [
			{ id: "1", kind: "user", content: "Hello" },
			{ id: "2", kind: "assistant", content: "World" },
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Hello");
		expect(frame).toContain("World");
	});

	it("renders tool calls within an entry", () => {
		const entries: TranscriptEntry[] = [
			{
				id: "5",
				kind: "tool",
				content: "running tools",
				toolCalls: [
					{
						id: "tc1",
						name: "execute_command",
						arguments: { command: "ls" },
						resultContent: "file.txt",
					},
				],
			},
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("execute_command");
	});

	it("renders tool call with arguments", () => {
		const entries: TranscriptEntry[] = [
			{
				id: "6",
				kind: "tool",
				content: "",
				toolCalls: [
					{
						name: "my_tool",
						arguments: { key: "value" },
					},
				],
			},
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("my_tool");
	});

	it("renders a tool call with no arguments", () => {
		const entries: TranscriptEntry[] = [
			{
				id: "7",
				kind: "tool",
				content: "",
				toolCalls: [{ name: "no_args_tool", arguments: {} }],
			},
		];
		const { lastFrame } = render(React.createElement(Transcript, { entries }));
		expect(lastFrame()).toContain("no_args_tool()");
	});
});

describe("LiveToolCalls", () => {
	it("renders tool call names", () => {
		const toolCalls: TranscriptToolCall[] = [
			{ id: "1", name: "execute_command", arguments: { command: "pwd" } },
		];
		const { lastFrame } = render(
			React.createElement(LiveToolCalls, { toolCalls }),
		);
		expect(lastFrame()).toContain("execute_command");
	});

	it("renders error tool calls differently", () => {
		const toolCalls: TranscriptToolCall[] = [
			{
				id: "2",
				name: "failing_tool",
				arguments: {},
				isError: true,
			},
		];
		const { lastFrame } = render(
			React.createElement(LiveToolCalls, { toolCalls }),
		);
		expect(lastFrame()).toContain("failing_tool");
	});

	it("renders multiple concurrent tool calls", () => {
		const toolCalls: TranscriptToolCall[] = [
			{ name: "tool_a", arguments: {} },
			{ name: "tool_b", arguments: { x: 1 } },
		];
		const { lastFrame } = render(
			React.createElement(LiveToolCalls, { toolCalls }),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("tool_a");
		expect(frame).toContain("tool_b");
	});
});
