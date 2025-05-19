# Makefile for devops-agent Go project

# Variables
BINARY_DIR=bin
BINARY_NAME=devops-agent
GO=go
GOTEST=$(GO) test
GOVET=$(GO) vet
GOBUILD=$(GO) build
GOCLEAN=$(GO) clean
GOGET=$(GO) get
GOMOD=$(GO) mod
GOFMT=$(GO) fmt

# Default make command
.PHONY: all
all: test build

# Run the application
.PHONY: run
run:
	$(GO) run ./...

# Build all the packages
.PHONY: build-all
build-all:
	$(GOBUILD) -v ./...

# Build the application
.PHONY: build
build:
	$(GOBUILD) -o $(BINARY_DIR)/$(BINARY_NAME) -v ./cmd/agent

# Test the application
.PHONY: test
test:
	$(GOTEST) -v ./...

# Clean build files
.PHONY: clean
clean:
	$(GOCLEAN)
	rm -f $(BINARY_DIR)/$(BINARY_NAME)

# Format code
.PHONY: fmt
fmt:
	$(GOFMT) ./...

# Check code style
.PHONY: lint
lint:
	golangci-lint run

# Tidy and verify dependencies
.PHONY: deps
deps:
	$(GOMOD) tidy
	$(GOMOD) verify

# Update dependencies
.PHONY: update-deps
update-deps:
	$(GOGET) -u ./...
	$(GOMOD) tidy

# Help command
.PHONY: help
help:
	@echo "Available commands:"
	@echo " make build         - Build the application"
	@echo " make run           - Run the application"
	@echo " make test          - Run tests"
	@echo " make clean         - Remove build artifacts"
	@echo " make fmt           - Format code"
	@echo " make lint          - Run linters"
	@echo " make deps          - Tidy and verify dependencies"
	@echo " make update-deps   - Update dependencies"
	@echo " make all           - Run tests and build"
	@echo " make help          - Show this help message"