# DevOps Agent

A Node.js TypeScript application that provides an interactive command-line interface for DevOps operations, powered by Google's Gemini AI.

## Features

- Interactive command prompt with AI-powered responses
- Google Gemini AI integration for DevOps questions and guidance
- Support for direct prompts and structured questions
- **YAML configuration with Zod schema validation**
- Flexible configuration loading from multiple locations
- Built with TypeScript and Node.js 24
- LangChain integration for advanced AI capabilities
- Includes devcontainer setup for consistent development environment

## Configuration

The application uses YAML configuration files with Zod schema validation. Configuration files are loaded in the following order:

1. `devops-agent.yaml`
2. `devops-agent.yml` 
3. `.devops-agent.yaml`
4. `.devops-agent.yml`
5. `config.yaml`
6. `config.yml`

### Configuration Format

```yaml
llm:
  gemini:
    model: gemini-2.0-flash
    maxOutputTokens: 2048
    # apiKey: your_api_key_here  # Optional: can use GOOGLE_API_KEY environment variable
```

### Environment Variables

- `GOOGLE_API_KEY`: Your Google Gemini API key (required if not set in config file)

## Getting Started

### Prerequisites

1. Get a Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Copy the API key for configuration

### Using DevContainer (Recommended)

1. Open this project in VS Code
2. When prompted, click "Reopen in Container" or use Command Palette: "Dev Containers: Reopen in Container"
3. Wait for the container to build and dependencies to install
4. Configure your API key:
   ```bash
   # Edit the .env file and replace 'your_gemini_api_key_here' with your actual API key
   nano .env
   ```
5. Run the application:
   ```bash
   npm run dev
   ```

### Local Development

1. Ensure you have Node.js 24+ installed
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your API key:
   ```bash
   # Edit the .env file and replace 'your_gemini_api_key_here' with your actual API key
   nano .env
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run the application:
   ```bash
   npm start
   ```

## Available Scripts

- `npm run dev` - Run the application in development mode with tsx
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript application
- `npm run watch` - Watch for changes and recompile automatically
- `npm run clean` - Remove the dist directory

## Usage

Once the application is running, you can interact with it using the following commands:

### Available Commands

- `help` - Show available commands and examples
- `ask <question>` - Ask Gemini a specific DevOps question
- `<any text>` - Send any text directly to Gemini for processing
- `exit` - Exit the application

### Example Interactions

```bash
> help
Available commands:
  exit                    - Exit the application
  help                    - Show this help message  
  ask <question>          - Ask Gemini a specific question
  <any text>              - Send any text directly to Gemini

Examples:
  ask How do I deploy a Docker container?
  What is Kubernetes?
  Explain CI/CD best practices

> ask How do I set up a CI/CD pipeline?
Thinking...
Gemini: A CI/CD pipeline automates the process of integrating code changes...

> What are the benefits of using Docker?
Thinking...
Gemini: Docker provides several benefits for application deployment...

> exit
Goodbye!
```

## Project Structure

```
devops-agent/
├── .devcontainer/
│   └── devcontainer.json
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
