import * as readline from "readline";
import { Agent } from "./agent.js";
import { printMarkdown } from "./utils/markdownRenderer.js";

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
		await this.agent.initialize();

		console.log("Welcome to DevOps Agent!");

		// Display available providers
		console.log("\nAvailable AI Providers:");
		const providers = this.agent.getProviderInfo();
		for (const provider of providers) {
			const status = provider.enabled ? "✓ Enabled" : "✗ Disabled";
			const defaultMark = provider.isDefault ? " (Default)" : "";
			console.log(`  • ${provider.name}: ${status}${defaultMark}`);
		}

		console.log(`\nAvailable commands: ${this.availableCommands.join(", ")}`);
		console.log('Type "exit" to quit or press CTRL+D');
		this.rl.prompt();
	}

	private setupEventHandlers(): void {
		this.rl.on("line", async (line: string) => {
			const command = line.trim().toLowerCase();

			if (command === "exit") {
				this.rl.close();
				return;
			}

			// Handle other commands here
			await this.handleCommand(command);
			this.rl.prompt();
		});

		// Handle CTRL+D (EOF)
		this.rl.on("close", () => {
			console.log("\n👋 Good Bye!");
			process.exit(0);
		});

		// Handle CTRL+C
		this.rl.on("SIGINT", () => {
			console.log('\nReceived SIGINT. Type "exit" to quit or press CTRL+D.');
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
			this.showStatus();
			return;
		}

		if (command.startsWith("ask ")) {
			const prompt = command.substring(4).trim();
			if (prompt) {
				await this.sendToAgent(prompt);
			} else {
				console.log(
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
			console.log("Processing request...");

			const response = await this.agent.processMessage(prompt);

			console.log("\nAI Agent:");
			await printMarkdown(response);
		} catch (error) {
			console.error(
				"Error communicating with AI Agent:",
				error instanceof Error ? error.message : error,
			);
		}
	}

	private clearConversation(): void {
		this.agent.clearConversationHistory();
	}

	private showTools(): void {
		console.log("Available tools:");
		const tools = this.agent.getAvailableTools();
		for (const tool of tools) {
			console.log(`  • ${tool.schema.name}: ${tool.schema.description}`);
		}
	}

	private showHelp(): void {
		console.log("Available commands:");
		console.log("  exit                    - Exit the application");
		console.log("  help                    - Show this help message");
		console.log(
			"  ask <question>          - Ask the AI Agent a specific question",
		);
		console.log("  clear                   - Clear conversation history");
		console.log("  tools                   - Show available tools");
		console.log("  status                  - Show AI provider status");
		console.log(
			"  <any text>              - Send any text directly to the AI Agent",
		);
		console.log("Examples:");
		console.log("  ask How do I deploy a Docker container?");
		console.log("  What is Kubernetes?");
		console.log("  Explain CI/CD best practices");
		console.log("  clear");
		console.log("  tools");
		console.log("  status");
	}

	private showStatus(): void {
		console.log("AI Provider Status:");
		const providers = this.agent.getProviderInfo();
		for (const provider of providers) {
			const status = provider.enabled ? "✓ Enabled" : "✗ Disabled";
			const defaultMark = provider.isDefault ? " (Default)" : "";
			console.log(`  • ${provider.name}: ${status}${defaultMark}`);
		}
	}
}
