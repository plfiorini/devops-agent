import { styleText } from "node:util";

export class Logger {
	constructor() {
		console.log("Logger initialized");
	}

	public log(...args: unknown[]): void {
		console.log(...args);
	}

	public debug(...args: unknown[]): void {
		args.map((arg) => console.debug(styleText("gray", arg as string)));
	}

	public info(...args: unknown[]): void {
		args.map((arg) => console.info(styleText("cyan", arg as string)));
	}

	public error(...args: unknown[]): void {
		args.map((arg) => console.error(styleText("red", arg as string)));
	}

	public warn(...args: unknown[]): void {
		args.map((arg) => console.warn(styleText("yellow", arg as string)));
	}
}

export default new Logger();
