import { appendJsonLine } from "./log-writer";
import { writeLatestErrorSnapshot } from "./error.json";
import { nowIso } from "../utils/ids";
import type { ErrorLogEntry } from "./types";

const LOG_PATH = "storage/logs/error.log";

/**
 * Always includes the full currentState so a failure can be reproduced
 * without needing to correlate it against a separate state history. Appends
 * to error.log (full audit trail) and overwrites error.json (latest-error
 * snapshot) — both are required, see docs/QnA-sprint-s2.md item 3.
 */
export async function logError(entry: Omit<ErrorLogEntry, "timestamp">): Promise<void> {
  const record: ErrorLogEntry = { timestamp: nowIso(), ...entry };
  await Promise.all([appendJsonLine(LOG_PATH, record), writeLatestErrorSnapshot(record)]);
}
