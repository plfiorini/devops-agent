import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import {
	type LogLevel,
	type LoggerSink,
	formatLogArgs,
	logger,
	resetLoggerSink,
	setLoggerSink,
} from "./logger.ts";

describe("formatLogArgs", () => {
	it("returns plain string unchanged", () => {
		expect(formatLogArgs(["hello"])).toBe("hello");
	});

	it("joins multiple strings with space", () => {
		expect(formatLogArgs(["hello", "world"])).toBe("hello world");
	});

	it("extracts message from Error instances", () => {
		const err = new Error("something went wrong");
		expect(formatLogArgs([err])).toBe("something went wrong");
	});

	it("JSON-serializes plain objects", () => {
		const result = formatLogArgs([{ key: "value" }]);
		expect(result).toBe('{"key":"value"}');
	});

	it("JSON-serializes arrays", () => {
		const result = formatLogArgs([[1, 2, 3]]);
		expect(result).toBe("[1,2,3]");
	});

	it("handles mix of types", () => {
		const result = formatLogArgs(["message", { count: 1 }]);
		expect(result).toBe('message {"count":1}');
	});

	it("handles numbers", () => {
		expect(formatLogArgs([42])).toBe("42");
	});

	it("handles null and undefined via JSON", () => {
		expect(formatLogArgs([null])).toBe("null");
	});

	it("falls back to String() for non-serialisable values", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const result = formatLogArgs([circular]);
		expect(typeof result).toBe("string");
	});

	it("returns empty string for empty args array", () => {
		expect(formatLogArgs([])).toBe("");
	});
});

describe("logger with sink", () => {
	const sinkCalls: Array<{ level: LogLevel; args: unknown[] }> = [];
	const sink: LoggerSink = (level, args) => {
		sinkCalls.push({ level, args });
	};

	beforeEach(() => {
		sinkCalls.length = 0;
		setLoggerSink(sink);
	});

	afterEach(() => {
		resetLoggerSink();
	});

	const levels = [
		"log",
		"debug",
		"trace",
		"info",
		"error",
		"warn",
	] as LogLevel[];

	for (const level of levels) {
		it(`logger.${level} calls the sink with level="${level}"`, () => {
			logger[level]("test message");
			expect(sinkCalls.length).toBe(1);
			expect(sinkCalls[0]?.level).toBe(level);
			expect(sinkCalls[0]?.args).toEqual(["test message"]);
		});
	}

	it("sink receives multiple arguments", () => {
		logger.info("a", "b", "c");
		expect(sinkCalls[0]?.args).toEqual(["a", "b", "c"]);
	});

	it("sink receives Error objects", () => {
		const err = new Error("boom");
		logger.error("oops", err);
		expect(sinkCalls[0]?.level).toBe("error");
		expect(sinkCalls[0]?.args[1]).toBe(err);
	});
});

describe("logger without sink (console fallback)", () => {
	beforeEach(() => {
		resetLoggerSink();
	});

	it("does not throw when logging without a sink", () => {
		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
		expect(() => logger.log("no sink")).not.toThrow();
		consoleSpy.mockRestore();
	});

	it("logger.log calls console.log without a sink", () => {
		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
		logger.log("hello");
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});

describe("setLoggerSink / resetLoggerSink", () => {
	afterEach(() => {
		resetLoggerSink();
	});

	it("replacing the sink routes subsequent calls to the new sink", () => {
		const calls1: unknown[] = [];
		const calls2: unknown[] = [];

		setLoggerSink((_, args) => calls1.push(args));
		logger.info("first");
		setLoggerSink((_, args) => calls2.push(args));
		logger.info("second");

		expect(calls1.length).toBe(1);
		expect(calls2.length).toBe(1);
	});

	it("after reset, sink is no longer called", () => {
		const calls: unknown[] = [];
		setLoggerSink((_, args) => calls.push(args));
		resetLoggerSink();

		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
		logger.log("after reset");
		consoleSpy.mockRestore();

		expect(calls.length).toBe(0);
	});
});
