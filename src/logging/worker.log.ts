import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { WorkerLogEntry } from "./types";

const LOG_PATH = "storage/logs/worker.log";

/**
 * One JSONL line per worker status report (not a rewritten array snapshot) so
 * this stays append-only and consistent with every other log in this module.
 */
export async function logWorkerStatus(entry: Omit<WorkerLogEntry, "timestamp">): Promise<void> {
  const record: WorkerLogEntry = { timestamp: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
