import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { type Config, ConfigSchema, defaultConfig } from './schema';

const CONFIG_FILENAMES = [
  'devops-agent.yaml',
  'devops-agent.yml',
  '.devops-agent.yaml',
  '.devops-agent.yml',
  'config.yaml',
  'config.yml',
];

/**
 * Load configuration from a specific file path
 */
function loadFromFile(filePath: string): Partial<Config> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Configuration file not found: ${filePath}`);
      return {};
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(fileContent) || {};
  } catch (error) {
    console.error(`Error loading configuration from ${filePath}:`, error);
    return {};
  }
}

/**
 * Find and load configuration from standard locations
 */
function findAndLoadConfig(): Partial<Config> {
  const cwd = process.cwd();
  
  for (const filename of CONFIG_FILENAMES) {
    const filePath = path.join(cwd, filename);
    if (fs.existsSync(filePath)) {
      console.log(`Loading configuration from: ${filePath}`);
      return loadFromFile(filePath);
    }
  }

  console.log('No configuration file found, using defaults');
  return {};
}

/**
 * Deep merge configuration with defaults
 */
function mergeWithDefaults(config: Partial<Config>): Config {
  return {
    llm: {
      gemini: {
        ...defaultConfig.llm.gemini,
        ...config.llm?.gemini,
      },
    },
  };
}

/**
 * Validate configuration using Zod schema
 */
function validateConfig(config: unknown): Config {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    console.log('Falling back to default configuration');
    return defaultConfig;
  }
}

/**
 * Load configuration from YAML file with fallback to defaults
 */
export function loadConfig(configPath?: string): Config {
  let config: Partial<Config> = {};
  
  // If specific path provided, try to load it
  if (configPath) {
    config = loadFromFile(configPath);
  } else {
    // Try to find config file in current directory
    config = findAndLoadConfig();
  }

  // Merge with defaults and validate
  const mergedConfig = mergeWithDefaults(config);
  
  // Add API key from environment if not in config
  if (!mergedConfig.llm.gemini.apiKey && process.env.GOOGLE_API_KEY) {
    mergedConfig.llm.gemini.apiKey = process.env.GOOGLE_API_KEY;
  }

  return validateConfig(mergedConfig);
}

/**
 * Create a sample configuration file
 */
export function createSampleConfig(outputPath = 'devops-agent.yaml'): void {
  const sampleConfig = `# DevOps Agent Configuration
llm:
  gemini:
    model: gemini-2.0-flash
    maxOutputTokens: 2048
    # apiKey: your_api_key_here  # Optional: can use GOOGLE_API_KEY environment variable instead
`;

  try {
    fs.writeFileSync(outputPath, sampleConfig, 'utf8');
    console.log(`Sample configuration created: ${outputPath}`);
  } catch (error) {
    console.error(`Error creating sample configuration: ${error}`);
  }
}
