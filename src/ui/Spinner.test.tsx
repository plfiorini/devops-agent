import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Spinner } from "./Spinner.tsx";

describe("Spinner", () => {
	it("renders thinking text", () => {
		const startedAt = Date.now() - 1000; // 1 second ago
		const { lastFrame } = render(
			React.createElement(Spinner, { startedAt }),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Thinking");
	});

	it("renders elapsed time", () => {
		const startedAt = Date.now() - 2000; // ~2 seconds ago
		const { lastFrame } = render(
			React.createElement(Spinner, { startedAt }),
		);
		const frame = lastFrame() ?? "";
		// Elapsed time in seconds should appear
		expect(frame).toMatch(/\d+\.\d+s/);
	});
});
