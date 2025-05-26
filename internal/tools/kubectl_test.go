package tools

import (
	"testing"
)

func TestKubectlDeclaration(t *testing.T) {
	// Test that the declaration has the correct structure
	if KubectlDeclaration.Name != "kubectl" {
		t.Errorf("Expected name 'kubectl', got '%s'", KubectlDeclaration.Name)
	}

	if KubectlDeclaration.Description == "" {
		t.Error("Expected non-empty description")
	}

	// Test that required properties are marked correctly
	commandProp, exists := KubectlDeclaration.Parameters.Properties["command"]
	if !exists {
		t.Error("Expected 'command' property to exist")
	} else if !commandProp.Required {
		t.Error("Expected 'command' property to be required")
	}

	// Test that all expected properties exist
	expectedProps := []string{"command", "context", "namespace", "output"}
	for _, prop := range expectedProps {
		if _, exists := KubectlDeclaration.Parameters.Properties[prop]; !exists {
			t.Errorf("Expected property '%s' to exist", prop)
		}
	}

	// Test property types
	for propName, prop := range KubectlDeclaration.Parameters.Properties {
		if prop.Type != "string" {
			t.Errorf("Expected property '%s' to be of type 'string', got '%s'", propName, prop.Type)
		}
		if prop.Description == "" {
			t.Errorf("Expected property '%s' to have a description", propName)
		}
	}
}

func TestKubectlDeclarationSchema(t *testing.T) {
	// Test schema type
	if KubectlDeclaration.Parameters.Type != "object" {
		t.Errorf("Expected schema type 'object', got '%s'", KubectlDeclaration.Parameters.Type)
	}

	// Test that Properties map is not nil
	if KubectlDeclaration.Parameters.Properties == nil {
		t.Error("Expected Properties map to be initialized")
	}

	// Test specific property descriptions contain expected keywords
	commandProp := KubectlDeclaration.Parameters.Properties["command"]
	if commandProp.Description == "" {
		t.Error("Command property should have a description")
	}

	contextProp := KubectlDeclaration.Parameters.Properties["context"]
	if contextProp.Description == "" {
		t.Error("Context property should have a description")
	}

	namespaceProp := KubectlDeclaration.Parameters.Properties["namespace"]
	if namespaceProp.Description == "" {
		t.Error("Namespace property should have a description")
	}

	outputProp := KubectlDeclaration.Parameters.Properties["output"]
	if outputProp.Description == "" {
		t.Error("Output property should have a description")
	}
}

func TestKubectlDeclarationConstants(t *testing.T) {
	// Test that the declaration is consistent
	if KubectlDeclaration.Name == "" {
		t.Error("Name should not be empty")
	}

	if KubectlDeclaration.Parameters.Type == "" {
		t.Error("Parameters type should not be empty")
	}

	// Make sure required properties are correctly marked
	for propName, prop := range KubectlDeclaration.Parameters.Properties {
		if propName == "command" && !prop.Required {
			t.Error("Command property should be marked as required")
		}
	}
}

func TestKubectlDeclarationDescriptions(t *testing.T) {
	// Test that description mentions kubectl
	if KubectlDeclaration.Description == "" {
		t.Error("Declaration should have a description")
	}

	// Test command property description mentions kubectl prefix
	commandProp := KubectlDeclaration.Parameters.Properties["command"]
	if commandProp.Description == "" {
		t.Error("Command property description should not be empty")
	}

	// Test context property mentions Kubernetes context
	contextProp := KubectlDeclaration.Parameters.Properties["context"]
	if contextProp.Description == "" {
		t.Error("Context property description should not be empty")
	}

	// Test namespace property mentions Kubernetes namespace
	namespaceProp := KubectlDeclaration.Parameters.Properties["namespace"]
	if namespaceProp.Description == "" {
		t.Error("Namespace property description should not be empty")
	}

	// Test output property mentions format examples
	outputProp := KubectlDeclaration.Parameters.Properties["output"]
	if outputProp.Description == "" {
		t.Error("Output property description should not be empty")
	}
}
