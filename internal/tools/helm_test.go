package tools

import (
	"testing"
)

func TestHelmDeclaration(t *testing.T) {
	// Test that the declaration has the correct structure
	if HelmDeclaration.Name != "helm" {
		t.Errorf("Expected name 'helm', got '%s'", HelmDeclaration.Name)
	}

	if HelmDeclaration.Description == "" {
		t.Error("Expected non-empty description")
	}

	// Test that required properties are marked correctly
	commandProp, exists := HelmDeclaration.Parameters.Properties["command"]
	if !exists {
		t.Error("Expected 'command' property to exist")
	} else if !commandProp.Required {
		t.Error("Expected 'command' property to be required")
	}

	// Test that all expected properties exist
	expectedProps := []string{"command", "kubecontext", "namespace", "output"}
	for _, prop := range expectedProps {
		if _, exists := HelmDeclaration.Parameters.Properties[prop]; !exists {
			t.Errorf("Expected property '%s' to exist", prop)
		}
	}

	// Test property types
	for propName, prop := range HelmDeclaration.Parameters.Properties {
		if prop.Type != "string" {
			t.Errorf("Expected property '%s' to be of type 'string', got '%s'", propName, prop.Type)
		}
		if prop.Description == "" {
			t.Errorf("Expected property '%s' to have a description", propName)
		}
	}
}

func TestHelmDeclarationSchema(t *testing.T) {
	// Test schema type
	if HelmDeclaration.Parameters.Type != "object" {
		t.Errorf("Expected schema type 'object', got '%s'", HelmDeclaration.Parameters.Type)
	}

	// Test that Properties map is not nil
	if HelmDeclaration.Parameters.Properties == nil {
		t.Error("Expected Properties map to be initialized")
	}

	// Test specific property descriptions contain expected keywords
	commandProp := HelmDeclaration.Parameters.Properties["command"]
	if commandProp.Description == "" {
		t.Error("Command property should have a description")
	}

	namespaceProp := HelmDeclaration.Parameters.Properties["namespace"]
	if namespaceProp.Description == "" {
		t.Error("Namespace property should have a description")
	}
}

func TestHelmDeclarationConstants(t *testing.T) {
	// Test that the declaration is consistent
	if HelmDeclaration.Name == "" {
		t.Error("Name should not be empty")
	}

	if HelmDeclaration.Parameters.Type == "" {
		t.Error("Parameters type should not be empty")
	}

	// Make sure required properties are correctly marked
	for propName, prop := range HelmDeclaration.Parameters.Properties {
		if propName == "command" && !prop.Required {
			t.Error("Command property should be marked as required")
		}
	}
}
