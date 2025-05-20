package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"devops-agent/internal/tools"
)

// GeminiLLM implements the LLM interface for Google's Gemini models.
type GeminiLLM struct {
	apiKey              string
	model               string
	endpoint            string
	conversationHistory []Content
}

type GeminiRequest struct {
	Contents      []Content      `json:"contents"`
	Tools         []tools.Tool   `json:"tools,omitempty"`
	SafetyRatings []SafetyRating `json:"safetySettings,omitempty"`
	// GenerationConfig GenerationConfig `json:"generationConfig,omitempty"` // Optional
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
	Content Content `json:"content"`
	// FinishReason ...
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

// Chat implements the LLM interface for Gemini.
func (g *GeminiLLM) Chat(messages []Message) (Message, error) {
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

	// Keep trying until Gemini gives a text response (not a function call)
	for {
		requestPayload := GeminiRequest{
			Contents: g.conversationHistory,
			Tools:    tools.Tools,
			SafetyRatings: []SafetyRating{
				{Category: "HARM_CATEGORY_HARASSMENT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_HATE_SPEECH", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
				{Category: "HARM_CATEGORY_DANGEROUS_CONTENT", Threshold: "BLOCK_MEDIUM_AND_ABOVE"},
			},
		}

		jsonPayload, err := json.Marshal(requestPayload)
		if err != nil {
			return Message{}, fmt.Errorf("%w: failed to marshal request: %v", ErrLLMAPI, err)
		}

		// fmt.Printf("\n[DEBUG] Sending to Gemini:\n%s\n", string(jsonPayload)) // For debugging

		// Create HTTP request
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
		if err != nil {
			return Message{}, fmt.Errorf("%w: failed to create request: %v", ErrLLMAPI, err)
		}
		req.Header.Set("Content-Type", "application/json")

		// Send the request
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			return Message{}, fmt.Errorf("%w: failed to send request: %v", ErrLLMAPI, err)
		}
		defer resp.Body.Close()

		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return Message{}, fmt.Errorf("%w: failed to read response: %v", ErrLLMAPI, err)
		}

		// Check for successful status code
		if resp.StatusCode != http.StatusOK {
			return Message{}, fmt.Errorf("%w: API returned status %d: %s", ErrLLMAPI, resp.StatusCode, string(body))
		}

		fmt.Printf("\n[DEBUG] Received from Gemini:\n%s\n", string(body)) // For debugging

		var geminiResp GeminiResponse
		if err := json.Unmarshal(body, &geminiResp); err != nil {
			return Message{}, fmt.Errorf("%w: failed to unmarshal response: %v", ErrInvalidResponse, err)
		}

		// Extract the generated text from the response
		if len(geminiResp.Candidates) == 0 {
			return Message{}, fmt.Errorf("%w: unexpected response structure - no candidates", ErrInvalidResponse)
		}

		// Iterate through all candidates
		for _, candidate := range geminiResp.Candidates {
			if len(candidate.Content.Parts) == 0 {
				// Skip candidates with no parts
				continue
			}

			// Add model's turn to history (whether it's a text or a function call)
			g.conversationHistory = append(g.conversationHistory, candidate.Content)

			// Process each part in the candidate's content
			for _, responsePart := range candidate.Content.Parts {
				if responsePart.FunctionCall != nil {
					fc := responsePart.FunctionCall
					fmt.Printf("AI wants to call function: %s with args: %v\n", fc.Name, fc.Args)

					toolFunc, exists := tools.AvailableTools[fc.Name]
					if !exists {
						log.Printf("Error: Gemini requested unknown tool '%s'\n", fc.Name)
						// Send an error back to Gemini by adding a function response with an error
						g.conversationHistory = append(g.conversationHistory, Content{
							Role: "model", // This is technically from the "tool" role, but API expects user/model
							Parts: []Part{{
								FunctionResponse: &FunctionResponse{
									Name: fc.Name,
									Response: map[string]interface{}{
										"error": "Tool not found: " + fc.Name,
									},
								},
							}},
						})
						continue // Try the next candidate or re-prompt Gemini
					}

					toolResult, err := toolFunc(fc.Args)
					if err != nil {
						log.Printf("Error executing tool %s: %v\n", fc.Name, err)
						// Send error back to Gemini
						g.conversationHistory = append(g.conversationHistory, Content{
							Role: "model", // or "tool" if API evolves; "model" seems to work for now when it's a function response.
							Parts: []Part{{
								FunctionResponse: &FunctionResponse{
									Name: fc.Name,
									Response: map[string]interface{}{
										"error": fmt.Sprintf("Error executing tool %s: %v", fc.Name, err),
									},
								},
							}},
						})
						continue // Try the next candidate or re-prompt Gemini with the tool execution error
					}

					log.Printf("[TOOL] %s result: %v\n", fc.Name, toolResult)

					// Add function response to history
					toolResponseContent := Content{
						Role: "model",
						Parts: []Part{{
							FunctionResponse: &FunctionResponse{
								Name:     fc.Name,
								Response: toolResult,
							},
						}},
					}
					g.conversationHistory = append(g.conversationHistory, toolResponseContent)
					// Now, loop again to send this history (including tool result) back to Gemini.
				} else if responsePart.Text != "" {
					fmt.Printf("AI: %s\n", responsePart.Text)
					// The model's response (which might be a text or a function call) is already added to history above.
					// If it was text, we're done with this turn.
					return Message{}, nil // Break the inner loop, ready for new user input
				} else {
					log.Println("AI response part was empty (no text or function call).")
					// Add a placeholder to avoid issues and break.
					g.conversationHistory = append(g.conversationHistory, Content{
						Role:  "model",
						Parts: []Part{{Text: "I received an unexpected response. Let's try again."}},
					})
					fmt.Println("AI: I received an unexpected response. Let's try again.")
					return Message{}, nil
				}
			}
		}
	}
}
