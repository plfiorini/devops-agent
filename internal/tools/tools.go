package tools

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

// AvailableTools maps tool names to their implementations
var AvailableTools = map[string]ToolFunction{
	"bash": ExecuteBash,
}

var Tools = []Tool{
	{
		FunctionDeclarations: []FunctionDeclaration{
			{
				Name:        "bash",
				Description: "Execute a bash command and return the result",
				Parameters: Schema{
					Type: "object",
					Properties: map[string]Property{
						"command": {
							Type:        "string",
							Description: "The bash command to execute",
						},
					},
					Required: []string{"command"},
				},
			},
		},
	},
}
