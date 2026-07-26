import type { Env } from "./env";

/**
 * Derived, application-shaped configuration built from the raw Env. Anything
 * that needs computing or grouping from environment variables belongs here,
 * not scattered across call sites.
 */
export interface AppConfig {
  env: Env;
}

export function loadConfig(env: Env): AppConfig {
  return { env };
}
