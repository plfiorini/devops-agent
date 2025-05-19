package tools

import (
	"strings"
	"testing"
)

func TestExecuteBash(t *testing.T) {
	tests := []struct {
		name           string
		args           map[string]interface{}
		wantOutput     string
		wantExitCode   int
		wantErrContain string
	}{
		{
			name:         "successful command",
			args:         map[string]interface{}{"command": "echo 'hello world'"},
			wantOutput:   "hello world",
			wantExitCode: 0,
		},
		{
			name:         "successful command with exit code",
			args:         map[string]interface{}{"command": "exit 5"},
			wantOutput:   "",
			wantExitCode: 5,
		},
		{
			name:           "missing command",
			args:           map[string]interface{}{},
			wantErrContain: "missing or invalid 'command' argument",
		},
		{
			name:           "command is not a string",
			args:           map[string]interface{}{"command": 123},
			wantErrContain: "missing or invalid 'command' argument",
		},
		{
			name:         "command with output",
			args:         map[string]interface{}{"command": "ls -la /non-existent-directory"},
			wantExitCode: 2, // ls returns non-zero when directory doesn't exist
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ExecuteBash(tt.args)

			// Check error cases
			if tt.wantErrContain != "" {
				if err == nil {
					t.Errorf("ExecuteBash() expected error containing %q, got nil", tt.wantErrContain)
					return
				}
				if !strings.Contains(err.Error(), tt.wantErrContain) {
					t.Errorf("ExecuteBash() error = %v, want error containing %q", err, tt.wantErrContain)
				}
				return
			}

			// Non-error cases should not return an error
			if err != nil {
				t.Errorf("ExecuteBash() unexpected error: %v", err)
				return
			}

			// Check output
			if tt.wantOutput != "" {
				output, ok := result["output"].(string)
				if !ok {
					t.Errorf("ExecuteBash() result doesn't contain string 'output'")
					return
				}
				if !strings.Contains(output, tt.wantOutput) {
					t.Errorf("ExecuteBash() output = %q, want %q", output, tt.wantOutput)
				}
			}

			// Check exit code
			exitCode, ok := result["exit_code"].(int)
			if !ok {
				t.Errorf("ExecuteBash() result doesn't contain int 'exit_code'")
				return
			}
			if exitCode != tt.wantExitCode {
				t.Errorf("ExecuteBash() exit_code = %d, want %d", exitCode, tt.wantExitCode)
			}
		})
	}
}