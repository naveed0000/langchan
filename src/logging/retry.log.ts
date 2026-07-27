import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { RetryLogEntry } from "./types";

const LOG_PATH = "storage/logs/retry.log";

export async function logRetry(entry: Omit<RetryLogEntry, "timestamp">): Promise<void> {
  const record: RetryLogEntry = { timestamp: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
