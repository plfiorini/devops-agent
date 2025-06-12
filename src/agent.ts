import { config } from "./config.js";
import { GeminiProvider } from "./models/gemini.js";
import { SystemPrompt } from "./systemPrompt.js";
import loadTools from "./tools.js";
import { Message, Provider, Tool } from "./types.js";

export class Agent {
	private provider?: Provider = undefined;
	private conversationHistory: Message[] = [];
	private tools: Tool[] = [];

	public getAvailableTools(): Tool[] {
		return this.tools;
	}

	/**
	 * Get conversation history
	 */
	getConversationHistory(): Message[] {
		return [...this.conversationHistory];
	}

	/**
	 * Clear conversation history but keep system prompt
	 */
	clearConversationHistory(): void {
		this.conversationHistory = [];
	}

	/**
	 * Create LLM provider and add tools to the agent.
	 */
	async initialize(): Promise<void> {
		this.tools = await loadTools();
		this.provider = new GeminiProvider(config.providers.gemini!, this.tools);
	}

	/**
	 * Process a user message and potentially execute tools
	 */
	async processMessage(userMessage: string): Promise<string> {
		if (!this.provider) {
			throw new Error(
				"Agent provider is not initialized. Call initialize() first.",
			);
		}

		try {
			// Add user message to history
			this.conversationHistory.push({
				role: "user",
				content: userMessage,
			});

			// Create request with system prompt and conversation history
			const request = {
				systemPrompt: SystemPrompt,
				messages: this.conversationHistory,
			};

			// Get response from provider
			const response = await this.provider.chatBot(request);

			// Add assistant response to history
			this.conversationHistory.push({
				role: "assistant",
				content: response.content,
			});

			return response.content;
		} catch (error) {
			console.error("Agent processing error:", error);
			throw new Error(
				`Failed to process message: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
