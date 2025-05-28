package tools

import (
	"fmt"
	"os/exec"
)

var BashDeclaration = Tool{
	Name:        "bash",
	Description: "Execute a bash command and return the result",
	Parameters: Schema{
		Type: DataTypeObject,
		Properties: map[string]Property{
			"command": {
				Type:        DataTypeString,
				Description: "The bash command to execute",
				Required:    true,
			},
		},
	},
}

func ExecuteBash(args map[string]interface{}) (map[string]interface{}, error) {
	command, ok := args["command"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'command' argument")
	}

	// Execute the command using bash
	cmd := exec.Command("bash", "-c", command)

	// Execute the command and capture combined output
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// Get exit code
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("failed to execute command: %v", err)
		}
	}

	// Return the results
	result := map[string]interface{}{
		"output":    outputStr,
		"exit_code": exitCode,
	}

	return result, nil
}
