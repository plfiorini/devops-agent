## Available Tools

The agent comes with the following built-in tools:

### Execute Command Tool
- **Purpose**: Execute conservative read/test shell commands on the system
- **Parameters**:
  - `command` (required): The shell command to execute
  - `workingDirectory` (optional): Directory to execute the command in
  - `timeoutMs` (optional): Maximum execution time in milliseconds
  - `maxOutputChars` (optional): Maximum combined stdout/stderr characters to return
- **Result**: Structured object with `ok`, `stdout`, `stderr`, `output`, `exitCode`, `signal`, `timedOut`, `truncated`, and optional `error`
- **Safety**: Commands outside the conservative read/test allowlist are rejected until an approval flow is implemented

### Adding New Tools

To add a new tool:

1. Create a new file in `src/tools/` (e.g., `myTool.ts`)
2. Implement the `Tool` interface:

```typescript
import { z } from "zod";
import type { Tool } from "../types.ts";

const InputSchema = z.object({
  param1: z.string(),
});

const OutputSchema = z.string();

class MyTool implements Tool {
  name = "my_tool";
  description = "Description of what this tool does";
  inputSchema = InputSchema;
  outputSchema = OutputSchema;

  async execute(args: z.infer<typeof InputSchema>): Promise<string> {
    // Tool implementation
    return "Tool result";
  }
}

export default new MyTool();
```

3. The tool will be automatically loaded by the tool loading system
