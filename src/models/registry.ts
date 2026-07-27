import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Env } from "../config/env";
import { createGeminiModel } from "./gemini";
import { createOpenAiModel } from "./openai";
import { createOllamaModel } from "./ollama";

export interface ResolvedModel {
  provider: string;
  modelName: string;
  model: BaseChatModel;
}

/** "Gemini 3.5 Flash Lite" and "gemini-3.5-flash-lite" both resolve to the same key. */
export const normalizeModelId = (id: string): string => id.trim().toLowerCase().replace(/\s+/g, "-");

/**
 * Every LLM you can name in config/llm.ts. Adding a provider/version is one
 * line here. Keys are lowercase; selectChatModel lowercases the id before
 * lookup so "OpenAI" / "Gemini" also match.
 */
export const MODEL_REGISTRY: Record<string, (env: Env) => ResolvedModel> = {
  gemini: (env) => ({ provider: "Gemini", modelName: "gemini-2.5-flash", model: createGeminiModel(env, "gemini-2.5-flash") }),
  "gemini-2.5-pro": (env) => ({ provider: "Gemini", modelName: "gemini-2.5-pro", model: createGeminiModel(env, "gemini-2.5-pro") }),
  "gemini-3.5-flash-lite": (env) => ({ provider: "Gemini", modelName: "gemini-3.5-flash-lite", model: createGeminiModel(env, "gemini-3.5-flash-lite") }),
  "gemini-3.1-flash-lite": (env) => ({ provider: "Gemini", modelName: "gemini-3.1-flash-lite", model: createGeminiModel(env, "gemini-3.1-flash-lite") }),
  openai: (env) => ({ provider: "OpenAI", modelName: "gpt-4o-mini", model: createOpenAiModel(env, "gpt-4o-mini") }),
  "gpt-4o": (env) => ({ provider: "OpenAI", modelName: "gpt-4o", model: createOpenAiModel(env, "gpt-4o") }),
  ollama: (env) => ({ provider: "Ollama", modelName: env.OLLAMA_CHAT_MODEL, model: createOllamaModel(env) }),
};
