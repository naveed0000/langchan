import { loadEnv } from "./env";
import { loadConfig } from "./config";
import { createContainer, type Container } from "./container";

/**
 * Startup sequence: load env -> derive config -> build the DI container.
 * `server.ts` calls this before it starts listening.
 */
export async function bootstrap(): Promise<Container> {
  const env = loadEnv();
  const config = loadConfig(env);
  return createContainer(config);
}
