import { ChatOpenAI } from "@langchain/openai";
import type { Env } from "../config/env";

export function createOpenAiModel(env: Env, model = "gpt-4o-mini"): ChatOpenAI {
  return new ChatOpenAI({
    ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
    model,
    temperature: 0.3,
  });
}
