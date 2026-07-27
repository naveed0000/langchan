import { appendJsonLine } from "./log-writer";
import { nowIso } from "../utils/ids";
import type { ProviderLogEntry } from "./types";

const LOG_PATH = "storage/logs/provider.log";

export async function logProviderSwitch(entry: Omit<ProviderLogEntry, "timestamp">): Promise<void> {
  const record: ProviderLogEntry = { timestamp: nowIso(), ...entry };
  await appendJsonLine(LOG_PATH, record);
}
