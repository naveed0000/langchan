# ponytail-review — sprint-s2

Scope: over-engineering only. Correctness/security/perf routed elsewhere.
Diff: 28 new `src/` files, +5182 lines vs `s1-llm-database-connection`.

## Findings

### logging/ — 8 files that are 1 function

`src/logging/*.log.ts`: yagni: 7 wrapper files (`api`, `retry`, `provider`, `worker`, `validation`, `checkpoint`, `error`) are byte-identical except a path constant and one time-key. Each is `{ timestamp: nowIso(), ...entry } -> appendJsonLine(PATH, record)`. Collapse to one generic:
```ts
export const logEvent = (name: string, rec: object) =>
  appendJsonLine(`storage/logs/${name}.log`, { timestamp: nowIso(), ...rec });
```
Callers already build the full typed record; per-type functions add nothing. `-70`.

`src/logging/index.ts`: delete: barrel re-exporting the 8 files that collapse away. `-9`.

`src/logging/error.json.ts:13`: yagni: `writeLatestErrorSnapshot` — latest-error snapshot file has no reader anywhere in the repo (grep: only error.log.ts imports it). Speculative until a dashboard reads it. `-16`.

`src/logging/log-writer.ts`: keep. Real shared IO, one place. Lean.

`src/logging/types.ts:12-22`: delete: `ApiLogEntry` `promptTokens`/`completionTokens`/`totalTokens`/`cost` all hardcoded `0` at the only call site (worker.ts:86-93). Dead fields until token accounting exists. `-4`.

### worker.ts — always-true validators

`src/generation/worker.ts:33-44`: delete: `ValidationChecks.duplicate/chapter/topic/grammar` all hardcoded `true`; `difficulty` is a count check under a wrong name. Half the struct is placeholder. Drop the always-true keys until implemented; keep `latex`/`options`/`explanation`/count. `-4` here + `-4` in types.ts:46-55.

### state — fields nobody writes

`src/state/types.ts:36-39,26-34`: yagni: `MemoryState{ram,cpu}` set to `"0 MB"`/`"0%"` and never updated; `progress.duplicatesRejected`/`validationFailed`/`retries` and `worker.activeWorkers`/`idleWorkers` initialized once, never mutated. Speculative telemetry. `-12`.

### duplicated atomic-json IO

`src/generation/config-store.ts` + `src/state/state.store.ts:24-29`: shrink: write-temp-then-rename and read-json are copy-pasted across both (config-store's own comment says "same pattern as state.store"). Extract `writeJsonAtomic(path,obj)` / `readJson(path)` to `utils/`, call from both. `-15`.

### llm.factory — dead field

`src/models/llm.factory.ts:10`: delete: `providerLabel` is written in both return paths but read nowhere (grep: only self-references). Superseded by the new `provider`+`modelName`. Drop it. `-3`.

### utils/ids — stdlib wrapper

`src/utils/ids.ts:3-5`: native: `nowIso()` wraps `new Date().toISOString()`. scheduler.ts:148,169 already calls the raw form directly, so the wrapper isn't even applied consistently. Inline it. `-3` (+ churn).

### prompt-builder — duplicated distribution block

`src/generation/prompt-builder.ts:256-281`: shrink: `buildUserContent` re-emits the difficulty/type distribution already spelled out in `buildSystemPrompt:48-60`. Fold the user message to exam-context + "Generate EXACTLY N, return JSON array" one-liner; the system prompt owns the rules. `-15`. (Prompt *rules* text L98-253 is ported-verbatim domain content — NOT bloat, leave it.)

## Non-findings (leave alone)
- `prompt-builder` rule text — hard-won LaTeX/validation spec, ported 1:1. Keep.
- `generate.ts` argv parse — 2 lines, no dep. Keep.
- `taxonomy.ts` 3-query index — correct, avoids N+1. Keep.
- barrels `generation/index.ts`, `state/index.ts` — harmless. Ignore.

## Score
net: -145 lines possible (≈ -100 of it is the logging module).
