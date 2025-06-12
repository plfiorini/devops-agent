import { Tool, ToolSchema, ToolSchemaType } from "../types.js";

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
		const { exec } = await import("child_process");
		const { promisify } = await import("util");
		const execAsync = promisify(exec);

		try {
			const options = workingDirectory ? { cwd: workingDirectory } : {};
			const { stdout, stderr } = await execAsync(command, options);

			let result = "";
			if (stdout) result += `STDOUT:\n${stdout}`;
			if (stderr) result += `${result ? "\n" : ""}STDERR:\n${stderr}`;

			return result || "Command executed successfully (no output)";
		} catch (error: any) {
			throw new Error(`Command failed: ${error.message}`);
		}
	}
}

export default new ExecuteCommandTool();
