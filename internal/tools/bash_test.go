package tools

import (
	"testing"
)

func TestBashDeclaration(t *testing.T) {
	// Test that the declaration has the correct structure
	if BashDeclaration.Name != "bash" {
		t.Errorf("Expected name 'bash', got '%s'", BashDeclaration.Name)
	}

	if BashDeclaration.Description == "" {
		t.Error("Expected non-empty description")
	}

	// Test that required properties are marked correctly
	commandProp, exists := BashDeclaration.Parameters.Properties["command"]
	if !exists {
		t.Error("Expected 'command' property to exist")
	} else if !commandProp.Required {
		t.Error("Expected 'command' property to be required")
	}

	// Test that all expected properties exist
	expectedProps := []string{"command"}
	for _, prop := range expectedProps {
		if _, exists := BashDeclaration.Parameters.Properties[prop]; !exists {
			t.Errorf("Expected property '%s' to exist", prop)
		}
	}

	// Test property types
	for propName, prop := range BashDeclaration.Parameters.Properties {
		if prop.Type != "string" {
			t.Errorf("Expected property '%s' to be of type 'string', got '%s'", propName, prop.Type)
		}
		if prop.Description == "" {
			t.Errorf("Expected property '%s' to have a description", propName)
		}
	}
}

func TestBashDeclarationSchema(t *testing.T) {
	// Test schema type
	if BashDeclaration.Parameters.Type != "object" {
		t.Errorf("Expected schema type 'object', got '%s'", BashDeclaration.Parameters.Type)
	}

	// Test that Properties map is not nil
	if BashDeclaration.Parameters.Properties == nil {
		t.Error("Expected Properties map to be initialized")
	}

	// Test specific property descriptions contain expected keywords
	commandProp := BashDeclaration.Parameters.Properties["command"]
	if commandProp.Description == "" {
		t.Error("Command property should have a description")
	}
}

func TestBashDeclarationConstants(t *testing.T) {
	// Test that the declaration is consistent
	if BashDeclaration.Name == "" {
		t.Error("Name should not be empty")
	}

	if BashDeclaration.Parameters.Type == "" {
		t.Error("Parameters type should not be empty")
	}

	// Make sure required properties are correctly marked
	for propName, prop := range BashDeclaration.Parameters.Properties {
		if propName == "command" && !prop.Required {
			t.Error("Command property should be marked as required")
		}
	}
}
