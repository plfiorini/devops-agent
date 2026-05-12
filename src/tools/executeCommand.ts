import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { z } from "zod";
import type { Tool } from "../types.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_CHARS = 20_000;
const MAX_OUTPUT_CHARS = 50_000;

const InputSchema = z.object({
	command: z.string().describe("The shell command to execute"),
	workingDirectory: z
		.string()
		.optional()
		.describe("The working directory to execute the command in (optional)"),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(120_000)
		.optional()
		.describe("Maximum execution time in milliseconds"),
	maxOutputChars: z
		.number()
		.int()
		.min(100)
		.max(MAX_OUTPUT_CHARS)
		.optional()
		.describe("Maximum combined stdout/stderr characters to return"),
});

const OutputSchema = z
	.object({
		ok: z.boolean(),
		command: z.string(),
		stdout: z.string(),
		stderr: z.string(),
		output: z.string(),
		exitCode: z.number().nullable(),
		signal: z.string().nullable(),
		timedOut: z.boolean(),
		truncated: z.boolean(),
		error: z.string().optional(),
	})
	.describe("Structured result for a command execution attempt");

type CommandResult = z.infer<typeof OutputSchema>;

class ExecuteCommandTool implements Tool {
	name = "execute_command";
	description = "Execute a shell command on the system";
	inputSchema = InputSchema;
	outputSchema = OutputSchema;
	isError = (result: CommandResult) => !result.ok;
	formatResult = (result: CommandResult): string =>
		result.output ||
		result.error ||
		"Command executed successfully (no output)";

	execute = (args: z.infer<typeof InputSchema>): Promise<CommandResult> => {
		const {
			command,
			workingDirectory,
			timeoutMs = DEFAULT_TIMEOUT_MS,
			maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
		} = args;

		return new Promise((resolve) => {
			const child = spawn("/bin/sh", ["-c", command], {
				cwd: workingDirectory,
				stdio: ["ignore", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";
			let output = "";
			let truncated = false;

			const appendOutput = (chunk: string) => {
				if (truncated) return;
				const remaining = maxOutputChars - output.length;
				if (chunk.length > remaining) {
					output += `${chunk.slice(0, remaining)}\n[output truncated]`;
					truncated = true;
				} else {
					output += chunk;
				}
			};

			const stdoutDecoder = new StringDecoder("utf8");
			const stderrDecoder = new StringDecoder("utf8");

			child.stdout?.on("data", (data: Buffer) => {
				const s = stdoutDecoder.write(data);
				stdout += s;
				appendOutput(s);
			});

			child.stderr?.on("data", (data: Buffer) => {
				const s = stderrDecoder.write(data);
				stderr += s;
				appendOutput(s);
			});

			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGTERM");
			}, timeoutMs);

			child.on("close", (code, signal) => {
				clearTimeout(timer);
				// Flush any remaining buffered bytes from the decoders.
				const stdoutRemainder = stdoutDecoder.end();
				const stderrRemainder = stderrDecoder.end();
				if (stdoutRemainder) {
					stdout += stdoutRemainder;
					appendOutput(stdoutRemainder);
				}
				if (stderrRemainder) {
					stderr += stderrRemainder;
					appendOutput(stderrRemainder);
				}
				resolve({
					ok: code === 0 && !timedOut,
					command,
					stdout,
					stderr,
					output,
					exitCode: code,
					signal: signal ?? null,
					timedOut,
					truncated,
					...(timedOut
						? { error: `Command timed out after ${timeoutMs}ms` }
						: {}),
				});
			});

			child.on("error", (err) => {
				clearTimeout(timer);
				resolve({
					ok: false,
					command,
					stdout,
					stderr,
					output: output || err.message,
					exitCode: null,
					signal: null,
					timedOut: false,
					truncated,
					error: err.message,
				});
			});
		});
	};
}

export default new ExecuteCommandTool();
