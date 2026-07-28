import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the registry so the worker resolves fake models instead of real providers.
const invoke = vi.fn();
vi.mock("../models/registry", () => ({
  MODEL_REGISTRY: {
    "model-a": () => ({ provider: "A", modelName: "model-a", model: { withStructuredOutput: () => ({ invoke }) } }),
    "model-b": () => ({ provider: "B", modelName: "model-b", model: { withStructuredOutput: () => ({ invoke }) } }),
  },
}));

import { QuotaManager } from "../quota";
import { runBatchWorker, type WorkerInput } from "./worker";
import type { BatchContext } from "./prompt-builder";
import type { ExecutionState } from "../state/types";

class MemoryStore {
  saved: Record<string, unknown> = {};
  async load() {
    return {} as never;
  }
  async save(s: Record<string, unknown>) {
    this.saved = s;
  }
}

const context: BatchContext = {
  categoryName: "Mechanics",
  chapterName: "Kinematics",
  topicName: "Motion",
  categoryId: 1,
  chapterId: 2,
  topicId: 3,
  subtopics: ["velocity"],
  questionNumber: 2,
  difficultyDistribution: { easy: 1, moderate: 1, hard: 0 },
  questionTypeDistribution: { single: 2, multiple: 0, numerical: 0 },
};

const dummyState = { current: {} } as unknown as ExecutionState;

const okResponse = {
  raw: { usage_metadata: { input_tokens: 100, output_tokens: 200, total_tokens: 300 } },
  parsed: { questions: [{ optionType: "Single", options: [1, 2, 3, 4], explanation: "x", latex: [] }, { optionType: "Single", options: [1, 2, 3, 4], explanation: "y", latex: [] }] },
};

async function makeInput(): Promise<WorkerInput> {
  const quota = new QuotaManager(new MemoryStore() as never);
  await quota.init();
  return {
    env: {} as never,
    workerId: 1,
    batchId: "BATCH-TEST",
    executionId: "GEN-TEST",
    modelIds: ["model-a", "model-b"],
    quota,
    context,
    currentState: dummyState,
  };
}

afterEach(() => {
  invoke.mockReset();
});

describe("runBatchWorker", () => {
  it("records real token usage on success", async () => {
    invoke.mockResolvedValueOnce(okResponse);
    const input = await makeInput();
    const result = await runBatchWorker(input);

    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(input.quota.getState("model-a")!.tokensUsed).toBe(300);
    expect(input.quota.getState("model-a")!.successes).toBe(1);
  });

  it("cools down model-a on a 429 and fails over to model-b", async () => {
    const rateLimit = Object.assign(new Error("429 Too Many Requests"), { status: 429 });
    invoke.mockRejectedValueOnce(rateLimit).mockResolvedValueOnce(okResponse);

    const input = await makeInput();
    const result = await runBatchWorker(input);

    expect(result.success).toBe(true);
    expect(input.quota.getState("model-a")!.health).toBe("RateLimited");
    expect(input.quota.getState("model-a")!.rateLimitCount).toBe(1);
    // model-b served the successful retry.
    expect(input.quota.getState("model-b")!.successes).toBe(1);
    expect(input.quota.getState("model-b")!.fallbackCount).toBe(1);
  });

  it("does not retry a non-retryable 401", async () => {
    const auth = Object.assign(new Error("401 invalid api key"), { status: 401 });
    invoke.mockRejectedValue(auth);

    const input = await makeInput();
    const result = await runBatchWorker(input);

    expect(result.success).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1); // no retry
  });
});
