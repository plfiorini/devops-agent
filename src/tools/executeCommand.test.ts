import assert from "node:assert/strict";
import test from "node:test";
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

	assert.equal(result.ok, true);
	assert.match(result.stdout, /devops-agent/);
	assert.equal(result.exitCode, 0);
});

test("execute_command reports command timeouts", async () => {
	const result = await runCommand({ command: "sleep 1", timeoutMs: 10 });

	assert.equal(result.ok, false);
	assert.equal(result.timedOut, true);
	assert.match(result.error ?? "", /timed out/);
});

test("execute_command returns nonzero exits as structured failures", async () => {
	const result = await runCommand({ command: "false" });

	assert.equal(result.ok, false);
	assert.equal(result.exitCode, 1);
	assert.equal(result.timedOut, false);
});

test("execute_command truncates large output", async () => {
	const longText = "a".repeat(150);
	const result = await runCommand({
		command: `printf '${longText}'`,
		maxOutputChars: 100,
	});

	assert.equal(result.ok, true);
	assert.equal(result.truncated, true);
	assert.match(result.output, /output truncated/);
});
