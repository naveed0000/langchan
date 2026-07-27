import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateExecutionId, nowIso } from "../utils/ids";
import type { ExecutionState, ProviderState } from "./types";

const STATE_PATH = "storage/state.json";

export async function readState(): Promise<ExecutionState | null> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    return JSON.parse(raw) as ExecutionState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Writes to a temp file then renames over the real path so a crash mid-write
 * never leaves state.json truncated or half-written.
 */
export async function writeState(state: ExecutionState): Promise<void> {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  const tempPath = `${STATE_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");
  await rename(tempPath, STATE_PATH);
}

export interface CreateInitialStateInput {
  totalQuestions: number;
  totalApiCalls: number;
  parallelWorkers: number;
  provider: ProviderState;
}

export function createInitialState(input: CreateInitialStateInput): ExecutionState {
  const timestamp = nowIso();
  return {
    executionId: generateExecutionId(),
    status: "PENDING",
    startedAt: timestamp,
    updatedAt: timestamp,
    lastCheckpoint: timestamp,
    current: {
      categoryIndex: 0,
      chapterIndex: 0,
      topicIndex: 0,
      batchIndex: 0,
      category: "",
      chapter: "",
      topic: "",
      subtopics: [],
    },
    provider: input.provider,
    worker: {
      parallelWorkers: input.parallelWorkers,
      activeWorkers: 0,
      idleWorkers: input.parallelWorkers,
    },
    progress: {
      questionsGenerated: 0,
      questionsRemaining: input.totalQuestions,
      apiCallsCompleted: 0,
      apiCallsRemaining: input.totalApiCalls,
      duplicatesRejected: 0,
      validationFailed: 0,
      retries: 0,
    },
    memory: { ram: "0 MB", cpu: "0%" },
  };
}
