import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Env } from "../config/env";
import { LLM_MODELS } from "../config/llm";
import { MODEL_REGISTRY, normalizeModelId } from "./registry";
import { logSuccess, logWarn } from "../utils/logger";

export interface SelectedModel {
  model: BaseChatModel;
  /** Normalized registry id of the chosen model — lets the worker walk the rest of the list. */
  id: string;
  provider: string;
  modelName: string;
}

const UNAVAILABLE_SIGNALS = [
  "429",
  "503",
  "quota",
  "rate limit",
  "resource_exhausted",
  "unavailable",
  "network",
  "fetch failed",
];

/** Shared by the initial probe here and by generation/worker.ts's retry loop. */
export function isProviderUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return UNAVAILABLE_SIGNALS.some((needle) => message.includes(needle));
}

/**
 * Walks the LLM_MODELS list (config/llm.ts) in order and returns the first one
 * that answers a cheap probe call. Unknown ids and providers that are down
 * (quota/rate-limit/network/missing-key) are skipped so the run uses whichever
 * of your chosen models is reachable. One entry or many — same path.
 */
export async function selectChatModel(env: Env, models: string[] = LLM_MODELS): Promise<SelectedModel> {
  const probe = new HumanMessage("Reply with OK.");

  for (const rawId of models) {
    const id = normalizeModelId(rawId);
    const factory = MODEL_REGISTRY[id];
    if (!factory) {
      logWarn(`Unknown LLM "${rawId}" in LLM_MODELS — skipping`);
      continue;
    }

    const { provider, modelName, model } = factory(env);
    try {
      await model.invoke([probe]);
      logSuccess(`${provider} ready (${modelName})`);
      return { model, id, provider, modelName };
    } catch (error) {
      if (!isProviderUnavailable(error)) {
        throw error;
      }
      logWarn(`${provider} unavailable (${modelName}) — trying next`);
    }
  }

  throw new Error(`No usable LLM. Tried: ${models.join(", ") || "(empty LLM_MODELS)"}`);
}
