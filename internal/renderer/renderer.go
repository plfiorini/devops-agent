package renderer

import (
	"fmt"
	"io"
	"os"

	"github.com/charmbracelet/glamour"
)

// DefaultRenderer is the default renderer with standard configuration
var DefaultRenderer *Renderer

// Renderer wraps glamour rendering functionality
type Renderer struct {
	renderer *glamour.TermRenderer
}

// init initializes the default renderer
func init() {
	var err error
	DefaultRenderer, err = NewRenderer()
	if err != nil {
		// If we can't create a renderer, create a fallback one
		fmt.Fprintf(os.Stderr, "Warning: failed to initialize glamour renderer: %v\n", err)
		DefaultRenderer = &Renderer{
			renderer: nil, // Will use fallback rendering
		}
	}
}

// NewRenderer creates a new renderer with default settings
func NewRenderer() (*Renderer, error) {
	renderer, err := glamour.NewTermRenderer(
		// Dark background style
		glamour.WithAutoStyle(),
		// Set word wrap width to terminal width
		glamour.WithWordWrap(100),
	)

	if err != nil {
		return nil, err
	}

	return &Renderer{
		renderer: renderer,
	}, nil
}

// RenderText renders text using glamour markdown styling
func (r *Renderer) RenderText(text string) (string, error) {
	if r.renderer == nil {
		// Fallback to plain text if renderer is not available
		return text, nil
	}

	// Render the text as Markdown
	rendered, err := r.renderer.Render(text)
	if err != nil {
		return text, err // Return original text on error
	}

	return rendered, nil
}

// RenderToWriter renders text and writes to the specified writer
func (r *Renderer) RenderToWriter(text string, w io.Writer) error {
	rendered, err := r.RenderText(text)
	if err != nil {
		// If rendering fails, write the original text
		_, writeErr := fmt.Fprintln(w, text)
		return fmt.Errorf("render error: %v, write error: %v", err, writeErr)
	}

	_, err = fmt.Fprint(w, rendered)
	return err
}

// ProcessTextResponse renders text and prints it to stdout
func ProcessTextResponse(text string) {
	err := DefaultRenderer.RenderToWriter(text, os.Stdout)
	if err != nil {
		// If rendering fails, fallback to plain text
		fmt.Println(text)
	}
}
