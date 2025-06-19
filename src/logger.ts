export const logger = {
	log: (...args: unknown[]) => console.log(...args),
	debug: (...args: unknown[]) => console.debug("[DEBUG]", ...args),
	trace: (...args: unknown[]) => console.trace("[TRACE]", ...args),
	info: (...args: unknown[]) => console.info("[INFO]", ...args),
	error: (...args: unknown[]) => console.error("[ERROR]", ...args),
	warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
};

const supportsColor =
	process.stdout.isTTY && process.env.TERM !== "dumb" && !process.env.NO_COLOR;
if (supportsColor) {
	const RED = "\x1b[31m";
	const YELLOW = "\x1b[33m";
	const GRAY = "\x1b[90m";
	const GREEN = "\x1b[32m";
	const WHITE = "\x1b[37m";
	const RESET = "\x1b[0m";

	logger.debug = (...args: unknown[]) =>
		console.debug(`${GRAY}[DEBUG]`, ...args, RESET);
	logger.trace = (...args: unknown[]) =>
		console.trace(`${WHITE}[TRACE]`, ...args, RESET);
	logger.info = (...args: unknown[]) =>
		console.info(`${GREEN}[INFO]`, ...args, RESET);
	logger.warn = (...args: unknown[]) =>
		console.warn(`${YELLOW}[WARN]`, ...args, RESET);
	logger.error = (...args: unknown[]) =>
		console.error(`${RED}[ERROR]`, ...args, RESET);
}

export default logger;
