import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { DevOpsAIAgent } from './agent/devops-agent';
import { loadConfig } from './config/loader';
import type { Config } from './config/schema';

// Load environment variables
dotenv.config();

class DevOpsAgent {
  private rl: readline.Interface;
  private availableCommands: string[] = ['exit', 'ask', 'help', 'clear', 'tools'];
  private aiAgent: DevOpsAIAgent;
  private config: Config;

  constructor() {
    // Load configuration
    this.config = loadConfig();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    // Initialize AI Agent with configuration
    this.aiAgent = new DevOpsAIAgent(this.config);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle line input
    this.rl.on('line', async (input: string) => {
      const command = input.trim().toLowerCase();

      if (command === 'exit') {
        this.exit();
        return;
      }

      // Handle other commands here
      await this.handleCommand(command);
      this.rl.prompt();
    });

    // Handle CTRL+D (EOF)
    this.rl.on('close', () => {
      this.exit();
    });

    // Handle CTRL+C
    this.rl.on('SIGINT', () => {
      console.log('\nReceived SIGINT. Type "exit" to quit or press CTRL+D.');
      this.rl.prompt();
    });
  }

  private async handleCommand(command: string): Promise<void> {
    if (command === '') {
      return;
    }

    if (command === 'help') {
      this.showHelp();
      return;
    }

    if (command === 'clear') {
      this.clearConversation();
      return;
    }

    if (command === 'tools') {
      this.showTools();
      return;
    }

    if (command.startsWith('ask ')) {
      const prompt = command.substring(4).trim();
      if (prompt) {
        await this.sendToAgent(prompt);
      } else {
        console.log('Please provide a question after "ask". Example: ask How do I deploy a Docker container?');
      }
      return;
    }

    // If no specific command matched, treat it as a direct prompt to the AI Agent
    await this.sendToAgent(command);
  }

  private async sendToAgent(prompt: string): Promise<void> {
    try {
      console.log('Processing request...');
      
      const response = await this.aiAgent.processMessage(prompt);
      
      console.log('\nAI Agent:', response);
    } catch (error) {
      console.error('Error communicating with AI Agent:', error instanceof Error ? error.message : error);
      console.log('Please check your GOOGLE_API_KEY in the .env file');
    }
  }

  private clearConversation(): void {
    this.aiAgent.clearConversationHistory();
    console.log('Conversation history cleared.');
  }

  private showTools(): void {
    console.log('Available DevOps Tools:');
    const tools = this.aiAgent.getAvailableTools();
    for (const tool of tools) {
      console.log(`  • ${tool}`);
    }
  }

  private showHelp(): void {
    console.log('Available commands:');
    console.log('  exit                    - Exit the application');
    console.log('  help                    - Show this help message');
    console.log('  ask <question>          - Ask the AI Agent a specific question');
    console.log('  clear                   - Clear conversation history');
    console.log('  tools                   - Show available DevOps tools');
    console.log('  <any text>              - Send any text directly to the AI Agent');
    console.log('Examples:');
    console.log('  ask How do I deploy a Docker container?');
    console.log('  What is Kubernetes?');
    console.log('  Explain CI/CD best practices');
    console.log('  clear');
    console.log('  tools');
  }

  private exit(): void {
    console.log('\nGoodbye!');
    process.exit(0);
  }

  public start(): void {
    console.log('Welcome to DevOps Agent!');
    console.log(`Available commands: ${this.availableCommands.join(', ')}`);
    console.log('Type "exit" to quit or press CTRL+D');
    this.rl.prompt();
  }
}

// Start the application
const agent = new DevOpsAgent();
agent.start();
