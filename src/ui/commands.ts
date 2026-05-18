export type UiCommandName =
	| "help"
	| "tools"
	| "status"
	| "provider"
	| "providers"
	| "model"
	| "models"
	| "clear"
	| "exit";

export type ParsedInput =
	| { type: "empty" }
	| { type: "invalid"; message: string }
	| { type: "command"; name: UiCommandName; args?: string }
	| { type: "prompt"; prompt: string };

const commandNames = new Set<UiCommandName>([
	"help",
	"tools",
	"status",
	"provider",
	"providers",
	"model",
	"models",
	"clear",
	"exit",
]);

export const helpText = [
	"Commands:",
	"  /help              Show this help panel",
	"  /tools             Show loaded tools",
	"  /status            Show provider status",
	"  /provider          Show active provider",
	"  /provider <n>      Switch provider (gemini, openai, azure_openai, anthropic, ollama)",
	"  /provider <n>:<m>  Switch provider and set model",
	"  /providers         List available providers",
	"  /model             Show active model",
	"  /model <m>         Switch model for the current provider",
	"  /models            List available models for the current provider",
	"  /clear             Clear transcript and conversation history",
	"  /exit              Exit the TUI",
	"",
	"Input:",
	"  Enter          Send",
	"  Ctrl+J         Insert a newline",
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
		const args = commandText.slice(commandName.length).trim() || undefined;
		return { type: "command", name: commandName, args };
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
