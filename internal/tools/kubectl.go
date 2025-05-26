package tools

import (
	"fmt"
	"os/exec"
)

var KubectlDeclaration = Tool{
	Name:        "kubectl",
	Description: "Execute a kubectl command and return the result",
	Parameters: Schema{
		Type: "object",
		Properties: map[string]Property{
			"command": {
				Type:        "string",
				Description: "The kubectl command to execute (without the 'kubectl' prefix)",
				Required:    true,
			},
			"context": {
				Type:        "string",
				Description: "The Kubernetes context to use (optional)",
			},
			"namespace": {
				Type:        "string",
				Description: "The Kubernetes namespace to use (optional)",
			},
			"output": {
				Type:        "string",
				Description: "The output format (e.g., json, yaml, wide) (optional)",
			},
		},
	},
}

func ExecuteKubectl(args map[string]interface{}) (map[string]interface{}, error) {
	command, ok := args["command"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'command' argument")
	}

	// Build the kubectl command with options
	kubectlCmd := "kubectl"

	// Add context if specified
	if context, ok := args["context"].(string); ok && context != "" {
		kubectlCmd += fmt.Sprintf(" --context=%s", context)
	}

	// Add namespace if specified
	if namespace, ok := args["namespace"].(string); ok && namespace != "" {
		kubectlCmd += fmt.Sprintf(" --namespace=%s", namespace)
	}

	// Add output format if specified
	if output, ok := args["output"].(string); ok && output != "" {
		kubectlCmd += fmt.Sprintf(" --output=%s", output)
	}

	// Append the user's command
	kubectlCmd += " " + command

	// Execute the command using bash
	cmd := exec.Command("bash", "-c", kubectlCmd)

	// Execute the command and capture combined output
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// Get exit code
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("failed to execute kubectl command: %v", err)
		}
	}

	// Return the results
	result := map[string]interface{}{
		"output":    outputStr,
		"exit_code": exitCode,
	}

	return result, nil
}
