/**
 * Per-model rate limits, in priority order alongside config/llm.ts's LLM_MODELS.
 * The QuotaManager NEVER hardcodes a number — every limit comes from here, so
 * onboarding a new provider is: add a registry factory + one row below.
 *
 * Keys are normalized registry ids (see src/models/registry.ts). Anything not
 * listed inherits DEFAULT_LIMITS. Ollama is local, so its cloud quota is
 * effectively unlimited (Infinity) — it's the always-available fallback.
 *
 * Numbers reflect typical Gemini free-tier ceilings; tune per your API plan.
 */
export interface ModelLimits {
  /** Requests per minute. */
  rpmLimit: number;
  /** Tokens per minute (prompt + completion). */
  tpmLimit: number;
  /** Requests per day. */
  rpdLimit: number;
  enabled: boolean;
  /** Tokens assumed for the response when estimating a request before sending. */
  expectedOutputTokens: number;
}

export const DEFAULT_LIMITS: ModelLimits = {
  rpmLimit: 15,
  tpmLimit: 250_000,
  rpdLimit: 1_000,
  enabled: true,
  expectedOutputTokens: 8_000,
};

export const MODEL_LIMITS: Record<string, Partial<ModelLimits>> = {
  "gemini-3.5-flash-lite": { rpmLimit: 15, tpmLimit: 250_000, rpdLimit: 1_000 },
  "gemini-3.1-flash-lite": { rpmLimit: 15, tpmLimit: 250_000, rpdLimit: 1_000 },
  gemini: { rpmLimit: 10, tpmLimit: 250_000, rpdLimit: 250 },
  "gemini-2.5-pro": { rpmLimit: 5, tpmLimit: 250_000, rpdLimit: 100 },
  openai: { rpmLimit: 500, tpmLimit: 200_000, rpdLimit: 10_000 },
  "gpt-4o": { rpmLimit: 500, tpmLimit: 200_000, rpdLimit: 10_000 },
  ollama: { rpmLimit: Infinity, tpmLimit: Infinity, rpdLimit: Infinity },
};

export function limitsFor(id: string): ModelLimits {
  return { ...DEFAULT_LIMITS, ...MODEL_LIMITS[id] };
}

/**
 * Cooldown after a 429/overload with no Retry-After header: exponential
 * backoff 30s → 60s → 120s → 240s (capped), keyed off consecutive cooldowns.
 */
export const COOLDOWN = {
  baseMs: 30_000,
  factor: 2,
  maxMs: 240_000,
};
