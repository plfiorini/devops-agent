import { render } from "ink";
import { App } from "./ui/App.tsx";

if (process.stdout.isTTY) {
	// Clear the visible screen on startup but preserve the scrollback buffer
	// so the user's terminal history is not lost.
	// \x1b[2J clears the visible screen; \x1b[H moves the cursor to the top-left.
	process.stdout.write("\x1b[2J\x1b[H");
	// Render the app
	render(<App />);
} else {
	console.error("This application must be run in a terminal.");
	process.exit(1);
}
