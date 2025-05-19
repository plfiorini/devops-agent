package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"devops-agent/internal/config"
	"devops-agent/internal/llm"
)

func main() {
	// Define command-line flags
	configPath := flag.String("config", "config.yaml", "Path to the configuration file")
	flag.Parse()

	// Initialize the application
	fmt.Println("DevOps AI Agent")
	fmt.Println("---------------")
	fmt.Printf("Using configuration file: %s\n", *configPath)

	// Load configuration
	appConfig, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	reader := bufio.NewReader(os.Stdin)

	// Create the LLM client using the factory
	llmClient, err := llm.NewLLMProvider(appConfig.LLM) // Use loaded config
	if err != nil {
		log.Fatalf("Error creating LLM provider (%s): %v", appConfig.LLM.Provider, err)
	}

	fmt.Printf("Successfully initialized LLM provider %s with model %s\n", appConfig.LLM.Provider, appConfig.LLM.Model)

	for {
		fmt.Print("> ")
		input, err := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		// Check if Ctrl+D was pressed during input read
		if errors.Is(err, io.EOF) {
			fmt.Println("\nExiting due to EOF (CTRL+D)")
			break
		}

		if input == "" {
			continue
		}

		lowerInput := strings.ToLower(input)
		if lowerInput == "exit" || lowerInput == "quit" {
			break
		}

		// Create a structured message object
		messages := []llm.Message{
			{Role: "user", Content: input},
		}
		chatResponse, err := llmClient.Chat(messages)
		if err == nil {
			continue
		} else {
			log.Fatalf("Error in chat with %s: %v", appConfig.LLM.Provider, err)
		}
		fmt.Printf("%s Chat Response (Role: %s):\n%s\n", appConfig.LLM.Provider, chatResponse.Role, chatResponse.Content)
	}
}
