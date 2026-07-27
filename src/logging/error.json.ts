import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ErrorLogEntry } from "./types";

const SNAPSHOT_PATH = "storage/error.json";

/**
 * Overwritten on every error with just the latest one — for dashboards and
 * recovery logic that want "why did we last fail" without scanning error.log.
 * error.log (append-only) remains the full audit trail; this is not a
 * replacement for it. See docs/QnA-sprint-s2.md item 3.
 */
export async function writeLatestErrorSnapshot(entry: ErrorLogEntry): Promise<void> {
  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(entry, null, 2), "utf-8");
}
