# Model Context Protocol (MCP) Support

The DevOps Agent supports the Model Context Protocol (MCP), which allows integration with external servers that provide additional tools, resources, and prompts to enhance the agent's capabilities.

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI applications with external data sources and tools. MCP servers can provide:

- **Tools**: Executable functions that the agent can call
- **Resources**: Data sources and files that the agent can read
- **Prompts**: Pre-defined prompt templates for common tasks

## Configuration

MCP servers are configured in the `config.yaml` file under the `mcp.servers` section:

```yaml
mcp:
  servers:
    filesystem:
      name: "File System"
      command: "npx"
      args: ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
      enabled: true
      description: "Provides file system operations"
      env:
        # Optional environment variables
        DEBUG: "true"
```

### Configuration Options

- `name`: Human-readable name for the server
- `command`: The command to start the MCP server
- `args`: Array of command-line arguments
- `enabled`: Whether the server should be connected on startup
- `description`: Optional description of the server's capabilities
- `env`: Optional environment variables for the server process

## Available MCP Servers

Here are some popular MCP servers that work well with DevOps workflows:

### File System Server

```yaml
filesystem:
  name: "File System"
  command: "npx"
  args: ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
  enabled: true
  description: "Provides file system operations"
```

Provides tools for reading, writing, and managing files and directories.

### Git Server

```yaml
git:
  name: "Git"
  command: "npx"
  args: ["@modelcontextprotocol/server-git", "--repository", "/path/to/repo"]
  enabled: true
  description: "Provides Git repository operations"
```

Provides tools for Git operations like commits, branches, and repository management.

### Docker Server

```yaml
docker:
  name: "Docker"
  command: "npx"
  args: ["@modelcontextprotocol/server-docker"]
  enabled: true
  description: "Provides Docker container management"
```

Provides tools for Docker container and image management.

### Kubernetes Server

```yaml
kubernetes:
  name: "Kubernetes"
  command: "npx"
  args: ["@modelcontextprotocol/server-kubernetes"]
  enabled: true
  description: "Provides Kubernetes cluster operations"
  env:
    KUBECONFIG: "/path/to/kubeconfig"
```

Provides tools for Kubernetes cluster management and resource operations.

## Using MCP in the Agent

Once MCP servers are configured and connected, their tools become available to the agent automatically. You can:

### View MCP Status

```
mcp
```

This command shows the status of all configured MCP servers and counts of available tools, resources, and prompts.

### List MCP Tools

Ask the agent to list available MCP tools:
```
ask List all available MCP tools
```

### Use MCP Tools

The agent will automatically use MCP tools when appropriate. For example:
```
ask Read the contents of the package.json file
ask Create a new branch called feature/mcp-support
ask Deploy the application to Kubernetes
```

## Built-in MCP Management Tools

The agent provides several built-in tools for managing MCP servers:

- `mcp_list_tools`: List all available tools from connected MCP servers
- `mcp_list_resources`: List all available resources from connected MCP servers
- `mcp_list_prompts`: List all available prompts from connected MCP servers
- `mcp_server_status`: Show status of connected MCP servers

## Troubleshooting

### Server Connection Issues

If an MCP server fails to connect:

1. Check that the command and arguments are correct
2. Ensure the MCP server package is installed
3. Verify file paths and permissions
4. Check the agent logs for error messages

### Tool Not Available

If an expected tool is not available:

1. Use the `mcp` command to check server status
2. Verify the server is connected and enabled
3. Check if the server supports the expected tools

### Performance Considerations

- MCP servers run as separate processes
- Tool calls involve inter-process communication
- Consider enabling only the MCP servers you need
- Some operations may be slower than built-in tools

## Development

### Creating Custom MCP Servers

You can create custom MCP servers for your specific DevOps workflows. See the [MCP documentation](https://modelcontextprotocol.io/) for details on server implementation.

### Server Development Tips

- Use the MCP SDK for your preferred language
- Implement proper error handling
- Provide clear tool descriptions
- Test with the MCP Inspector tool
- Consider security implications of exposed tools
