import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Appends one JSON Lines record. Shared by every log type so the
 * mkdir-then-append behavior (and the file format) only lives in one place.
 */
export async function appendJsonLine(filePath: string, record: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf-8");
}
