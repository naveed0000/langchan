import type { ExecutionState } from "../state/types";

/**
 * The one logger for the whole project. Console-only, colored, human readable.
 * Replaces the old file-based src/logging/* JSONL wrappers — same call sites,
 * same data shapes (see the *LogEntry interfaces below), no filesystem.
 *
 * Simple:     logger.info / success / warn / error / debug / trace
 * Structured: logger.api / retry / provider / validation / worker / checkpoint
 *
 * NODE_ENV=development -> verbose multi-line blocks (+ stack traces).
 * NODE_ENV=production  -> compact single lines.
 * Toggle debug/trace and layout via configureLogger({ ... }).
 */

// ── preserved types (moved verbatim from the old logging/types.ts) ───────────

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

// ── config ───────────────────────────────────────────────────────────────────

export type LogLevel = "trace" | "debug" | "info" | "success" | "warn" | "error";
const RANK: Record<LogLevel, number> = { trace: 0, debug: 1, info: 2, success: 3, warn: 4, error: 5 };

const isProd = process.env.NODE_ENV === "production";

const config = {
  /** Minimum level printed. */
  minLevel: (isProd ? "info" : "trace") as LogLevel,
  /** Multi-line blocks + stack traces (dev) vs compact single lines (prod). */
  verbose: !isProd,
  /** Gate for logger.debug / logger.trace. */
  debug: !isProd || process.env.DEBUG === "true",
};

export function configureLogger(patch: Partial<typeof config>): void {
  Object.assign(config, patch);
}

// ── colors ─────────────────────────────────────────────────────────────────

const useColor = !process.env.NO_COLOR;
const paint = (code: string, text: string): string => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const C = {
  dim: (t: string) => paint("2", t),
  bold: (t: string) => paint("1", t),
  gray: (t: string) => paint("90", t),
  red: (t: string) => paint("31", t),
  green: (t: string) => paint("32", t),
  yellow: (t: string) => paint("33", t),
  blue: (t: string) => paint("34", t),
  magenta: (t: string) => paint("35", t),
  cyan: (t: string) => paint("36", t),
};
type Painter = (t: string) => string;

// ── helpers ──────────────────────────────────────────────────────────────────

const ts = (): string => new Date().toISOString().replace("T", " ").slice(0, 19);

const stateSummary = (s: ExecutionState): string =>
  `${s.status} @ ${s.current.category || "-"}/${s.current.chapter || "-"}/${s.current.topic || "-"}`;

type Row = [string, string | number | boolean | undefined];

function render(level: LogLevel, color: Painter, header: string, rows: Row[]): void {
  if (RANK[level] < RANK[config.minLevel]) return;

  const kept = rows.filter(([, v]) => v !== undefined && v !== "");

  if (!config.verbose) {
    const compact = kept.map(([k, v]) => `${k.trim().toLowerCase()}=${v}`).join(" ");
    console.log(`${C.dim(ts())} ${color(header)} ${compact}`);
    return;
  }

  const divider = C.gray("─".repeat(60));
  console.log(divider);
  console.log(color(C.bold(header)));
  for (const [k, v] of kept) console.log(`${k.padEnd(10)}: ${v}`);
  console.log(divider);
}

/** One-line messages (info/success/warn/debug/trace). */
function line(level: LogLevel, color: Painter, tag: string, message: string): void {
  if (RANK[level] < RANK[config.minLevel]) return;
  console.log(`${C.dim(ts())} ${color(C.bold(tag))} ${message}`);
}

// ── the logger ────────────────────────────────────────────────────────────────

export const logger = {
  configure: configureLogger,

  trace(message: string): void {
    if (config.debug) line("trace", C.gray, "TRACE", message);
  },
  debug(message: string): void {
    if (config.debug) line("debug", C.gray, "DEBUG", message);
  },
  info(message: string): void {
    line("info", C.blue, "INFO", message);
  },
  success(message: string): void {
    line("success", C.green, "✓ SUCCESS", message);
  },
  warn(message: string): void {
    line("warn", C.yellow, "⚠ WARNING", message);
  },

  api(e: Omit<ApiLogEntry, "timestamp">): void {
    const color = e.status === "SUCCESS" ? C.cyan : C.red;
    render("info", color, `${e.status === "SUCCESS" ? "✓" : "✗"} API ${e.status}`, [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Worker", `#${e.workerId}`],
      ["Provider", e.provider],
      ["Model", e.model],
      ["Batch", e.batchId],
      ["Topic", `${e.category} / ${e.chapter} / ${e.topic}`],
      ["Latency", `${e.latencyMs} ms`],
      ["Tokens", e.totalTokens],
      ["Questions", `${e.questionsReceived}/${e.questionsRequested}`],
      ["Status", e.status],
    ]);
  },

  retry(e: Omit<RetryLogEntry, "timestamp">): void {
    render("warn", C.yellow, `↻ RETRY (attempt ${e.attempt})`, [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Batch", e.batchId],
      ["Provider", e.provider],
      ["Reason", e.reason],
      ["Strategy", e.strategy],
      ["Wait", `${e.wait} ms`],
      ["Fallback", e.fallback ? "yes" : "no"],
      ["State", stateSummary(e.currentState)],
    ]);
  },

  provider(e: Omit<ProviderLogEntry, "timestamp">): void {
    if (config.verbose) {
      const divider = C.gray("─".repeat(60));
      console.log(divider);
      console.log(C.magenta(C.bold("⇄ PROVIDER SWITCH")));
      console.log(`${e.from.provider} ${e.from.model}`);
      console.log("        ↓");
      console.log(`${e.to.provider} ${e.to.model}`);
      console.log(`Reason    : ${e.reason}`);
      console.log(`Batch     : ${e.batchId}`);
      console.log(divider);
      return;
    }
    render("warn", C.magenta, "⇄ PROVIDER SWITCH", [
      ["From", `${e.from.provider} ${e.from.model}`],
      ["To", `${e.to.provider} ${e.to.model}`],
      ["Reason", e.reason],
      ["Batch", e.batchId],
    ]);
  },

  validation(e: Omit<ValidationLogEntry, "timestamp">): void {
    const failed = Object.entries(e.checks).filter(([, ok]) => !ok).map(([k]) => k);
    const color = e.status === "PASSED" ? C.green : C.red;
    render("info", color, `${e.status === "PASSED" ? "✓" : "✗"} VALIDATION ${e.status}`, [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Question", e.questionId],
      ["Batch", e.batchId],
      ["Validator", e.validator],
      ["Status", e.status],
      ["Failed", failed.length ? failed.join(", ") : "none"],
    ]);
  },

  worker(e: Omit<WorkerLogEntry, "timestamp">): void {
    render("info", C.blue, `▪ WORKER #${e.workerId} ${e.status}`, [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Worker", `#${e.workerId}`],
      ["Batch", e.currentBatch],
      ["Completed", e.completedBatches],
      ["Failed", e.failedBatches],
      ["Avg Time", `${e.averageExecutionTime} ms`],
      ["State", stateSummary(e.currentState)],
    ]);
  },

  checkpoint(e: Omit<CheckpointLogEntry, "savedAt">): void {
    const cur = e.currentState.current;
    render("info", C.magenta, "◆ CHECKPOINT", [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Checkpoint", e.checkpointId],
      ["Category", cur.category],
      ["Chapter", cur.chapter],
      ["Topic", cur.topic],
      ["Generated", e.generatedQuestions],
      ["API Calls", e.apiCallsCompleted],
      ["Progress", stateSummary(e.currentState)],
    ]);
  },

  /** Accepts a full ErrorLogEntry (structured) or a plain message string. */
  error(e: Omit<ErrorLogEntry, "timestamp"> | string): void {
    if (typeof e === "string") {
      line("error", C.red, "✗ ERROR", e);
      return;
    }
    render("error", C.red, `✗ ERROR ${e.status}`, [
      ["Time", ts()],
      ["Exec", e.executionId],
      ["Worker", `#${e.workerId}`],
      ["Batch", e.batchId],
      ["Provider", e.provider],
      ["Model", e.model],
      ["Type", e.error.type],
      ["Status", e.error.httpStatus],
      ["Retryable", e.error.retryable ? "yes" : "no"],
      ["Attempt", e.attempt],
      ["Fallback", e.fallbackProvider],
      ["Message", e.error.message],
      ["Stack", config.verbose ? e.error.stack : undefined],
    ]);
  },
};
