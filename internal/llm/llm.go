package llm

import (
	"errors"
	"fmt"
	
	"github.com/sirupsen/logrus"
	
	"devops-agent/internal/resources"
)

// getDefaultSystemPrompt returns the default system prompt loaded from embedded resources.
// If there's an error loading the prompt, it returns a simple fallback prompt.
func getDefaultSystemPrompt() string {
	prompt, err := resources.GetSystemPrompt()
	if err != nil {
		// Provide a minimal fallback prompt in case of errors
		return "You are a helpful AI assistant for cloud architects and DevOps engineers."
	}
	return prompt
}

// LLM represents a generic interface for Large Language Models.
type LLM interface {
	// Chat sends a series of messages to the LLM and returns the assistant's reply.
	// Implementations should handle the context of the conversation.
	Chat(messages []Message) error
	
	// SetLogger sets the logger for the LLM instance
	SetLogger(logger *logrus.Logger)
}

// MessageRole represents the role of a message sender in a conversation.
type MessageRole string

const (
	// SystemRole is for system messages that provide context or instructions.
	SystemRole MessageRole = "system"
	// UserRole is for messages sent by the user.
	UserRole MessageRole = "user"
)

// Message represents a single message in a chat conversation.
type Message struct {
	Role    MessageRole
	Content string
}

// Custom error types for LLM interactions
var (
	// ErrLLMAPI is returned when there's an error communicating with the LLM API.
	ErrLLMAPI = errors.New("LLM API error")
	// ErrInvalidResponse is returned when the LLM API returns an unexpected or invalid response.
	ErrInvalidResponse = errors.New("invalid response from LLM API")
	// ErrConfiguration is returned when there's an issue with the LLM configuration.
	ErrConfiguration = errors.New("LLM configuration error")
)

// LLMProviderType defines the supported LLM providers.
type LLMProviderType string

const (
	GeminiProvider    LLMProviderType = "gemini"
	// Add other providers here
)

// LLMConfig holds the configuration for an LLM provider.
type LLMConfig struct {
	Provider         LLMProviderType `yaml:"provider"`
	APIKey           string          `yaml:"apiKey"`
	Model            string          `yaml:"model,omitempty"`            // Optional: if not provided, the default model for the provider will be used.
	Endpoint         string          `yaml:"endpoint,omitempty"`         // Optional: if not provided, the default endpoint for the provider will be used.
}

// NewLLMProvider is a factory function that returns an LLM interface based on the provider type.
func NewLLMProvider(config LLMConfig, logger *logrus.Logger) (LLM, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("%w: APIKey is required in LLMConfig", ErrConfiguration)
	}

	var llmInstance LLM
	var err error
	
	switch config.Provider {
	case GeminiProvider:
		llmInstance, err = NewGeminiLLM(config)
	default:
		return nil, fmt.Errorf("%w: unsupported LLM provider: %s", ErrConfiguration, config.Provider)
	}
	
	if err != nil {
		return nil, err
	}
	
	// Set the logger in the LLM instance
	llmInstance.SetLogger(logger)
	return llmInstance, nil
}
