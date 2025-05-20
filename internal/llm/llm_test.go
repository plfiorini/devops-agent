package llm

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewLLMProvider(t *testing.T) {
	// Test case 1: Valid Gemini provider
	configGemini := LLMConfig{
		Provider: GeminiProvider,
		APIKey:   "test-api-key",
	}
	llmGemini, err := NewLLMProvider(configGemini)
	assert.NoError(t, err)
	assert.NotNil(t, llmGemini)
	_, ok := llmGemini.(*GeminiLLM)
	assert.True(t, ok, "Expected a GeminiLLM instance")

	// Test case 2: Unsupported provider
	configUnsupported := LLMConfig{
		Provider: "unsupported-provider",
		APIKey:   "test-api-key",
	}
	llmUnsupported, err := NewLLMProvider(configUnsupported)
	assert.Error(t, err)
	assert.Nil(t, llmUnsupported)
	assert.ErrorIs(t, err, ErrConfiguration, "Expected ErrConfiguration for unsupported provider")

	// Test case 3: Missing APIKey
	configNoAPIKey := LLMConfig{
		Provider: GeminiProvider,
	}
	llmNoAPIKey, err := NewLLMProvider(configNoAPIKey)
	assert.Error(t, err)
	assert.Nil(t, llmNoAPIKey)
	assert.ErrorIs(t, err, ErrConfiguration, "Expected ErrConfiguration for missing APIKey")
}

func TestGeminiLLM_Chat(t *testing.T) {
	// This test requires a mock HTTP server to simulate the Gemini API.
	// For now, we'll test the basic construction and a simple chat call
	// without hitting a real API. We'll need to enhance this with a mock server later.

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

	geminiLLM, ok := llm.(*GeminiLLM)
	assert.True(t, ok)
	assert.Equal(t, apiKey, geminiLLM.apiKey)
	assert.Equal(t, "gemini-1.5-flash", geminiLLM.model)
	assert.Equal(t, "https://generativelanguage.googleapis.com/v1beta", geminiLLM.endpoint)
	assert.NotEmpty(t, geminiLLM.conversationHistory)
	assert.Equal(t, "model", geminiLLM.conversationHistory[0].Role) // System prompt
	assert.Equal(t, getDefaultSystemPrompt(), geminiLLM.conversationHistory[0].Parts[0].Text)

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
	// // reply, err := geminiLLM.Chat(messages)
	// // assert.NoError(t, err)
	// // assert.Equal(t, "model", string(reply.Role))
	// // assert.Equal(t, "Hello there!", reply.Content)

	t.Log("GeminiLLM.Chat test needs a mock HTTP server for full validation.")
}

// Helper function to create a mock LLM for testing scenarios where a generic LLM is needed
// without specific provider logic.
type mockLLM struct {
	ChatFunc func(messages []Message) (Message, error)
}

func (m *mockLLM) Chat(messages []Message) (Message, error) {
	if m.ChatFunc != nil {
		return m.ChatFunc(messages)
	}
	return Message{Role: "model", Content: "mock response"}, nil
}

func TestMockLLM(t *testing.T) {
	mock := &mockLLM{
		ChatFunc: func(messages []Message) (Message, error) {
			if len(messages) > 0 && messages[0].Content == "ping" {
				return Message{Role: "model", Content: "pong"}, nil
			}
			return Message{Role: "model", Content: "default mock"}, nil
		},
	}

	reply, err := mock.Chat([]Message{{Role: UserRole, Content: "ping"}})
	assert.NoError(t, err)
	assert.Equal(t, "pong", reply.Content)

	reply, err = mock.Chat([]Message{{Role: UserRole, Content: "hello"}})
	assert.NoError(t, err)
	assert.Equal(t, "default mock", reply.Content)
}

// It's good practice to ensure that all concrete LLM types actually implement the LLM interface.
// This won't run as a test but will cause a compile-time error if they don't.
func TestLLMInterfaceImplementations(t *testing.T) {
	var _ LLM = (*GeminiLLM)(nil)
	var _ LLM = (*mockLLM)(nil)
}
