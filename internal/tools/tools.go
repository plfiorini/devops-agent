package tools

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type Tool struct {
	FunctionDeclarations []FunctionDeclaration `json:"functionDeclarations"`
}

type FunctionDeclaration struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Parameters  Schema `json:"parameters"`
}

type Schema struct {
	Type       string              `json:"type"` // e.g., "object"
	Properties map[string]Property `json:"properties"`
	Required   []string            `json:"required,omitempty"`
}

type Property struct {
	Type        string `json:"type"` // e.g., "string", "number"
	Description string `json:"description"`
}

// ToolFunction represents a function our AI can call
type ToolFunction func(args map[string]interface{}) (map[string]interface{}, error)

// Global configuration for tools
var UnsafeMode bool = false

// AvailableTools maps tool names to their implementations
var AvailableTools = map[string]ToolFunction{
	"bash": ExecuteBash,
}

// SetUnsafeMode configures whether tools should run without confirmation
func SetUnsafeMode(unsafe bool) {
	UnsafeMode = unsafe
}

// ExecuteToolWithConfirmation wraps a tool execution with confirmation prompt
func ExecuteToolWithConfirmation(name string, toolFunc ToolFunction, args map[string]interface{}) (map[string]interface{}, error) {
	// If in unsafe mode, execute without confirmation
	if UnsafeMode {
		return toolFunc(args)
	}

	// Otherwise, prompt for confirmation
	fmt.Printf("AI wants to use tool: %s with args: %v\n", name, args)
	fmt.Print("Allow this action? [y/N] ")

	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return nil, fmt.Errorf("failed to read confirmation: %v", err)
	}

	response = strings.ToLower(strings.TrimSpace(response))
	if response != "y" && response != "yes" {
		return map[string]interface{}{
			"result": "Tool execution cancelled by user.",
		}, nil
	}

	// User confirmed, execute the tool
	return toolFunc(args)
}

var Tools = []Tool{
	{
		FunctionDeclarations: []FunctionDeclaration{
			BashDeclaration,
		},
	},
}
