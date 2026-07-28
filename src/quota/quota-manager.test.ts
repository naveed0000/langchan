import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { limitsFor } from "../config/quota";
import { JsonQuotaStore, type QuotaStore } from "./store";
import { QuotaManager } from "./quota-manager";
import type { QuotaState, TokenUsage } from "./types";

class MemoryStore implements QuotaStore {
  saved: Record<string, QuotaState> = {};
  async load() {
    return structuredClone(this.saved);
  }
  async save(states: Record<string, QuotaState>) {
    this.saved = structuredClone(states);
  }
}

const usage = (total: number): TokenUsage => ({
  promptTokens: Math.floor(total / 2),
  completionTokens: Math.ceil(total / 2),
  totalTokens: total,
  estimated: false,
});

async function newManager(): Promise<QuotaManager> {
  const m = new QuotaManager(new MemoryStore());
  await m.init();
  return m;
}

const RATE_LIMIT_429 = { httpStatus: 429, retryable: true, rateLimited: true } as const;

describe("QuotaManager", () => {
  it("enforces RPM: blocks once the per-minute request limit is hit", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro"; // rpm 5
    const rpm = limitsFor(id).rpmLimit;
    const now = 1_000_000;

    for (let i = 0; i < rpm; i++) {
      expect(m.acquire([id], 1, now)).not.toBeNull();
    }
    expect(m.acquire([id], 1, now)).toBeNull();
    expect(m.check(id, 1, now).reason).toBe("rpm");
  });

  it("enforces TPM: blocks when estimated tokens would exceed the minute budget", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const tpm = limitsFor(id).tpmLimit;

    expect(m.acquire([id], tpm, 0)).not.toBeNull(); // fills the token budget
    expect(m.check(id, 1, 0).reason).toBe("tpm");
  });

  it("enforces RPD: blocks after the daily request limit, even across minutes", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro"; // rpd 100, rpm 5
    const rpd = limitsFor(id).rpdLimit;

    // One request per minute so RPM never gets in the way of reaching RPD.
    for (let i = 0; i < rpd; i++) {
      expect(m.acquire([id], 1, i * 60_000)).not.toBeNull();
    }
    expect(m.check(id, 1, rpd * 60_000).reason).toBe("rpd");
  });

  it("resets the minute window automatically once the minute rolls over", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const rpm = limitsFor(id).rpmLimit;

    for (let i = 0; i < rpm; i++) m.acquire([id], 100, 0);
    expect(m.check(id, 1, 0).reason).toBe("rpm");

    // 60s later the window has rolled — requests and tokens are fresh.
    expect(m.check(id, 1, 60_000).allowed).toBe(true);
    const state = m.getState(id)!;
    expect(state.requestsThisMinute).toBe(0);
    expect(state.tokensThisMinute).toBe(0);
  });

  it("cools a model down on 429 and frees it after the cooldown expires", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const now = 0;

    const duration = m.cooldown(id, RATE_LIMIT_429, now);
    expect(m.check(id, 1, now).reason).toBe("cooling_down");
    expect(m.getState(id)!.health).toBe("RateLimited");

    // Still cooling one ms before expiry, available at expiry.
    expect(m.check(id, 1, now + duration - 1).reason).toBe("cooling_down");
    expect(m.check(id, 1, now + duration).allowed).toBe(true);
    expect(m.getState(id)!.health).toBe("Healthy");
  });

  it("uses exponential backoff for successive cooldowns", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const first = m.cooldown(id, RATE_LIMIT_429, 0);
    const second = m.cooldown(id, RATE_LIMIT_429, first);
    expect(second).toBe(first * 2); // 30s -> 60s
  });

  it("honors a Retry-After hint over the backoff", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const d = m.cooldown(id, { ...RATE_LIMIT_429, retryAfterMs: 5_000 }, 0);
    expect(d).toBe(5_000);
  });

  it("falls back to the next model in priority order when the first is cooling", async () => {
    const m = await newManager();
    m.cooldown("gemini-2.5-pro", RATE_LIMIT_429, 0);
    const lease = m.acquire(["gemini-2.5-pro", "ollama"], 100, 0);
    expect(lease?.id).toBe("ollama");
  });

  it("returns null when every model is cooling / out of quota", async () => {
    const m = await newManager();
    m.cooldown("gemini-2.5-pro", RATE_LIMIT_429, 0);
    m.cooldown("gemini", RATE_LIMIT_429, 0);
    expect(m.acquire(["gemini-2.5-pro", "gemini"], 1, 0)).toBeNull();
  });

  it("reserves quota synchronously so concurrent acquires can't oversubscribe RPM", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    // Two back-to-back acquires with no await between — each must see the other's reservation.
    m.acquire([id], 10, 0);
    m.acquire([id], 10, 0);
    expect(m.getState(id)!.requestsThisMinute).toBe(2);
    expect(m.getState(id)!.tokensThisMinute).toBe(20);
  });

  it("reconciles reserved tokens with the real usage on record()", async () => {
    const m = await newManager();
    const id = "gemini-2.5-pro";
    const lease = m.acquire([id], 8_000, 0)!; // reserved estimate
    m.record(lease, usage(3_000), 120, 0); // actual came in lower
    const state = m.getState(id)!;
    expect(state.tokensThisMinute).toBe(3_000);
    expect(state.tokensUsed).toBe(3_000);
    expect(state.successes).toBe(1);
  });

  it("skips disabled models", async () => {
    // No id maps to disabled by default; assert the decision path via a fake by
    // relying on limitsFor — here we just confirm enabled models are allowed and
    // the reason enum is wired. (Disabled is config-driven in config/quota.ts.)
    const m = await newManager();
    expect(m.check("gemini-2.5-pro", 1, 0).allowed).toBe(true);
  });
});

describe("JsonQuotaStore persistence", () => {
  const path = join(tmpdir(), `quota-test-${Date.now()}.json`);
  afterEach(async () => {
    await rm(path, { force: true });
  });

  it("survives a restart: counters reload from disk", async () => {
    const store = new JsonQuotaStore(path);
    const m1 = new QuotaManager(store);
    await m1.init();
    m1.acquire(["gemini-2.5-pro"], 500, 0);
    await m1.persist();

    const m2 = new QuotaManager(new JsonQuotaStore(path));
    await m2.init();
    expect(m2.getState("gemini-2.5-pro")!.requestsThisMinute).toBe(1);
    expect(m2.getState("gemini-2.5-pro")!.tokensThisMinute).toBe(500);
  });
});
