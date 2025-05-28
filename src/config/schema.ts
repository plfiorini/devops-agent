import { z } from 'zod';

/**
 * Configuration schema for the DevOps Agent
 */
export const ConfigSchema = z.object({
  llm: z.object({
    gemini: z.object({
      model: z.string().default('gemini-2.0-flash'),
      maxOutputTokens: z.number().int().positive().default(2048),
      apiKey: z.string().optional(), // Can be provided via environment variable
    }),
  }),
});

/**
 * Inferred TypeScript type from the schema
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
export const defaultConfig: Config = {
  llm: {
    gemini: {
      model: 'gemini-2.0-flash',
      maxOutputTokens: 2048,
    },
  },
};
