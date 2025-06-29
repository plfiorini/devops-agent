import { readdirSync } from "node:fs";
import { join } from "node:path";
import logger from "./logger.ts";
import type { Tool } from "./types.ts";

const toolsDir = join(import.meta.dirname, "tools");

export const loadTools = async () => {
	const tools: Tool[] = [];
	// logger.debug(`Loading tools from directory: ${toolsDir}`);
	const files = readdirSync(toolsDir).filter(
		(file) => file.endsWith(".ts") || file.endsWith(".js"),
	);
	// logger.debug(`Found tool files: ${files.join(", ")}`);

	for (const file of files) {
		const toolModule = await import(join(toolsDir, file));
		if (toolModule.default) {
			tools.push(toolModule.default);
		}
	}

	return tools;
};

export default loadTools;
