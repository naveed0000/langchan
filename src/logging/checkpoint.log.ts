import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { CheckpointLogEntry } from "./types";

const LOG_PATH = "storage/logs/checkpoint.log";

export async function logCheckpoint(entry: Omit<CheckpointLogEntry, "savedAt">): Promise<void> {
  const record: CheckpointLogEntry = { savedAt: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
