import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
						colonIndex >= 0
							? args.slice(colonIndex + 1) || undefined
							: undefined;
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

	return (
		<Box flexDirection="column" height={rows > 0 ? rows : 24}>
			<Header
				status={status}
				isInitializing={isInitializing}
				isProcessing={isProcessing}
			/>
			<Box flexDirection={isWide ? "row" : "column"} flexGrow={1} gap={1}>
				<Box
					borderColor="cyan"
					borderStyle="round"
					flexDirection="column"
					flexGrow={1}
					minHeight={8}
					overflow="hidden"
					paddingX={1}
				>
					<Transcript entries={entries.slice(-maxEntries)} />
				</Box>
				<Box
					borderColor="gray"
					borderStyle="round"
					flexDirection="column"
					height={panelHeight}
					overflow="hidden"
					paddingX={1}
					width={isWide ? 36 : undefined}
				>
					<SidePanel
						activePanel={activePanel}
						status={status}
						tools={tools}
						startupError={startupError}
					/>
				</Box>
			</Box>
			<Composer
				disabled={isInitializing || isProcessing}
				value={composerValue}
				onChange={setComposerValue}
				onCyclePanel={cyclePanel}
				onSubmit={handleSubmit}
			/>
			<Footer activePanel={activePanel} />
		</Box>
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

	return (
		<Box justifyContent="space-between" paddingX={1}>
			<Text bold color="cyan">
				DevOps Agent
			</Text>
			<Box gap={2}>
				<Text color="green">{status.activeProviderName ?? "No provider"}</Text>
				<Text
					dimColor
				>{`${enabledProviders.length}/${status.providers.length} providers`}</Text>
				<Text dimColor>{`${status.toolCount} tools`}</Text>
				<Text color={isProcessing ? "yellow" : "green"}>{state}</Text>
			</Box>
		</Box>
	);
}

function Transcript({ entries }: { entries: TranscriptEntry[] }) {
	if (entries.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center">
				<Text dimColor>Ask a DevOps question or type /help.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{entries.map((entry) => (
				<TranscriptRow entry={entry} key={entry.id} />
			))}
		</Box>
	);
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold={entry.kind === "error"} color={entryColor(entry.kind)}>
				{entryLabel(entry.kind)}
			</Text>
			<Text wrap="wrap">{entry.content}</Text>
		</Box>
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
		return (
			<>
				<PanelTitle title="Help" />
				<Text wrap="wrap">{helpText}</Text>
			</>
		);
	}

	if (activePanel === "tools") {
		return (
			<>
				<PanelTitle title="Tools" />
				{tools.length === 0 ? (
					<Text dimColor>No tools loaded.</Text>
				) : (
					tools.map((tool) => (
						<Box flexDirection="column" key={tool.name} marginBottom={1}>
							<Text color="green">{tool.name}</Text>
							<Text dimColor wrap="wrap">
								{tool.description}
							</Text>
						</Box>
					))
				)}
			</>
		);
	}

	return (
		<>
			<PanelTitle title="Status" />
			{startupError && <Text color="red">{startupError}</Text>}
			<Text>
				{"Active: "}
				<Text color="green">
					{status.activeProviderName ?? "not initialized"}
				</Text>
			</Text>
			<Text>
				{"Model: "}
				<Text color="green">{status.activeModelName ?? "not initialized"}</Text>
			</Text>
			<Text dimColor>{`Messages: ${status.conversationCount}`}</Text>
			<Text dimColor>{`Tools: ${status.toolCount}`}</Text>
			<Box flexDirection="column" marginTop={1}>
				{status.providers.map((provider) => (
					<ProviderLine key={provider.name} provider={provider} />
				))}
			</Box>
		</>
	);
}

function PanelTitle({ title }: { title: string }) {
	return (
		<Box marginBottom={1}>
			<Text bold color="cyan">
				{title}
			</Text>
		</Box>
	);
}

function ProviderLine({ provider }: { provider: ProviderInfo }) {
	return (
		<Box flexDirection="row" gap={1}>
			<Text wrap="truncate-end">{provider.name}</Text>
			<Text color={provider.enabled ? "green" : "red"}>
				{provider.enabled ? "ON" : "OFF"}
			</Text>
			{provider.isDefault && <Text color="blue">(default)</Text>}
		</Box>
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

	return (
		<Box
			borderColor={disabled ? "gray" : "green"}
			borderStyle="round"
			flexDirection="column"
			minHeight={3}
			paddingX={1}
		>
			{lines.map((line, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: lines are positional with no stable identity
				<Box key={`line-${index}`}>
					<Text color="green">{index === 0 ? "> " : "  "}</Text>
					<Text dimColor={value.length === 0}>
						{line || (index === 0 ? "Type a message or /help" : " ")}
					</Text>
				</Box>
			))}
		</Box>
	);
}

function Footer({ activePanel }: { activePanel: Panel }) {
	return (
		<Box justifyContent="space-between" paddingX={1}>
			<Text dimColor>Enter send | Ctrl+J newline | Esc clear | /exit quit</Text>
			<Text dimColor>{`Panel: ${activePanel} | Ctrl+P cycle`}</Text>
		</Box>
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
