import * as colors from "./terminal/colors.ts";
import { errorSymbol, infoSymbol, warningSymbol } from "./terminal/symbols.ts";

export const logger = {
	log: (...args: unknown[]) => console.log(...args),
	debug: (...args: unknown[]) => console.debug("[DEBUG]", ...args),
	trace: (...args: unknown[]) => console.trace("[TRACE]", ...args),
	info: (...args: unknown[]) => console.info("[INFO]", ...args),
	error: (...args: unknown[]) => console.error("[ERROR]", ...args),
	warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
};

if (colors.supportsColor) {
	logger.debug = (...args: unknown[]) => console.debug(colors.white(args));
	logger.trace = (...args: unknown[]) => console.trace(colors.gray(args));
	logger.info = (...args: unknown[]) =>
		console.info(colors.blue([infoSymbol, ...args]));
	logger.warn = (...args: unknown[]) =>
		console.warn(colors.yellow([warningSymbol, ...args]));
	logger.error = (...args: unknown[]) =>
		console.error(colors.red([errorSymbol, ...args]));
}

export default logger;
