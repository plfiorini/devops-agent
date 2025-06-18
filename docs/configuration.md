# Configuration

**For Google Gemini:**
```yaml
default_provider: "gemini"

providers:
    gemini:
    enabled: true
    api_key: "your-gemini-api-key"
    model: "gemini-2.5-flash-preview-04-17"
    temperature: 0.7  # Optional, controls randomness (0.0 to 1.0)
    max_tokens: 4096  # Optional, maximum tokens in response
```

**For Azure OpenAI:**
```yaml
default_provider: "azure_openai"

providers:
    azure_openai:
    enabled: true
    api_key: "your-azure-openai-api-key"
    endpoint: "https://your-resource-name.openai.azure.com"
    deployment_name: "your-deployment-name"
    api_version: "2024-02-15-preview"
    temperature: 0.7  # Optional, controls randomness (0.0 to 2.0)
    max_tokens: 4096  # Optional, maximum tokens in response
```

**For OpenAI:**
```yaml
default_provider: "openai"

providers:
    openai:
    enabled: true
    api_key: "your-openai-api-key"
    model: "gpt-4o"
    organization: "your-org-id"
    base_url: "https://api.openai.com/v1"
    temperature: 0.7  # Optional, controls randomness (0.0 to 2.0)
    max_tokens: 4096  # Optional, maximum tokens in response
```

**For Anthropic:**
```yaml
default_provider: "anthropic"

providers:
    anthropic:
    enabled: true
    api_key: "your-anthropic-api-key"
    model: "claude-3-5-sonnet-20241022"
    base_url: "https://api.anthropic.com"  # Optional
    temperature: 0.7  # Optional, controls randomness (0.0 to 1.0)
    max_tokens: 4096  # Optional, maximum tokens in response
```
