import * as colors from "./terminal/colors.ts";
import { errorSymbol, infoSymbol, warningSymbol } from "./terminal/symbols.ts";

export type LogLevel = "log" | "debug" | "trace" | "info" | "warn" | "error";
export type LoggerSink = (level: LogLevel, args: unknown[]) => void;

let loggerSink: LoggerSink | undefined;

export function setLoggerSink(sink: LoggerSink): void {
	loggerSink = sink;
}

export function resetLoggerSink(): void {
	loggerSink = undefined;
}

export function formatLogArgs(args: unknown[]): string {
	return args
		.map((arg) => {
			if (typeof arg === "string") {
				return arg;
			}

			if (arg instanceof Error) {
				return arg.message;
			}

			try {
				return JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		})
		.join(" ");
}

function writeLog(level: LogLevel, args: unknown[]): void {
	if (loggerSink) {
		loggerSink(level, args);
		return;
	}

	if (colors.supportsColor) {
		if (level === "debug") {
			console.debug(colors.white(args));
			return;
		}

		if (level === "trace") {
			console.trace(colors.gray(args));
			return;
		}

		if (level === "info") {
			console.info(colors.blue([infoSymbol, ...args]));
			return;
		}

		if (level === "warn") {
			console.warn(colors.yellow([warningSymbol, ...args]));
			return;
		}

		if (level === "error") {
			console.error(colors.red([errorSymbol, ...args]));
			return;
		}
	}

	if (level === "log") {
		console.log(...args);
		return;
	}

	const prefix = `[${level.toUpperCase()}]`;
	console[level](prefix, ...args);
}

export const logger = {
	log: (...args: unknown[]) => writeLog("log", args),
	debug: (...args: unknown[]) => writeLog("debug", args),
	trace: (...args: unknown[]) => writeLog("trace", args),
	info: (...args: unknown[]) => writeLog("info", args),
	error: (...args: unknown[]) => writeLog("error", args),
	warn: (...args: unknown[]) => writeLog("warn", args),
};

export default logger;
