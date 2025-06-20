## Available Tools

The agent comes with the following built-in tools:

### Execute Command Tool
- **Purpose**: Execute shell commands on the system
- **Parameters**:
  - `command` (required): The shell command to execute
  - `workingDirectory` (optional): Directory to execute the command in
- **Usage**: Automatically invoked by the AI when system operations are needed

### Adding New Tools

To add a new tool:

1. Create a new file in `src/tools/` (e.g., `myTool.ts`)
2. Implement the `Tool` interface:

```typescript
import { Tool, ToolSchema, ToolSchemaType } from "../types.ts";

class MyTool implements Tool {
  schema: ToolSchema = {
    name: "my_tool",
    description: "Description of what this tool does",
    parameters: {
      properties: {
        param1: {
          type: ToolSchemaType.STRING,
          description: "Description of parameter",
        },
      },
      required: ["param1"],
    },
  };

  async run(args: { param1: string }): Promise<string> {
    // Tool implementation
    return "Tool result";
  }
}

export default new MyTool();
```

3. The tool will be automatically loaded by the tool loading system
