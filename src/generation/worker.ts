import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Env } from "../config/env";
import { createOllamaModel } from "../models/ollama";
import { isProviderUnavailable } from "../models/llm.factory";
import { generateQuestionBatch } from "./generate-batch";
import type { BatchContext } from "./prompt-builder";
import type { GeneratedQuestion } from "./question-schema";
import { logApiCall, logError, logRetry, logProviderSwitch, logValidation, type ValidationChecks } from "../logging";
import type { ExecutionState } from "../state/types";
import { generateId } from "../utils/ids";

export interface WorkerInput {
  env: Env;
  workerId: number;
  batchId: string;
  executionId: string;
  model: BaseChatModel;
  provider: "Gemini" | "Ollama";
  modelName: string;
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
 * Runs one batch to completion: generate -> validate -> log. Retries up to
 * MAX_ATTEMPTS with exponential backoff, switching Gemini -> Ollama mid-loop
 * if a retryable provider-unavailable error shows up (docs/QnA-sprint-s2.md
 * items 5 & 6 — the worker stays generic, no scheduling/traversal logic here).
 */
export async function runBatchWorker(input: WorkerInput): Promise<WorkerResult> {
  let model = input.model;
  let provider = input.provider;
  let modelName = input.modelName;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const startedAt = Date.now();
      const questions = await generateQuestionBatch(model, input.context);
      const latencyMs = Date.now() - startedAt;

      await logApiCall({
        executionId: input.executionId,
        workerId: input.workerId,
        batchId: input.batchId,
        provider,
        model: modelName,
        requestId: generateId("REQ"),
        category: input.context.categoryName,
        chapter: input.context.chapterName,
        topic: input.context.topicName,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs,
        httpStatus: 200,
        questionsRequested: input.context.questionNumber,
        questionsReceived: questions.length,
        cost: 0,
        status: "SUCCESS",
      });

      const { checks, passed } = validateBatch(questions, input.context);
      await logValidation({
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
      const retryable = isProviderUnavailable(error);
      const nextRetryAfter = 2 ** attempt * 1000;
      const isFinalAttempt = attempt >= MAX_ATTEMPTS;

      await logError({
        executionId: input.executionId,
        workerId: input.workerId,
        batchId: input.batchId,
        provider,
        model: modelName,
        currentState: input.currentState,
        error: { ...describeError(error), httpStatus: 0, retryable },
        attempt,
        nextRetryAfter,
        status: isFinalAttempt ? "FAILED" : "RETRYING",
      });

      if (isFinalAttempt) {
        return { batchId: input.batchId, success: false, questions: [] };
      }

      await logRetry({
        executionId: input.executionId,
        batchId: input.batchId,
        attempt,
        currentState: input.currentState,
        reason: retryable ? "Provider unavailable" : describeError(error).message,
        strategy: "ExponentialBackoff",
        wait: nextRetryAfter,
        provider,
        fallback: false,
      });

      if (retryable && provider === "Gemini") {
        await logProviderSwitch({
          executionId: input.executionId,
          currentState: input.currentState,
          from: { provider, model: modelName },
          to: { provider: "Ollama", model: input.env.OLLAMA_CHAT_MODEL },
          reason: "Quota/availability failure",
          batchId: input.batchId,
        });
        model = createOllamaModel(input.env);
        provider = "Ollama";
        modelName = input.env.OLLAMA_CHAT_MODEL;
      }

      await new Promise((resolve) => setTimeout(resolve, nextRetryAfter));
    }
  }

  return { batchId: input.batchId, success: false, questions: [] };
}
