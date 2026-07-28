import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { QuotaState } from "./types";

/**
 * Persistence boundary for quota state. One method to load the whole map, one
 * to save it — business logic (QuotaManager) never touches the filesystem.
 * Swap this for SQLite or Redis without changing the manager.
 *
 * ponytail: JSON only for now (single instance). SQLite = durability upgrade;
 * Redis = the multi-instance upgrade path (see QuotaManager concurrency note).
 */
export interface QuotaStore {
  load(): Promise<Record<string, QuotaState>>;
  save(states: Record<string, QuotaState>): Promise<void>;
}

const QUOTA_PATH = "storage/quota.json";

export class JsonQuotaStore implements QuotaStore {
  constructor(private readonly path: string = QUOTA_PATH) {}

  async load(): Promise<Record<string, QuotaState>> {
    try {
      return JSON.parse(await readFile(this.path, "utf-8")) as Record<string, QuotaState>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  /** Temp-file + rename so a crash mid-write never truncates quota.json. */
  async save(states: Record<string, QuotaState>): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    await writeFile(temp, JSON.stringify(states, null, 2), "utf-8");
    await rename(temp, this.path);
  }
}
