// Package resources handles embedded resources for the application
package resources

import (
	"embed"
)

//go:embed prompt.txt
var promptFS embed.FS

// GetSystemPrompt returns the content of the system prompt file
func GetSystemPrompt() (string, error) {
	content, err := promptFS.ReadFile("prompt.txt")
	if err != nil {
		return "", err
	}
	return string(content), nil
}
