import { expect, test } from "vitest";
import executeCommand from "./executeCommand.ts";

type CommandResult = {
	ok: boolean;
	stdout: string;
	output: string;
	exitCode: number | null;
	timedOut: boolean;
	truncated: boolean;
	error?: string;
};

async function runCommand(args: {
	command: string;
	timeoutMs?: number;
	maxOutputChars?: number;
}): Promise<CommandResult> {
	return (await executeCommand.execute(args)) as CommandResult;
}

test("execute_command runs a basic command", async () => {
	const result = await runCommand({ command: "pwd" });

	expect(result.ok).toBe(true);
	expect(result.stdout).toMatch(/devops-agent/);
	expect(result.exitCode).toBe(0);
});

test("execute_command reports command timeouts", async () => {
	const result = await runCommand({ command: "sleep 1", timeoutMs: 10 });

	expect(result.ok).toBe(false);
	expect(result.timedOut).toBe(true);
	expect(result.error ?? "").toMatch(/timed out/);
});

test("execute_command returns nonzero exits as structured failures", async () => {
	const result = await runCommand({ command: "false" });

	expect(result.ok).toBe(false);
	expect(result.exitCode).toBe(1);
	expect(result.timedOut).toBe(false);
});

test("execute_command truncates large output", async () => {
	const longText = "a".repeat(150);
	const result = await runCommand({
		command: `printf '${longText}'`,
		maxOutputChars: 100,
	});

	expect(result.ok).toBe(true);
	expect(result.truncated).toBe(true);
	expect(result.output).toMatch(/output truncated/);
});
