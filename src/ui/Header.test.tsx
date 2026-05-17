import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Header } from "./Header.tsx";

describe("Header", () => {
	it("renders the app name", () => {
		const { lastFrame } = render(React.createElement(Header));
		expect(lastFrame()).toContain("DevOps Agent");
	});

	it("renders usage hint", () => {
		const { lastFrame } = render(React.createElement(Header));
		expect(lastFrame()).toContain("/help");
	});
});
