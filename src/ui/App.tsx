import { Box, Static, useApp } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Agent, type AgentStatus } from "../agent.ts";
import {
	formatLogArgs,
	type LogLevel,
	resetLoggerSink,
	setLoggerSink,
} from "../logger.ts";
import type { Tool, ToolCall } from "../types.ts";
import { Composer } from "./Composer.tsx";
import { helpText, parseInput, type UiCommandName } from "./commands.ts";
import { Footer } from "./Footer.tsx";
import { Header } from "./Header.tsx";
import { Spinner } from "./Spinner.tsx";
import { StatusLine } from "./StatusLine.tsx";
import { LiveToolCalls, Transcript } from "./Transcript.tsx";
import type {
	AgentClient,
	TranscriptEntry,
	TranscriptToolCall,
} from "./types.ts";

export type AppProps = {
	agent?: AgentClient;
};

export function App({ agent }: AppProps) {
	const { exit } = useApp();
	const client = useMemo<AgentClient>(() => agent ?? new Agent(), [agent]);

	const entryId = useRef(0);
	const [entries, setEntries] = useState<TranscriptEntry[]>([]);
	const [status, setStatus] = useState<AgentStatus>(() => client.getStatus());
	const [isInitializing, setIsInitializing] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStartedAt, setProcessingStartedAt] = useState<number>(0);
	const [, setTools] = useState<Tool[]>([]);
	const [liveToolCalls, setLiveToolCalls] = useState<
		TranscriptToolCall[] | null
	>(null);

	// Append entry to transcript
	const appendEntry = useCallback((entry: Omit<TranscriptEntry, "id">) => {
		const id = String(entryId.current++);
		setEntries((prev) => [...prev, { ...entry, id }]);
	}, []);

	// Refresh agent status and tools
	const refreshStatus = useCallback(() => {
		setStatus(client.getStatus());
		setTools(client.getAvailableTools());
	}, [client]);

	// One-shot startup: initialize the agent, surface a "ready" line.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await client.initialize();
				if (cancelled) return;
				const next = client.getStatus();
				setStatus(next);
			} catch (error) {
				if (cancelled) return;
				appendEntry({ kind: "error", content: messageOf(error) });
			} finally {
				if (!cancelled) setIsInitializing(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [client, appendEntry]);

	// Handle commands
	const runCommand = useCallback(
		async (name: UiCommandName, args?: string) => {
			if (name === "exit") {
				exit();
				return;
			}
			if (name === "help") {
				appendEntry({ kind: "agent", content: helpText });
				return;
			}
			if (name === "tools") {
				appendEntry({
					kind: "agent",
					content: formatTools(client.getAvailableTools()),
				});
				return;
			}
			if (name === "status") {
				appendEntry({
					kind: "agent",
					content: formatStatus(client.getStatus()),
				});
				return;
			}
			if (name === "clear") {
				client.clearMessages();
				entryId.current = 0;
				setEntries([]);
				refreshStatus();
				appendEntry({ kind: "agent", content: "Conversation cleared." });
				return;
			}
			if (name === "provider") {
				if (!args) {
					const currentStatus = client.getStatus();
					appendEntry({
						kind: "agent",
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
						await client.switchProvider(providerKey, modelOverride);
						refreshStatus();
						const nextStatus = client.getStatus();
						appendEntry({
							kind: "agent",
							content: `Switched to ${nextStatus.activeProviderName} (model: ${nextStatus.activeModelName}). Conversation history cleared.`,
						});
					} catch (error) {
						appendEntry({ kind: "error", content: messageOf(error) });
					}
				}
				return;
			}
			if (name === "providers") {
				const { providers } = client.getStatus();
				const configured = providers.filter((p) => p.enabled);
				appendEntry({
					kind: "agent",
					content:
						configured.length > 0
							? `Configured providers:\n${configured
									.map(
										(p) => `- ${p.name}${p.isDefault ? " (default)" : ""}`,
									)
									.join("\n")}`
							: "No providers are currently enabled.",
				});
				return;
			}
			if (name === "model") {
				if (!args) {
					const currentStatus = client.getStatus();
					appendEntry({
						kind: "agent",
						content: `Active model: ${currentStatus.activeModelName ?? "none"} (provider: ${currentStatus.activeProviderName ?? "none"})`,
					});
				} else {
					try {
						await client.switchModel(args);
						refreshStatus();
						const nextStatus = client.getStatus();
						appendEntry({
							kind: "agent",
							content: `Model switched to ${nextStatus.activeModelName}.`,
						});
					} catch (error) {
						appendEntry({ kind: "error", content: messageOf(error) });
					}
				}
				return;
			}
			if (name === "models") {
				const providerStatus = client.getStatus();
				if (!providerStatus.activeProviderName) {
					appendEntry({
						kind: "error",
						content: "No active provider. Cannot list models.",
					});
					return;
				}
				const models = await client.getSupportedModels();
				appendEntry({
					kind: "agent",
					content: `Supported models for ${providerStatus.activeProviderName}:\n${models
						.map((m) => `- ${m}`)
						.join("\n")}`,
				});
				return;
			}
		},
		[appendEntry, client, exit, refreshStatus],
	);

	// Show logs as entries
	useEffect(() => {
		setLoggerSink((level: LogLevel, args: unknown[]) => {
			if (level !== "warn") {
				return;
			}

			appendEntry({
				kind: "agent",
				content: `Warning: ${formatLogArgs(args)}`,
			});
		});

		return () => {
			resetLoggerSink();
		};
	}, [appendEntry]);

	// Handle message submission
	const handleSubmit = useCallback(
		async (raw: string) => {
			const parsed = parseInput(raw);
			if (parsed.type === "empty") return;

			if (parsed.type === "invalid") {
				appendEntry({ kind: "error", content: parsed.message });
				return;
			}

			if (parsed.type === "command") {
				appendEntry({
					kind: "command",
					content: `/${parsed.name}${parsed.args ? ` ${parsed.args}` : ""}`,
				});
				runCommand(parsed.name, parsed.args);
				return;
			}

			if (!status.initialized) {
				appendEntry({ kind: "error", content: "Agent is still initializing." });
				return;
			}

			appendEntry({ kind: "user", content: parsed.prompt });
			setProcessingStartedAt(Date.now());
			setIsProcessing(true);

			let pendingToolEntry: Omit<TranscriptEntry, "id"> | null = null;

			try {
				for await (const response of client.chat(parsed.prompt)) {
					if (response.role === "tool") {
						// ToolResultMessage — update the matching live tool call immutably;
						// the pending entry commits at the next assistant message or in finally.
						if (pendingToolEntry?.toolCalls) {
							// Snapshot into a const so TypeScript preserves the narrowed
							// (non-null) type through the subsequent findIndex/map calls.
							const entry: Omit<TranscriptEntry, "id"> = pendingToolEntry;
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							const existingCalls = entry.toolCalls!;
							const toolCallIndex = existingCalls.findIndex(
								(c) => c.id === response.toolCallId,
							);
							if (toolCallIndex !== -1) {
								const updatedToolCalls: TranscriptToolCall[] =
									existingCalls.map((c, i) =>
										i === toolCallIndex
											? {
													...c,
													...(response.isError && { isError: true }),
													resultContent:
														response.displayContent ??
														(response.isError
															? response.content
															: undefined),
												}
											: c,
									);
								pendingToolEntry = {
									...entry,
									toolCalls: updatedToolCalls,
								};
								setLiveToolCalls(updatedToolCalls);
							}
						}
					} else if (response.role === "assistant") {
						if ("toolCalls" in response && response.toolCalls.length > 0) {
							// AssistantToolCallMessage — commit any previous pending entry first.
							if (pendingToolEntry) appendEntry(pendingToolEntry);
							const toolCalls = response.toolCalls.map(
								(call: ToolCall) =>
									({
										id: call.id,
										name: call.name,
										arguments: call.arguments,
									}) as TranscriptToolCall,
							);
							pendingToolEntry = {
								kind: "tool",
								content: response.content,
								toolCalls,
							};
							setLiveToolCalls(toolCalls);
						} else {
							// Plain assistant TextMessage — commit any pending tool entry first.
							if (pendingToolEntry) {
								appendEntry(pendingToolEntry);
								pendingToolEntry = null;
								setLiveToolCalls(null);
							}
							if (response.content) {
								appendEntry({ kind: "assistant", content: response.content });
							}
						}
					}
					// "system" and "user" messages from the generator are intentionally ignored:
					// system messages are internal, and the user message was already appended above.

					refreshStatus();
				}
			} catch (error) {
				if (pendingToolEntry) {
					appendEntry(pendingToolEntry);
					pendingToolEntry = null;
				}
				appendEntry({ kind: "error", content: messageOf(error) });
			} finally {
				if (pendingToolEntry) appendEntry(pendingToolEntry);
				setLiveToolCalls(null);
				setIsProcessing(false);
			}
		},
		[appendEntry, client, refreshStatus, runCommand, status.initialized],
	);

	const composerDisabled = isInitializing || isProcessing;

	return (
		<Box flexDirection="column">
			{/* Header is static — printed once at the top of scrollback. */}
			<Static items={[{ id: "header" }]}>
				{(_) => <Header key="header" />}
			</Static>
			{/* Transcript history flows into the host terminal's native scrollback. */}
			<Transcript entries={entries} />
			{/* Live region: status, spinner, composer, footer. */}
			<Box flexDirection="column" marginTop={1}>
				{liveToolCalls && liveToolCalls.length > 0 && (
					<LiveToolCalls toolCalls={liveToolCalls} />
				)}
				{isProcessing && <Spinner startedAt={processingStartedAt} />}
				<StatusLine status={status} isProcessing={isProcessing} />
				<Composer disabled={composerDisabled} onSubmit={handleSubmit} />
				<Footer />
			</Box>
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

function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
