# Configuration

The application is configured via a YAML file named `config.yaml` in the current working directory. The file is loaded at startup and validated against a [Zod](https://zod.dev) schema — misconfigured fields produce a clear error message before the UI starts.

## Config Loading

`config.yaml` is read from `process.cwd()` (the directory from which you run `bun start`). You can keep separate config files per project by running the agent from different directories.

The file is not committed to version control by default — make sure your `.gitignore` includes `config.yaml` so that API keys are never accidentally pushed.

## Provider Selection

`default_provider` sets the active provider at startup. Its value must:

1. Be one of: `ollama`, `gemini`, `openai`, `azure_openai`, `anthropic`
2. Have a corresponding entry under `providers`
3. Have `enabled: true`

If any of these conditions fail, the agent exits with an error before rendering the UI.

You can enable multiple providers in the same config and switch between them at runtime with `/provider <name>`.

## Configuration Reference

### Ollama (local, no API key required)

```yaml
default_provider: "ollama"

providers:
  ollama:
    enabled: true
    model: "llama3.3"           # Required: any model pulled via `ollama pull`
    base_url: "http://localhost:11434"  # Optional, this is the default
    temperature: 0.7            # Optional, 0.0–2.0
```

Ollama has no `max_tokens` setting — token limits are set per model in Ollama itself.

### Google Gemini

```yaml
default_provider: "gemini"

providers:
  gemini:
    enabled: true
    api_key: "your-gemini-api-key"  # Required
    model: "gemini-2.5-flash"       # Required
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional
```

### OpenAI

```yaml
default_provider: "openai"

providers:
  openai:
    enabled: true
    api_key: "your-openai-api-key"      # Required
    model: "gpt-4o"                      # Required
    organization: "your-org-id"          # Optional
    base_url: "https://api.openai.com/v1"  # Optional, for custom endpoints
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional
```

### Azure OpenAI

```yaml
default_provider: "azure_openai"

providers:
  azure_openai:
    enabled: true
    api_key: "your-azure-openai-api-key"                # Optional (can use managed identity)
    endpoint: "https://your-resource-name.openai.azure.com"  # Required
    deployment_name: "your-deployment-name"             # Required
    api_version: "2024-02-15-preview"                   # Optional
    temperature: 0.7   # Optional, 0.0–2.0
    max_tokens: 4096   # Optional
```

### Anthropic

```yaml
default_provider: "anthropic"

providers:
  anthropic:
    enabled: true
    api_key: "your-anthropic-api-key"    # Required
    model: "claude-sonnet-4-6"           # Required
    base_url: "https://api.anthropic.com"  # Optional
    temperature: 0.7   # Optional, 0.0–1.0 (Anthropic cap is 1.0)
    max_tokens: 4096   # Optional
```

## Parameter Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | — | Whether this provider can be used |
| `api_key` | string | — | Provider API key (not used by Ollama) |
| `model` | string | — | Model name or deployment name |
| `temperature` | float | provider default | Response randomness. Anthropic: 0–1; all others: 0–2 |
| `max_tokens` | integer | 4096 | Maximum tokens in the response (not used by Ollama) |
| `base_url` | string | provider default | Custom API endpoint (Ollama, OpenAI, Anthropic) |
| `organization` | string | — | OpenAI organization ID |
| `endpoint` | string | — | Azure OpenAI resource endpoint |
| `deployment_name` | string | — | Azure OpenAI deployment name |
| `api_version` | string | `2024-02-15-preview` | Azure OpenAI API version |

## Security

- `config.yaml` should be in your `.gitignore` — it contains API keys
- Never commit API keys to version control
- Use environment-specific config files (one per project directory) rather than a single shared file
