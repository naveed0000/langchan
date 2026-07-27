import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitialConfig } from "./types";

const CONFIG_PATH = "storage/initial.json";

export async function readInitialConfig(): Promise<InitialConfig> {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as InitialConfig;
}

/** Same write-temp-then-rename pattern as state.store.ts, for the same reason. */
export async function writeInitialConfig(config: InitialConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const tempPath = `${CONFIG_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(config, null, 2), "utf-8");
  await rename(tempPath, CONFIG_PATH);
}
