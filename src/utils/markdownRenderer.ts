import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import logger from "../logger.ts";

// Configure marked to use the terminal renderer with custom styling
marked.use(
	markedTerminal({
		width: process.stdout.columns || 80,
		reflowText: true,
	}),
);

/**
 * Render markdown text asynchronously with ANSI formatting for terminal display
 * @param markdownText The markdown text to render
 * @returns Promise that resolves to the rendered text with ANSI escape codes
 */
export async function renderMarkdown(markdownText: string): Promise<string> {
	try {
		const result = await marked.parse(markdownText);
		return result;
	} catch (error) {
		logger.error("Error rendering markdown:", error);
		// Fallback to plain text if rendering fails
		return markdownText;
	}
}

/**
 * Print markdown text with ANSI formatting to the console (async version)
 * @param markdownText The markdown text to print
 */
export async function printMarkdown(markdownText: string): Promise<void> {
	const rendered = await renderMarkdown(markdownText);
	logger.log(rendered);
}
