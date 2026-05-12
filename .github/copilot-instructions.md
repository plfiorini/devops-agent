# Copilot Instructions

- **Runtime:** Use Bun instead of Node.js.
- **Package Manager:** Use `bun` (e.g., `bun install`, `bun add`) instead of `npm`, `yarn`, or `pnpm`.
- **Scripts:** Use `bun run <script>` instead of `npm run`.
- **Execution:** Use `bun <file>.ts` or `bun <file>.js` to run files.
- **Testing:** Use `bun test` instead of `jest` or `vitest`.
- **Imports:** Prefer `import` (ESM) over `require` (CommonJS).
- **API compatibility:** Assume Bun's built-in APIs (e.g., `Bun.serve`) when applicable, but recognize node-compat APIs where needed.
