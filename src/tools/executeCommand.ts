import { z } from "zod";
import type { Tool } from "../types.ts";

const InputSchema = z.object({
	command: z.string().describe("The shell command to execute"),
	workingDirectory: z
		.string()
		.optional()
		.describe("The working directory to execute the command in (optional)"),
});

const OutputSchema = z
	.string()
	.describe(
		"The output of the executed command, including both stdout and stderr",
	);

class ExecuteCommandTool implements Tool {
	name = "execute_command";
	description = "Execute a shell command on the system";
	inputSchema = InputSchema;
	outputSchema = OutputSchema;
	execute = async (args: z.infer<typeof InputSchema>) => {
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

		const { command, workingDirectory } = args;

		try {
			const options = workingDirectory ? { cwd: workingDirectory } : {};
			const { stdout, stderr } = await execAsync(command, options);

			let result = "";
			if (stdout) result += `STDOUT:\n${stdout}`;
			if (stderr) result += `${result ? "\n" : ""}STDERR:\n${stderr}`;

			return result || "Command executed successfully (no output)";
		} catch (error: unknown) {
			throw new Error(
				`Command failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};
}

export default new ExecuteCommandTool();
