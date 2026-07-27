import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { ValidationLogEntry } from "./types";

const LOG_PATH = "storage/logs/validation.log";

export async function logValidation(entry: Omit<ValidationLogEntry, "timestamp">): Promise<void> {
  const record: ValidationLogEntry = { timestamp: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
