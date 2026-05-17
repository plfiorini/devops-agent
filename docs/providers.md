# Providers

The DevOps AI Agent supports five LLM providers. All providers implement the same `ProviderInterface` and support streaming, tool calling, and runtime model switching.

## Feature Comparison

| Provider | API Key Required | Runs Locally | Streaming | Tool Use | Temperature Range |
|----------|-----------------|-------------|-----------|----------|------------------|
| Ollama | No | Yes | Yes | Yes | 0.0 – 2.0 |
| Gemini | Yes | No | Yes | Yes | 0.0 – 2.0 |
| OpenAI | Yes | No | Yes | Yes | 0.0 – 2.0 |
| Azure OpenAI | Yes | No | Yes | Yes | 0.0 – 2.0 |
| Anthropic | Yes | No | Yes | Yes | 0.0 – 1.0 |

## Ollama (Default)

Ollama runs open-source models locally. No API key is required. The agent connects to the Ollama daemon at `http://localhost:11434` by default.

**Recommended models** (must be pulled with `ollama pull <model>` first):

- `llama3.3` — Meta's Llama 3.3 70B
- `qwen2.5` — Alibaba's Qwen 2.5
- `mistral` — Mistral 7B
- `deepseek-r1` — DeepSeek R1 (includes chain-of-thought / thinking)
- `phi4` — Microsoft Phi-4

The available model list is fetched live from the Ollama daemon via `getSupportedModels()`.

## Google Gemini

**Recommended models**:

- `gemini-2.5-flash` (Recommended — fast, cost-effective)
- `gemini-2.5-pro`
- `gemini-2.0-flash`

## OpenAI

**Recommended models**:

- `gpt-4o` (Recommended)
- `gpt-4o-mini`
- `o3-mini`

The `base_url` parameter can point to any OpenAI-compatible API endpoint (e.g. local proxies, third-party hosts).

## Azure OpenAI

Azure OpenAI uses deployment names rather than model names. The model you use depends on what you have deployed in your Azure resource.

**Common deployments**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`

The `api_version` defaults to `2024-02-15-preview` if omitted.

## Anthropic

**Recommended models**:

- `claude-opus-4-7` (Most capable)
- `claude-sonnet-4-6` (Recommended — balanced)
- `claude-haiku-4-5-20251001` (Fast, lightweight)

## Provider Interface

Every provider implements `ProviderInterface` from `src/types.ts`:

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

`agentLoop` is the core method. It runs the full agentic loop for a single user turn: sends the prompt to the model, handles tool calls by dispatching to the loaded tools, feeds results back, and continues until the model responds without requesting further tool calls. It yields `Message` objects that the UI streams into the transcript.

## Adding a New Provider

1. Create `src/providers/myprovider.ts` and implement `ProviderInterface`
2. Add the provider key to the `providerSchema` enum in `src/config.ts`
3. Add a config schema (Zod object) for the new provider in `src/config.ts`
4. Add the provider key and config type to `providersConfigSchema`
5. Add an instantiation branch to `src/providers/factory.ts`
