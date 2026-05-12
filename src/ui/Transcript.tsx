import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import { useEffect, useState } from "react";
import type {
	TranscriptEntry,
	TranscriptEntryKind,
	TranscriptToolCall,
} from "./types.ts";

export function Transcript({ entries }: { entries: TranscriptEntry[] }) {
	return (
		<Box flexDirection="column">
			{entries.map((entry) => (
				<TranscriptRow key={entry.id} entry={entry} />
			))}
		</Box>
	);
}

function formatToolCall(call: TranscriptToolCall): string {
	const args = Object.entries(call.arguments)
		.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
		.join(", ");
	return args ? `${call.name}(${args})` : `${call.name}()`;
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
	const { glyph, name, color } = labelFor(entry.kind);

	return (
		<Box flexDirection="column" marginTop={1}>
			<Box>
				<Text bold color={color}>
					{glyph} {name}
				</Text>
			</Box>
			<Box marginLeft={2} flexDirection="column">
				<Markdown color={entry.kind === "error" ? "red" : undefined}>
					{entry.content}
				</Markdown>
				{entry.toolCalls && entry.toolCalls.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						{entry.toolCalls.map((call) => (
							<Box key={call.id ?? call.name} flexDirection="column">
								<Box>
									<Text color={call.isError ? "red" : "cyan"}>⏺ </Text>
									<Text bold>{formatToolCall(call)}</Text>
								</Box>
								{call.resultContent && (
									<Box marginLeft={2}>
										<Text color={call.isError ? "red" : "gray"}>{call.resultContent}</Text>
									</Box>
								)}
							</Box>
						))}
					</Box>
				)}
			</Box>
		</Box>
	);
}

function labelFor(kind: TranscriptEntryKind): {
	glyph: string;
	name: string;
	color: string;
} {
	switch (kind) {
		case "user":
			return { glyph: "›", name: "You", color: "green" };
		case "assistant":
			return { glyph: "✦", name: "Assistant", color: "cyan" };
		case "command":
			return { glyph: "⌘", name: "Command", color: "yellow" };
		case "error":
			return { glyph: "✗", name: "Error", color: "red" };
		default:
			return { glyph: "•", name: "System", color: "gray" };
	}
}

function BlinkingDot() {
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		const id = setInterval(() => setVisible((v) => !v), 600);
		return () => clearInterval(id);
	}, []);
	return <Text color="cyan">{visible ? "⏺" : " "} </Text>;
}

export function LiveToolCalls({
	toolCalls,
}: {
	toolCalls: TranscriptToolCall[];
}) {
	return (
		<Box flexDirection="column" marginTop={1} marginLeft={2}>
			{toolCalls.map((call) => (
				<Box key={call.id ?? call.name}>
					{call.isError ? <Text color="red">⏺ </Text> : <BlinkingDot />}
					<Text bold>{formatToolCall(call)}</Text>
				</Box>
			))}
		</Box>
	);
}
