# Master Prompt — Implement a Production-Grade LLM Quota & Rate Limit Manager

You are a senior backend architect.

Design and implement a production-ready LLM Quota Manager responsible for selecting the best available model while respecting provider rate limits and automatically failing over when limits are reached.

The implementation must be modular, testable, and provider-agnostic.

---

## Objective

Implement a quota-aware model scheduler that:

- Prevents RPM violations.
- Prevents TPM violations.
- Prevents RPD violations.
- Supports multiple providers.
- Automatically falls back to the next available model.
- Recovers automatically after cooldown.
- Supports future providers without code duplication.

The system must work for:

- Gemini
- OpenAI
- Ollama
- Any future provider

---

# Model Registry

Models are configured in priority order.

Example:

```ts
export const MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini",
    "ollama"
];
```

The scheduler always starts from the highest priority model.

---

# Every model must contain

Each model should expose metadata.

Example

```
id
provider
priority
rpmLimit
tpmLimit
rpdLimit
enabled
supportsStreaming
supportsThinking
maxContext
maxOutput
```

The scheduler must never hardcode limits.

Everything should come from configuration.

---

# Quota Manager

Create a dedicated Quota Manager.

Responsibilities

- Track requests per minute
- Track tokens per minute
- Track requests per day
- Reset counters automatically
- Calculate remaining quota
- Decide whether a request can execute

The rest of the application must never directly manipulate quota counters.

---

# Quota State

Maintain runtime state for every model.

Track

- requestsThisMinute
- tokensThisMinute
- requestsToday
- minuteResetTime
- dayResetTime
- cooldownUntil
- lastError
- lastSuccess
- healthStatus

---

# Before Every Request

Estimate

Prompt Tokens

+

Expected Output Tokens

=

Estimated Total Tokens

Before selecting a model verify

RPM

CurrentRequests + 1 <= RPM Limit

TPM

CurrentTokens + EstimatedTokens <= TPM Limit

RPD

CurrentDailyRequests + 1 <= RPD Limit

If any check fails

Skip model

Move to next model

Never send the request.

---

# After Successful Response

Update

requestsThisMinute

tokensThisMinute

requestsToday

Store

actual prompt tokens

actual completion tokens

actual total tokens

Never rely only on estimation after the response.

---

# Automatic Reset

Minute counters

Automatically reset every minute.

Daily counters

Automatically reset every day.

Do not require restarting the application.

---

# Cooldown

If a provider returns

429

Place the model into cooldown.

Cooldown duration should use

Retry-After header

if available.

Otherwise

Use exponential backoff.

Example

30 sec

60 sec

120 sec

240 sec

Do not permanently disable the model.

After cooldown expires

Model becomes available automatically.

---

# Scheduler

Implement a scheduler.

Algorithm

For every request

Sort models by priority

For each model

Skip disabled models

Skip cooldown models

Reset counters if needed

Check RPM

Check TPM

Check RPD

If allowed

Send request

If successful

Return immediately

If timeout

Try next model

If network error

Try next model

If HTTP 429

Cooldown

Try next model

If HTTP 500

Retry limited times

Then move next

If no cloud model succeeds

Fallback to Ollama

If Ollama also fails

Return meaningful error.

---

# Token Accounting

Use actual provider usage whenever available.

Store

Prompt Tokens

Completion Tokens

Total Tokens

Do not estimate after receiving a response.

---

# Health Monitoring

Each model should expose health.

Healthy

CoolingDown

Disabled

Unavailable

RateLimited

Offline

The scheduler should ignore unhealthy models.

---

# Concurrency

Support multiple simultaneous requests.

Quota updates must be thread-safe.

Avoid race conditions.

If multiple workers exist

Use atomic operations.

Prefer Redis for distributed deployments.

Single instance may use in-memory storage.

---

# Persistence

Quota state should survive restarts.

Support

JSON

SQLite

Redis

Implementation should allow replacing the storage engine without changing business logic.

---

# Error Categories

Retryable

429

500

502

503

504

Timeout

Connection Reset

Network Failure

Non Retryable

400

401

403

404

Validation Error

Malformed Request

Authentication Failure

Do not retry non-retryable errors.

---

# Logging

Log every decision.

Examples

Model Selected

Model Skipped

RPM Exceeded

TPM Exceeded

RPD Exceeded

Cooldown Started

Cooldown Finished

Fallback Triggered

Retry Started

Retry Completed

Provider Error

Token Usage

Execution Time

---

# Metrics

Expose metrics.

Per model

Requests

Success Rate

Failure Rate

Average Latency

Tokens Used

Remaining RPM

Remaining TPM

Remaining RPD

Cooldown Count

429 Count

Retry Count

Fallback Count

---

# Extensibility

The architecture must follow SOLID principles.

Adding a new provider should require only

1.

Register model

2.

Implement provider adapter

No scheduler changes.

---

# Directory Structure

Recommend a scalable folder structure.

Example

models/

providers/

quota/

scheduler/

storage/

metrics/

logging/

config/

interfaces/

utils/

tests/

---

# Testing

Provide unit tests for

RPM validation

TPM validation

RPD validation

Cooldown

Fallback

Retry

Counter reset

Concurrent requests

Storage persistence

---

# Deliverables

Generate

- Folder structure
- Architecture diagram
- Interfaces
- Class responsibilities
- Data flow
- Sequence diagram
- Scheduler algorithm
- Quota Manager design
- Retry strategy
- Cooldown strategy
- Persistence strategy
- Configuration examples
- Sample state schema
- Error handling strategy
- Testing strategy
- Best practices
- Future improvements

---

# Requirements

- Production-ready architecture
- Clean Architecture
- SOLID principles
- Dependency Injection
- Strong typing
- No duplicated logic
- Highly extensible
- Provider agnostic
- Easy to maintain
- Well documented
- Optimised for high throughput
- Safe for concurrent execution
- Easy to add future LLM providers
