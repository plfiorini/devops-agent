package tools

import (
	"fmt"
	"os/exec"
)

var AzDeclaration = Tool{
	Name:        "az",
	Description: "Execute an Azure CLI command and return the result",
	Parameters: Schema{
		Type: "object",
		Properties: map[string]Property{
			"command": {
				Type:        "string",
				Description: "The Azure CLI command to execute (without the 'az' prefix)",
				Required:    true,
			},
			"subscription": {
				Type:        "string",
				Description: "The Azure subscription ID or name to use (optional)",
			},
			"resource_group": {
				Type:        "string",
				Description: "The Azure resource group to use (optional)",
			},
			"output": {
				Type:        "string",
				Description: "The output format (e.g., json, yaml, table, tsv) (optional)",
			},
		},
	},
}

func ExecuteAz(args map[string]interface{}) (map[string]interface{}, error) {
	command, ok := args["command"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'command' argument")
	}

	// Build the az command with options
	azCmd := "az"

	// Add subscription if specified
	if subscription, ok := args["subscription"].(string); ok && subscription != "" {
		azCmd += fmt.Sprintf(" --subscription=%s", subscription)
	}

	// Add resource group if specified
	if resourceGroup, ok := args["resource_group"].(string); ok && resourceGroup != "" {
		azCmd += fmt.Sprintf(" --resource-group=%s", resourceGroup)
	}

	// Add output format if specified
	if output, ok := args["output"].(string); ok && output != "" {
		azCmd += fmt.Sprintf(" --output=%s", output)
	}

	// Append the user's command
	azCmd += " " + command

	// Execute the command using bash
	cmd := exec.Command("bash", "-c", azCmd)

	// Execute the command and capture combined output
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// Get exit code
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			// For non-ExitError cases (e.g., command not found), still capture output if any
			// and return a more generic error.
			result := map[string]interface{}{
				"output":    outputStr,
				"exit_code": -1, // Indicate an error before execution or a non-standard exit
			}
			return result, fmt.Errorf("failed to execute az command: %v. Output: %s", err, outputStr)
		}
	}

	// Return the results
	result := map[string]interface{}{
		"output":    outputStr,
		"exit_code": exitCode,
	}

	return result, nil
}
