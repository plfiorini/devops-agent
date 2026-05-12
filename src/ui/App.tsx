import { Box, Text, useApp, useInput, useStdout } from "ink";
import Markdown from "ink-markdown-es";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Agent, type AgentStatus, type ProviderInfo } from "../agent.ts";
import { formatLogArgs, resetLoggerSink, setLoggerSink } from "../logger.ts";
import type { Tool } from "../types.ts";
import { helpText, parseInput, type UiCommandName } from "./commands.ts";

type EntryKind = "user" | "assistant" | "system" | "error" | "command";

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

export type AppProps = {
	agent?: AgentClient;
};

export function App({ agent }: AppProps) {
	const { exit } = useApp();
	const appAgent = useMemo<AgentClient>(() => agent ?? new Agent(), [agent]);
	const scrollRef = useRef<ScrollViewRef>(null);
	const { stdout } = useStdout();
	const entryIndex = useRef(0);
	const [entries, setEntries] = useState<TranscriptEntry[]>([]);
	const [input, setInput] = useState("");
	const [isInitializing, setIsInitializing] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [startupError, setStartupError] = useState<string | undefined>();
	const [status, setStatus] = useState<AgentStatus>({
		initialized: false,
		providers: [],
		toolCount: 0,
		conversationCount: 0,
	});
	const [, setTools] = useState<Tool[]>([]);

	// Handle terminal resizing due to manual window change
	useEffect(() => {
		const handleResize = () => scrollRef.current?.remeasure();
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
		};
	}, [stdout]);

	// Scroll to bottom after new content is rendered
	// biome-ignore lint/correctness/useExhaustiveDependencies: Always scroll with new contents
	useEffect(() => {
		scrollRef.current?.scrollToBottom();
	}, [entries, isProcessing]);

	// Handle keyboard input
	useInput(
		(input, key) => {
			const lowerInput = input.toLowerCase();

			if (key.ctrl && lowerInput === "c") {
				exit();
			}

			if (key.upArrow) {
				scrollRef.current?.scrollBy(-1);
			}
			if (key.downArrow) {
				scrollRef.current?.scrollBy(1);
			}
			if (key.pageUp) {
				const height = scrollRef.current?.getViewportHeight() || 1;
				scrollRef.current?.scrollBy(-height);
			}
			if (key.pageDown) {
				const height = scrollRef.current?.getViewportHeight() || 1;
				scrollRef.current?.scrollBy(height);
			}
		},
		{
			isActive: true,
		},
	);

	// Append entry to transcript
	const appendEntry = useCallback((entry: Omit<TranscriptEntry, "id">) => {
		const id = String(entryIndex.current++);
		setEntries((currentEntries) => [...currentEntries, { ...entry, id }]);
	}, []);

	// Refresh agent status and tools
	const refreshAgentState = useCallback(() => {
		setStatus(appAgent.getStatus());
		setTools(appAgent.getAvailableTools());
	}, [appAgent]);

	// Show logs as entries
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

	// Initialize agent on mount
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

	// Handle commands
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
				appendEntry({ kind: "system", content: helpText });
				return;
			}

			if (commandName === "tools") {
				appendEntry({
					kind: "system",
					content: formatTools(appAgent.getAvailableTools()),
				});
				return;
			}

			if (commandName === "status") {
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
		async (value: string) => {
			const parsedInput = parseInput(value);

			if (parsedInput.type === "empty") {
				return;
			}

			setInput("");

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
				appendEntry({ kind: "assistant", content: response.trimEnd() });
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
			refreshAgentState,
			startupError,
			status.initialized,
			handleCommand,
		],
	);

	return (
		<Box flexDirection="column" padding={1}>
			<Header />
			<Box flexDirection="column" width="100%" flexGrow={1} flexShrink={1}>
				<ScrollView ref={scrollRef}>
					<Transcript entries={entries} />
					{isProcessing && <Processing />}
				</ScrollView>
			</Box>
			<Prompt
				input={input}
				disabled={isInitializing || isProcessing}
				onChange={setInput}
				onSubmit={handleSubmit}
			/>
			<Footer />
		</Box>
	);
}

function Header() {
	return (
		<Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
			<Text bold color="cyan">
				DevOps Agent
			</Text>
		</Box>
	);
}

function Footer() {
	return (
		<Box marginTop={1}>
			<Text dimColor>Press Ctrl+C to exit</Text>
		</Box>
	);
}

function Processing() {
	return (
		<Box marginBottom={1}>
			<Text color="green" bold>
				🤖 Assistant:{" "}
			</Text>
			<Text>
				<Spinner type="dots" />
				<Text> Thinking...</Text>
			</Text>
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
		<Box flexDirection="column" marginBottom={1}>
			{entries.map((entry) => (
				<TranscriptRow entry={entry} key={entry.id} />
			))}
		</Box>
	);
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
	return (
		<Box key={entry.id} flexDirection="column" marginBottom={1}>
			<Box paddingX={1} paddingY={0} backgroundColor={entryColor(entry.kind)}>
				{entryComponent(entry.kind)}
			</Box>
			<Box marginLeft={2} marginTop={1}>
				<Markdown>{entry.content}</Markdown>
			</Box>
		</Box>
	);
}

function entryComponent(kind: EntryKind) {
	if (kind === "user") {
		return (
			<>
				<Text>🧑&nbsp;</Text>
				<Text>You</Text>
			</>
		);
	}

	if (kind === "assistant") {
		return (
			<>
				<Text>🤖&nbsp;</Text>
				<Text>Assistant</Text>
			</>
		);
	}

	if (kind === "command") {
		return (
			<>
				<Text>⚙️&nbsp;</Text>
				<Text>Command</Text>
			</>
		);
	}

	if (kind === "error") {
		return (
			<>
				<Text>❌&nbsp;</Text>
				<Text>Error</Text>
			</>
		);
	}

	return (
		<>
			<Text>ℹ️&nbsp;</Text>
			<Text>System</Text>
		</>
	);
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

function Prompt({
	input,
	disabled,
	onChange,
	onSubmit,
}: {
	input: string;
	disabled: boolean;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void;
}) {
	return (
		<Box
			borderStyle="single"
			borderColor="gray"
			marginLeft={2}
			marginRight={2}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			paddingY={0}
		>
			<Text>❯ </Text>
			<TextInput
				value={input}
				focus={!disabled}
				onChange={onChange}
				onSubmit={(value) => {
					if (!disabled) {
						onSubmit(value);
					}
				}}
				placeholder="Ask something..."
			/>
		</Box>
	);
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
