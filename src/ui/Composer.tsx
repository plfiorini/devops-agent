import { Box, Text, useInput } from "ink";
import { useState } from "react";

const PLACEHOLDER = "Type a message or /help";

// On macOS, Terminal sends Ctrl+A / Ctrl+E (readline conventions) for
// beginning/end of line because there are no dedicated Home/End keys on
// laptop keyboards. Every other platform uses the physical Home/End keys,
// which produce escape sequences that Ink already maps to key.home / key.end.
const IS_DARWIN = process.platform === "darwin";

export type ComposerProps = {
	disabled: boolean;
	onSubmit: (value: string) => void;
};

export function Composer({ disabled, onSubmit }: ComposerProps) {
	const [buffer, setBuffer] = useState("");
	const [cursorPos, setCursorPos] = useState(0);

	useInput(
		(input, key) => {
			const text = input.toLowerCase().trim();

			// Let the Ink runtime handle Ctrl+C exit; don't swallow it.
			if (key.ctrl && text === "c") {
				return;
			}

			if (key.escape) {
				setBuffer("");
				setCursorPos(0);
				return;
			}

			if (key.leftArrow) {
				setCursorPos((prev) => Math.max(0, prev - 1));
				return;
			}

			if (key.rightArrow) {
				setCursorPos((prev) => Math.min(buffer.length, prev + 1));
				return;
			}

			if (key.home || (IS_DARWIN && key.ctrl && text === "a")) {
				const lineStart = buffer.lastIndexOf("\n", cursorPos - 1) + 1;
				setCursorPos(lineStart);
				return;
			}

			if (key.end || (IS_DARWIN && key.ctrl && text === "e")) {
				const next = buffer.indexOf("\n", cursorPos);
				setCursorPos(next === -1 ? buffer.length : next);
				return;
			}

			if (key.return) {
				if (key.ctrl) {
					setBuffer(
						`${buffer.slice(0, cursorPos)}\n${buffer.slice(cursorPos)}`,
					);
					setCursorPos(cursorPos + 1);
					return;
				}
				if (buffer.length > 0) {
					onSubmit(buffer);
					setBuffer("");
					setCursorPos(0);
				}
				return;
			}

			// Ctrl+J inserts a newline. Two paths depending on terminal protocol:
			// - Legacy: Ink resolves 0x0A to name='enter' with ctrl=false, so
			//   key.return is false and key.ctrl is false; input is the raw '\n'.
			// - Kitty protocol: modifier bits are explicit, so key.ctrl=true and
			//   input='j'; the '\n' raw-byte path is never taken.
			// Both must be caught here, before the ctrl-guard below.
			if (input === "\n" || (key.ctrl && text === "j")) {
				setBuffer(`${buffer.slice(0, cursorPos)}\n${buffer.slice(cursorPos)}`);
				setCursorPos(cursorPos + 1);
				return;
			}

			if (key.backspace || key.delete) {
				if (cursorPos > 0) {
					setBuffer(buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos));
					setCursorPos(cursorPos - 1);
				}
				return;
			}

			// Ignore other modifier-only key combos.
			if (key.ctrl || key.meta) {
				return;
			}

			if (!input) {
				return;
			}

			const sanitized = stripControlChars(input);
			if (!sanitized) {
				return;
			}

			setBuffer(
				buffer.slice(0, cursorPos) + sanitized + buffer.slice(cursorPos),
			);
			setCursorPos(cursorPos + sanitized.length);
		},
		{ isActive: !disabled },
	);

	const showPlaceholder = buffer.length === 0;
	const lines = showPlaceholder ? [""] : buffer.split("\n");
	const borderColor = disabled ? "gray" : "cyan";

	// Resolve which line and column the cursor is on.
	let cursorLine = 0;
	let cursorCol = cursorPos;
	if (!showPlaceholder) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (cursorCol <= line.length) {
				cursorLine = i;
				break;
			}
			cursorCol -= line.length + 1; // +1 for the newline character
		}
	}

	return (
		<Box
			borderStyle="single"
			borderColor={borderColor}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			flexDirection="column"
		>
			{lines.map((line, idx) => {
				const prefix = idx === 0 ? "❯ " : "  ";
				const hasCursor = !disabled && idx === cursorLine;
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: composer lines are positional
					<Box key={idx}>
						<Text color={borderColor}>{prefix}</Text>
						{showPlaceholder ? (
							<>
								{!disabled && <Text inverse> </Text>}
								<Text dimColor>{PLACEHOLDER}</Text>
							</>
						) : hasCursor ? (
							<Text>
								{line.slice(0, cursorCol)}
								<Text inverse>{line[cursorCol] ?? " "}</Text>
								{line.slice(cursorCol + 1)}
							</Text>
						) : (
							<Text>{line}</Text>
						)}
					</Box>
				);
			})}
		</Box>
	);
}

// Drop C0 control bytes that may slip through when terminals deliver multi-byte
// escape sequences split across reads — useInput already surfaces those via key.*
function stripControlChars(input: string): string {
	let out = "";
	for (const char of input) {
		const code = char.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f) continue;
		out += char;
	}
	return out;
}
