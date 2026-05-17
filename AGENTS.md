# Agent Instructions

- **Runtime:** Bun (not Node.js)
- **Package manager:** `bun install` / `bun add` (not npm/yarn/pnpm)
- **Run:** `bun run <script>` or `bun <file>.ts`
- **Test:** `bun test`
- **Imports:** ESM `import` over CommonJS `require`
- **APIs:** Prefer Bun built-ins (e.g. `Bun.serve`); fall back to node-compat where needed
