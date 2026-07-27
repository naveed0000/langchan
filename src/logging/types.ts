import type { ExecutionState } from "../state/types";

export interface ApiLogEntry {
  timestamp: string;
  executionId: string;
  workerId: number;
  batchId: string;
  provider: string;
  model: string;
  requestId: string;
  category: string;
  chapter: string;
  topic: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  httpStatus: number;
  questionsRequested: number;
  questionsReceived: number;
  cost: number;
  status: "SUCCESS" | "FAILED";
}

export interface ErrorLogEntry {
  timestamp: string;
  executionId: string;
  workerId: number;
  batchId: string;
  provider: string;
  model: string;
  currentState: ExecutionState;
  error: {
    type: string;
    httpStatus: number;
    message: string;
    stack?: string;
    retryable: boolean;
  };
  attempt: number;
  nextRetryAfter: number;
  fallbackProvider?: string;
  status: "RETRYING" | "FAILED" | "ABANDONED";
}

export interface ValidationChecks {
  latex: boolean;
  options: boolean;
  duplicate: boolean;
  difficulty: boolean;
  chapter: boolean;
  topic: boolean;
  grammar: boolean;
  explanation: boolean;
}

export interface ValidationLogEntry {
  timestamp: string;
  executionId: string;
  questionId: string;
  batchId: string;
  currentState: ExecutionState;
  validator: string;
  checks: ValidationChecks;
  status: "PASSED" | "FAILED";
}

export interface RetryLogEntry {
  timestamp: string;
  executionId: string;
  batchId: string;
  attempt: number;
  currentState: ExecutionState;
  reason: string;
  strategy: string;
  wait: number;
  provider: string;
  fallback: boolean;
}

export interface ProviderLogEntry {
  timestamp: string;
  executionId: string;
  currentState: ExecutionState;
  from: { provider: string; model: string };
  to: { provider: string; model: string };
  reason: string;
  batchId: string;
}

export interface WorkerLogEntry {
  timestamp: string;
  executionId: string;
  workerId: number;
  status: "Running" | "Idle" | "Stopped" | "Failed";
  currentBatch: string;
  completedBatches: number;
  failedBatches: number;
  averageExecutionTime: number;
  currentState: ExecutionState;
}

export interface CheckpointLogEntry {
  checkpointId: string;
  executionId: string;
  batchId: string;
  categoryIndex: number;
  chapterIndex: number;
  topicIndex: number;
  generatedQuestions: number;
  apiCallsCompleted: number;
  savedAt: string;
  currentState: ExecutionState;
}
