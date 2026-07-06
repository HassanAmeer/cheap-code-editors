export interface PiModelConfig {
	id: string;
	name: string;
	reasoning?: boolean;
	input?: string[];
	contextWindow?: number;
	maxTokens?: number;
	cost?: {
		input: number;
		output: number;
		cacheRead?: number;
		cacheWrite?: number;
	};
	provider?: string;
	_category?: string;
	_tokens?: string;
	_support?: string[];
}

export interface ModelMetadata {
	id: string;
	name: string;
	[key: string]: any;
}
