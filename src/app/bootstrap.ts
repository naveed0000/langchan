import { loadEnv, type Env } from "../config/env";
import { testConnection } from "../database/postgres";
import { selectChatModel, type SelectedModel } from "../models/llm.factory";
import { loadEmbeddingDimensions } from "../embeddings/embedding";
import { logSuccess } from "../utils/logger";

export interface BootstrapResult extends SelectedModel {
  env: Env;
}

export async function bootstrap(): Promise<BootstrapResult> {
  const env = loadEnv();
  logSuccess("Environment Loaded");

  await testConnection(env);
  logSuccess("PostgreSQL Connected");

  const selected = await selectChatModel(env);

  await loadEmbeddingDimensions(env);

  return { env, ...selected };
}
