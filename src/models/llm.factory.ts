import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Env } from "../config/env";
import { createGeminiModel } from "./gemini";
import { createOllamaModel } from "./ollama";
import { logSuccess, logWarn, logInfo } from "../utils/logger";

export interface SelectedModel {
  model: BaseChatModel;
  providerLabel: string;
  provider: "Gemini" | "Ollama";
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
 * Tries Gemini first with a cheap probe call; falls back to Ollama qwen3:8b
 * on quota/rate-limit/network/availability failures so the app never crashes
 * because a single provider is down.
 */
export async function selectChatModel(env: Env): Promise<SelectedModel> {
  if (!env.GEMINI_API_KEY) {
    logWarn("Gemini unavailable (missing GEMINI_API_KEY)");
    logInfo("Switching to Ollama...");
    return connectToOllama(env);
  }

  const gemini = createGeminiModel(env);
  try {
    await gemini.invoke([new HumanMessage("Reply with OK.")]);
    logSuccess("Gemini Initialized");
    return { model: gemini, providerLabel: "Gemini 2.5", provider: "Gemini", modelName: "gemini-2.5-flash" };
  } catch (error) {
    if (!isProviderUnavailable(error)) {
      throw error;
    }
    logWarn("Gemini unavailable");
    logInfo("Switching to Ollama...");
    return connectToOllama(env);
  }
}

async function connectToOllama(env: Env): Promise<SelectedModel> {
  const ollama = createOllamaModel(env);
  await ollama.invoke([new HumanMessage("Reply with OK.")]);
  logSuccess("Ollama Connected");
  logInfo(`Using ${env.OLLAMA_CHAT_MODEL}`);
  return {
    model: ollama,
    providerLabel: `Ollama ${env.OLLAMA_CHAT_MODEL}`,
    provider: "Ollama",
    modelName: env.OLLAMA_CHAT_MODEL,
  };
}
