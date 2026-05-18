import { describe, expect, it } from "bun:test";
import { loadTools } from "./tools.ts";

describe("loadTools", () => {
	it("returns an array", async () => {
		const tools = await loadTools();
		expect(Array.isArray(tools)).toBe(true);
	});

	it("loads the execute_command tool", async () => {
		const tools = await loadTools();
		const names = tools.map((t) => t.name);
		expect(names).toContain("execute_command");
	});

	it("every tool has required fields", async () => {
		const tools = await loadTools();
		for (const tool of tools) {
			expect(typeof tool.name).toBe("string");
			expect(typeof tool.description).toBe("string");
			expect(tool.inputSchema).toBeDefined();
			expect(tool.outputSchema).toBeDefined();
			expect(typeof tool.execute).toBe("function");
		}
	});

	it("does not include test files as tools", async () => {
		const tools = await loadTools();
		for (const tool of tools) {
			expect(tool.name).not.toContain(".test");
		}
	});
});
