package tools

import (
	"testing"
)

func TestAzDeclaration(t *testing.T) {
	// Test that the declaration has the correct structure
	if AzDeclaration.Name != "az" {
		t.Errorf("Expected name 'az', got '%s'", AzDeclaration.Name)
	}

	if AzDeclaration.Description == "" {
		t.Error("Expected non-empty description")
	}

	// Test required parameters
	expectedRequired := []string{"command"}
	if len(AzDeclaration.Parameters.Required) != len(expectedRequired) {
		t.Errorf("Expected %d required parameters, got %d", len(expectedRequired), len(AzDeclaration.Parameters.Required))
	}

	for i, req := range expectedRequired {
		if AzDeclaration.Parameters.Required[i] != req {
			t.Errorf("Expected required parameter '%s', got '%s'", req, AzDeclaration.Parameters.Required[i])
		}
	}

	// Test that all expected properties exist
	expectedProps := []string{"command", "subscription", "resource_group", "output"}
	for _, prop := range expectedProps {
		if _, exists := AzDeclaration.Parameters.Properties[prop]; !exists {
			t.Errorf("Expected property '%s' to exist", prop)
		}
	}

	// Test property types
	for propName, prop := range AzDeclaration.Parameters.Properties {
		if prop.Type != "string" {
			t.Errorf("Expected property '%s' to be of type 'string', got '%s'", propName, prop.Type)
		}
		if prop.Description == "" {
			t.Errorf("Expected property '%s' to have a description", propName)
		}
	}
}

func TestAzDeclarationSchema(t *testing.T) {
	// Test schema type
	if AzDeclaration.Parameters.Type != "object" {
		t.Errorf("Expected schema type 'object', got '%s'", AzDeclaration.Parameters.Type)
	}

	// Test that Properties map is not nil
	if AzDeclaration.Parameters.Properties == nil {
		t.Error("Expected Properties map to be initialized")
	}

	// Test specific property descriptions contain expected keywords
	commandProp := AzDeclaration.Parameters.Properties["command"]
	if commandProp.Description == "" {
		t.Error("Command property should have a description")
	}

	subscriptionProp := AzDeclaration.Parameters.Properties["subscription"]
	if subscriptionProp.Description == "" {
		t.Error("Subscription property should have a description")
	}

	resourceGroupProp := AzDeclaration.Parameters.Properties["resource_group"]
	if resourceGroupProp.Description == "" {
		t.Error("Resource group property should have a description")
	}

	outputProp := AzDeclaration.Parameters.Properties["output"]
	if outputProp.Description == "" {
		t.Error("Output property should have a description")
	}
}

func TestAzDeclarationConstants(t *testing.T) {
	// Test that the declaration is consistent
	if AzDeclaration.Name == "" {
		t.Error("Name should not be empty")
	}

	if AzDeclaration.Parameters.Type == "" {
		t.Error("Parameters type should not be empty")
	}

	// Test that required fields are actually in properties
	for _, req := range AzDeclaration.Parameters.Required {
		if _, exists := AzDeclaration.Parameters.Properties[req]; !exists {
			t.Errorf("Required field '%s' should exist in properties", req)
		}
	}
}

func TestAzDeclarationPropertyDescriptions(t *testing.T) {
	// Test specific property descriptions for Azure CLI context
	tests := []struct {
		property   string
		shouldHave []string
	}{
		{"command", []string{"Azure CLI", "command"}},
		{"subscription", []string{"subscription"}},
		{"resource_group", []string{"resource group"}},
		{"output", []string{"output", "format"}},
	}

	for _, test := range tests {
		prop, exists := AzDeclaration.Parameters.Properties[test.property]
		if !exists {
			t.Errorf("Property '%s' should exist", test.property)
			continue
		}

		description := prop.Description
		for _, keyword := range test.shouldHave {
			if description == "" {
				t.Errorf("Property '%s' should have a description containing '%s'", test.property, keyword)
			}
		}
	}
}

func TestAzDeclarationPropertiesCount(t *testing.T) {
	expectedCount := 4
	actualCount := len(AzDeclaration.Parameters.Properties)

	if actualCount != expectedCount {
		t.Errorf("Expected %d properties, got %d", expectedCount, actualCount)
	}
}
