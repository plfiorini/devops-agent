package tools

import (
	"reflect"
	"testing"
)

func TestToolStructures(t *testing.T) {
	// Test Tool structure
	tool := Tool{
		FunctionDeclarations: []FunctionDeclaration{
			{
				Name:        "test",
				Description: "test description",
				Parameters: Schema{
					Type: "object",
					Properties: map[string]Property{
						"param1": {
							Type:        "string",
							Description: "param1 description",
						},
					},
					Required: []string{"param1"},
				},
			},
		},
	}

	if len(tool.FunctionDeclarations) != 1 {
		t.Errorf("Expected 1 function declaration, got %d", len(tool.FunctionDeclarations))
	}

	// Test FunctionDeclaration structure
	fd := tool.FunctionDeclarations[0]
	if fd.Name != "test" {
		t.Errorf("Expected name to be 'test', got %s", fd.Name)
	}
	if fd.Description != "test description" {
		t.Errorf("Expected description to be 'test description', got %s", fd.Description)
	}

	// Test Schema structure
	schema := fd.Parameters
	if schema.Type != "object" {
		t.Errorf("Expected type to be 'object', got %s", schema.Type)
	}
	if len(schema.Properties) != 1 {
		t.Errorf("Expected 1 property, got %d", len(schema.Properties))
	}
	if len(schema.Required) != 1 || schema.Required[0] != "param1" {
		t.Errorf("Expected required to be ['param1'], got %v", schema.Required)
	}

	// Test Property structure
	prop := schema.Properties["param1"]
	if prop.Type != "string" {
		t.Errorf("Expected type to be 'string', got %s", prop.Type)
	}
	if prop.Description != "param1 description" {
		t.Errorf("Expected description to be 'param1 description', got %s", prop.Description)
	}
}

func TestAvailableTools(t *testing.T) {
	if len(AvailableTools) != 1 {
		t.Errorf("Expected 1 available tool, got %d", len(AvailableTools))
	}

	if _, exists := AvailableTools["bash"]; !exists {
		t.Errorf("Expected 'bash' tool to exist in AvailableTools")
	}

	// Test that ExecuteBash is assigned to the right key
	expectedFunc := reflect.ValueOf(ExecuteBash)
	actualFunc := reflect.ValueOf(AvailableTools["bash"])

	if expectedFunc.Pointer() != actualFunc.Pointer() {
		t.Errorf("Expected AvailableTools['bash'] to be ExecuteBash, got a different function")
	}
}

func TestTools(t *testing.T) {
	if len(Tools) != 1 {
		t.Errorf("Expected 1 tool, got %d", len(Tools))
	}

	tool := Tools[0]
	if len(tool.FunctionDeclarations) != 1 {
		t.Errorf("Expected 1 function declaration, got %d", len(tool.FunctionDeclarations))
	}

	fd := tool.FunctionDeclarations[0]
	if fd.Name != "bash" {
		t.Errorf("Expected name to be 'bash', got %s", fd.Name)
	}
	if fd.Description != "Execute a bash command and return the result" {
		t.Errorf("Expected correct description, got %s", fd.Description)
	}

	schema := fd.Parameters
	if schema.Type != "object" {
		t.Errorf("Expected type to be 'object', got %s", schema.Type)
	}
	if len(schema.Properties) != 1 {
		t.Errorf("Expected 1 property, got %d", len(schema.Properties))
	}
	if prop, exists := schema.Properties["command"]; !exists {
		t.Errorf("Expected 'command' property to exist")
	} else {
		if prop.Type != "string" {
			t.Errorf("Expected 'command' property type to be 'string', got %s", prop.Type)
		}
	}
	if len(schema.Required) != 1 || schema.Required[0] != "command" {
		t.Errorf("Expected required to be ['command'], got %v", schema.Required)
	}
}
