package config

import (
	"fmt"
	"os"

	"devops-agent/internal/llm"

	"gopkg.in/yaml.v3"
)

// Config represents the application configuration structure.
type Config struct {
	LLM        llm.LLMConfig `yaml:"llm"`
	UnsafeMode bool          `yaml:"unsafeMode"`
}

// LoadConfig loads configuration from the specified file path.
// It prioritizes values from the config file, but falls back to environment variables for API keys if not set in the file.
func LoadConfig(path string) (*Config, error) {
	configFile, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", path, err)
	}

	var cfg Config
	err = yaml.Unmarshal(configFile, &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal config file %s: %w", path, err)
	}

	// Fallback to environment variables for API key if not set in config
	if cfg.LLM.APIKey == "" || cfg.LLM.APIKey == "YOUR_API_KEY_HERE" {
		envVar := getAPIKeyEnvVar(cfg.LLM.Provider)
		apiKeyFromEnv := os.Getenv(envVar)
		if apiKeyFromEnv == "" {
			return nil, fmt.Errorf("API key for provider %s not found in config file or environment variable %s", cfg.LLM.Provider, envVar)
		}
		cfg.LLM.APIKey = apiKeyFromEnv
	}

	return &cfg, nil
}

// getAPIKeyEnvVar returns the environment variable name for the given LLM provider.
func getAPIKeyEnvVar(provider llm.LLMProviderType) string {
	switch provider {
	case llm.GeminiProvider:
		return "GEMINI_API_KEY"
	default:
		panic(fmt.Sprintf("unknown LLM provider: %s", provider))
	}
}
