import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { Env } from "../config/env";

export function createGeminiModel(env: Env): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    ...(env.GEMINI_API_KEY ? { apiKey: env.GEMINI_API_KEY } : {}),
    model: "gemini-2.5-flash",
    temperature: 0.3,
  });
}
