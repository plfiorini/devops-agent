import { type Tool, type ToolSchema, ToolSchemaType } from "../types.ts";

class ExecuteCommandTool implements Tool {
	schema: ToolSchema = {
		name: "execute_command",
		description: "Execute a shell command on the system",
		parameters: {
			properties: {
				command: {
					type: ToolSchemaType.STRING,
					description: "The shell command to execute",
				},
				workingDirectory: {
					type: ToolSchemaType.STRING,
					description:
						"The working directory to execute the command in (optional)",
				},
			},
			required: ["command"],
		},
	};

	async run({
		command,
		workingDirectory,
	}: { command: string; workingDirectory?: string }): Promise<string> {
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

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
	}
}

export default new ExecuteCommandTool();
