import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { ApiLogEntry } from "./types";

const LOG_PATH = "storage/logs/api.log";

export async function logApiCall(entry: Omit<ApiLogEntry, "timestamp">): Promise<void> {
  const record: ApiLogEntry = { timestamp: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
