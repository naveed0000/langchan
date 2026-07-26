import { OllamaEmbeddings } from "@langchain/ollama";
import type { Env } from "../config/env";
import { logSuccess, logInfo } from "../utils/logger";

export async function loadEmbeddingDimensions(env: Env): Promise<number> {
  const embeddings = new OllamaEmbeddings({
    model: env.OLLAMA_EMBEDDING_MODEL,
    baseUrl: env.OLLAMA_BASE_URL,
  });

  const vector = await embeddings.embedQuery("Sample text for embedding dimension check.");
  logSuccess("Embedding Model Loaded");
  logInfo(`Embedding dimensions: ${vector.length}`);
  return vector.length;
}
