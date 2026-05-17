# Tools

Tools give the AI agent the ability to take actions on the system. The agent decides when to call a tool based on the conversation; the tool runs, and its output is fed back into the next model turn.

## Dynamic Tool Loading

At startup, `src/tools.ts` scans the `src/tools/` directory and imports every `.ts` / `.js` file that is not a test file (filenames not containing `.test.`). Each file must export a default object that satisfies the `Tool` interface. There is no registration step — dropping a file into `src/tools/` is enough.

## Built-in Tools

### `execute_command`

Runs a shell command via `/bin/sh` and returns the captured output.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | Yes | — | The shell command to execute |
| `workingDirectory` | string | No | `process.cwd()` | Directory to run the command in |
| `timeoutMs` | integer (1–120000) | No | 30000 | Maximum execution time in ms |
| `maxOutputChars` | integer (100–50000) | No | 20000 | Maximum combined stdout/stderr chars |

**Result object:**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | `true` if exit code is 0 and no timeout |
| `command` | string | The command that was run |
| `stdout` | string | Standard output |
| `stderr` | string | Standard error |
| `output` | string | Combined stdout + stderr |
| `exitCode` | number \| null | Process exit code |
| `signal` | string \| null | Signal name if killed |
| `timedOut` | boolean | Whether the command exceeded `timeoutMs` |
| `truncated` | boolean | Whether output exceeded `maxOutputChars` |
| `error` | string | Error message if the spawn itself failed |

## Adding a New Tool

1. Create `src/tools/myTool.ts`
2. Export a default object implementing the `Tool` interface:

```typescript
import { z } from "zod";
import type { Tool } from "../types.ts";

const InputSchema = z.object({
  param1: z.string().describe("Description of param1"),
});

const OutputSchema = z.object({
  ok: z.boolean(),
  result: z.string(),
});

const myTool: Tool = {
  name: "my_tool",
  description: "One-sentence description the model sees when deciding to call this tool",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  async execute(args) {
    // args is typed as z.infer<typeof InputSchema>
    return { ok: true, result: `received ${args.param1}` };
  },

  // Optional: tell the agent when to treat the result as an error
  isError(result) {
    return !result.ok;
  },

  // Optional: format the result for display in the transcript
  formatResult(result) {
    return result.result;
  },
};

export default myTool;
```

3. The tool is loaded automatically on next startup — no other changes needed.

**Guidelines for tool authors:**

- Keep `description` short and action-oriented — the model uses it to decide when to call your tool
- Use Zod `.describe()` on schema fields so the model understands each parameter
- Validate all external I/O; the `inputSchema` is enforced automatically before `execute` is called
- Return structured data via `outputSchema` rather than plain strings where possible — `formatResult` can then produce a human-readable representation separately
