# DevOps AI Agent

A powerful AI-powered DevOps assistant that helps with infrastructure automation, CI/CD pipelines, containerization, and cloud deployments.

## Features

- 🤖 **AI-Powered Assistant**: Leverages multiple LLMs for intelligent DevOps guidance
- 🛠️ **Tool Integration**: Extensible tool system for executing system commands
- 💬 **Interactive Chat Interface**: Command-line chat interface with conversation history
- 🔧 **DevOps Expertise**: Specialized in infrastructure automation and deployment strategies
- 📝 **TypeScript**: Fully typed codebase for better development experience
- 🎯 **Modular Architecture**: Clean separation of concerns with pluggable providers and tools

## Architecture

The project follows a modular architecture:

```
src/
├── agent.ts           # Main AI agent orchestrator
├── chatbot.ts         # Interactive CLI interface
├── config.ts          # Configuration management
├── index.ts           # Application entry point
├── tools.ts           # Tool loading system
├── types.ts           # TypeScript type definitions
├── models/
│   └── gemini.ts      # Google Gemini AI provider
└── tools/
    └── executeCommand.ts  # Shell command execution tool
```

### Key Components

- **Agent**: Core orchestrator that manages conversation history and tool execution
- **ChatBot**: Interactive command-line interface for user interactions
- **GeminiProvider**: Integration with Google's Gemini AI model
- **Tools System**: Extensible framework for adding new capabilities
- **Configuration**: YAML-based configuration management

## Prerequisites

- Node.js 18+ (ES2024 support required)
- Google Gemini API key
- TypeScript knowledge (for development)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd devops-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure the application**:
   ```bash
   cp config.yaml.example config.yaml
   ```
   
   Edit `config.yaml` and add your Google Gemini API key:
   ```yaml
   providers:
     gemini:
       api_key: "your-gemini-api-key"
       model: "your-model"
   ```

## Usage

### Development Mode

Run the application in development mode with auto-reload:

```bash
npm run dev
```

### Production Mode

Build and run the application:

```bash
npm run build
npm start
```

### Interactive Commands

Once the application is running, you can use the following commands:

- `help` - Show available commands
- `ask <question>` - Ask the AI agent a specific question
- `tools` - List available tools
- `clear` - Clear conversation history
- `exit` - Exit the application

### Example Usage

```
> ask How do I create a Dockerfile for a Node.js application?
> What are the best practices for Kubernetes deployments?
> tools
> clear
> exit
```

## Configuration

The application uses a YAML configuration file (`config.yaml`) with the following structure:

```yaml
providers:
  gemini:
    api_key: "your-api-key-here"
    model: "your-model"
```

## Development

### Scripts

- `npm run typecheck` - Type checking without compilation
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Development mode with auto-reload
- `npm run start` - Run the compiled application
- `npm run check` - Run Biome linter and formatter checks
- `npm run check:fix` - Auto-fix linting and formatting issues
- `npm run format` - Format code with Biome
- `npm run format:write` - Format and write changes
- `npm run lint` - Run Biome linter

## Security

- **API Keys**: Store API keys securely in `config.yaml` (excluded from version control)
- **Command Execution**: The execute command tool runs with the same permissions as the Node.js process
- **Input Validation**: All tool parameters are validated according to their schemas

## License

This project is licensed under the AGPL-3.0-only License. See the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `npm run check`
5. Submit a pull request

## Troubleshooting

### Common Issues

**"Provider configuration is missing"**
- Ensure `config.yaml` exists and contains valid provider configuration
- Check that your API key is correct and has proper permissions

**"API key is required"**
- Verify your API key in `config.yaml`
- Make sure the API key has access to the provider

**Tool execution failures**
- Check that the system has the necessary permissions for command execution
- Verify that required system tools are installed
