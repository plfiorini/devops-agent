package tools

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Tool represents a tool that can be executed by the AI.
type Tool struct {
	Name        string
	Description string
	Parameters  Schema
}

// DataType represents the type of data a property can hold.
type DataType string

const (
	// DataTypeString represents a string type.
	DataTypeString DataType = "string"
	// DataTypeInteger represents an integer type.
	DataTypeInteger DataType = "integer"
	// DataTypeBoolean represents a boolean type.
	DataTypeBoolean DataType = "boolean"
	// DataTypeObject represents an object type.
	DataTypeObject DataType = "object"
)

// Schema represents an object schema for tool parameters.
type Schema struct {
	Type       DataType
	Properties map[string]Property
}

// Property represents a property in a schema.
type Property struct {
	Type        DataType
	Description string
	Required    bool
}

// ToolFunction represents a function our AI can call.
type ToolFunction func(args map[string]interface{}) (map[string]interface{}, error)

// Global configuration for tools
var UnsafeMode bool = false

// Tools is a list of all available tools.
var Tools = []Tool{
	BashDeclaration,
	KubectlDeclaration,
	HelmDeclaration,
	AzDeclaration,
}

// AvailableTools maps tool names to their implementations.
var AvailableTools = map[string]ToolFunction{
	"bash":    ExecuteBash,
	"kubectl": ExecuteKubectl,
	"helm":    ExecuteHelm,
	"az":      ExecuteAz,
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
