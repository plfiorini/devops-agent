package resources

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetSystemPrompt(t *testing.T) {
	prompt, err := GetSystemPrompt()

	// Test that the prompt loads successfully
	assert.NoError(t, err)
	assert.NotEmpty(t, prompt)

	// Test that the prompt contains expected content
	assert.True(t, strings.Contains(prompt, "You are a helpful assistant"))
	assert.True(t, strings.Contains(prompt, "You can help with"))
}
