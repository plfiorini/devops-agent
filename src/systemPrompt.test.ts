import { describe, expect, it } from "bun:test";
import { SystemPrompt } from "./systemPrompt.ts";

describe("SystemPrompt", () => {
	it("is a non-empty string", () => {
		expect(typeof SystemPrompt).toBe("string");
		expect(SystemPrompt.trim().length).toBeGreaterThan(0);
	});

	it("contains DevOps-related keywords", () => {
		expect(SystemPrompt).toContain("DevOps");
		expect(SystemPrompt).toContain("Kubernetes");
		expect(SystemPrompt).toContain("Terraform");
	});

	it("contains safety guidance", () => {
		expect(SystemPrompt).toContain("destructive");
		expect(SystemPrompt).toContain("confirmation");
	});

	it("mentions cloud platforms", () => {
		expect(SystemPrompt).toContain("AWS");
		expect(SystemPrompt).toContain("Azure");
		expect(SystemPrompt).toContain("GCP");
	});
});
