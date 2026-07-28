/**
 * Provider-agnostic error classification. LangChain surfaces provider HTTP
 * errors inconsistently (status on the error, in `response`, or only in the
 * message string), so we probe all three and fall back to string matching.
 */

export interface ClassifiedError {
  httpStatus: number;
  retryable: boolean;
  /** True for HTTP 429 / quota / rate-limit — the model should go into cooldown. */
  rateLimited: boolean;
  /** Cooldown hint from a Retry-After header, in ms; undefined = use backoff. */
  retryAfterMs?: number;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 422]);

const RATE_LIMIT_SIGNALS = ["429", "quota", "rate limit", "resource_exhausted", "too many requests"];
const RETRYABLE_SIGNALS = [
  "500", "502", "503", "504",
  "unavailable", "overloaded", "timeout", "timed out",
  "econnreset", "econnrefused", "etimedout", "network", "fetch failed", "socket hang up",
];
const NON_RETRYABLE_SIGNALS = ["400", "401", "403", "404", "invalid api key", "permission", "authentication", "malformed"];

function statusOf(error: unknown): number {
  const e = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return e?.status ?? e?.statusCode ?? e?.response?.status ?? 0;
}

function retryAfterOf(error: unknown): number | undefined {
  const headers = (error as { response?: { headers?: Record<string, string | string[]> } })?.response?.headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export function classifyError(error: unknown): ClassifiedError {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = statusOf(error);
  const retryAfterMs = retryAfterOf(error);

  const retryAfter = retryAfterMs !== undefined ? { retryAfterMs } : {};

  const rateLimited =
    status === 429 || RATE_LIMIT_SIGNALS.some((s) => message.includes(s));
  if (rateLimited) return { httpStatus: status || 429, retryable: true, rateLimited: true, ...retryAfter };

  if (NON_RETRYABLE_STATUS.has(status) || NON_RETRYABLE_SIGNALS.some((s) => message.includes(s))) {
    return { httpStatus: status, retryable: false, rateLimited: false };
  }

  if (RETRYABLE_STATUS.has(status) || RETRYABLE_SIGNALS.some((s) => message.includes(s))) {
    return { httpStatus: status, retryable: true, rateLimited: false, ...retryAfter };
  }

  // Unknown: treat as non-retryable so we don't burn retries on real bugs.
  return { httpStatus: status, retryable: false, rateLimited: false };
}
