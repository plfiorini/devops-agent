import * as colors from "./colors.ts";
import {
	errorSymbol,
	infoSymbol,
	isUnicodeSupported,
	successSymbol,
	warningSymbol,
} from "./symbols.ts";

// Type definitions
interface SpinnerFrame {
	frames: string[];
	interval: number;
}

interface SpinnerOptions {
	spinner?: SpinnerFrame;
	text?: string;
	stream?: NodeJS.WriteStream;
	color?: keyof typeof colors;
}

type ColorFunction = (...args: unknown[]) => string;

// Utility functions
function isInteractive(stream: NodeJS.WriteStream): boolean {
	return Boolean(stream.isTTY && !process.env.CI);
}

function stripVTControlCharacters(str: string): string {
	// Remove ANSI escape sequences (ESC[...m or ESC[...K)
	return str.replace(/\\x1\[[0-9;]*[mK]/g, "");
}

const defaultSpinner = {
	frames: isUnicodeSupported
		? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
		: ["-", "\\", "|", "/"],
	interval: 80,
};

class Spinner {
	#frames: string[];
	#interval: number;
	#currentFrame = -1;
	#timer: NodeJS.Timeout | undefined;
	#text: string;
	#stream: NodeJS.WriteStream;
	#color: keyof typeof colors;
	#lines = 0;
	#exitHandlerBound: (signal: string) => void;
	#isInteractive: boolean;
	#lastSpinnerFrameTime = 0;
	#isSpinning = false;

	constructor(options: SpinnerOptions = {}) {
		const spinner = options.spinner ?? defaultSpinner;
		this.#frames = spinner.frames;
		this.#interval = spinner.interval;
		this.#text = options.text ?? "";
		this.#stream = options.stream ?? process.stderr;
		this.#color = options.color ?? "cyan";
		this.#isInteractive = isInteractive(this.#stream);
		this.#exitHandlerBound = this.#exitHandler.bind(this);
	}

	start(text?: string): this {
		if (text) {
			this.#text = text;
		}

		if (this.isSpinning) {
			return this;
		}

		this.#isSpinning = true;
		this.#hideCursor();
		this.#render();
		this.#subscribeToProcessEvents();

		// Only start the timer in interactive mode
		if (this.#isInteractive) {
			this.#timer = setInterval(() => {
				this.#render();
			}, this.#interval);
		}

		return this;
	}

	stop(finalText?: string): this {
		if (!this.isSpinning) {
			return this;
		}

		this.#isSpinning = false;
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = undefined;
		}

		this.#showCursor();
		this.clear();
		this.#unsubscribeFromProcessEvents();

		if (finalText) {
			this.#stream.write(`${finalText}\n`);
		}

		return this;
	}

	#symbolStop(symbol: string, text?: string): this {
		return this.stop(`${symbol} ${text ?? this.#text}`);
	}

	success(text?: string): this {
		return this.#symbolStop(successSymbol, text);
	}

	error(text?: string): this {
		return this.#symbolStop(errorSymbol, text);
	}

	warning(text?: string): this {
		return this.#symbolStop(warningSymbol, text);
	}

	info(text?: string): this {
		return this.#symbolStop(infoSymbol, text);
	}

	get isSpinning() {
		return this.#isSpinning;
	}

	get text() {
		return this.#text;
	}

	set text(value: string | undefined) {
		this.#text = value ?? "";
		this.#render();
	}

	get color(): keyof typeof colors {
		return this.#color;
	}

	set color(value: keyof typeof colors) {
		this.#color = value;
		this.#render();
	}

	clear() {
		if (!this.#isInteractive) {
			return this;
		}

		this.#stream.cursorTo(0);

		for (let index = 0; index < this.#lines; index++) {
			if (index > 0) {
				this.#stream.moveCursor(0, -1);
			}

			this.#stream.clearLine(1);
		}

		this.#lines = 0;

		return this;
	}

	#render(): void {
		// Ensure we only update the spinner frame at the wanted interval,
		// even if the frame method is called more often.
		const now = Date.now();
		if (
			this.#currentFrame === -1 ||
			now - this.#lastSpinnerFrameTime >= this.#interval
		) {
			this.#currentFrame = ++this.#currentFrame % this.#frames.length;
			this.#lastSpinnerFrameTime = now;
		}

		const colorFn = colors[this.#color] as ColorFunction;
		const applyColor = typeof colorFn === "function" ? colorFn : colors.cyan;
		const frame = this.#frames[this.#currentFrame];
		let string = `${applyColor(frame)} ${this.#text}`;

		if (!this.#isInteractive) {
			string += "\n";
		}

		this.clear();
		this.#write(string);

		if (this.#isInteractive) {
			this.#lines = this.#lineCount(string);
		}
	}

	#write(text: string): void {
		this.#stream.write(text);
	}

	#lineCount(text: string): number {
		const width = this.#stream.columns ?? 80;
		const lines = stripVTControlCharacters(text).split("\n");

		let lineCount = 0;
		for (const line of lines) {
			lineCount += Math.max(1, Math.ceil(line.length / width));
		}

		return lineCount;
	}

	#hideCursor(): void {
		if (this.#isInteractive) {
			this.#write("\u001b[?25l");
		}
	}

	#showCursor(): void {
		if (this.#isInteractive) {
			this.#write("\u001b[?25h");
		}
	}

	#subscribeToProcessEvents(): void {
		process.once("SIGINT", this.#exitHandlerBound);
		process.once("SIGTERM", this.#exitHandlerBound);
	}

	#unsubscribeFromProcessEvents(): void {
		process.off("SIGINT", this.#exitHandlerBound);
		process.off("SIGTERM", this.#exitHandlerBound);
	}

	#exitHandler(signal: string): void {
		if (this.isSpinning) {
			this.stop();
		}

		// SIGINT: 128 + 2
		// SIGTERM: 128 + 15
		const exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
		process.exit(exitCode);
	}
}

export default function createSpinner(options: SpinnerOptions = {}): Spinner {
	return new Spinner(options);
}
