# DevOps AI Agent

A powerful AI-powered DevOps assistant that helps with infrastructure automation, CI/CD pipelines, containerization, and cloud deployments.

## Features

- **AI-Powered Assistant**: Leverages multiple LLMs (Ollama, Google Gemini, Azure OpenAI, OpenAI, Anthropic) for intelligent DevOps guidance
- **Local Model Support**: Run fully offline with Ollama — no API key required
- **Tool Integration**: Extensible tool system for executing system commands
- **Ink Terminal UI**: Full-screen terminal interface with transcript, side panels, status, tools, and a multiline composer
- **Rich Terminal Output**: Markdown rendering with ANSI colors and formatting
- **DevOps Expertise**: Specialized in infrastructure automation and deployment strategies
- **TypeScript**: Fully typed codebase for better development experience
- **Modular Architecture**: Clean separation of concerns with pluggable providers and tools

## Prerequisites

- [Bun](https://bun.sh) 1.x
- At least one AI provider:
  - [Ollama](https://ollama.com) running locally (no API key required — the default), or
  - Google Gemini API key, or
  - Azure OpenAI service endpoint and API key, or
  - OpenAI API key, or
  - Anthropic API key

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd devops-agent
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure the application**:
   ```bash
   cp config.yaml.example config.yaml
   ```

   Edit `config.yaml` and [configure your preferred AI provider](docs/configuration.md).

## Usage

### Development Mode

Run the application in watch mode with auto-reload:

```bash
bun dev
```

### Production Mode

Build a standalone binary and run it:

```bash
bun build
./devopsagent
```

Or run directly without building:

```bash
bun start
```

### Interactive Commands

Once the application is running, you can use the following commands:

- `/help` or `help` — Show available commands
- `ask <question>` — Ask the AI agent a specific question
- `/tools` or `tools` — List available tools
- `/status` or `status` — Show AI provider status
- `/clear` or `clear` — Clear conversation history and the transcript
- `/exit` or `exit` — Exit the application

The composer supports multiline prompts. Press `Enter` to submit, `Ctrl+J` or `Shift+Enter` to insert a newline, `Ctrl+P` to cycle the side panel, and `Esc` to clear the composer.

### Example Usage

```text
ask How do I create a Dockerfile for a Node.js application?
What are the best practices for Kubernetes deployments?
/tools
/clear
/exit
```

## Terminal Output

The DevOps AI Agent features rich terminal output with markdown rendering:

- **Headings**: Color-coded headings with different levels (H1-H6)
- **Code Blocks**: Syntax-highlighted code blocks with background colors
- **Inline Code**: Highlighted inline code with cyan background
- **Lists**: Properly formatted bullet points and numbered lists
- **Links**: Clickable links with underlines and URLs
- **Emphasis**: Bold text and italic text formatting
- **Tables**: Beautiful table formatting with borders

## Getting API Keys

### Ollama (Local — No Key Required)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3.3` (or any supported model)
3. Ollama runs at `http://localhost:11434` by default — no configuration needed beyond specifying the model name

### Google Gemini

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" and copy it

### OpenAI

1. Visit [OpenAI's API platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys → "Create new secret key"

### Azure OpenAI

1. Create an Azure OpenAI resource in the [Azure Portal](https://portal.azure.com)
2. Deploy a model (e.g., GPT-4o)
3. Get your endpoint URL and API key from the resource overview
4. Note your deployment name

### Anthropic

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to API Keys → "Create Key"

## Configuration

The application uses a YAML configuration file (`config.yaml`). A minimal configuration using Ollama looks like:

```yaml
default_provider: "ollama"

providers:
  ollama:
    enabled: true
    model: "llama3.3"
    base_url: "http://localhost:11434"  # Optional, this is the default
```

A full configuration showing all available providers:

```yaml
default_provider: "ollama"

providers:
  ollama:
    enabled: true
    model: "llama3.3"
    base_url: "http://localhost:11434"  # Optional
    temperature: 0.7                   # Optional, 0.0–2.0

  gemini:
    enabled: false
    api_key: "your-gemini-api-key"
    model: "gemini-2.5-flash"
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional

  azure_openai:
    enabled: false
    api_key: "your-azure-api-key"
    endpoint: "https://your-resource.openai.azure.com"
    deployment_name: "your-deployment"
    api_version: "2024-02-15-preview"
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional

  openai:
    enabled: false
    api_key: "your-openai-api-key"
    model: "gpt-4o"
    organization: "your-org-id"  # Optional
    base_url: "https://api.openai.com/v1"  # Optional
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional

  anthropic:
    enabled: false
    api_key: "your-anthropic-api-key"
    model: "claude-sonnet-4-6"
    base_url: "https://api.anthropic.com"  # Optional
    temperature: 0.7   # Optional, 0.0–1.0
    max_tokens: 4096   # Optional
```

You can enable multiple providers and switch between them at runtime. See [docs/configuration.md](docs/configuration.md) for full details.

### Configuration Parameters

- **temperature**: Controls the randomness of responses
  - Ollama/Gemini/OpenAI/Azure OpenAI: 0.0 (deterministic) to 2.0 (very creative)
  - Anthropic: 0.0 (deterministic) to 1.0 (creative)
- **max_tokens**: Maximum number of tokens in the response (Ollama has no explicit limit)

## Development

### Scripts

| Script | Purpose |
|--------|---------|
| `bun start` | Run the agent |
| `bun dev` | Watch mode with auto-reload |
| `bun build` | Compile to standalone binary `devopsagent` |
| `bun test` | Run tests with coverage |
| `bun run typecheck` | Type check without emitting |
| `bun run check` | Biome linter and formatter checks |
| `bun run check:fix` | Auto-fix linting and formatting issues |
| `bun run format` | Format code with Biome |
| `bun run format:write` | Format and write changes |
| `bun run lint` | Run Biome linter |

## Security

- **API Keys**: Store API keys in `config.yaml` — it is excluded from version control by default
- **Command Execution**: The execute command tool runs with the same permissions as the Bun process
- **Input Validation**: All tool parameters are validated against their Zod schemas

## License

This project is licensed under the AGPL-3.0-only License. See the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `bun run check`
5. Submit a pull request

## Troubleshooting

### Common Issues

**"Provider configuration is missing"**
- Ensure `config.yaml` exists and contains valid provider configuration
- Check that `default_provider` matches a key under `providers` that has `enabled: true`

**"API key is required"**
- Verify your API key in `config.yaml`
- Make sure the API key has access to the provider's API

**Ollama connection refused**
- Make sure the Ollama daemon is running: `ollama serve`
- Verify the model is pulled: `ollama list`
- Check that `base_url` in config matches where Ollama is listening

**Tool execution failures**
- Check that the system has the necessary permissions for command execution
- Verify that required system tools are installed

**"Must be run in an interactive terminal"**
- The Ink TUI requires a TTY. Run the agent directly in a terminal, not piped or redirected.

**Markdown rendering issues**
- If terminal output appears garbled, ensure your terminal supports ANSI escape codes
- For best results, use a modern terminal emulator (VS Code integrated terminal, iTerm2, Windows Terminal)
