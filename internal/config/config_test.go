package config

import (
	"devops-agent/internal/llm"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig(t *testing.T) {
	tempDir := t.TempDir()

	t.Run("valid config file", func(t *testing.T) {
		// Create a valid config file
		configPath := filepath.Join(tempDir, "valid_config.yaml")
		configContent := `
llm:
  provider: gemini
  apiKey: test-api-key
  model: gemini-pro
`
		err := os.WriteFile(configPath, []byte(configContent), 0644)
		require.NoError(t, err)

		// Load config
		cfg, err := LoadConfig(configPath)
		require.NoError(t, err)
		assert.Equal(t, llm.GeminiProvider, cfg.LLM.Provider)
		assert.Equal(t, "test-api-key", cfg.LLM.APIKey)
		assert.Equal(t, "gemini-pro", cfg.LLM.Model)
	})

	t.Run("fallback to environment variable", func(t *testing.T) {
		// Create config with missing API key
		configPath := filepath.Join(tempDir, "env_fallback.yaml")
		configContent := `
llm:
  provider: gemini
  model: gemini-pro
`
		err := os.WriteFile(configPath, []byte(configContent), 0644)
		require.NoError(t, err)

		// Set environment variable
		os.Setenv("GEMINI_API_KEY", "env-api-key")
		defer os.Unsetenv("GEMINI_API_KEY")

		// Load config
		cfg, err := LoadConfig(configPath)
		require.NoError(t, err)
		assert.Equal(t, "env-api-key", cfg.LLM.APIKey)
	})

	t.Run("file not found", func(t *testing.T) {
		_, err := LoadConfig(filepath.Join(tempDir, "nonexistent.yaml"))
		assert.Error(t, err)
	})

	t.Run("invalid yaml", func(t *testing.T) {
		configPath := filepath.Join(tempDir, "invalid.yaml")
		err := os.WriteFile(configPath, []byte("invalid: yaml: content:"), 0644)
		require.NoError(t, err)

		_, err = LoadConfig(configPath)
		assert.Error(t, err)
	})

	t.Run("missing API key", func(t *testing.T) {
		configPath := filepath.Join(tempDir, "missing_key.yaml")
		configContent := `
llm:
  provider: gemini
  model: gemini-pro
`
		err := os.WriteFile(configPath, []byte(configContent), 0644)
		require.NoError(t, err)

		// Ensure environment variable is not set
		os.Unsetenv("GEMINI_API_KEY")

		_, err = LoadConfig(configPath)
		assert.Error(t, err)
	})

	t.Run("placeholder API key", func(t *testing.T) {
		configPath := filepath.Join(tempDir, "placeholder_key.yaml")
		configContent := `
llm:
  provider: gemini
  apiKey: YOUR_API_KEY_HERE
  model: gemini-pro
`
		err := os.WriteFile(configPath, []byte(configContent), 0644)
		require.NoError(t, err)

		// Set environment variable
		os.Setenv("GEMINI_API_KEY", "env-api-key")
		defer os.Unsetenv("GEMINI_API_KEY")

		// Load config
		cfg, err := LoadConfig(configPath)
		require.NoError(t, err)
		assert.Equal(t, "env-api-key", cfg.LLM.APIKey)
	})
}

func TestGetAPIKeyEnvVar(t *testing.T) {
	t.Run("gemini provider", func(t *testing.T) {
		envVar := getAPIKeyEnvVar(llm.GeminiProvider)
		assert.Equal(t, "GEMINI_API_KEY", envVar)
	})

	t.Run("unknown provider", func(t *testing.T) {
		defer func() {
			if r := recover(); r == nil {
				t.Error("The code did not panic")
			}
		}()
		getAPIKeyEnvVar("unknown-provider")
	})
}