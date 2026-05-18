import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import { useEffect, useState } from "react";

export function Spinner({ startedAt }: { startedAt: number }) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 100);
		return () => clearInterval(interval);
	}, []);

	const elapsed = ((now - startedAt) / 1000).toFixed(1);

	return (
		<Box paddingX={1} marginTop={1}>
			<Text color="green">
				<InkSpinner type="dots" />
			</Text>
			<Text> </Text>
			<Text dimColor>Thinking… ({elapsed}s)</Text>
		</Box>
	);
}
