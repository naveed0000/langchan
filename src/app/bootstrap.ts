import { loadEnv, type Env } from "../config/env";
import { testConnection } from "../database/postgres";
import { selectChatModel, type SelectedModel } from "../models/llm.factory";
import { loadEmbeddingDimensions } from "../embeddings/embedding";
import { logger } from "../logger/logger";

export interface BootstrapResult extends SelectedModel {
  env: Env;
}

export async function bootstrap(): Promise<BootstrapResult> {
  const env = loadEnv();
  logger.success("Environment Loaded");

  await testConnection(env);
  logger.success("PostgreSQL Connected");

  const selected = await selectChatModel(env);

  await loadEmbeddingDimensions(env);

  return { env, ...selected };
}
