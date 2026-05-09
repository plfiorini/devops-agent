# Architecture

The project follows a modular architecture:

```
src/
├── agent.ts           # Main AI agent orchestrator
├── ui/                # Ink terminal UI components and command parsing
├── config.ts          # Configuration management
├── index.ts           # Ink application entry point
├── tools.ts           # Tool loading system
├── types.ts           # TypeScript type definitions
├── models/
│   ├── gemini.ts      # Google Gemini AI provider
│   ├── openai.ts      # OpenAI provider
│   └── anthropic.ts   # Anthropic Claude provider
├── tools/
│   └── executeCommand.ts  # Shell command execution tool
└── utils/
    └── markdownRenderer.ts # Terminal markdown rendering with ANSI colors
```

## Key Components

- **Agent**: Core orchestrator that manages conversation history and tool execution
- **Ink UI**: Full-screen terminal interface with transcript, status/tools/help panels, and multiline input
- **Markdown Renderer**: Converts AI responses from markdown to beautifully formatted terminal output with ANSI colors
- **GeminiProvider**: Integration with Google's Gemini AI model
- **OpenAIProvider**: Integration with OpenAI models (including Azure OpenAI)
- **AnthropicProvider**: Integration with Anthropic's Claude models
- **Tools System**: Extensible framework for adding new capabilities
- **Configuration**: YAML-based configuration management
