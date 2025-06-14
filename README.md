# DevOps AI Agent

A powerful AI-powered DevOps assistant that helps with infrastructure automation, CI/CD pipelines, containerization, and cloud deployments.

## Features

- 🤖 **AI-Powered Assistant**: Leverages multiple LLMs (Google Gemini, Azure OpenAI, OpenAI) for intelligent DevOps guidance
- 🛠️ **Tool Integration**: Extensible tool system for executing system commands
- 💬 **Interactive Chat Interface**: Command-line chat interface with conversation history
- 🎨 **Rich Terminal Output**: Beautiful markdown rendering with ANSI colors and formatting
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
│   ├── gemini.ts      # Google Gemini AI provider
│   ├── azureOpenAI.ts # Azure OpenAI provider
│   └── openai.ts      # OpenAI provider
├── tools/
│   └── executeCommand.ts  # Shell command execution tool
└── utils/
    └── markdownRenderer.ts # Terminal markdown rendering with ANSI colors
```

### Key Components

- **Agent**: Core orchestrator that manages conversation history and tool execution
- **ChatBot**: Interactive command-line interface with rich markdown rendering for user interactions
- **Markdown Renderer**: Converts AI responses from markdown to beautifully formatted terminal output with ANSI colors
- **GeminiProvider**: Integration with Google's Gemini AI model
- **AzureOpenAIProvider**: Integration with Azure OpenAI service
- **OpenAIProvider**: Integration with OpenAI models
- **Tools System**: Extensible framework for adding new capabilities
- **Configuration**: YAML-based configuration management

## Prerequisites

- Node.js 18+ (ES2024 support required)
- At least one AI provider:
  - Google Gemini API key, or
  - Azure OpenAI service endpoint and API key, or
  - OpenAI API key
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
   
   This will install all required dependencies including:
   - AI provider SDKs (Google Gemini, OpenAI, Azure OpenAI)
   - Markdown rendering libraries (`marked`, `marked-terminal`)
   - TypeScript and development tools

3. **Configure the application**:
   ```bash
   cp config.yaml.example config.yaml
   ```
   
   Edit `config.yaml` and configure your preferred AI provider:
   
   **For Google Gemini:**
   ```yaml
   default_provider: "gemini"
   
   providers:
     gemini:
       enabled: true
       api_key: "your-gemini-api-key"
       model: "gemini-2.5-flash-preview-04-17"
   ```
   
   **For Azure OpenAI:**
   ```yaml
   default_provider: "azure_openai"
   
   providers:
     azure_openai:
       enabled: true
       api_key: "your-azure-openai-api-key"
       endpoint: "https://your-resource-name.openai.azure.com"
       deployment_name: "your-deployment-name"
       api_version: "2024-02-15-preview"
   ```
   
   **For OpenAI:**
   ```yaml
   default_provider: "openai"
   
   providers:
     openai:
       enabled: true
       api_key: "your-openai-api-key"
       model: "gpt-4o"
       organization: "your-org-id"
       base_url: "https://api.openai.com/v1"
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

## Terminal Output

The DevOps AI Agent features rich terminal output with markdown rendering:

- **Headings**: Color-coded headings with different levels (H1-H6)
- **Code Blocks**: Syntax-highlighted code blocks with background colors
- **Inline Code**: `Highlighted inline code` with cyan background
- **Lists**: Properly formatted bullet points and numbered lists
- **Links**: Clickable links with underlines and URLs
- **Emphasis**: **Bold text** and *italic text* formatting
- **Tables**: Beautiful table formatting with borders

The markdown renderer uses the `marked-terminal` library to convert AI responses into visually appealing terminal output with ANSI escape codes for colors and formatting.

## Configuration

The application uses a YAML configuration file (`config.yaml`) with the following structure:

```yaml
default_provider: "gemini"  # Your preferred provider

providers:
  gemini:
    enabled: true
    api_key: "your-api-key-here"
    model: "your-model"

  azure_openai:
    enabled: false
    api_key: "your-azure-api-key"
    endpoint: "https://your-resource.openai.azure.com"
    deployment_name: "your-deployment"
    api_version: "2024-02-15-preview"

  openai:
    enabled: false
    api_key: "your-openai-api-key"
    model: "gpt-4o"
    organization: "your-org-id"  # Optional
    base_url: "https://api.openai.com/v1"  # Optional, for custom endpoints
```

You can enable multiple providers and specify which one to use as the default.

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

**Markdown rendering issues**
- If terminal output appears garbled, ensure your terminal supports ANSI escape codes
- For best results, use a modern terminal emulator (VS Code integrated terminal, iTerm2, Windows Terminal)
- Some older terminals may not support all formatting features
