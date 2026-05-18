import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Footer } from "./Footer.tsx";

describe("Footer", () => {
	it("renders keyboard shortcut hints", () => {
		const { lastFrame } = render(React.createElement(Footer));
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Enter");
		expect(frame).toContain("Ctrl");
	});
});
