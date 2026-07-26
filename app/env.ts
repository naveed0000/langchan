/**
 * Single source of truth for reading process.env. Nothing outside this file
 * should touch process.env directly, so env access stays typed and testable.
 */
export interface Env {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  DATABASE_URL: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
}

export function loadEnv(): Env {
  // TODO: validate process.env (e.g. with zod) and throw on missing required vars.
  throw new Error("loadEnv: not implemented");
}
