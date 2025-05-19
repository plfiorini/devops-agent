# DevOps AI Agent

## Overview

DevOps AI Agent is a command-line tool designed for software architects and DevOps engineers that leverages AI to assist with managing infrastructure and automating tasks. The agent uses large language models to understand natural language queries and execute appropriate DevOps operations.

## Project Structure

```
devops-agent/
├── cmd/
│   └── agent/           # Main CLI application entry point
├── internal/
│   ├── config/          # Configuration loading and management
│   ├── llm/             # LLM provider implementations
│   └── tools/           # Tool implementations (bash, etc.)
├── bin/                 # Compiled binaries
├── .devcontainer/       # VS Code dev container configuration
├── .gitignore           # Git ignore file
├── go.mod               # Go module definition
├── go.sum               # Go module checksums
├── Makefile             # Build automation
├── README.md            # This file
└── config.yaml          # Application configuration file (create this)
```

## Getting Started

### Prerequisites

- Go 1.21 or later
- Git
- API key for Gemini (or other supported LLM providers)
- Access to AWS and Azure accounts (for using related features)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd devops-agent
   ```

2. Install dependencies:
   ```bash
   go mod tidy
   ```

3. Create a configuration file (`config.yaml`) in the project root:
   ```yaml
   llm:
     provider: gemini
     apiKey: YOUR_API_KEY_HERE
     model: gemini-pro
   ```
   
   You can also set the API key using environment variables:
   ```bash
   export GEMINI_API_KEY=your-api-key-here
   ```

4. If using a development container:
   ```bash
   # Open the project in VS Code and use the "Reopen in Container" option
   # Or use GitHub Codespaces to open the project directly
   ```

### Building

Use the provided Makefile to build, test and run the application:

```bash
# Build the application
make build

# Run tests
make test

# Build and test
make all

# Clean build files
make clean
```

### Usage

Run the agent directly with:

```bash
make run
```

Or use the compiled binary:

```bash
./bin/devops-agent
```

You can specify a different configuration file using the `--config` flag:

```bash
./bin/devops-agent --config path/to/config.yaml
```

#### Example Commands

```bash
# Start the interactive agent
./bin/devops-agent

# Example interactions (once agent is running):
# > Describe EC2 instances in us-west-2 region
# > List all docker containers
# > Create a new S3 bucket called my-app-data
```

## Features

### Currently Implemented

- Conversational interface with AI assistance
- Bash command execution
- Configuration management

### Planned Features

- AWS service management
- Azure resource management
- Git operations
- Container management
- Infrastructure as Code support
- CI/CD pipeline integration
- Kubernetes cluster management
- Security compliance checking

## Development

### Adding New Tools

To add a new tool:

1. Create a new file in the `internal/tools/` directory
2. Implement the tool function with the signature `func ToolName(args map[string]interface{}) (map[string]interface{}, error)`
3. Add the tool to the `AvailableTools` map in `internal/tools/tools.go`
4. Add the tool declaration to the `Tools` slice in `internal/tools/tools.go`

### Testing

Run the test suite:

```bash
make test
```

For specific test coverage:

```bash
go test -cover ./...
```

### Supported LLM Providers

Currently, the agent supports:
- Gemini (Google's LLM)

Planned support:
- OpenAI (GPT models)
- Anthropic Claude
- DeepSeek
- Local LLM models

## Agent Architecture References

This project draws inspiration from the following resources on AI agent architecture:

- [The Unreasonable Effectiveness of an LLM Agent Loop with Tool Use](https://sketch.dev/blog/agent-loop)
- [Gemini: Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) - Gemini's function calling pattern
- [OpenAI: Function Calling](https://platform.openai.com/docs/guides/function-calling) - OpenAI's function calling pattern

Special thanks to my collegue [Alessandro Annini](https://github.com/AlessandroAnnini) who showed me the first article
and his [implementation](https://github.com/AlessandroAnnini/agent-loop) of the agent loop.

## Ideas for the future

- [LangChain](https://langchain.com/) - Framework for developing applications powered by language models

## Troubleshooting

### Common Issues

1. **API Key Issues**
   
   If you encounter "Invalid API key" errors, ensure your API key is correctly set in the config file or environment variable.

2. **Permission Denied Errors**
   
   Some operations require elevated permissions. Run with sudo or ensure appropriate cloud provider credentials are configured.

3. **Network Connectivity**
   
   The agent requires internet access to communicate with LLM providers. Check your connection if you encounter timeouts.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

- As indicated in `LICENSE.code`, devops-agent source code files are provided under the GNU General Public License, version 3.0 or later (**GPL-3.0-or-later**)
- As indicated in `LICENSE.docs`, devops-agent **documentation files** are provided and may be used under the Creative Commons Attribution 4.0 International license (**CC-BY-4.0**).

This `README.md` file is documentation: `SPDX-License-Identifier: CC-BY-4.0`
