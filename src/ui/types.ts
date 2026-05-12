import type { AgentStatus } from "../agent.ts";
import type { Provider } from "../config.ts";
import type { Message, Tool } from "../types.ts";

export type TranscriptEntryKind =
	| "user"
	| "assistant"
	| "agent"
	| "error"
	| "command"
	| "tool"
	| "debug";

export type TranscriptToolCall = {
	id?: string;
	name: string;
	arguments: Record<string, unknown>;
	isError?: boolean;
	resultContent?: string;
};

export type TranscriptEntry = {
	id: string;
	kind: TranscriptEntryKind;
	content: string;
	toolCalls?: TranscriptToolCall[];
};

export type AgentClient = {
	initialize: () => Promise<void>;
	getAvailableTools: () => Tool[];
	getStatus: () => AgentStatus;
	clearMessages: () => void;
	chat: (prompt: string) => AsyncGenerator<Message>;
	getSupportedProviders: () => Promise<Provider[]>;
	getSupportedModels: () => Promise<string[]>;
	switchProvider(providerKey: string, model?: string): Promise<void>;
	switchModel: (model: string) => Promise<void>;
};
