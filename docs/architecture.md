# Architecture

The DevOps AI Agent is a React + [Ink](https://github.com/vadimdemedes/ink) terminal application backed by a pluggable LLM provider layer. The agent loop runs inside a TypeScript class; the UI is a set of Ink components that stream messages from the agent in real time.

## Source Structure

```
src/
├── index.tsx              # Entry point — renders <App /> via Ink
├── agent.ts               # Core Agent class: provider management, tool dispatch, chat loop
├── config.ts              # Zod schema + YAML config loader
├── types.ts               # Shared TypeScript types (Message, ProviderInterface, Tool)
├── tools.ts               # Dynamic tool loader
├── logger.ts              # Logging utilities
├── systemPrompt.ts        # DevOps expert system prompt
│
├── providers/
│   ├── factory.ts         # Instantiates the correct provider from config
│   ├── ollama.ts          # Ollama provider (local models)
│   ├── gemini.ts          # Google Gemini provider
│   ├── openai.ts          # OpenAI provider (also base for Azure)
│   ├── azure_openai.ts    # Azure OpenAI provider
│   └── anthropic.ts       # Anthropic Claude provider
│
├── tools/
│   └── executeCommand.ts  # Built-in shell command execution tool
│
└── ui/
    ├── App.tsx            # Root component: wires agent to UI state
    ├── Header.tsx         # Title bar
    ├── Footer.tsx         # Keybinding hints
    ├── Composer.tsx       # Multiline user input
    ├── Transcript.tsx     # Scrollable message history
    ├── Spinner.tsx        # Loading indicator
    ├── StatusLine.tsx     # Provider / model status
    ├── commands.ts        # Slash-command parsing and dispatch
    └── types.ts           # UI-specific types
```

## Key Components

### `index.tsx`

Verifies that stdout is a TTY, then renders `<App />` using `ink`'s `render()`. The process exits when the user runs `/exit`.

### `agent.ts` — Agent

The `Agent` class owns the active provider and the loaded tool set. It exposes:

- `chat(prompt)` — async generator that delegates to the active provider's `agentLoop()` and yields `Message` objects
- `switchProvider(name)` — hot-swap the active provider without restarting
- `switchModel(name)` — change the model on the active provider

Tool dispatch happens inside each provider's `agentLoop()`: when the model returns tool calls, the provider finds the matching `Tool` by name, validates arguments with Zod, calls `execute()`, and feeds the result back into the next model turn.

### `config.ts`

Loads `config.yaml` from the current working directory using `zod-config` with the YAML adapter. The Zod schema enforces:

- `default_provider` must be one of the five known provider keys
- The default provider must be present under `providers` and have `enabled: true`
- Per-provider fields (API keys, models, temperature bounds) are validated before the app starts

### `types.ts`

Defines the contracts that keep the provider layer and UI decoupled:

```typescript
interface ProviderInterface {
  getProviderName(): string;
  getModelName(): string;
  setModelName(model: string): void;
  getSupportedModels(): Promise<string[]>;
  getMessagesCount(): number;
  clearMessages(): void;
  agentLoop(prompt: string): AsyncGenerator<Message>;
}
```

```typescript
interface GenericTool<Input, Output> {
  name: string;
  description: string;
  inputSchema: Input;        // Zod schema
  outputSchema: Output;      // Zod schema
  execute(args): Promise<Result>;
  isError?(result): boolean;    // optional
  formatResult?(result): string; // optional display override
}
```

### `tools.ts` — Dynamic Tool Loader

Scans `src/tools/` at startup and imports every `.ts` / `.js` file that is not a test file (`.test.*`). Each file must export a default object conforming to the `Tool` interface. Loaded tools are passed to the `Agent`, which forwards them to the active provider.

### `providers/factory.ts`

Reads `config.default_provider`, instantiates the matching provider class, and passes it the relevant config slice and the loaded tools array.

## Data Flow

```
User types in Composer
       │
       ▼
  App.tsx calls agent.chat(prompt)
       │
       ▼
  agent.ts → provider.agentLoop(prompt)
       │
       ├─ streams TextMessage / AssistantToolCallMessage
       │         ▼
       │    Transcript renders message
       │
       └─ on tool call → tool.execute(args)
                │
                ▼
           ToolResultMessage yielded
                │
                ▼
           Transcript renders result
                │
                ▼
         next agentLoop iteration
```

The agent loop continues until the model emits a response with no tool calls, at which point the generator returns and the Spinner disappears.
