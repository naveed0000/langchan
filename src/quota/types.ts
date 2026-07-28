/** Health as the scheduler sees it — unhealthy models are skipped at selection. */
export type HealthStatus =
  | "Healthy"
  | "CoolingDown"
  | "Disabled"
  | "RateLimited"
  | "Offline";

/** Actual token usage pulled from the provider response (never estimated). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** True when the provider gave no usage_metadata and we fell back to an estimate. */
  estimated: boolean;
}

/**
 * Runtime quota state for one model. Counters + reset windows + cooldown, plus
 * cumulative metrics counters. Persisted so a restart resumes mid-window
 * instead of granting a fresh quota.
 */
export interface QuotaState {
  id: string;
  requestsThisMinute: number;
  tokensThisMinute: number;
  requestsToday: number;
  /** Epoch ms at which the minute window rolls over. */
  minuteResetTime: number;
  /** Epoch ms at which the daily window rolls over. */
  dayResetTime: number;
  /** Epoch ms until which the model is in cooldown; 0 = available. */
  cooldownUntil: number;
  /** Drives exponential backoff; reset to 0 on a success. */
  consecutiveCooldowns: number;
  lastError: string | null;
  /** Epoch ms of last successful response. */
  lastSuccess: number | null;
  health: HealthStatus;

  // cumulative metrics (never reset by the minute/day windows)
  requests: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  tokensUsed: number;
  cooldownCount: number;
  rateLimitCount: number;
  retryCount: number;
  fallbackCount: number;
}

export type SkipReason = "disabled" | "cooling_down" | "rpm" | "tpm" | "rpd";

export interface QuotaDecision {
  allowed: boolean;
  reason?: SkipReason;
}

/** Returned by acquire(): a reservation the worker settles via record/cooldown. */
export interface QuotaLease {
  id: string;
  /** Tokens optimistically reserved at acquire time; reconciled in record(). */
  reservedTokens: number;
}

/** Per-model view for dashboards/metrics — derived, not stored. */
export interface ModelMetrics {
  id: string;
  health: HealthStatus;
  requests: number;
  successRate: number;
  failureRate: number;
  averageLatencyMs: number;
  tokensUsed: number;
  remainingRpm: number;
  remainingTpm: number;
  remainingRpd: number;
  cooldownCount: number;
  rateLimitCount: number;
  retryCount: number;
  fallbackCount: number;
}
