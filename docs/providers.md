### Adding New AI Providers

To add support for other AI providers (OpenAI, Anthropic, etc.):

1. Create a new provider class in `src/models/`
2. Implement the `Provider` interface
3. Update the configuration schema in `src/config.ts`
4. Modify the agent initialization in `src/agent.ts`