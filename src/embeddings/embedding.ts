import { OllamaEmbeddings } from "@langchain/ollama";
import type { Env } from "../config/env";
import { logger } from "../logger/logger";

export async function loadEmbeddingDimensions(env: Env): Promise<number> {
  const embeddings = new OllamaEmbeddings({
    model: env.OLLAMA_EMBEDDING_MODEL,
    baseUrl: env.OLLAMA_BASE_URL,
  });

  const vector = await embeddings.embedQuery("Sample text for embedding dimension check.");
  logger.success("Embedding Model Loaded");
  logger.info(`Embedding dimensions: ${vector.length}`);
  return vector.length;
}
