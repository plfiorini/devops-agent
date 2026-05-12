import { Box, Text } from "ink";

export function Header() {
	return (
		<Box
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			flexDirection="column"
		>
			<Box>
				<Text bold color="cyan">
					✦ DevOps Agent
				</Text>
			</Box>
			<Box>
				<Text dimColor>
					Type a message and press Enter. /help for commands.
				</Text>
			</Box>
		</Box>
	);
}
