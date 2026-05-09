import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Agent, type AgentStatus, type ProviderInfo } from "../agent.ts";
import {
	type LogLevel,
	formatLogArgs,
	resetLoggerSink,
	setLoggerSink,
} from "../logger.ts";
import type { Tool } from "../types.ts";
import { renderMarkdown } from "../utils/markdownRenderer.ts";
import { type UiCommandName, helpText, parseInput } from "./commands.ts";

type EntryKind = "user" | "assistant" | "system" | "error" | "command";
type Panel = "status" | "tools" | "help";

type TranscriptEntry = {
	id: string;
	kind: EntryKind;
	content: string;
};

export type AgentClient = {
	initialize: () => Promise<void>;
	processMessage: (prompt: string) => Promise<string>;
	clearConversationHistory: () => void;
	getAvailableTools: () => Tool[];
	getProviderInfo: () => ProviderInfo[];
	getStatus: () => AgentStatus;
	switchProvider: (providerKey: string, model?: string) => Promise<void>;
	switchModel: (model: string) => Promise<void>;
};

export type DevOpsAgentAppProps = {
	agent?: AgentClient;
};

const panels: Panel[] = ["status", "tools", "help"];
const h = React.createElement;

export function DevOpsAgentApp({ agent }: DevOpsAgentAppProps) {
	const { exit } = useApp();
	const { columns, rows } = useWindowSize();
	const appAgent = useMemo<AgentClient>(() => agent ?? new Agent(), [agent]);
	const entryIndex = useRef(0);
	const [entries, setEntries] = useState<TranscriptEntry[]>([]);
	const [composerValue, setComposerValue] = useState("");
	const [status, setStatus] = useState<AgentStatus>({
		initialized: false,
		providers: [],
		toolCount: 0,
		conversationCount: 0,
	});
	const [tools, setTools] = useState<Tool[]>([]);
	const [activePanel, setActivePanel] = useState<Panel>("status");
	const [isInitializing, setIsInitializing] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [startupError, setStartupError] = useState<string | undefined>();

	const appendEntry = useCallback((entry: Omit<TranscriptEntry, "id">) => {
		const id = String(entryIndex.current++);
		setEntries((currentEntries) => [...currentEntries, { ...entry, id }]);
	}, []);

	const refreshAgentState = useCallback(() => {
		setStatus(appAgent.getStatus());
		setTools(appAgent.getAvailableTools());
	}, [appAgent]);

	useEffect(() => {
		setLoggerSink((level: LogLevel, args: unknown[]) => {
			if (level !== "warn") {
				return;
			}

			appendEntry({
				kind: "system",
				content: `Warning: ${formatLogArgs(args)}`,
			});
		});

		return () => {
			resetLoggerSink();
		};
	}, [appendEntry]);

	useEffect(() => {
		let isMounted = true;

		async function initializeAgent() {
			appendEntry({
				kind: "system",
				content: "Initializing providers and tools...",
			});

			try {
				await appAgent.initialize();

				if (!isMounted) {
					return;
				}

				const nextStatus = appAgent.getStatus();
				setStatus(nextStatus);
				setTools(appAgent.getAvailableTools());
				appendEntry({
					kind: "system",
					content: `Ready. Active provider: ${
						nextStatus.activeProviderName ?? "unknown"
					}. Tools loaded: ${nextStatus.toolCount}.`,
				});
			} catch (error) {
				if (!isMounted) {
					return;
				}

				const message = getErrorMessage(error);
				setStartupError(message);
				appendEntry({
					kind: "error",
					content: message,
				});
			} finally {
				if (isMounted) {
					setIsInitializing(false);
				}
			}
		}

		void initializeAgent();

		return () => {
			isMounted = false;
		};
	}, [appAgent, appendEntry]);

	const cyclePanel = useCallback(() => {
		setActivePanel((currentPanel) => {
			const currentIndex = panels.indexOf(currentPanel);
			return panels[(currentIndex + 1) % panels.length] ?? "status";
		});
	}, []);

	const handleCommand = useCallback(
		async (commandName: UiCommandName, args?: string) => {
			appendEntry({
				kind: "command",
				content: args ? `/${commandName} ${args}` : `/${commandName}`,
			});

			if (commandName === "exit") {
				exit();
				return;
			}

			if (commandName === "help") {
				setActivePanel("help");
				appendEntry({ kind: "system", content: helpText });
				return;
			}

			if (commandName === "tools") {
				setActivePanel("tools");
				appendEntry({
					kind: "system",
					content: formatTools(appAgent.getAvailableTools()),
				});
				return;
			}

			if (commandName === "status") {
				setActivePanel("status");
				appendEntry({
					kind: "system",
					content: formatStatus(appAgent.getStatus()),
				});
				return;
			}

			if (commandName === "provider") {
				if (!args) {
					const currentStatus = appAgent.getStatus();
					appendEntry({
						kind: "system",
						content: `Active provider: ${currentStatus.activeProviderName ?? "none"} (model: ${currentStatus.activeModelName ?? "none"})`,
					});
				} else {
					const colonIndex = args.indexOf(":");
					const providerKey =
						colonIndex >= 0 ? args.slice(0, colonIndex) : args;
					const modelOverride =
						colonIndex >= 0 ? args.slice(colonIndex + 1) || undefined : undefined;
					try {
						await appAgent.switchProvider(providerKey, modelOverride);
						refreshAgentState();
						const nextStatus = appAgent.getStatus();
						appendEntry({
							kind: "system",
							content: `Switched to ${nextStatus.activeProviderName} (model: ${nextStatus.activeModelName}). Conversation history cleared.`,
						});
					} catch (error) {
						appendEntry({ kind: "error", content: getErrorMessage(error) });
					}
				}
				return;
			}

			if (commandName === "model") {
				if (!args) {
					const currentStatus = appAgent.getStatus();
					appendEntry({
						kind: "system",
						content: `Active model: ${currentStatus.activeModelName ?? "none"} (provider: ${currentStatus.activeProviderName ?? "none"})`,
					});
				} else {
					try {
						await appAgent.switchModel(args);
						refreshAgentState();
						const nextStatus = appAgent.getStatus();
						appendEntry({
							kind: "system",
							content: `Model switched to ${nextStatus.activeModelName}.`,
						});
					} catch (error) {
						appendEntry({ kind: "error", content: getErrorMessage(error) });
					}
				}
				return;
			}

			appAgent.clearConversationHistory();
			entryIndex.current = 1;
			setEntries([
				{
					id: "0",
					kind: "system",
					content: "Conversation cleared.",
				},
			]);
			refreshAgentState();
		},
		[appAgent, appendEntry, exit, refreshAgentState],
	);

	const handleSubmit = useCallback(
		async (input: string) => {
			const parsedInput = parseInput(input);

			if (parsedInput.type === "empty") {
				return;
			}

			setComposerValue("");

			if (parsedInput.type === "invalid") {
				appendEntry({ kind: "error", content: parsedInput.message });
				return;
			}

			if (parsedInput.type === "command") {
				void handleCommand(parsedInput.name, parsedInput.args);
				return;
			}

			if (startupError || !status.initialized) {
				appendEntry({
					kind: "error",
					content: startupError ?? "Agent is still initializing.",
				});
				return;
			}

			appendEntry({ kind: "user", content: parsedInput.prompt });
			setIsProcessing(true);

			try {
				const response = await appAgent.processMessage(parsedInput.prompt);
				const renderedResponse = await renderMarkdown(response);
				appendEntry({ kind: "assistant", content: renderedResponse.trimEnd() });
				refreshAgentState();
			} catch (error) {
				appendEntry({ kind: "error", content: getErrorMessage(error) });
			} finally {
				setIsProcessing(false);
			}
		},
		[
			appAgent,
			appendEntry,
			handleCommand,
			refreshAgentState,
			startupError,
			status.initialized,
		],
	);

	const isWide = columns >= 100;
	const panelHeight = isWide ? undefined : Math.max(7, Math.min(10, rows - 12));
	const maxEntries = Math.max(4, rows - (isWide ? 9 : 17));

	return h(
		Box,
		{ flexDirection: "column", height: rows > 0 ? rows : 24 },
		h(Header, {
			status,
			isInitializing,
			isProcessing,
		}),
		h(
			Box,
			{ flexDirection: isWide ? "row" : "column", flexGrow: 1, gap: 1 },
			h(
				Box,
				{
					borderColor: "cyan",
					borderStyle: "round",
					flexDirection: "column",
					flexGrow: 1,
					minHeight: 8,
					overflow: "hidden",
					paddingX: 1,
				},
				h(Transcript, { entries: entries.slice(-maxEntries) }),
			),
			h(
				Box,
				{
					borderColor: "gray",
					borderStyle: "round",
					flexDirection: "column",
					height: panelHeight,
					overflow: "hidden",
					paddingX: 1,
					width: isWide ? 36 : undefined,
				},
				h(SidePanel, {
					activePanel,
					status,
					tools,
					startupError,
				}),
			),
		),
		h(Composer, {
			disabled: isInitializing || isProcessing,
			value: composerValue,
			onChange: setComposerValue,
			onCyclePanel: cyclePanel,
			onSubmit: handleSubmit,
		}),
		h(Footer, { activePanel }),
	);
}

function Header({
	status,
	isInitializing,
	isProcessing,
}: {
	status: AgentStatus;
	isInitializing: boolean;
	isProcessing: boolean;
}) {
	const enabledProviders = status.providers.filter(
		(provider) => provider.enabled,
	);
	const state = isInitializing
		? "initializing"
		: isProcessing
			? "working"
			: "ready";

	return h(
		Box,
		{ justifyContent: "space-between", paddingX: 1 },
		h(Text, { bold: true, color: "cyan" }, "DevOps Agent"),
		h(
			Box,
			{ gap: 2 },
			h(Text, { color: "green" }, status.activeProviderName ?? "No provider"),
			h(
				Text,
				{ dimColor: true },
				`${enabledProviders.length}/${status.providers.length} providers`,
			),
			h(Text, { dimColor: true }, `${status.toolCount} tools`),
			h(Text, { color: isProcessing ? "yellow" : "green" }, state),
		),
	);
}

function Transcript({ entries }: { entries: TranscriptEntry[] }) {
	if (entries.length === 0) {
		return h(
			Box,
			{ flexGrow: 1, justifyContent: "center" },
			h(Text, { dimColor: true }, "Ask a DevOps question or type /help."),
		);
	}

	return h(
		Box,
		{ flexDirection: "column" },
		entries.map((entry) => h(TranscriptRow, { entry, key: entry.id })),
	);
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
	return h(
		Box,
		{ flexDirection: "column", marginBottom: 1 },
		h(
			Text,
			{ bold: entry.kind === "error", color: entryColor(entry.kind) },
			entryLabel(entry.kind),
		),
		h(Text, { wrap: "wrap" }, entry.content),
	);
}

function SidePanel({
	activePanel,
	status,
	tools,
	startupError,
}: {
	activePanel: Panel;
	status: AgentStatus;
	tools: Tool[];
	startupError?: string;
}) {
	if (activePanel === "help") {
		return h(
			React.Fragment,
			null,
			h(PanelTitle, { title: "Help" }),
			h(Text, { wrap: "wrap" }, helpText),
		);
	}

	if (activePanel === "tools") {
		return h(
			React.Fragment,
			null,
			h(PanelTitle, { title: "Tools" }),
			tools.length === 0
				? h(Text, { dimColor: true }, "No tools loaded.")
				: tools.map((tool) =>
						h(
							Box,
							{
								flexDirection: "column",
								key: tool.name,
								marginBottom: 1,
							},
							h(Text, { color: "green" }, tool.name),
							h(Text, { dimColor: true, wrap: "wrap" }, tool.description),
						),
					),
		);
	}

	return h(
		React.Fragment,
		null,
		h(PanelTitle, { title: "Status" }),
		startupError ? h(Text, { color: "red" }, startupError) : undefined,
		h(
			Text,
			null,
			h(React.Fragment, { key: "label" }, "Active: "),
			h(
				Text,
				{ color: "green", key: "value" },
				status.activeProviderName ?? "not initialized",
			),
		),
		h(
			Text,
			null,
			h(React.Fragment, { key: "label" }, "Model: "),
			h(
				Text,
				{ color: "green", key: "value" },
				status.activeModelName ?? "not initialized",
			),
		),
		h(Text, { dimColor: true }, `Messages: ${status.conversationCount}`),
		h(Text, { dimColor: true }, `Tools: ${status.toolCount}`),
		h(
			Box,
			{ flexDirection: "column", marginTop: 1 },
			status.providers.map((provider) =>
				h(ProviderLine, { key: provider.name, provider }),
			),
		),
	);
}

function PanelTitle({ title }: { title: string }) {
	return h(
		Box,
		{ marginBottom: 1 },
		h(Text, { bold: true, color: "cyan" }, title),
	);
}

function ProviderLine({ provider }: { provider: ProviderInfo }) {
	return h(
		Box,
		{ flexDirection: "row", gap: 1 },
		h(Text, { wrap: "truncate-end" }, provider.name),
		h(Text, { color: provider.enabled ? "green" : "red" }, provider.enabled ? "ON" : "OFF"),
		provider.isDefault ? h(Text, { color: "blue" }, "(default)") : undefined,
	);
}

function Composer({
	value,
	disabled,
	onChange,
	onCyclePanel,
	onSubmit,
}: {
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
	onCyclePanel: () => void;
	onSubmit: (value: string) => Promise<void>;
}) {
	const bufferRef = useRef(value);
	bufferRef.current = value;

	const setBuffer = useCallback(
		(next: string) => {
			bufferRef.current = next;
			onChange(next);
		},
		[onChange],
	);

	useInput(
		(input, key) => {
			const lowerInput = input.toLowerCase();

			if (key.ctrl && lowerInput === "p") {
				onCyclePanel();
				return;
			}

			if (disabled) {
				return;
			}

			if (key.escape) {
				setBuffer("");
				return;
			}

			if (
				(key.ctrl && (lowerInput === "j" || key.return)) ||
				(key.shift && key.return)
			) {
				setBuffer(`${bufferRef.current}\n`);
				return;
			}

			if (key.return) {
				const toSubmit = bufferRef.current;
				setBuffer("");
				void onSubmit(toSubmit);
				return;
			}

			if (key.backspace || key.delete) {
				setBuffer(bufferRef.current.slice(0, -1));
				return;
			}

			if (key.ctrl || key.meta || input.length === 0) {
				return;
			}

			setBuffer(`${bufferRef.current}${input}`);
		},
		{ isActive: true },
	);

	const lines = value.length > 0 ? value.split("\n") : [""];

	return h(
		Box,
		{
			borderColor: disabled ? "gray" : "green",
			borderStyle: "round",
			flexDirection: "column",
			minHeight: 3,
			paddingX: 1,
		},
		lines.map((line, index) =>
			h(
				Box,
				{ key: index },
				h(Text, { color: "green" }, index === 0 ? "> " : "  "),
				h(
					Text,
					{ dimColor: value.length === 0 },
					line || (index === 0 ? "Type a message or /help" : " "),
				),
			),
		),
	);
}

function Footer({ activePanel }: { activePanel: Panel }) {
	return h(
		Box,
		{ justifyContent: "space-between", paddingX: 1 },
		h(
			Text,
			{ dimColor: true },
			"Enter send | Ctrl+J newline | Esc clear | /exit quit",
		),
		h(Text, { dimColor: true }, `Panel: ${activePanel} | Ctrl+P cycle`),
	);
}

function entryLabel(kind: EntryKind): string {
	if (kind === "user") {
		return "You";
	}

	if (kind === "assistant") {
		return "Agent";
	}

	if (kind === "command") {
		return "Command";
	}

	if (kind === "error") {
		return "Error";
	}

	return "System";
}

function entryColor(kind: EntryKind): string {
	if (kind === "user") {
		return "green";
	}

	if (kind === "assistant") {
		return "cyan";
	}

	if (kind === "command") {
		return "yellow";
	}

	if (kind === "error") {
		return "red";
	}

	return "gray";
}

function formatStatus(status: AgentStatus): string {
	const providerLines = status.providers.map(
		(provider) =>
			`  - ${provider.name}: ${provider.enabled ? "enabled" : "disabled"}${
				provider.isDefault ? " (default)" : ""
			}`,
	);

	return [
		`Active provider: ${status.activeProviderName ?? "not initialized"}`,
		`Model: ${status.activeModelName ?? "not initialized"}`,
		`Tools loaded: ${status.toolCount}`,
		`Conversation messages: ${status.conversationCount}`,
		"Providers:",
		...providerLines,
	].join("\n");
}

function formatTools(tools: Tool[]): string {
	if (tools.length === 0) {
		return "No tools loaded.";
	}

	return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n");
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
