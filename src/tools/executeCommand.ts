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

function makeResult(
	command: string,
	fields: Omit<CommandResult, "command" | "output" | "truncated"> & {
		truncated?: boolean;
	},
	maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
): CommandResult {
	const { output, truncated } = formatOutput(
		fields.stdout,
		fields.stderr || (!fields.ok && fields.error ? fields.error : ""),
		maxOutputChars,
	);

	return {
		...fields,
		command,
		output,
		truncated: fields.truncated || truncated,
	};
}

function formatOutput(
	stdout: string,
	stderr: string,
	maxOutputChars: number,
): { output: string; truncated: boolean } {
	const sections: string[] = [];
	if (stdout) {
		sections.push(`STDOUT:\n${stdout}`);
	}
	if (stderr) {
		sections.push(`STDERR:\n${stderr}`);
	}

	const output =
		sections.join("\n") || "Command executed successfully (no output)";
	if (output.length <= maxOutputChars) {
		return { output, truncated: false };
	}

	return {
		output: `${output.slice(0, maxOutputChars)}\n[output truncated]`,
		truncated: true,
	};
}

class ExecuteCommandTool implements Tool {
	name = "execute_command";
	description = "Execute a shell command on the system";
	inputSchema = InputSchema;
	outputSchema = OutputSchema;
	execute = async (args: z.infer<typeof InputSchema>) => {
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

		const {
			command,
			workingDirectory,
			timeoutMs = DEFAULT_TIMEOUT_MS,
			maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
		} = args;

		try {
			const options = {
				...(workingDirectory ? { cwd: workingDirectory } : {}),
				timeout: timeoutMs,
				maxBuffer: Math.max(maxOutputChars * 4, 1024 * 1024),
			};
			const { stdout, stderr } = await execAsync(command, options);

			return makeResult(
				command,
				{
					ok: true,
					stdout,
					stderr,
					exitCode: 0,
					signal: null,
					timedOut: false,
				},
				maxOutputChars,
			);
		} catch (error: unknown) {
			const execError = error as Error & {
				code?: number;
				signal?: string;
				stdout?: string;
				stderr?: string;
				killed?: boolean;
			};
			const timedOut =
				execError.killed === true || execError.signal === "SIGTERM";
			return makeResult(
				command,
				{
					ok: false,
					stdout: execError.stdout ?? "",
					stderr: execError.stderr ?? "",
					exitCode: typeof execError.code === "number" ? execError.code : null,
					signal: execError.signal ?? null,
					timedOut,
					error: timedOut
						? `Command timed out after ${timeoutMs}ms`
						: execError.message,
				},
				maxOutputChars,
			);
		}
	};
}

export default new ExecuteCommandTool();
