import * as readline from 'readline';

class DevOpsAgent {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle line input
    this.rl.on('line', (input: string) => {
      const command = input.trim().toLowerCase();

      if (command === 'exit') {
        this.exit();
        return;
      }

      // Handle other commands here
      this.handleCommand(command);
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

  private handleCommand(command: string): void {
    if (command === '') {
      return;
    }

    console.log(`Unknown command: ${command}`);
    console.log('Available commands: exit');
  }

  private exit(): void {
    console.log('\nGoodbye!');
    process.exit(0);
  }

  public start(): void {
    console.log('Welcome to DevOps Agent!');
    console.log('Type "exit" to quit or press CTRL+D');
    this.rl.prompt();
  }
}

// Start the application
const agent = new DevOpsAgent();
agent.start();
