package llm

import (
	"os"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestNewLLMProvider(t *testing.T) {
	// Create a test logger
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Suppress logs during testing

	// Test case 1: Valid Gemini provider
	configGemini := LLMConfig{
		Provider: GeminiProvider,
		APIKey:   "test-api-key",
	}
	llmGemini, err := NewLLMProvider(configGemini, logger)
	assert.NoError(t, err)
	assert.NotNil(t, llmGemini)
	_, ok := llmGemini.(*GeminiLLM)
	assert.True(t, ok, "Expected a GeminiLLM instance")

	// Test case 2: Unsupported provider
	configUnsupported := LLMConfig{
		Provider: "unsupported-provider",
		APIKey:   "test-api-key",
	}
	llmUnsupported, err := NewLLMProvider(configUnsupported, logger)
	assert.Error(t, err)
	assert.Nil(t, llmUnsupported)
	assert.ErrorIs(t, err, ErrConfiguration, "Expected ErrConfiguration for unsupported provider")

	// Test case 3: Missing APIKey
	configNoAPIKey := LLMConfig{
		Provider: GeminiProvider,
	}
	llmNoAPIKey, err := NewLLMProvider(configNoAPIKey, logger)
	assert.Error(t, err)
	assert.Nil(t, llmNoAPIKey)
	assert.ErrorIs(t, err, ErrConfiguration, "Expected ErrConfiguration for missing APIKey")
}

func TestGeminiLLM_Chat(t *testing.T) {
	// This test requires a mock HTTP server to simulate the Gemini API.
	// For now, we'll test the basic construction and a simple chat call
	// without hitting a real API. We'll need to enhance this with a mock server later.

	// Create a test logger
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Suppress logs during testing

	apiKey := os.Getenv("GEMINI_API_KEY") // Or use a dummy key for tests not hitting the actual API
	if apiKey == "" {
		apiKey = "dummy-test-api-key" // Use a dummy key if not set, for local tests
	}

	config := LLMConfig{
		Provider: GeminiProvider,
		APIKey:   apiKey,
		Model:    "gemini-1.5-flash", // Using a potentially faster/cheaper model for testing if it were real
	}

	llm, err := NewGeminiLLM(config)
	assert.NoError(t, err)
	assert.NotNil(t, llm)

	// Set logger
	llm.SetLogger(logger)

	geminiLLM, ok := llm.(*GeminiLLM)
	assert.True(t, ok)
	assert.Equal(t, apiKey, geminiLLM.apiKey)
	assert.Equal(t, "gemini-1.5-flash", geminiLLM.model)
	assert.Equal(t, "https://generativelanguage.googleapis.com/v1beta", geminiLLM.endpoint)
	assert.NotEmpty(t, geminiLLM.conversationHistory)
	assert.Equal(t, "model", geminiLLM.conversationHistory[0].Role) // System prompt
	assert.Equal(t, getDefaultSystemPrompt(), geminiLLM.conversationHistory[0].Parts[0].Text)
	assert.Equal(t, logger, geminiLLM.logger) // Check that logger was set correctly

	// At this point, to test the Chat method properly, we would need a mock HTTP server.
	// The following is a placeholder for how you might start to structure such a test.
	// For a real test, you'd set up http.ServeMux with a handler for the Gemini endpoint.

	// messages := []Message{
	// 	{Role: UserRole, Content: "Hello Gemini!"},
	// }
	//
	// // Example of how to use a mock server (conceptual)
	// /*
	// server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	//    // Check request, return mock response
	//    w.Header().Set("Content-Type", "application/json")
	//    fmt.Fprintln(w, `{"candidates": [{"content": {"role": "model", "parts": [{"text": "Hello there!"}]}}]}`)
	// }))
	// defer server.Close()
	//
	// // Temporarily override the endpoint for the test
	// originalEndpoint := geminiLLM.endpoint
	// geminiLLM.endpoint = server.URL // Point to mock server
	// defer func() { geminiLLM.endpoint = originalEndpoint }() // Restore original
	// */
	//
	// // err := geminiLLM.Chat(messages)
	// // assert.NoError(t, err)

	t.Log("GeminiLLM.Chat test needs a mock HTTP server for full validation.")
}

// Helper function to create a mock LLM for testing scenarios where a generic LLM is needed
// without specific provider logic.
type mockLLM struct {
	ChatFunc func(messages []Message) error
	logger   *logrus.Logger
}

func (m *mockLLM) Chat(messages []Message) error {
	if m.ChatFunc != nil {
		return m.ChatFunc(messages)
	}
	return nil
}

func (m *mockLLM) SetLogger(logger *logrus.Logger) {
	m.logger = logger
}

func TestMockLLM(t *testing.T) {
	// Create a test logger
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Suppress logs during testing

	mock := &mockLLM{
		ChatFunc: func(messages []Message) error {
			if len(messages) > 0 && messages[0].Content == "ping" {
				return nil
			}
			return nil
		},
	}
	
	// Set logger
	mock.SetLogger(logger)
	assert.Equal(t, logger, mock.logger)

	err := mock.Chat([]Message{{Role: UserRole, Content: "ping"}})
	assert.NoError(t, err)

	err = mock.Chat([]Message{{Role: UserRole, Content: "hello"}})
	assert.NoError(t, err)
}

// It's good practice to ensure that all concrete LLM types actually implement the LLM interface.
// This won't run as a test but will cause a compile-time error if they don't.
func TestLLMInterfaceImplementations(t *testing.T) {
	var _ LLM = (*GeminiLLM)(nil)
	var _ LLM = (*mockLLM)(nil)
}
