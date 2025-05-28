# DevOps Agent

A Node.js TypeScript application that provides an interactive command-line interface for DevOps operations, powered by Google's Gemini AI.

## Features

- Interactive command prompt with AI-powered responses
- Google Gemini AI integration for DevOps questions and guidance
- Support for direct prompts and structured questions
- Built with TypeScript and Node.js 24
- LangChain integration for advanced AI capabilities
- Includes devcontainer setup for consistent development environment

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

Once the application is running, you'll see an interactive prompt:

```
Welcome to DevOps Agent!
Available commands: exit, ask, help
Type "exit" to quit or press CTRL+D
> 
```

### Available Commands

- **`help`** - Show all available commands and examples
- **`ask <question>`** - Ask Gemini a specific DevOps question
- **`<any text>`** - Send any text directly to Gemini for AI-powered responses
- **`exit`** - Exit the application

### Example Usage

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

> What are Docker best practices?
Thinking...
Gemini: Here are some key Docker best practices...
```

Once the application is running, you'll see a prompt:

```
Welcome to DevOps Agent!
Type "exit" to quit or press CTRL+D
> 
```

### Commands

- `exit` - Exit the application
- CTRL+D - Exit the application
- CTRL+C - Display exit instructions

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
