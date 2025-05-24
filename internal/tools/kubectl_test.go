package tools

import (
	"reflect"
	"testing"
)

// contains checks if a string is present in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func TestKubectlDeclaration(t *testing.T) {
	// Validate KubectlDeclaration has the expected properties
	if KubectlDeclaration.Name != "kubectl" {
		t.Errorf("Expected KubectlDeclaration.Name to be 'kubectl', got '%s'", KubectlDeclaration.Name)
	}

	// Check that required parameters are defined correctly
	commandParam, exists := KubectlDeclaration.Parameters.Properties["command"]
	if !exists {
		t.Errorf("Expected KubectlDeclaration to have 'command' parameter")
	} else {
		if commandParam.Type != "string" {
			t.Errorf("Expected 'command' parameter to be of type 'string', got '%s'", commandParam.Type)
		}
	}

	// Check optional parameters
	optionalParams := []string{"context", "namespace", "output"}
	for _, param := range optionalParams {
		p, exists := KubectlDeclaration.Parameters.Properties[param]
		if !exists {
			t.Errorf("Expected KubectlDeclaration to have '%s' parameter", param)
		} else {
			if KubectlDeclaration.Parameters.Required != nil && contains(KubectlDeclaration.Parameters.Required, param) {
				t.Errorf("Expected '%s' parameter to be optional, but it is required", param)
			}
			if p.Type != "string" {
				t.Errorf("Expected '%s' parameter to be of type 'string', got '%s'", param, p.Type)
			}
		}
	}
}

func TestExecuteKubectlSignature(t *testing.T) {
	// Use reflection to verify function signature
	fnType := reflect.TypeOf(ExecuteKubectl)

	// Check that it's a function
	if fnType.Kind() != reflect.Func {
		t.Fatal("ExecuteKubectl is not a function")
	}

	// Check parameter count
	if fnType.NumIn() != 1 {
		t.Errorf("ExecuteKubectl should accept 1 parameter, got %d", fnType.NumIn())
	}

	// Check parameter type
	if fnType.In(0).Kind() != reflect.Map {
		t.Errorf("ExecuteKubectl parameter should be a map, got %s", fnType.In(0).Kind())
	}

	// Check return values
	if fnType.NumOut() != 2 {
		t.Errorf("ExecuteKubectl should return 2 values, got %d", fnType.NumOut())
	}

	// Check first return value (should be map[string]interface{})
	if fnType.Out(0).Kind() != reflect.Map {
		t.Errorf("First return value should be a map, got %s", fnType.Out(0).Kind())
	}

	// Check second return value (should be error)
	if fnType.Out(1).String() != "error" {
		t.Errorf("Second return value should be error, got %s", fnType.Out(1).String())
	}
}
