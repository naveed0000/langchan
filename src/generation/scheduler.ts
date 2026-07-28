import { mkdir, writeFile } from "node:fs/promises";
import type { Env } from "../config/env";
import { LLM_MODELS } from "../config/llm";
import { MODEL_REGISTRY, normalizeModelId } from "../models/registry";
import { JsonQuotaStore, QuotaManager } from "../quota";
import { createInitialState, readState, writeState } from "../state";
import { logger } from "../logger/logger";
import { generateId } from "../utils/ids";
import { prepareInitialConfig } from "./prepare-config";
import { writeInitialConfig } from "./config-store";
import { findNextTopic, allocateBatchCount, applyBatchCompletion } from "./traversal";
import { runBatchWorker } from "./worker";
import type { BatchContext } from "./prompt-builder";
import type { GeneratedQuestion } from "./question-schema";

export interface RunGenerationOptions {
  /** Safety cap on total batches for this call — smoke tests pass 1, a full run leaves it unset. */
  maxBatches?: number;
}

export interface RunGenerationSummary {
  batchesAttempted: number;
  batchesSucceeded: number;
  questionsGenerated: number;
  /** True only when the whole generation plan (every topic) is COMPLETED. */
  planCompleted: boolean;
}

async function persistBatchOutput(batchId: string, questions: GeneratedQuestion[]): Promise<void> {
  await mkdir("storage/output", { recursive: true });
  await writeFile(`storage/output/${batchId}.json`, JSON.stringify(questions, null, 2), "utf-8");
}

/**
 * The Scheduler from docs/QnA-sprint-s2.md item 4/5: reads state.json +
 * initial.json, allocates up to 5 batches for the current topic, runs them
 * concurrently through the (stateless) worker pool, and persists progress
 * after every individual successful batch — see traversal.ts for why that's
 * per-batch rather than per-group of 5.
 */
export async function runGenerationCycle(
  env: Env,
  options: RunGenerationOptions = {},
): Promise<RunGenerationSummary> {
  const maxBatches = options.maxBatches ?? Infinity;

  const { config } = await prepareInitialConfig(env);

  // Priority-ordered model ids, dropping any that lack a registry factory. The
  // quota manager — not an upfront probe — decides which one runs each request,
  // enforcing RPM/TPM/RPD and cooling down models that 429.
  const modelIds = LLM_MODELS.map(normalizeModelId).filter((id) => MODEL_REGISTRY[id]);
  if (modelIds.length === 0) throw new Error("No usable LLM in LLM_MODELS (none match the registry)");

  const quota = new QuotaManager(new JsonQuotaStore());
  await quota.init();

  const existingState = await readState();
  const state =
    existingState ??
    createInitialState({
      totalQuestions: config.generationconfig.totalquestions,
      totalApiCalls: config.generationconfig.totalapicalls,
      parallelWorkers: 5,
      provider: { current: modelIds[0]!, model: modelIds[0]!, fallback: modelIds.slice(1).join(", ") || "none" },
    });
  state.status = "RUNNING";
  await writeState(state);

  let batchesAttempted = 0;
  let batchesSucceeded = 0;
  let questionsGenerated = 0;
  let planCompleted = false;

  while (batchesAttempted < maxBatches) {
    const topicRef = findNextTopic(config);
    if (!topicRef) {
      planCompleted = true;
      break;
    }

    const { category, chapter, topic } = topicRef;
    const batchSize = chapter.generationconfig.batchsize;
    const batchesToRun = Math.min(allocateBatchCount(topic, batchSize), maxBatches - batchesAttempted);
    if (batchesToRun <= 0) break;

    state.current = {
      categoryIndex: config.categories.indexOf(category),
      chapterIndex: category.chapters.indexOf(chapter),
      topicIndex: chapter.topics.indexOf(topic),
      batchIndex: 0,
      category: category.name,
      chapter: chapter.name,
      topic: topic.name,
      subtopics: topic.subtopics,
    };

    const context: BatchContext = {
      categoryName: category.name,
      chapterName: chapter.name,
      topicName: topic.name,
      categoryId: category.id,
      chapterId: chapter.id,
      topicId: topic.id,
      subtopics: topic.subtopics,
      questionNumber: batchSize,
      difficultyDistribution: chapter.generationconfig.perbatchdistribution.difficulty,
      questionTypeDistribution: chapter.generationconfig.perbatchdistribution.questiontype,
    };

    const tasks = Array.from({ length: batchesToRun }, (_, index) => {
      const workerId = index + 1;
      const batchId = generateId("BATCH");
      return runBatchWorker({
        env,
        workerId,
        batchId,
        executionId: state.executionId,
        modelIds,
        quota,
        context,
        currentState: state,
      }).then(async (result) => {
        logger.worker({
          executionId: state.executionId,
          workerId,
          status: result.success ? "Idle" : "Failed",
          currentBatch: result.batchId,
          completedBatches: result.success ? 1 : 0,
          failedBatches: result.success ? 0 : 1,
          averageExecutionTime: 0,
          currentState: state,
        });
        return result;
      });
    });

    const results = await Promise.all(tasks);

    // Persist quota once here, in the serial section — never from inside the
    // concurrent workers (a shared temp file + rename would race). The workers
    // share one in-memory manager, so cooldowns/counters are already enforced
    // during the group; this only makes them durable across restarts.
    await quota.persist();

    for (const result of results) {
      batchesAttempted++;
      if (!result.success) continue;

      batchesSucceeded++;
      questionsGenerated += result.questions.length;

      await persistBatchOutput(result.batchId, result.questions);
      applyBatchCompletion(topic, batchSize);

      state.progress.questionsGenerated += result.questions.length;
      state.progress.questionsRemaining = Math.max(
        0,
        state.progress.questionsRemaining - result.questions.length,
      );
      state.progress.apiCallsCompleted += 1;
      state.progress.apiCallsRemaining = Math.max(0, state.progress.apiCallsRemaining - 1);
      state.updatedAt = new Date().toISOString();
      state.lastCheckpoint = state.updatedAt;

      await writeInitialConfig(config);
      await writeState(state);

      logger.checkpoint({
        checkpointId: generateId("CP"),
        executionId: state.executionId,
        batchId: result.batchId,
        categoryIndex: state.current.categoryIndex,
        chapterIndex: state.current.chapterIndex,
        topicIndex: state.current.topicIndex,
        generatedQuestions: state.progress.questionsGenerated,
        apiCallsCompleted: state.progress.apiCallsCompleted,
        currentState: state,
      });
    }
  }

  state.status = planCompleted ? "COMPLETED" : "PAUSED";
  state.updatedAt = new Date().toISOString();
  await writeState(state);
  await quota.persist();

  for (const m of quota.metrics()) {
    logger.info(
      `Quota ${m.id}: ${m.health} · req ${m.requests} · success ${(m.successRate * 100).toFixed(0)}% · ` +
        `rpm ${m.remainingRpm} tpm ${m.remainingTpm} rpd ${m.remainingRpd} · 429×${m.rateLimitCount} fallback×${m.fallbackCount}`,
    );
  }

  return { batchesAttempted, batchesSucceeded, questionsGenerated, planCompleted };
}
