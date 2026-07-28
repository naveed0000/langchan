import { COOLDOWN, limitsFor } from "../config/quota";
import { logger } from "../logger/logger";
import type { ClassifiedError } from "./errors";
import type { QuotaStore } from "./store";
import type { HealthStatus, ModelMetrics, QuotaDecision, QuotaLease, QuotaState, TokenUsage } from "./types";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Single decision point for "which model can run this request right now?".
 *
 * The whole application asks the manager instead of touching counters: it
 * tracks RPM/TPM/RPD per model, enforces them BEFORE a call, applies cooldown
 * on 429/overload, lazily resets the minute/day windows, and records actual
 * token usage after each response.
 *
 * Concurrency: on a single Node instance, `acquire()` is the critical section
 * and contains NO `await` — it checks-and-reserves synchronously, so 5
 * concurrent workers can't all pass the RPM check and then all fire. Disk
 * persistence happens outside that section.
 *
 * ponytail: in-process atomicity via the JS single thread. Multiple instances
 * would need Redis INCR / a distributed lock — that's the documented ceiling,
 * not built here.
 */
export class QuotaManager {
  private states: Record<string, QuotaState> = {};

  constructor(private readonly store: QuotaStore) {}

  /** Load persisted counters so a restart resumes mid-window. */
  async init(): Promise<void> {
    this.states = await this.store.load();
  }

  async persist(): Promise<void> {
    await this.store.save(this.states);
  }

  getState(id: string): QuotaState | undefined {
    return this.states[id];
  }

  private freshState(id: string, now: number): QuotaState {
    return {
      id,
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      requestsToday: 0,
      minuteResetTime: now + MINUTE_MS,
      dayResetTime: now + DAY_MS,
      cooldownUntil: 0,
      consecutiveCooldowns: 0,
      lastError: null,
      lastSuccess: null,
      health: "Healthy",
      requests: 0,
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      tokensUsed: 0,
      cooldownCount: 0,
      rateLimitCount: 0,
      retryCount: 0,
      fallbackCount: 0,
    };
  }

  private ensure(id: string, now: number): QuotaState {
    const existing = this.states[id];
    if (existing) return existing;
    const created = this.freshState(id, now);
    this.states[id] = created;
    return created;
  }

  /** Lazily roll the minute/day windows and clear an expired cooldown. */
  private rollWindows(s: QuotaState, now: number): void {
    if (now >= s.minuteResetTime) {
      s.requestsThisMinute = 0;
      s.tokensThisMinute = 0;
      s.minuteResetTime = now + MINUTE_MS;
    }
    if (now >= s.dayResetTime) {
      s.requestsToday = 0;
      s.dayResetTime = now + DAY_MS;
    }
    if (s.cooldownUntil !== 0 && now >= s.cooldownUntil) {
      s.cooldownUntil = 0;
      if (limitsFor(s.id).enabled) s.health = "Healthy";
      logger.info(`Cooldown finished: ${s.id} available again`);
    }
  }

  /** Would a request of `estTokens` be allowed on this model right now? */
  check(id: string, estTokens: number, now: number = Date.now()): QuotaDecision {
    const s = this.ensure(id, now);
    this.rollWindows(s, now);
    const limits = limitsFor(id);

    if (!limits.enabled) return { allowed: false, reason: "disabled" };
    if (s.cooldownUntil > now) return { allowed: false, reason: "cooling_down" };
    if (s.requestsThisMinute + 1 > limits.rpmLimit) return { allowed: false, reason: "rpm" };
    if (s.tokensThisMinute + estTokens > limits.tpmLimit) return { allowed: false, reason: "tpm" };
    if (s.requestsToday + 1 > limits.rpdLimit) return { allowed: false, reason: "rpd" };
    return { allowed: true };
  }

  /**
   * Walk `ids` in priority order and reserve the first one that passes. The
   * reservation (counter increments) happens here, synchronously, so a
   * concurrent caller sees the consumed quota immediately. Returns null when
   * every model is disabled / cooling / out of quota.
   */
  acquire(ids: string[], estTokens: number, now: number = Date.now()): QuotaLease | null {
    for (const id of ids) {
      const decision = this.check(id, estTokens, now);
      if (!decision.allowed) {
        logger.trace(`Model skipped: ${id} (${decision.reason})`);
        continue;
      }
      const s = this.states[id]!;
      s.requestsThisMinute += 1;
      s.tokensThisMinute += estTokens;
      s.requestsToday += 1;
      s.requests += 1;
      logger.info(`Model selected: ${id} (rpm ${s.requestsThisMinute}/${limitsFor(id).rpmLimit})`);
      return { id, reservedTokens: estTokens };
    }
    logger.warn(`No model available — all disabled/cooling/quota-exhausted`);
    return null;
  }

  /** Settle a lease after a successful response: reconcile tokens + metrics. */
  record(lease: QuotaLease, usage: TokenUsage, latencyMs: number, now: number = Date.now()): void {
    const s = this.ensure(lease.id, now);
    // Reconcile the optimistic reservation with the real token count.
    s.tokensThisMinute = Math.max(0, s.tokensThisMinute - lease.reservedTokens + usage.totalTokens);
    s.tokensUsed += usage.totalTokens;
    s.successes += 1;
    s.totalLatencyMs += latencyMs;
    s.lastSuccess = now;
    s.lastError = null;
    s.consecutiveCooldowns = 0;
    if (s.cooldownUntil === 0) s.health = "Healthy";
  }

  /** A retryable non-429 failure (timeout/5xx/network): count it, no cooldown. */
  failure(id: string, message: string, now: number = Date.now()): void {
    const s = this.ensure(id, now);
    s.failures += 1;
    s.lastError = message;
  }

  /** Put a model into cooldown after a 429/overload. */
  cooldown(id: string, error: ClassifiedError, now: number = Date.now()): number {
    const s = this.ensure(id, now);
    s.failures += 1;
    s.cooldownCount += 1;
    if (error.rateLimited) s.rateLimitCount += 1;

    const backoff = Math.min(
      COOLDOWN.baseMs * COOLDOWN.factor ** s.consecutiveCooldowns,
      COOLDOWN.maxMs,
    );
    const durationMs = error.retryAfterMs ?? backoff;
    s.cooldownUntil = now + durationMs;
    s.consecutiveCooldowns += 1;
    s.health = error.rateLimited ? "RateLimited" : "CoolingDown";
    s.lastError = `HTTP ${error.httpStatus}`;

    logger.warn(`Cooldown started: ${id} for ${Math.round(durationMs / 1000)}s (HTTP ${error.httpStatus})`);
    return durationMs;
  }

  markRetry(id: string, now: number = Date.now()): void {
    this.ensure(id, now).retryCount += 1;
  }

  markFallback(id: string, now: number = Date.now()): void {
    this.ensure(id, now).fallbackCount += 1;
  }

  /** Derived per-model metrics for dashboards/logging. */
  metrics(now: number = Date.now()): ModelMetrics[] {
    return Object.values(this.states).map((s) => {
      this.rollWindows(s, now);
      const limits = limitsFor(s.id);
      const health: HealthStatus = !limits.enabled ? "Disabled" : s.health;
      return {
        id: s.id,
        health,
        requests: s.requests,
        successRate: s.requests ? s.successes / s.requests : 0,
        failureRate: s.requests ? s.failures / s.requests : 0,
        averageLatencyMs: s.successes ? Math.round(s.totalLatencyMs / s.successes) : 0,
        tokensUsed: s.tokensUsed,
        remainingRpm: Math.max(0, limits.rpmLimit - s.requestsThisMinute),
        remainingTpm: Math.max(0, limits.tpmLimit - s.tokensThisMinute),
        remainingRpd: Math.max(0, limits.rpdLimit - s.requestsToday),
        cooldownCount: s.cooldownCount,
        rateLimitCount: s.rateLimitCount,
        retryCount: s.retryCount,
        fallbackCount: s.fallbackCount,
      };
    });
  }
}
