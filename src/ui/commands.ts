export type UiCommandName = "help" | "tools" | "status" | "clear" | "exit";

export type ParsedInput =
	| { type: "empty" }
	| { type: "invalid"; message: string }
	| { type: "command"; name: UiCommandName }
	| { type: "prompt"; prompt: string };

const commandNames = new Set<UiCommandName>([
	"help",
	"tools",
	"status",
	"clear",
	"exit",
]);

export const helpText = [
	"Commands:",
	"  /help          Show this help panel",
	"  /tools         Show loaded tools",
	"  /status        Show provider status",
	"  /clear         Clear transcript and conversation history",
	"  /exit          Exit the TUI",
	"",
	"Input:",
	"  Enter          Send",
	"  Ctrl+J         Insert a newline",
	"  Ctrl+P         Cycle the side panel",
	"  Esc            Clear the composer",
].join("\n");

export function parseInput(input: string): ParsedInput {
	const trimmed = input.trim();

	if (!trimmed) {
		return { type: "empty" };
	}

	const isSlashCommand = trimmed.startsWith("/");
	const commandText = isSlashCommand ? trimmed.slice(1).trim() : trimmed;
	const commandName = commandText.split(/\s+/, 1)[0]?.toLowerCase();
	const hasCommandArguments =
		commandName !== undefined &&
		commandText.slice(commandName.length).trim().length > 0;

	if (!commandName) {
		return { type: "empty" };
	}

	if (isSlashCommand && isUiCommandName(commandName)) {
		return { type: "command", name: commandName };
	}

	if (isSlashCommand) {
		return {
			type: "invalid",
			message: `Unknown command "/${commandName}". Type /help for commands.`,
		};
	}

	return { type: "prompt", prompt: input.trimEnd() };
}

function isUiCommandName(commandName: string): commandName is UiCommandName {
	return commandNames.has(commandName as UiCommandName);
}
