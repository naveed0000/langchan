import { ChatOllama } from "@langchain/ollama";
import type { Env } from "../config/env";

export function createOllamaModel(env: Env): ChatOllama {
  return new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.3,
  });
}
