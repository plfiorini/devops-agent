import { render } from "ink";
import { App } from "./ui/App.tsx";

if (process.stdout.isTTY) {
	render(<App />, {
		alternateScreen: true,
	});
} else {
	console.error("This application must be run in a terminal.");
	process.exit(1);
}
