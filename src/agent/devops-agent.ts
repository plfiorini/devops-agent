import {
	AIMessage,
	type BaseMessage,
	HumanMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { SystemMessagePromptTemplate } from "@langchain/core/prompts";
import type { StructuredTool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { type AgentExecutor, createReactAgent } from "langchain/agents";
import type { Config } from "../config/schema";
import {
	DockerTool,
	FileReaderTool,
	ShellExecutorTool,
	SystemInfoTool,
} from "../tools/devops-tools";

// Tool execution input type
interface ToolExecution {
	name: string;
	input: Record<string, unknown>;
}

/**
 * AI Agent with tool execution capabilities and conversation history
 */
export class DevOpsAIAgent {
	private llm: ChatGoogleGenerativeAI;
	private tools: StructuredTool[];
	private agent: AgentExecutor;
	private conversationHistory: BaseMessage[];
	private systemPrompt: SystemMessagePromptTemplate;

	constructor(config: Config) {
		// Initialize the LLM
		this.llm = new ChatGoogleGenerativeAI({
			model: config.llm.gemini.model,
			apiKey: config.llm.gemini.apiKey || process.env.GOOGLE_API_KEY,
			maxOutputTokens: config.llm.gemini.maxOutputTokens,
			temperature: 0,
		});

		// Initialize tools
		this.tools = [
			new ShellExecutorTool(),
			new SystemInfoTool(),
			new DockerTool(),
			new FileReaderTool(),
		];

		// Define system prompt
		/*
		const systemPromptText = `You are a DevOps AI Assistant with access to system tools. You can help with:
- System administration and monitoring
- Docker container management
- File operations and configuration management
- Shell command execution
- Infrastructure troubleshooting

Available tools:
- shell_executor: Execute shell commands
- system_info: Get system information (os, memory, disk, processes, network)
- docker_tool: Manage Docker containers and images
- file_reader: Read file contents

When a user asks for help, analyze their request and determine if you need to use tools to gather information or perform actions. Always explain what you're doing and provide helpful context.

Guidelines:
1. Be security-conscious - don't execute dangerous commands
2. Explain what tools you're using and why
3. Provide clear, actionable advice
4. If you need to use a tool, describe what you're going to do first
5. Format tool outputs clearly for the user

You should respond in a conversational manner and use tools when appropriate to help the user with their DevOps tasks.`;
		*/
		const systemPromptText = `You are a helpful assistant for cloud architects and DevOps engineers with the ability to execute tools.

You can help with:
- Infrastructure as Code (IaC) design and implementation (Terraform, CloudFormation, Pulumi)
- Cloud services configuration across AWS, Azure, GCP, and other platforms
- CI/CD pipeline optimization using GitHub Actions, Jenkins, GitLab CI, ArgoCD, and similar tools
- Kubernetes cluster management, deployment strategies, and troubleshooting
- Container orchestration, Docker image optimization, and multi-container applications
- Observability solutions including metrics, logging, and distributed tracing
- Infrastructure automation with Ansible, Chef, or Puppet
- Security hardening, compliance checks, and DevSecOps practices
- Architectural diagrams and documentation using formats like Mermaid, PlantUML, or C4 notation

When answering:
1. First diagnose the root cause of any issues before suggesting solutions
2. Prioritize simplicity, scalability, and security in your recommendations
3. Provide code with detailed comments explaining the rationale behind each significant step
4. Include debugging tips when suggesting complex implementations
5. When applicable, mention potential cost implications of different approaches
6. When asked for architecture diagrams, create them using Mermaid syntax and explain the key components


Always analyze the results after calling a function and provide meaningful insights based on the output. If further function calls are needed to complete a task, make them proactively.

For architecture diagrams:
- Use appropriate diagram types (flowcharts, sequence diagrams, deployment diagrams) based on the context
- Label all components, connections, and data flows clearly
- Include a legend if using multiple types of connections or components
- Explain the diagram after presenting it

If you need more context to provide an accurate answer, ask clarifying questions first or use available functions to gather necessary information.`;
		this.systemPrompt = SystemMessagePromptTemplate.fromTemplate(
			systemPromptText,
		);

		// Initialize the reactive agent with tools
		const agent = createReactAgent({
			llm: this.llm,
			// tools: this.tools,
			prompt: this.systemPrompt,
		});

		// Initialize conversation history with system prompt
		this.conversationHistory = [new SystemMessage(this.systemPrompt)];
	}

	/**
	 * Process a user message and potentially execute tools
	 */
	async processMessage(userMessage: string): Promise<string> {
		try {
			// Add user message to conversation history
			this.conversationHistory.push(new HumanMessage(userMessage));

			// Get initial response from LLM
			console.log("Analyzing request...");
			const response = await this.llm.invoke(this.conversationHistory);

			// Add AI response to conversation history
			this.conversationHistory.push(new AIMessage(response.content as string));

			// Check if the response indicates tool usage is needed
			const responseText = response.content as string;
			const toolUsage = this.detectToolUsage(responseText, userMessage);

			if (toolUsage.length > 0) {
				console.log(`Executing ${toolUsage.length} tool(s)...`);

				// Execute tools and collect results
				const toolResults: string[] = [];
				for (const tool of toolUsage) {
					const result = await this.executeTool(tool.name, tool.input);
					toolResults.push(`Tool: ${tool.name}\nResult: ${result}`);
				}

				// Create a follow-up message with tool results
				const toolResultsMessage = `Tool execution results:\n\n${toolResults.join("\n\n")}`;
				this.conversationHistory.push(
					new HumanMessage(
						`Based on these tool results, please provide a comprehensive answer: ${toolResultsMessage}`,
					),
				);

				// Get final response with tool results
				const finalResponse = await this.llm.invoke(this.conversationHistory);
				this.conversationHistory.push(
					new AIMessage(finalResponse.content as string),
				);

				return finalResponse.content as string;
			}

			return responseText;
		} catch (error) {
			const errorMessage = `Error processing message: ${error instanceof Error ? error.message : String(error)}`;
			console.error(errorMessage);
			return errorMessage;
		}
	}

	/**
	 * Detect if tool usage is needed based on LLM response and user message
	 */
	private detectToolUsage(
		response: string,
		userMessage: string,
	): ToolExecution[] {
		const toolUsage: ToolExecution[] = [];
		const lowerMessage = userMessage.toLowerCase();
		const lowerResponse = response.toLowerCase();

		console.log({
			MSG: lowerMessage,
			RESP: lowerResponse,
		});

		// Detect system information requests
		if (
			lowerMessage.includes("system") ||
			lowerMessage.includes("memory") ||
			lowerMessage.includes("disk") ||
			lowerMessage.includes("cpu") ||
			lowerMessage.includes("process") ||
			lowerMessage.includes("network") ||
			lowerResponse.includes("system info") ||
			lowerResponse.includes("check system")
		) {
			if (lowerMessage.includes("memory") || lowerMessage.includes("ram")) {
				toolUsage.push({ name: "system_info", input: { info_type: "memory" } });
			} else if (
				lowerMessage.includes("disk") ||
				lowerMessage.includes("storage")
			) {
				toolUsage.push({ name: "system_info", input: { info_type: "disk" } });
			} else if (lowerMessage.includes("process")) {
				toolUsage.push({
					name: "system_info",
					input: { info_type: "processes" },
				});
			} else if (lowerMessage.includes("network")) {
				toolUsage.push({
					name: "system_info",
					input: { info_type: "network" },
				});
			} else {
				toolUsage.push({ name: "system_info", input: { info_type: "os" } });
			}
		}

		// Detect Docker requests
		if (
			lowerMessage.includes("docker") ||
			lowerMessage.includes("container") ||
			lowerResponse.includes("docker") ||
			lowerResponse.includes("container")
		) {
			if (
				lowerMessage.includes("container") &&
				!lowerMessage.includes("image")
			) {
				toolUsage.push({ name: "docker_tool", input: { action: "ps" } });
			} else if (lowerMessage.includes("image")) {
				toolUsage.push({ name: "docker_tool", input: { action: "images" } });
			} else if (
				lowerMessage.includes("stats") ||
				lowerMessage.includes("status")
			) {
				toolUsage.push({ name: "docker_tool", input: { action: "stats" } });
			} else {
				toolUsage.push({ name: "docker_tool", input: { action: "ps" } });
			}
		}

		// Detect file reading requests
		if (
			lowerMessage.includes("read file") ||
			lowerMessage.includes("show file") ||
			lowerMessage.includes("cat ") ||
			lowerMessage.includes("view file") ||
			lowerResponse.includes("read the file") ||
			lowerResponse.includes("check the file")
		) {
			// Try to extract file path from message
			const filePathMatch = userMessage.match(
				/(?:file|read|cat|view)\s+([^\s]+)/i,
			);
			if (filePathMatch) {
				toolUsage.push({
					name: "file_reader",
					input: { file_path: filePathMatch[1] },
				});
			}
		}

		// Detect shell command requests
		if (
			lowerMessage.includes("run command") ||
			lowerMessage.includes("execute") ||
			lowerMessage.includes("command") ||
			lowerResponse.includes("run the command") ||
			lowerResponse.includes("execute command")
		) {
			// Try to extract command from message
			const commandMatch = userMessage.match(/(?:run|execute|command)\s+(.+)/i);
			if (commandMatch) {
				const command = commandMatch[1].trim();
				// Basic safety check
				if (
					!command.includes("rm -rf") &&
					!command.includes("format") &&
					!command.includes("delete")
				) {
					toolUsage.push({ name: "shell_executor", input: { command } });
				}
			}
		}

		return toolUsage;
	}

	/**
	 * Execute a specific tool with given input
	 */
	private async executeTool(
		toolName: string,
		input: Record<string, unknown>,
	): Promise<string> {
		const tool = this.tools.find((t) => t.name === toolName);
		if (!tool) {
			return `Tool ${toolName} not found`;
		}

		try {
			return await tool.invoke(input);
		} catch (error) {
			return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	/**
	 * Get conversation history
	 */
	getConversationHistory(): BaseMessage[] {
		return [...this.conversationHistory];
	}

	/**
	 * Clear conversation history but keep system prompt
	 */
	clearConversationHistory(): void {
		this.conversationHistory = [new SystemMessage(this.systemPrompt)];
	}

	/**
	 * Get available tools
	 */
	getAvailableTools(): string[] {
		return this.tools.map((tool) => `${tool.name}: ${tool.description}`);
	}
}
