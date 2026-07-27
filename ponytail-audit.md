# ponytail-audit — langchan (repo-wide)

Scope: over-engineering/complexity only. Bugs/security/perf out of scope.
Tree: 37 `.ts` files under `src/`, 10 runtime deps. Ranked, biggest cut first.

## Findings

`delete: 4 unused deps — nothing imports them. Drop @langchain/anthropic, @langchain/openai, @langchain/community, and bare langchain (root meta-pkg). [package.json]` — grep of src/: 0 import sites each. Only google-genai, ollama, core, pg, zod, dotenv are used. **-4 deps.**

`yagni: logging/ is 8 files that are 1 function. api/retry/provider/worker/validation/checkpoint/error.log.ts are identical bar a path + time-key: {timestamp: nowIso(), ...entry} -> appendJsonLine(PATH, rec). Collapse to logEvent(name, rec). [src/logging/*.log.ts]` **-70.**

`delete: error.json.ts writeLatestErrorSnapshot — latest-error snapshot has no reader in the repo. Speculative until a dashboard reads it. [src/logging/error.json.ts]` **-16.**

`delete: logging/index.ts barrel re-exports the files that collapse away. [src/logging/index.ts]` **-9.**

`shrink: buildUserContent re-emits the difficulty/type distribution buildSystemPrompt already spells out. Fold to context + "generate N, return JSON array". [src/generation/prompt-builder.ts:256-281]` **-15.** (Rule text L98-253 is ported-verbatim domain spec — keep.)

`shrink: atomic write-temp-then-rename + read-json copy-pasted in two stores (config-store's comment even admits it). Extract writeJsonAtomic/readJson to utils. [src/generation/config-store.ts + src/state/state.store.ts:24-29]` **-15.**

`delete: state fields nobody writes — MemoryState{ram,cpu}="0 MB"/"0%", worker.activeWorkers/idleWorkers, progress.duplicatesRejected/validationFailed/retries all init-once, never mutated. [src/state/types.ts:26-39, state.store.ts]` **-12.**

`yagni: two Pool singletons + identical getPool() in postgres.ts and taxonomy.ts. One shared pool module, import from both. [src/database/postgres.ts:4-11 + taxonomy.ts:4-11]` **-8.**

`delete: ValidationChecks.duplicate/chapter/topic/grammar hardcoded true; difficulty is a count check misnamed. Drop the always-true keys until implemented. [src/generation/worker.ts:33-44 + logging/types.ts:46-55]` **-8.**

`delete: ApiLogEntry promptTokens/completionTokens/totalTokens/cost hardcoded 0 at the only call site. Dead until token accounting exists. [src/logging/types.ts:12-22, worker.ts:86-93]` **-4.**

`delete: SelectedModel.providerLabel written in both return paths, read nowhere. Superseded by provider+modelName. [src/models/llm.factory.ts:10]` **-3.**

`native: nowIso() wraps new Date().toISOString(); scheduler.ts:148,169 already calls the raw form, so the wrapper isn't even used consistently. Inline it. [src/utils/ids.ts:3-5]` **-3.**

`delete: dead npm scripts — "prepare-config" points at scripts/prepare-initial-config.ts (dir empty) and "start" at dist/app/server.js (no server.ts exists). [package.json]` **-2.**

## Non-findings (leave alone)
- prompt-builder rule text — hard-won LaTeX/validation spec, ported 1:1.
- gemini.ts / ollama.ts factories — thin but hold provider-specific config; keep.
- taxonomy.ts 3-query name index — correct, avoids N+1.
- utils/logger.ts — 3 one-liners, no dep. Keep.
- generation/index.ts, state/index.ts barrels — harmless.

## Score
net: -165 lines, -4 deps possible. (~-95 of the lines is the logging module.)
