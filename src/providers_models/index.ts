import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { PiModelConfig } from "../models.js"

let modelsData: Record<string, any[]> = {}
try {
	const modelsPath = fileURLToPath(new URL("./models.json", import.meta.url))
	modelsData = JSON.parse(readFileSync(modelsPath, "utf-8"))
} catch (e) {
	console.error("Failed to load models.json", e)
}

export const PROVIDERS_INFO = [
	{ id: "opencode", name: "OpenCode", envKey: "OPENCODE_API_KEY", defaultUrl: "https://opencode.ai/zen/v1" },
	{ id: "openai", name: "OpenAI", envKey: "OPENAI_API_KEY", defaultUrl: "https://api.openai.com/v1" },
	{
		id: "gemini",
		name: "Gemini",
		envKey: "GEMINI_API_KEY",
		defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		envKey: "OPENROUTER_API_KEY",
		defaultUrl: "https://openrouter.ai/api/v1",
	},
	{
		id: "nvidia",
		name: "NVIDIA NIM",
		envKey: "NVIDIA_API_KEY",
		defaultUrl: "https://integrate.api.nvidia.com/v1",
	},
	{ id: "poolside", name: "Poolside", envKey: "POOLSIDE_API_KEY", defaultUrl: "https://api.poolside.ai/v1" },
	{ id: "vercel", name: "Vercel", envKey: "VERCEL_API_KEY", defaultUrl: "https://ai-gateway.vercel.sh" },
	{ id: "zenmux", name: "Zenmux", envKey: "ZENMUX_API_KEY", defaultUrl: "https://zenmux.ai/api/v1" },
]

// Helper to parse "tokens" string (e.g. "128k", "2M") to number
function parseTokens(tokenStr: string): number {
	if (!tokenStr) return 8192
	const match = tokenStr.match(/(\d+)([kKMm]?)/)
	if (!match) return 8192
	const num = Number.parseInt(match[1], 10)
	const suffix = match[2].toLowerCase()
	if (suffix === "k") return num * 1024
	if (suffix === "m") return num * 1024 * 1024
	return num
}

function mapToPiModelConfig(model: any, providerId: string): PiModelConfig {
	const isVision = (Array.isArray(model.support) && model.support.includes("vision")) || model.is_vision_image === true

	let ctx = 8192
	if (model.context_size) {
		ctx = model.context_size
	} else if (model.tokens) {
		ctx = parseTokens(model.tokens)
	}

	const formattedName = model.show_name || model.name || model.full_name || "Unknown Model"

	let tokensLabel = model.tokens
	if (!tokensLabel && model.context_size) {
		tokensLabel =
			model.context_size >= 1048576
				? `${Math.round(model.context_size / 1048576)}M`
				: `${Math.round(model.context_size / 1024)}k`
	}
	if (!tokensLabel) tokensLabel = "8k"

	let category = "sometimes slow"
	if (model.fast === true || model.is_fast === true) category = "Fast"
	if (model.grid === true) category = "Grid"

	// support tags e.g. ["text", "code", "vision"]
	let supportTags: string[] = ["text"]
	if (Array.isArray(model.support)) {
		supportTags = model.support
	} else {
		if (model.code_exec || model.is_chat) supportTags.push("code")
		if (model.is_vision_image) supportTags.push("vision")
		if (model.web_search) supportTags.push("search")
	}

	const cfg: PiModelConfig = {
		id: model.model_id || model.value,
		name: formattedName,
		reasoning: model.reasoning || false,
		input: isVision ? ["text", "image"] : ["text"],
		contextWindow: ctx,
		maxTokens: Math.min(ctx, 8192),
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		provider: providerId,
		// @ts-ignore
		_category: category,
		// @ts-ignore
		_tokens: tokensLabel,
		// @ts-ignore
		_support: supportTags,
	}
	// Store in module-level map so it survives models.json round-trip
	modelInfoMap.set(cfg.id, { category, tokens: tokensLabel, support: supportTags })
	return cfg
}

/** Module-level lookup: modelId → { category, tokens, support } — survives models.json round-trip */
export const modelInfoMap = new Map<string, { category: string; tokens: string; support: string[] }>()

export function getCustomProvidersConfig(): Record<
	string,
	{ api?: string; baseUrl?: string; apiKey?: string; models?: PiModelConfig[] }
> {
	const config: Record<string, any> = {}

	let overrides: any = {}
	try {
		const overridesPath = join(homedir(), ".local", "share", "cheap", "model-overrides.json")
		if (existsSync(overridesPath)) {
			overrides = JSON.parse(readFileSync(overridesPath, "utf-8"))
		}
	} catch (e) {}

	let providerOverrides = overrides.providers || {}
	const modelOverrides = overrides.models || {}
	const customModels = overrides.customModels || []

	if (!overrides.providers && !overrides.models && !overrides.customModels) {
		providerOverrides = overrides
	}

	for (const pInfo of PROVIDERS_INFO) {
		const rawModels = modelsData[pInfo.id] || []
		if (!rawModels || rawModels.length === 0) continue

		const activeModels = rawModels
			.filter((m: any) => m.show !== false)
			.map((m: any) => {
				const piModel = mapToPiModelConfig(m, pInfo.id)
				if (providerOverrides[pInfo.id]?.vision) {
					piModel.input = ["text", "image"]
				}

				const mOver = modelOverrides[piModel.id]
				if (mOver) {
					if (mOver.vision !== undefined) {
						piModel.input = mOver.vision ? ["text", "image"] : ["text"]
					}
					if (mOver.large !== undefined) {
						// @ts-ignore
						piModel._category = mOver.large ? "sometimes slow" : "Fast"
					}
					if (mOver.contextWindow !== undefined) {
						piModel.contextWindow = mOver.contextWindow
						piModel.maxTokens = Math.min(mOver.contextWindow, 8192)
						const parts = piModel.name.split(" - ")
						const tokensStr =
							mOver.contextWindow >= 1048576
								? `${Math.round(mOver.contextWindow / 1048576)}M`
								: `${Math.round(mOver.contextWindow / 1024)}k`
						if (parts.length > 1) {
							parts[parts.length - 1] = tokensStr
							piModel.name = parts.join(" - ")
						}
					}
					if (mOver.reasoning !== undefined) {
						piModel.reasoning = mOver.reasoning
					}
					if (mOver.apiKey || mOver.baseUrl) {
						const virtualProviderId = `v-${piModel.id}`
						piModel.provider = virtualProviderId
						config[virtualProviderId] = {
							api: "openai-completions",
							baseUrl:
								mOver.baseUrl || process.env[`${pInfo.envKey.replace("_API_KEY", "_BASE_URL")}`] || pInfo.defaultUrl,
							apiKey: mOver.apiKey || process.env[pInfo.envKey] || "unset",
							models: [piModel],
						}
						return null
					}
				}

				return piModel
			})
			.filter(Boolean) as PiModelConfig[]

		for (const cm of customModels) {
			if (cm.provider === pInfo.id) {
				const tokensStr =
					cm.contextWindow >= 1048576
						? `${Math.round(cm.contextWindow / 1048576)}M`
						: `${Math.round(cm.contextWindow / 1024)}k`
				const displayName = cm.name || cm.id

				const customPiModel: PiModelConfig = {
					id: cm.id,
					name: displayName,
					reasoning: !!cm.reasoning,
					input: cm.vision ? ["text", "image"] : ["text"],
					contextWindow: cm.contextWindow || 8192,
					maxTokens: Math.min(cm.contextWindow || 8192, 8192),
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					provider: pInfo.id,
					// @ts-ignore
					_category: cm.large ? "sometimes slow" : "Fast",
					// @ts-ignore
					_tokens: tokensStr,
					// @ts-ignore
					_support: cm.vision ? ["text", "image", "vision"] : ["text", "code"],
				}
				modelInfoMap.set(cm.id, {
					category: cm.large ? "sometimes slow" : "Fast",
					tokens: tokensStr,
					support: cm.vision ? ["text", "image", "vision"] : ["text", "code"],
				})

				if (cm.apiKey || cm.baseUrl) {
					const virtualProviderId = `v-${cm.id}`
					customPiModel.provider = virtualProviderId
					config[virtualProviderId] = {
						api: "openai-completions",
						baseUrl: cm.baseUrl || process.env[`${pInfo.envKey.replace("_API_KEY", "_BASE_URL")}`] || pInfo.defaultUrl,
						apiKey: cm.apiKey || process.env[pInfo.envKey] || "unset",
						models: [customPiModel],
					}
				} else {
					activeModels.push(customPiModel)
				}
			}
		}

		if (activeModels.length > 0) {
			const baseUrl = process.env[`${pInfo.envKey.replace("_API_KEY", "_BASE_URL")}`] || pInfo.defaultUrl
			const apiKey = process.env[pInfo.envKey] || "unset"

			config[pInfo.id] = {
				api: "openai-completions",
				baseUrl: baseUrl,
				apiKey: apiKey,
				models: activeModels,
			}
		}
	}

	return config
}
