import { Box, Text } from "ink";
import type { AgentStatus } from "../agent.ts";

export function StatusLine({
	status,
	isProcessing,
}: {
	status: AgentStatus;
	isProcessing: boolean;
}) {
	const state = isProcessing
		? "working"
		: status.initialized
			? "ready"
			: "offline";
	const stateColor =
		state === "ready" ? "green" : state === "working" ? "yellow" : "red";

	return (
		<Box paddingX={1} marginTop={1}>
			<Text color={stateColor}>●</Text>
			<Text> </Text>
			<Text>{state}</Text>
			<Text dimColor> · Provider: </Text>
			<Text>{status.activeProviderName ?? "—"}</Text>
			<Text dimColor> · Model: </Text>
			<Text>{status.activeModelName ?? "—"}</Text>
			<Text dimColor> · Tools: </Text>
			<Text>{status.toolCount}</Text>
			<Text dimColor> · Msgs: </Text>
			<Text>{status.conversationCount}</Text>
		</Box>
	);
}
