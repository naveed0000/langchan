# Sprint S2 — LLM Quota & Rate-Limit Manager (implementation notes)

Implements `docs/sprint-s2-ratelimit.md`. Instead of a parallel framework, the
quota manager slots into the existing generation pipeline and **replaces** the
three ad-hoc failover mechanisms that were there before (an upfront probe in the
scheduler, a per-worker `fallbackIds.shift()` walk, and per-worker backoff) with
one shared decision point.

## Why one shared manager

The old per-worker fallback walk was stateless: worker 2 had no way to know
worker 1 had already been 429'd on the same model, so all five workers kept
hammering a rate-limited provider. The `QuotaManager` is a single instance
shared by every worker in a run — a 429 one worker hits cools the model down for
all of them. Cross-batch cooldown is the real capability that was missing.

## Folder structure

```
src/
  config/quota.ts          # per-model RPM/TPM/RPD limits + cooldown config (no hardcoded numbers in logic)
  quota/
    types.ts               # QuotaState, TokenUsage, decisions, metrics
    store.ts               # QuotaStore interface + JsonQuotaStore
    estimate.ts            # pre-flight token estimate (char/4 + expected output)
    errors.ts              # provider-agnostic error classification
    quota-manager.ts       # the manager: acquire / record / cooldown / reset / metrics
    quota-manager.test.ts  # 13 unit tests
    index.ts               # barrel
  generation/
    worker.ts              # asks the manager which model runs; records usage / cooldown
    generate-batch.ts      # returns real token usage from usage_metadata
    scheduler.ts           # builds the manager, passes it to the worker pool
```

## Data flow

```
scheduler ──build──> QuotaManager (loads storage/quota.json)
   │  for each batch → runBatchWorker(modelIds, quota, context)
   ▼
worker.acquire(modelIds, estTokens)   ── sync check-and-reserve ──> lease{id, reservedTokens}
   │                                     (RPM/TPM/RPD checked, counters reserved)
   ├─ ok ─> generateQuestionBatch(model) ─> {questions, usage}
   │           └─ quota.record(lease, usage)  (reconcile reserved→actual, metrics)
   ├─ 429 ─> quota.cooldown(id, Retry-After | backoff)  → next acquire skips it → next model
   ├─ 5xx/timeout/net ─> quota.failure(id) + retry
   └─ 4xx/validation ─> fail fast (no retry)
```

## Interfaces / responsibilities

- **`QuotaStore`** — `load()` / `save()`. One JSON impl; SQLite/Redis are drop-in
  replacements. The manager never touches the filesystem.
- **`QuotaManager`** — the only thing that reads or mutates counters.
  - `acquire(ids, estTokens)` → walks ids in priority order, returns a lease for
    the first that passes and reserves its quota **synchronously** (see
    concurrency), or `null` if all are unavailable.
  - `record(lease, usage, latency)` → reconciles the reserved estimate with the
    real `totalTokens`, updates success metrics.
  - `cooldown(id, classifiedError)` → 429 handling (Retry-After or exponential
    backoff), health → RateLimited.
  - `failure` / `markRetry` / `markFallback` → metric counters.
  - `check` → pure "is this allowed now?" (also used by `acquire`).
  - `metrics()` → derived per-model view (remaining RPM/TPM/RPD, success rate,
    avg latency, 429/retry/fallback counts).
- **worker** — owns no policy; it asks the manager and reports outcomes.
- **scheduler** — builds the manager, filters `LLM_MODELS` to registry-known ids,
  runs the worker pool, persists quota after batches + logs the metrics snapshot.

## Scheduler / selection algorithm

1. Sort models by priority (the `LLM_MODELS` order).
2. `acquire` skips disabled → cooling-down → RPM-full → TPM-full → RPD-full, in
   that order, and reserves the first that passes.
3. Send the request. On success, record actual tokens and return.
4. On 429 → cooldown + next acquire routes to the next model (natural failover,
   including down to Ollama, which has Infinity cloud limits).
5. On 5xx/timeout/network → count failure, retry (bounded).
6. On 4xx/auth/validation → non-retryable, fail immediately.
7. If every model is cooling/out of quota → `acquire` returns null → meaningful
   `NoModelAvailable` error.

## Retry / cooldown / reset

- **Retry**: `MAX_ATTEMPTS = 3` per batch. Rate-limited attempts re-acquire
  immediately (a different, healthy model gets picked); other retryables wait
  `2^attempt` seconds.
- **Cooldown**: Retry-After header if present, else `30s → 60s → 120s → 240s`
  (capped), keyed off consecutive cooldowns; reset to 0 on the next success.
- **Reset**: lazy — the minute/day windows roll on the next `check`/`acquire`
  when `now` passes the reset time. No timers, no restart, no leaks.

## Concurrency

Single Node instance: the JS event loop gives atomicity for free **because
`acquire()` contains no `await`** — it checks and increments counters in one
synchronous critical section, so five concurrent workers can't all pass the RPM
check and then all fire. Disk persistence happens **only in the scheduler's
serial section** (once per group of batches), never from inside the concurrent
workers — a shared `quota.json.tmp` + rename would otherwise race to ENOENT.
Writes use atomic temp-file + rename. Multi-instance deployments need Redis
`INCR` / a distributed lock — documented as the ceiling, not built.

## Token accounting

`generate-batch.ts` uses `withStructuredOutput(schema, { includeRaw: true })` so
the raw `AIMessage.usage_metadata` survives (plain `withStructuredOutput` drops
it). Real `input/output/total_tokens` flow into `logger.api` and
`quota.record`. If a provider omits usage on a structured call, it falls back to
an estimate and sets `usage.estimated = true` so the number isn't trusted as
authoritative.

## Sample state schema (`storage/quota.json`)

```json
{
  "gemini-3.5-flash-lite": {
    "id": "gemini-3.5-flash-lite",
    "requestsThisMinute": 3, "tokensThisMinute": 24120, "requestsToday": 41,
    "minuteResetTime": 1750000060000, "dayResetTime": 1750086400000,
    "cooldownUntil": 0, "consecutiveCooldowns": 0,
    "lastError": null, "lastSuccess": 1750000012000, "health": "Healthy",
    "requests": 41, "successes": 40, "failures": 1, "totalLatencyMs": 512000,
    "tokensUsed": 986400, "cooldownCount": 1, "rateLimitCount": 1,
    "retryCount": 2, "fallbackCount": 1
  }
}
```

## Error handling

`classifyError` probes `error.status` / `statusCode` / `response.status` and
falls back to string matching. Retryable: 429/5xx/timeout/network. Non-retryable:
400/401/403/404/422/auth/validation (fail fast). Unknown → treated as
non-retryable so real bugs don't burn the retry budget.

## Testing

`quota-manager.test.ts` — 13 tests: RPM / TPM / RPD enforcement, minute reset,
cooldown expiry, exponential backoff, Retry-After precedence, priority failover,
all-unavailable → null, synchronous reservation (concurrency), token
reconciliation, and JSON persistence across a restart. `npm test`.

## Best practices applied

Single responsibility (worker vs manager vs store), dependency injection (store
injected into manager), config-driven limits, provider-agnostic error handling,
atomic persistence, conservative (reserve-then-reconcile) token budgeting.

## Future improvements

- Redis-backed `QuotaStore` for multi-instance atomic counters.
- Real tokenizer for exact TPM (currently char/4 heuristic).
- Cost accounting per model (price × tokens) into metrics.
- Adaptive limits from `X-RateLimit-*` response headers.
- Enable a model in `config/quota.ts` (`enabled: false`) to drain it without a
  code change — the plumbing already reads it.
