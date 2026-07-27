import { loadEnv } from "../config/env";
import { runGenerationCycle } from "../generation/scheduler";
import { logInfo, logSuccess } from "../utils/logger";

/**
 * Entrypoint for the question-generation pipeline (Sprint S2). Separate from
 * app/main.ts (Sprint S1's connectivity smoke test) since this runs real,
 * potentially long, batched LLM generation against storage/initial.json.
 *
 * Usage: npm run generate -- --max-batches=1
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const maxBatchesArg = process.argv.find((arg) => arg.startsWith("--max-batches="));
  const maxBatches = maxBatchesArg ? Number(maxBatchesArg.split("=")[1]) : undefined;

  logInfo(`Starting generation cycle${maxBatches ? ` (max ${maxBatches} batches)` : ""}...`);
  const summary = await runGenerationCycle(env, maxBatches ? { maxBatches } : {});

  logSuccess(
    `Attempted ${summary.batchesAttempted} batches, ${summary.batchesSucceeded} succeeded, ` +
      `${summary.questionsGenerated} questions generated. Plan completed: ${summary.planCompleted}`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
