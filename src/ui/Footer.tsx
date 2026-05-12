import { Box, Text } from "ink";

export function Footer() {
	return (
		<Box paddingX={3}>
			<Text dimColor>
				Enter send · Ctrl+J newline · Esc clear · /help commands · Ctrl+C exit
			</Text>
		</Box>
	);
}
