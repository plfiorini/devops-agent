package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/sirupsen/logrus"

	"devops-agent/internal/renderer"
	"devops-agent/internal/tools"
)

// GeminiLLM implements the LLM interface for Google's Gemini models.
type GeminiLLM struct {
	apiKey              string
	model               string
	endpoint            string
	conversationHistory []Content
	logger              *logrus.Logger
}

type GenerationConfig struct {
	Temperature     float64  `json:"temperature,omitempty"`
	TopP            float64  `json:"topP,omitempty"`
	TopK            int      `json:"topK,omitempty"`
	CandidateCount  int      `json:"candidateCount,omitempty"`
	MaxOutputTokens int      `json:"maxOutputTokens,omitempty"`
	StopSequences   []string `json:"stopSequences,omitempty"`
}

type GeminiRequest struct {
	Contents         []Content        `json:"contents"`
	Tools            []Tool           `json:"tools,omitempty"`
	SafetyRatings    []SafetyRating   `json:"safetySettings,omitempty"`
	GenerationConfig GenerationConfig `json:"generationConfig,omitempty"`
}

type Content struct {
	Role  string `json:"role"` // "user" or "model"
	Parts []Part `json:"parts"`
}

type Part struct {
	Text             string            `json:"text,omitempty"`
	FunctionCall     *FunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *FunctionResponse `json:"functionResponse,omitempty"`
}

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

type FunctionCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type FunctionResponse struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type SafetyRating struct {
	Category  string `json:"category"`
	Threshold string `json:"threshold"`
}

type GeminiResponse struct {
	Candidates []Candidate `json:"candidates"`
	// PromptFeedback ... (omitted for simplicity)
}

type Candidate struct {
	Content      Content `json:"content"`
	FinishReason string  `json:"finishReason"`
	// SafetyRatings ...
}

// NewGeminiLLM creates a new Gemini LLM instance.
func NewGeminiLLM(config LLMConfig) (LLM, error) {
	model := config.Model
	if model == "" {
		model = "gemini-1.5-pro" // Default model
	}

	endpoint := config.Endpoint
	if endpoint == "" {
		endpoint = "https://generativelanguage.googleapis.com/v1beta"
	}

	// Add default system prompt
	var conversationHistory []Content
	conversationHistory = append(conversationHistory, Content{
		Role:  "model",
		Parts: []Part{{Text: getDefaultSystemPrompt()}},
	})

	return &GeminiLLM{
		apiKey:              config.APIKey,
		model:               model,
		endpoint:            endpoint,
		conversationHistory: conversationHistory,
	}, nil
}

// SetLogger sets the logger for the GeminiLLM instance
func (g *GeminiLLM) SetLogger(logger *logrus.Logger) {
	g.logger = logger
	// If no logger was provided, create a default one
	if g.logger == nil {
		g.logger = logrus.New()
		g.logger.SetLevel(logrus.InfoLevel)
	}
}

// Chat implements the LLM interface for Gemini.
func (g *GeminiLLM) Chat(messages []Message) error {
	// Construct the API endpoint URL with the API key
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", g.endpoint, g.model, g.apiKey)

	// Append messages to conversation history
	for _, msg := range messages {
		// Map roles from our standard to Gemini's expected format
		role := string(msg.Role)
		if role == "system" {
			role = "model"
		}

		g.conversationHistory = append(g.conversationHistory, Content{
			Role: role,
			Parts: []Part{
				{
					Text: msg.Content,
				},
			},
		})
	}

	// Convert tools.Tools to Gemini format
	var geminiTools []Tool
	if len(tools.Tools) > 0 {
		var functionDeclarations []FunctionDeclaration
		for _, tool := range tools.Tools {
			// Extract required properties for this tool
			var requiredProps []string
			for name, prop := range tool.Parameters.Properties {
				if prop.Required {
					requiredProps = append(requiredProps, name)
				}
			}
			functionDeclaration := FunctionDeclaration{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters: Schema{
					Type:       "object",
					Properties: make(map[string]Property),
					Required:   requiredProps,
				},
			}

			// Convert parameters from tools.Tool to Gemini format
			for paramName, param := range tool.Parameters.Properties {
				functionDeclaration.Parameters.Properties[paramName] = Property{
					Type:        param.Type,
					Description: param.Description,
				}
			}
			functionDeclarations = append(functionDeclarations, functionDeclaration)
		}
		geminiTools = []Tool{{
			FunctionDeclarations: functionDeclarations,
		}}
	}

	// Keep trying until Gemini gives a text response (not a function call)
	for {
		requestPayload := GeminiRequest{
			Contents: g.conversationHistory,
			Tools:    geminiTools,
			SafetyRatings: []SafetyRating{
				{Category: "HARM_CATEGORY_HARASSMENT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_HATE_SPEECH", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_DANGEROUS_CONTENT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
			},
			GenerationConfig: GenerationConfig{
				Temperature: 0,
			},
		}

		jsonPayload, err := json.Marshal(requestPayload)
		if err != nil {
			return fmt.Errorf("%w: failed to marshal request: %v", ErrLLMAPI, err)
		}

		g.logger.Debugf("Sending to Gemini:\n%s\n", string(jsonPayload)) // For debugging

		// Create HTTP request
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
		if err != nil {
			return fmt.Errorf("%w: failed to create request: %v", ErrLLMAPI, err)
		}
		req.Header.Set("Content-Type", "application/json")

		// Send the request
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("%w: failed to send request: %v", ErrLLMAPI, err)
		}
		defer resp.Body.Close()

		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("%w: failed to read response: %v", ErrLLMAPI, err)
		}

		// Check for successful status code
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("%w: API returned status %d: %s", ErrLLMAPI, resp.StatusCode, string(body))
		}

		g.logger.Debugf("Received from Gemini:\n%s\n", string(body)) // For debugging

		var geminiResp GeminiResponse
		if err := json.Unmarshal(body, &geminiResp); err != nil {
			return fmt.Errorf("%w: failed to unmarshal response: %v", ErrInvalidResponse, err)
		}

		// Extract the generated text from the response
		if len(geminiResp.Candidates) == 0 {
			// No candidates in the response
			return nil
		}

		// Iterate through all candidates
		for _, candidate := range geminiResp.Candidates {
			if len(candidate.Content.Parts) == 0 {
				// Skip candidates with no parts
				continue
			}

			// Add model's turn to history (whether it's a text or a function call)
			modelResponse := candidate.Content
			modelResponse.Role = "model"
			g.conversationHistory = append(g.conversationHistory, modelResponse)

			// Process each part in the candidate's content
			for _, responsePart := range candidate.Content.Parts {
				if responsePart.Text != "" {
					// Render the text response
					renderer.ProcessTextResponse(responsePart.Text)
				} else if responsePart.FunctionCall != nil {
					// Handle function call
					g.handleFunctionCall(responsePart.FunctionCall)
				} else {
					g.logger.Infoln("AI response part was empty (no text or function call).")

					// Add a placeholder to avoid issues and break.
					g.conversationHistory = append(g.conversationHistory, Content{
						Role:  "model",
						Parts: []Part{{Text: "I received an unexpected response. Let's try again."}},
					})
					g.logger.Infoln("AI: I received an unexpected response. Let's try again.")
					return nil
				}
			}

			// Check finish reason if present
			switch candidate.FinishReason {
			case "STOP":
				// Normal completion
				continue
			case "MAX_TOKENS":
				g.logger.Warnln("Response truncated due to MAX_TOKENS limit")
				return nil
			case "SAFETY":
				g.logger.Warnln("Response stopped due to safety concerns")
				return nil
			case "RECITATION":
				g.logger.Warnln("Response stopped due to recitation concerns")
				return nil
			case "OTHER":
				g.logger.Warnln("Response stopped for other reasons")
				return nil
			default:
				// No finish reason or unrecognized one, might be a partial response
				// ...but we'll return it anyway since the model's turn is added to history
				g.logger.Warnln("No finish reason or unrecognized one")
				return nil
			}
		}
	}
}

// handleFunctionCall processes function calls from the model
func (g *GeminiLLM) handleFunctionCall(fc *FunctionCall) error {
	g.logger.Infof("AI wants to call function: %s with args: %v", fc.Name, fc.Args)

	// Find the matching tool
	toolFunc, exists := tools.AvailableTools[fc.Name]
	if !exists {
		g.logger.Errorf("Gemini requested unknown tool '%s'\n", fc.Name)

		// Send an error back to Gemini by adding a function response with an error
		g.conversationHistory = append(g.conversationHistory, Content{
			Role: "model",
			Parts: []Part{{
				FunctionResponse: &FunctionResponse{
					Name: fc.Name,
					Response: map[string]interface{}{
						"error": "Tool not found: " + fc.Name,
					},
				},
			}},
		})

		return fmt.Errorf("%w: tool %s not found", ErrInvalidResponse, fc.Name)
	}

	// Execute the function with confirmation (unless in unsafe mode)
	result, err := tools.ExecuteToolWithConfirmation(fc.Name, toolFunc, fc.Args)
	if err != nil {
		g.logger.Errorf("Error executing tool %s: %v", fc.Name, err)

		// Add the error response to conversation history
		g.conversationHistory = append(g.conversationHistory, Content{
			Role: "model",
			Parts: []Part{{
				FunctionResponse: &FunctionResponse{
					Name: fc.Name,
					Response: map[string]interface{}{
						"error": fmt.Sprintf("Error executing tool %s: %v", fc.Name, err),
					},
				},
			}},
		})
		return err
	}
	//g.logger.Debugf("[TOOL] %s result: %v\n", fc.Name, result)

	// Add successful function response to conversation history
	//g.logger.Debugf("[TOOL] %s executed successfully with result: %v", fc.Name, result)
	g.conversationHistory = append(g.conversationHistory, Content{
		Role: "model",
		Parts: []Part{{
			FunctionResponse: &FunctionResponse{
				Name:     fc.Name,
				Response: result,
			},
		}},
	})

	return nil
}
