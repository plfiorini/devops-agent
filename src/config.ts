import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";

export type GeminiConfig = {
	api_key: string;
	model: string;
};

type ProvidersConfig = {
	gemini?: GeminiConfig;
};

type Config = {
	providers: ProvidersConfig;
};

function loadConfig(configPath?: string): Config {
	const defaultConfigPath = path.join(process.cwd(), "config.yaml");
	const filePath = configPath || defaultConfigPath;

	try {
		const fileContents = fs.readFileSync(filePath, "utf8");
		const config = YAML.parse(fileContents);

		if (!config.providers || !config.providers.gemini) {
			throw new Error("Gemini provider configuration is missing");
		}

		return config as Config;
	} catch (error) {
		throw new Error(`Failed to load config from ${filePath}: ${error}`);
	}
}

export const config: Config = loadConfig();
