import * as readline from 'readline';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class DevOpsAgent {
  private rl: readline.Interface;
  private availableCommands: string[] = ['exit', 'ask', 'help'];
  private geminiModel: ChatGoogleGenerativeAI;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\x1b[1m\x1b[34m> \x1b[0m'
    });

    // Initialize Gemini model
    this.geminiModel = new ChatGoogleGenerativeAI({
      model: "gemini-pro",
      apiKey: process.env.GOOGLE_API_KEY,
      maxOutputTokens: 2048,
    });

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

    if (command.startsWith('ask ')) {
      const prompt = command.substring(4).trim();
      if (prompt) {
        await this.sendToGemini(prompt);
      } else {
        console.log('Please provide a question after "ask". Example: ask How do I deploy a Docker container?');
      }
      return;
    }

    // If no specific command matched, treat it as a direct prompt to Gemini
    await this.sendToGemini(command);
  }

  private async sendToGemini(prompt: string): Promise<void> {
    try {
      console.log('\x1b[33mThinking...\x1b[0m');
      
      const message = new HumanMessage(prompt);
      const response = await this.geminiModel.invoke([message]);
      
      console.log('\x1b[32mGemini:\x1b[0m', response.content);
    } catch (error) {
      console.error('\x1b[31mError communicating with Gemini:\x1b[0m', error instanceof Error ? error.message : error);
      console.log('Please check your GOOGLE_API_KEY in the .env file');
    }
  }

  private showHelp(): void {
    console.log('\x1b[36mAvailable commands:\x1b[0m');
    console.log('  exit                    - Exit the application');
    console.log('  help                    - Show this help message');
    console.log('  ask <question>          - Ask Gemini a specific question');
    console.log('  <any text>              - Send any text directly to Gemini');
    console.log('\x1b[36mExamples:\x1b[0m');
    console.log('  ask How do I deploy a Docker container?');
    console.log('  What is Kubernetes?');
    console.log('  Explain CI/CD best practices');
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
