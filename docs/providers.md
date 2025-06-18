# Providers

## Supported Models

### Google Gemini

- `gemini-2.5-flash-preview-04-17` (Recommended)
- `gemini-1.5-pro`
- `gemini-1.5-flash`

### OpenAI

- `gpt-4o` (Recommended)
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

### Azure OpenAI

- Any model deployed in your Azure OpenAI service
- Common deployments: `gpt-4`, `gpt-4-turbo`, `gpt-35-turbo`

### Anthropic Claude

- `claude-3-5-sonnet-20241022` (Recommended)
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

## Adding New AI Providers

To add support for other AI providers (OpenAI, Anthropic, etc.):

1. Create a new provider class in `src/models/`
2. Implement the `Provider` interface
3. Update the configuration schema in `src/config.ts`
4. Modify the agent initialization in `src/agent.ts`