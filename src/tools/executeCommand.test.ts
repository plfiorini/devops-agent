import { describe, expect, it } from "bun:test";
import tool from "./executeCommand.ts";

const exec = (
	command: string,
	opts: {
		workingDirectory?: string;
		timeoutMs?: number;
		maxOutputChars?: number;
	} = {},
) =>
	tool.execute({
		command,
		workingDirectory: opts.workingDirectory,
		timeoutMs: opts.timeoutMs,
		maxOutputChars: opts.maxOutputChars,
	});

describe("ExecuteCommandTool metadata", () => {
	it("has the correct name", () => {
		expect(tool.name).toBe("execute_command");
	});

	it("has a non-empty description", () => {
		expect(typeof tool.description).toBe("string");
		expect(tool.description.length).toBeGreaterThan(0);
	});

	it("has inputSchema and outputSchema", () => {
		expect(tool.inputSchema).toBeDefined();
		expect(tool.outputSchema).toBeDefined();
	});
});

describe("basic execution", () => {
	it("runs echo and captures stdout", async () => {
		const result = await exec("echo hello");
		expect(result.ok).toBe(true);
		expect(result.stdout.trim()).toBe("hello");
		expect(result.exitCode).toBe(0);
		expect(result.timedOut).toBe(false);
		expect(result.truncated).toBe(false);
		expect(result.command).toBe("echo hello");
	});

	it("captures stderr separately", async () => {
		const result = await exec("echo error >&2");
		expect(result.stderr.trim()).toBe("error");
	});

	it("captures both stdout and stderr in combined output", async () => {
		const result = await exec("echo out; echo err >&2");
		expect(result.output).toContain("out");
	});

	it("handles a command with no output", async () => {
		const result = await exec("true");
		expect(result.ok).toBe(true);
		expect(result.exitCode).toBe(0);
	});
});

describe("non-zero exit code", () => {
	it("ok is false when command exits non-zero", async () => {
		const result = await exec("exit 1");
		expect(result.ok).toBe(false);
		expect(result.exitCode).toBe(1);
	});

	it("ok is false for exit code 42", async () => {
		const result = await exec("exit 42");
		expect(result.ok).toBe(false);
		expect(result.exitCode).toBe(42);
	});
});

describe("working directory", () => {
	it("runs command in the specified working directory", async () => {
		const result = await exec("pwd", { workingDirectory: "/tmp" });
		expect(result.ok).toBe(true);
		// macOS resolves /tmp → /private/tmp
		expect(result.stdout.trim()).toMatch(/\/tmp/);
	});
});

describe("timeout", () => {
	it("sets timedOut and ok=false when command exceeds timeoutMs", async () => {
		const result = await exec("sleep 10", { timeoutMs: 150 });
		expect(result.timedOut).toBe(true);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("150ms");
	});
});

describe("output truncation", () => {
	it("truncates output when it exceeds maxOutputChars", async () => {
		// Generate ~200 chars then truncate at 100
		const result = await exec(
			"python3 -c \"print('A'*200)\" 2>/dev/null || printf '%0.s!' {1..200}",
			{ maxOutputChars: 100 },
		);
		expect(result.truncated).toBe(true);
		expect(result.output).toContain("[output truncated]");
		expect(result.output.length).toBeLessThan(200);
	});
});

describe("isError predicate", () => {
	it("returns true when ok is false", () => {
		const fakeResult = {
			ok: false,
			command: "x",
			stdout: "",
			stderr: "",
			output: "",
			exitCode: 1,
			signal: null,
			timedOut: false,
			truncated: false,
		};
		expect(tool.isError?.(fakeResult)).toBe(true);
	});

	it("returns false when ok is true", () => {
		const fakeResult = {
			ok: true,
			command: "x",
			stdout: "hi",
			stderr: "",
			output: "hi",
			exitCode: 0,
			signal: null,
			timedOut: false,
			truncated: false,
		};
		expect(tool.isError?.(fakeResult)).toBe(false);
	});
});

describe("formatResult", () => {
	it("returns output when present", () => {
		const result = {
			ok: true,
			command: "x",
			stdout: "hi",
			stderr: "",
			output: "hi",
			exitCode: 0,
			signal: null,
			timedOut: false,
			truncated: false,
		};
		expect(tool.formatResult?.(result)).toBe("hi");
	});

	it("returns error when output is empty", () => {
		const result = {
			ok: false,
			command: "x",
			stdout: "",
			stderr: "",
			output: "",
			exitCode: 1,
			signal: null,
			timedOut: false,
			truncated: false,
			error: "command failed",
		};
		expect(tool.formatResult?.(result)).toBe("command failed");
	});

	it("returns default message when both output and error are empty", () => {
		const result = {
			ok: true,
			command: "x",
			stdout: "",
			stderr: "",
			output: "",
			exitCode: 0,
			signal: null,
			timedOut: false,
			truncated: false,
		};
		expect(tool.formatResult?.(result)).toBe(
			"Command executed successfully (no output)",
		);
	});
});
