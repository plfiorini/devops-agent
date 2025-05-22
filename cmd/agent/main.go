package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/sirupsen/logrus"

	"devops-agent/internal/config"
	"devops-agent/internal/llm"
	"devops-agent/internal/tools"
)

func main() {
	// Initialize logrus
	log := logrus.New()
	log.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	// Define command-line flags
	configPath := flag.String("config", "config.yaml", "Path to the configuration file")
	logLevel := flag.String("log-level", "info", "Log level (debug, info, warn, error, fatal, panic)")
	unsafeMode := flag.Bool("unsafe", false, "Run in unsafe mode (no confirmation for tool execution)")
	flag.Parse()

	// Set log level from flag
	level, err := logrus.ParseLevel(*logLevel)
	if err != nil {
		log.Warnf("Invalid log level '%s', defaulting to 'info'", *logLevel)
		level = logrus.InfoLevel
	}
	log.SetLevel(level)

	// Initialize the application
	fmt.Println("DevOps AI Agent")
	fmt.Println("---------------")
	fmt.Printf("Using configuration file: %s\n", *configPath)

	// Load configuration
	appConfig, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	// Set unsafe mode from flag
	appConfig.UnsafeMode = *unsafeMode
	if appConfig.UnsafeMode {
		log.Warnln("Running in unsafe mode - commands will execute without confirmation")
	}

	// Pass unsafe mode to the tools package
	tools.SetUnsafeMode(appConfig.UnsafeMode)

	reader := bufio.NewReader(os.Stdin)

	// Create the LLM client using the factory
	llmClient, err := llm.NewLLMProvider(appConfig.LLM, log)
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
			fmt.Println("Exiting application")
			break
		}

		// Create a structured message object
		messages := []llm.Message{
			{Role: "user", Content: input},
		}
		err = llmClient.Chat(messages)
		if err == nil {
			continue
		} else {
			log.Errorf("Error in chat with %s: %v", appConfig.LLM.Provider, err)
			fmt.Println("An error occurred while processing your request. Please try again.")
		}
	}
}
