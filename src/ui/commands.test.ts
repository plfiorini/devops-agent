import { describe, expect, it } from "bun:test";
import { helpText, parseInput } from "./commands.ts";

describe("parseInput", () => {
	describe("empty input", () => {
		it("returns empty for empty string", () => {
			expect(parseInput("")).toEqual({ type: "empty" });
		});

		it("returns empty for whitespace-only string", () => {
			expect(parseInput("   ")).toEqual({ type: "empty" });
			expect(parseInput("\t")).toEqual({ type: "empty" });
			expect(parseInput("\n")).toEqual({ type: "empty" });
		});

		it("returns empty for a bare slash", () => {
			expect(parseInput("/")).toEqual({ type: "empty" });
		});

		it("returns empty for slash with only whitespace", () => {
			expect(parseInput("/   ")).toEqual({ type: "empty" });
		});
	});

	describe("valid commands", () => {
		const validCommands = [
			"help",
			"tools",
			"status",
			"provider",
			"providers",
			"model",
			"models",
			"clear",
			"exit",
		] as const;

		for (const cmd of validCommands) {
			it(`recognises /${cmd}`, () => {
				const result = parseInput(`/${cmd}`);
				expect(result.type).toBe("command");
				if (result.type === "command") {
					expect(result.name).toBe(cmd);
					expect(result.args).toBeUndefined();
				}
			});
		}

		it("is case-insensitive for command names", () => {
			const result = parseInput("/HELP");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.name).toBe("help");
			}
		});

		it("strips leading/trailing whitespace around the command", () => {
			const result = parseInput("  /help  ");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.name).toBe("help");
			}
		});

		it("passes args for /provider with argument", () => {
			const result = parseInput("/provider anthropic");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.name).toBe("provider");
				expect(result.args).toBe("anthropic");
			}
		});

		it("passes args for /provider with provider:model syntax", () => {
			const result = parseInput("/provider openai:gpt-4");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.name).toBe("provider");
				expect(result.args).toBe("openai:gpt-4");
			}
		});

		it("passes args for /model with argument", () => {
			const result = parseInput("/model llama3");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.name).toBe("model");
				expect(result.args).toBe("llama3");
			}
		});

		it("args are undefined when no extra text follows command", () => {
			const result = parseInput("/clear");
			expect(result.type).toBe("command");
			if (result.type === "command") {
				expect(result.args).toBeUndefined();
			}
		});
	});

	describe("invalid commands", () => {
		it("returns invalid for unknown slash command", () => {
			const result = parseInput("/unknown");
			expect(result.type).toBe("invalid");
			if (result.type === "invalid") {
				expect(result.message).toContain("/unknown");
			}
		});

		it("returns invalid for /foo", () => {
			const result = parseInput("/foo");
			expect(result.type).toBe("invalid");
			if (result.type === "invalid") {
				expect(result.message).toContain("/help");
			}
		});
	});

	describe("prompt input", () => {
		it("returns prompt for plain text", () => {
			const result = parseInput("hello world");
			expect(result.type).toBe("prompt");
			if (result.type === "prompt") {
				expect(result.prompt).toBe("hello world");
			}
		});

		it("trims trailing whitespace from prompt", () => {
			const result = parseInput("hello   ");
			expect(result.type).toBe("prompt");
			if (result.type === "prompt") {
				expect(result.prompt).toBe("hello");
			}
		});

		it("preserves leading whitespace in prompt", () => {
			const result = parseInput("  hello");
			expect(result.type).toBe("prompt");
			if (result.type === "prompt") {
				expect(result.prompt).toBe("  hello");
			}
		});

		it("text containing command words without slash is a prompt", () => {
			expect(parseInput("help me").type).toBe("prompt");
			expect(parseInput("exit the building").type).toBe("prompt");
			expect(parseInput("clear all data").type).toBe("prompt");
		});

		it("preserves newlines in prompt", () => {
			const result = parseInput("line1\nline2");
			expect(result.type).toBe("prompt");
			if (result.type === "prompt") {
				expect(result.prompt).toBe("line1\nline2");
			}
		});
	});
});

describe("helpText", () => {
	it("is a non-empty string", () => {
		expect(typeof helpText).toBe("string");
		expect(helpText.length).toBeGreaterThan(0);
	});

	it("contains usage instructions", () => {
		expect(helpText).toContain("/help");
		expect(helpText).toContain("/exit");
		expect(helpText).toContain("/clear");
	});
});
