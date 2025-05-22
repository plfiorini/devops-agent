package renderer

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRenderer(t *testing.T) {
	renderer, err := NewRenderer()
	assert.NoError(t, err)
	assert.NotNil(t, renderer)

	// Test rendering simple markdown
	rendered, err := renderer.RenderText("# Hello World")
	assert.NoError(t, err)
	assert.NotEmpty(t, rendered)
	assert.NotEqual(t, "# Hello World", rendered) // Should be transformed

	// Test rendering to writer
	var buf bytes.Buffer
	err = renderer.RenderToWriter("**Bold Text**", &buf)
	assert.NoError(t, err)
	assert.NotEmpty(t, buf.String())
}

func TestProcessTextResponse(t *testing.T) {
	// This is mostly a smoke test to ensure it doesn't panic
	ProcessTextResponse("Test message")
	// No assertion needed; if it doesn't panic, it passes
}
