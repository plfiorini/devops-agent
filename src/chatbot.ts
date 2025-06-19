import { styleText } from "node:util";
import * as readline from "readline";
import { Agent } from "./agent.ts";
import logger from "./logger.ts";
import { printMarkdown } from "./utils/markdownRenderer.ts";

export class ChatBot {
	private readonly rl: readline.Interface;
	private readonly availableCommands: string[] = [
		"exit",
		"ask",
		"help",
		"clear",
		"tools",
		"status",
	];
	private readonly agent: Agent;

	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: "> ",
		});

		this.agent = new Agent();

		this.setupEventHandlers();
	}

	public async start(): Promise<void> {
		console.log(styleText(["blueBright", "bold"], "Welcome to DevOps Agent!"));

		await this.agent.initialize();

		// Show information
		await this.showStatus();
		this.showCommands();

		logger.log('\nType "exit" to quit or press CTRL+D');
		this.rl.prompt();
	}

	private setupEventHandlers(): void {
		this.rl.on("line", async (line: string) => {
			const command = line.trim().toLowerCase();

			if (command === "exit") {
				await this.agent.cleanup();
				this.rl.close();
				return;
			}

			// Handle other commands here
			await this.handleCommand(command);
			this.rl.prompt();
		});

		// Handle CTRL+D (EOF)
		this.rl.on("close", async () => {
			logger.log("\n👋 Good Bye!");
			await this.agent.cleanup();
			process.exit(0);
		});

		// Handle CTRL+C
		this.rl.on("SIGINT", () => {
			logger.log('\nReceived SIGINT. Type "exit" to quit or press CTRL+D.');
			this.rl.prompt();
		});
	}

	private async handleCommand(command: string): Promise<void> {
		if (command === "") {
			return;
		}

		if (command === "help") {
			this.showHelp();
			return;
		}

		if (command === "clear") {
			this.clearConversation();
			return;
		}

		if (command === "tools") {
			this.showTools();
			return;
		}

		if (command === "status") {
			await this.showStatus();
			return;
		}

		if (command.startsWith("ask ")) {
			const prompt = command.substring(4).trim();
			if (prompt) {
				await this.sendToAgent(prompt);
			} else {
				logger.log(
					'Please provide a question after "ask". Example: ask How do I deploy a Docker container?',
				);
			}
			return;
		}

		// If no specific command matched, treat it as a direct prompt to the AI Agent
		await this.sendToAgent(command);
	}

	private async sendToAgent(prompt: string): Promise<void> {
		try {
			logger.log("Processing request...");

			const response = await this.agent.processMessage(prompt);

			logger.log("\nAI Agent:");
			await printMarkdown(response);
		} catch (error) {
			logger.error(
				"Error communicating with AI Agent:",
				error instanceof Error ? error.message : error,
			);
		}
	}

	private clearConversation(): void {
		this.agent.clearConversationHistory();
	}

	private showTools(): void {
		logger.log("Available tools:");
		const tools = this.agent.getAvailableTools();
		for (const tool of tools) {
			logger.log(`  • ${tool.name}: ${tool.description}`);
		}
	}

	private showCommands(): void {
		console.log(`Available commands: ${this.availableCommands.join(", ")}`);
	}

	private showHelp(): void {
		logger.log("Available commands:");
		logger.log("  exit                    - Exit the application");
		logger.log("  help                    - Show this help message");
		logger.log(
			"  ask <question>          - Ask the AI Agent a specific question",
		);
		logger.log("  clear                   - Clear conversation history");
		logger.log("  tools                   - Show available tools");
		logger.log("  status                  - Show status");
		logger.log(
			"  <any text>              - Send any text directly to the AI Agent",
		);
		logger.log("Examples:");
		logger.log("  ask How do I deploy a Docker container?");
		logger.log("  What is Kubernetes?");
		logger.log("  Explain CI/CD best practices");
		logger.log("  clear");
		logger.log("  tools");
		logger.log("  status");
	}

	private async showStatus(): Promise<void> {
		this.showAgentStatus();
		await this.showMCPStatus();
	}

	private showAgentStatus(): void {
		logger.log("AI Provider Status:");
		const providers = this.agent.getProviderInfo();
		for (const provider of providers) {
			const status = provider.enabled ? "✓ Enabled" : "✗ Disabled";
			const defaultMark = provider.isDefault ? " (Default)" : "";
			logger.log(`  • ${provider.name}: ${status}${defaultMark}`);
		}
	}

	private async showMCPStatus(): Promise<void> {
		console.log("MCP Server Status:");
		try {
			const mcpManager = this.agent.getMCPManager();
			const servers = mcpManager.getConnectedServers();

			if (servers.length === 0) {
				console.log("  No MCP servers configured");
				return;
			}

			for (const server of servers) {
				const status = mcpManager.isServerConnected(server.id)
					? "✓ Connected"
					: "✗ Disconnected";
				console.log(`  • ${server.name}: ${status}`);
				console.log(`    Command: ${server.config.command}`);
				console.log(`    Args: ${server.config.args.join(" ")}`);
			}

			// Show available tools count
			const tools = await mcpManager.getAvailableTools();
			console.log(`\nMCP Tools: ${tools.length} available`);

			// Show available resources count
			const resources = await mcpManager.getAvailableResources();
			console.log(`MCP Resources: ${resources.length} available`);

			// Show available prompts count
			const prompts = await mcpManager.getAvailablePrompts();
			console.log(`MCP Prompts: ${prompts.length} available`);
		} catch (error) {
			console.error("Error getting MCP status:", error);
		}
	}
}
