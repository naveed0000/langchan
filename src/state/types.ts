export type ExecutionStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";

export interface CurrentPosition {
  categoryIndex: number;
  chapterIndex: number;
  topicIndex: number;
  batchIndex: number;
  category: string;
  chapter: string;
  topic: string;
  subtopics: string[];
}

export interface ProviderState {
  current: string;
  model: string;
  fallback: string;
}

export interface WorkerPoolState {
  parallelWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
}

export interface ProgressState {
  questionsGenerated: number;
  questionsRemaining: number;
  apiCallsCompleted: number;
  apiCallsRemaining: number;
  duplicatesRejected: number;
  validationFailed: number;
  retries: number;
}

export interface MemoryState {
  ram: string;
  cpu: string;
}

/**
 * Single source of truth for a generation run. Written atomically after every
 * batch so a crash can resume from the last consistent point instead of the
 * beginning.
 */
export interface ExecutionState {
  executionId: string;
  status: ExecutionStatus;
  startedAt: string;
  updatedAt: string;
  lastCheckpoint: string;
  current: CurrentPosition;
  provider: ProviderState;
  worker: WorkerPoolState;
  progress: ProgressState;
  memory: MemoryState;
}
