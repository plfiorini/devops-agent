package tools

import (
	"fmt"
	"os/exec"
)

var HelmDeclaration = Tool{
	Name:        "helm",
	Description: "Execute a helm command and return the result",
	Parameters: Schema{
		Type: DataTypeObject,
		Properties: map[string]Property{
			"command": {
				Type:        DataTypeString,
				Description: "The helm command to execute (without the 'helm' prefix)",
				Required:    true,
			},
			"kubecontext": {
				Type:        DataTypeString,
				Description: "The Kubernetes context to use for Helm (optional)",
			},
			"namespace": {
				Type:        DataTypeString,
				Description: "The Kubernetes namespace to use for Helm (optional)",
			},
			"output": {
				Type:        DataTypeString,
				Description: "The output format (e.g., json, yaml, table) (optional)",
			},
		},
	},
}

func ExecuteHelm(args map[string]interface{}) (map[string]interface{}, error) {
	command, ok := args["command"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'command' argument")
	}

	// Build the helm command with options
	helmCmd := "helm"

	// Add kubecontext if specified
	if kubecontext, ok := args["kubecontext"].(string); ok && kubecontext != "" {
		helmCmd += fmt.Sprintf(" --kube-context=%s", kubecontext)
	}

	// Add namespace if specified
	if namespace, ok := args["namespace"].(string); ok && namespace != "" {
		helmCmd += fmt.Sprintf(" --namespace=%s", namespace)
	}

	// Add output format if specified
	// Note: Helm output flags can vary by subcommand (e.g. `helm list -o json`, `helm get manifest <release>`)
	// This generic approach adds `--output` if provided, which works for many common commands.
	if output, ok := args["output"].(string); ok && output != "" {
		helmCmd += fmt.Sprintf(" --output=%s", output)
	}

	// Append the user's command
	helmCmd += " " + command

	// Execute the command using bash
	cmd := exec.Command("bash", "-c", helmCmd)

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
			return result, fmt.Errorf("failed to execute helm command: %v. Output: %s", err, outputStr)
		}
	}

	// Return the results
	result := map[string]interface{}{
		"output":    outputStr,
		"exit_code": exitCode,
	}

	return result, nil
}
