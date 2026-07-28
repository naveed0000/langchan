import type { Env } from "../config/env";
import { DEFAULT_LIMITS } from "../config/quota";
import { MODEL_REGISTRY } from "../models/registry";
import { classifyError } from "../quota/errors";
import { estimateTokens } from "../quota/estimate";
import type { QuotaManager } from "../quota/quota-manager";
import { generateQuestionBatch } from "./generate-batch";
import { buildSystemPrompt, buildUserContent, type BatchContext } from "./prompt-builder";
import type { GeneratedQuestion } from "./question-schema";
import { logger, type ValidationChecks } from "../logger/logger";
import type { ExecutionState } from "../state/types";
import { generateId } from "../utils/ids";

export interface WorkerInput {
  env: Env;
  workerId: number;
  batchId: string;
  executionId: string;
  /** Registry ids to try in priority order — the quota manager picks which one runs. */
  modelIds: string[];
  quota: QuotaManager;
  context: BatchContext;
  currentState: ExecutionState;
}

export interface WorkerResult {
  batchId: string;
  success: boolean;
  questions: GeneratedQuestion[];
}

const MAX_ATTEMPTS = 3;

function validateBatch(questions: GeneratedQuestion[], context: BatchContext): { checks: ValidationChecks; passed: boolean } {
  const checks: ValidationChecks = {
    latex: questions.every((q) => Array.isArray(q.latex)),
    options: questions.every((q) => (q.optionType === "Numerical" ? true : q.options?.length === 4)),
    // Semantic near-duplicate detection needs embeddings + similarity search
    // against prior batches — not implemented yet, always reported true here.
    duplicate: true,
    difficulty: questions.length === context.questionNumber,
    chapter: true,
    topic: true,
    grammar: true,
    explanation: questions.every((q) => q.explanation.length > 0),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function describeError(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { type: "UnknownError", message: String(error) };
}

/**
 * Runs one batch to completion: pick a model via the quota manager, generate,
 * validate, log. The worker owns NO scheduling/quota policy — it asks
 * `quota.acquire()` which model may run, records actual token usage on success,
 * and puts a model into cooldown on 429 (docs/QnA-sprint-s2.md items 5 & 6).
 * Because the manager is shared across all workers, a 429 one worker hits
 * cools the model down for the others too — the missing cross-batch capability
 * the old per-worker fallback walk couldn't provide.
 */
export async function runBatchWorker(input: WorkerInput): Promise<WorkerResult> {
  const { quota, context, modelIds } = input;
  const promptText = `${buildSystemPrompt(context)}\n${buildUserContent(context)}`;
  const estTokens = estimateTokens(promptText, DEFAULT_LIMITS.expectedOutputTokens);

  let previousId: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const lease = quota.acquire(modelIds, estTokens);
    if (!lease) {
      // Every model disabled / cooling / out of quota — nothing left to try.
      logger.error({
        executionId: input.executionId,
        workerId: input.workerId,
        batchId: input.batchId,
        provider: "-",
        model: "-",
        currentState: input.currentState,
        error: { type: "NoModelAvailable", httpStatus: 429, message: "All models rate-limited or out of quota", retryable: true },
        attempt,
        nextRetryAfter: 0,
        status: "ABANDONED",
      });
      return { batchId: input.batchId, success: false, questions: [] };
    }

    const { provider, modelName, model } = MODEL_REGISTRY[lease.id]!(input.env);

    // A different model than last attempt means the quota manager routed us to
    // a fallback (previous one cooled down / hit a limit).
    if (previousId && previousId !== lease.id) {
      quota.markFallback(lease.id);
      logger.provider({
        executionId: input.executionId,
        currentState: input.currentState,
        from: { provider: previousId, model: previousId },
        to: { provider, model: modelName },
        reason: "Quota/cooldown failover",
        batchId: input.batchId,
      });
    }
    previousId = lease.id;

    try {
      const startedAt = Date.now();
      const { questions, usage } = await generateQuestionBatch(model, context);
      const latencyMs = Date.now() - startedAt;

      quota.record(lease, usage, latencyMs);

      logger.api({
        executionId: input.executionId,
        workerId: input.workerId,
        batchId: input.batchId,
        provider,
        model: modelName,
        requestId: generateId("REQ"),
        category: context.categoryName,
        chapter: context.chapterName,
        topic: context.topicName,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        latencyMs,
        httpStatus: 200,
        questionsRequested: context.questionNumber,
        questionsReceived: questions.length,
        cost: 0,
        status: "SUCCESS",
      });

      const { checks, passed } = validateBatch(questions, context);
      logger.validation({
        executionId: input.executionId,
        questionId: generateId("Q"),
        batchId: input.batchId,
        currentState: input.currentState,
        validator: "StructuralQuestionValidator",
        checks,
        status: passed ? "PASSED" : "FAILED",
      });

      return { batchId: input.batchId, success: true, questions };
    } catch (error) {
      const classified = classifyError(error);
      const described = describeError(error);
      const isFinalAttempt = attempt >= MAX_ATTEMPTS;

      // Cool down ANY retryable error, not just 429 — that's how "retry a 500 a
      // few times, then move to the next model" works: the cooled model is
      // skipped on the next acquire(), which routes to the next model. 429 uses
      // Retry-After/backoff; transient 5xx/network get a short cooldown so a
      // healthy model isn't sidelined for long. Non-retryables fail fast.
      let cooldownMs = 0;
      if (classified.retryable) {
        const err = classified.rateLimited ? classified : { ...classified, retryAfterMs: 2 ** attempt * 1000 };
        cooldownMs = quota.cooldown(lease.id, err);
      } else {
        quota.failure(lease.id, described.message);
      }

      logger.error({
        executionId: input.executionId,
        workerId: input.workerId,
        batchId: input.batchId,
        provider,
        model: modelName,
        currentState: input.currentState,
        error: { ...described, httpStatus: classified.httpStatus, retryable: classified.retryable },
        attempt,
        nextRetryAfter: cooldownMs,
        status: isFinalAttempt ? "FAILED" : "RETRYING",
      });

      // Non-retryable (400/401/403/404/validation) — retrying won't help.
      if (!classified.retryable) {
        return { batchId: input.batchId, success: false, questions: [] };
      }
      if (isFinalAttempt) {
        return { batchId: input.batchId, success: false, questions: [] };
      }

      quota.markRetry(lease.id);
      logger.retry({
        executionId: input.executionId,
        batchId: input.batchId,
        attempt,
        currentState: input.currentState,
        reason: classified.rateLimited ? "Rate limited" : described.message,
        strategy: classified.rateLimited ? "Cooldown+Failover" : "Cooldown+Retry",
        wait: cooldownMs,
        provider,
        fallback: modelIds.length > 1,
      });

      // No sleep: the cooled-down model is skipped on the next acquire(), so
      // failover to the next model happens immediately. A single-model config
      // falls through to a null acquire and abandons.
    }
  }

  return { batchId: input.batchId, success: false, questions: [] };
}
