import { AzureOpenAI } from "openai";
import type { AzureOpenAIConfig } from "../config.ts";
import type { Tool } from "../types.ts";
import { OpenAIProvider } from "./openai.ts";

const DEFAULT_API_VERSION = "2024-10-21";

export class AzureOpenAIProvider extends OpenAIProvider {
	constructor(config: AzureOpenAIConfig, tools: Tool[]) {
		if (!config.endpoint) {
			throw new Error("Azure OpenAI endpoint is required");
		}
		if (!config.deployment_name) {
			throw new Error("Azure OpenAI deployment name is required");
		}

		// Initialize base class with a compatible shape; client is replaced below.
		// Pass a non-empty placeholder for api_key so OpenAIProvider's validation
		// passes — Azure can use managed identity (no key), and the OpenAI client
		// constructed here is immediately replaced by the AzureOpenAI client below.
		super(
			{
				enabled: config.enabled,
				api_key: config.api_key ?? "azure-managed-identity-placeholder",
				model: config.deployment_name,
				temperature: config.temperature,
				max_tokens: config.max_tokens,
			},
			tools,
		);

		this.client = new AzureOpenAI({
			apiKey: config.api_key,
			endpoint: config.endpoint,
			deployment: config.deployment_name,
			apiVersion: config.api_version ?? DEFAULT_API_VERSION,
		});

		// Reinitialize messages since clearMessages() was called in super().
		this.messages = [];
	}

	getProviderName(): string {
		return "azure_openai";
	}

	/**
	 * Azure OpenAI routes requests by deployment name (configured at client
	 * construction time), not by a model string.  Returning an empty list here
	 * means Agent.switchModel() will skip the "supported models" validation step
	 * and call setModelName() directly, which throws the descriptive error below.
	 */
	override async getSupportedModels(): Promise<string[]> {
		return [];
	}

	override setModelName(_model: string): void {
		throw new Error(
			"Azure OpenAI routes requests by deployment name. Use /provider azure_openai:<deployment> to switch deployments.",
		);
	}
}
