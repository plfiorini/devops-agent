# DevOps Agent

A Node.js TypeScript application that provides an interactive command-line interface for DevOps operations.

## Features

- Interactive command prompt with `> ` indicator
- Supports `exit` command to quit the application
- Handles CTRL+D (EOF) for graceful exit
- Built with TypeScript and Node.js 24
- Includes devcontainer setup for consistent development environment

## Getting Started

### Using DevContainer (Recommended)

1. Open this project in VS Code
2. When prompted, click "Reopen in Container" or use Command Palette: "Dev Containers: Reopen in Container"
3. Wait for the container to build and dependencies to install
4. Run the application:
   ```bash
   npm run dev
   ```

### Local Development

1. Ensure you have Node.js 24+ installed
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run the application:
   ```bash
   npm start
   ```

## Available Scripts

- `npm run dev` - Run the application in development mode with ts-node
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript application
- `npm run watch` - Watch for changes and recompile automatically
- `npm run clean` - Remove the dist directory

## Usage

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
