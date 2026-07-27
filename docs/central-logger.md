Refactor the entire logging system into a single centralized console logger.

Current Situation
- Remove the existing JSONL/file-based logging architecture.
- Remove appendJsonLine().
- Remove log-writer.ts.
- Remove api.log.ts.
- Remove provider.log.ts.
- Remove retry.log.ts.
- Remove validation.log.ts.
- Remove worker.log.ts.
- Remove error.json.ts.
- Remove every append-only JSON log implementation. The current implementation writes to files through appendJsonLine(). :contentReference[oaicite:0]{index=0}
- Existing log wrappers only wrap appendJsonLine() and should be replaced by a centralized logger. :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}

Goal

Create one centralized logger.

Example folder

src/
 └── logger/
      logger.ts

No other logger files should exist.

The logger must expose methods such as

logger.info(...)
logger.success(...)
logger.warn(...)
logger.error(...)
logger.api(...)
logger.retry(...)
logger.provider(...)
logger.validation(...)
logger.worker(...)
logger.checkpoint(...)
logger.debug(...)

Requirements

1. Every log should be printed only to the console.

2. Do not write anything to files.

3. Remove every filesystem dependency.

4. Remove appendFile, mkdir, writeFile usage.

5. Remove JSONL logging.

6. Remove storage/logs directory usage.

7. Remove storage/error.json snapshot logic. :contentReference[oaicite:4]{index=4}

8. Use colors.

Example

INFO
SUCCESS
WARNING
ERROR
API
RETRY
PROVIDER
WORKER
VALIDATION
CHECKPOINT

Each should have its own color.

9. Every log should contain

Timestamp
Execution ID
Worker ID (if available)
Provider
Model
Batch
Current State
Message

10. Console output should be human readable.

Example

────────────────────────────────────────────
✓ API SUCCESS
Time      : 2026-07-27 10:21:15
Provider  : Gemini
Model     : gemini-3.5-flash-lite
Worker    : #2
Batch     : BATCH-12
Latency   : 1842 ms
Tokens    : 3250
Questions : 8
Status    : SUCCESS
────────────────────────────────────────────

11. Error logs should display

Error Type
Status Code
Retryable
Stack (only in development)
Retry Count
Fallback Provider

12. Provider switch should display

Gemini 3.5 Flash Lite
        ↓
Gemini 3.1 Flash Lite

Reason:
429 Rate Limit

13. Validation logs should show

Question ID
Validator
Passed/Failed
Failed checks

14. Worker logs should show

Worker Number
Current Batch
Completed
Failed
Average Time

15. Checkpoint logs should show

Current Category
Chapter
Topic
Generated Questions
API Calls
Execution Progress

16. Logger must automatically detect

NODE_ENV

Development

Verbose logging

Production

Compact logging

17. Add log levels

TRACE
DEBUG
INFO
SUCCESS
WARN
ERROR

18. Logger should support enabling/disabling debug logs through configuration.

19. Replace every existing

logApiCall(...)
logRetry(...)
logWorkerStatus(...)
logProviderSwitch(...)
logValidation(...)
writeLatestErrorSnapshot(...)

with

logger.api(...)
logger.retry(...)
logger.worker(...)
logger.provider(...)
logger.validation(...)
logger.error(...)

20. Do not change any business logic.

Only replace the logging layer.

21. Preserve all existing TypeScript types/interfaces where possible (ApiLogEntry, RetryLogEntry, ProviderLogEntry, WorkerLogEntry, ValidationLogEntry, ErrorLogEntry, CheckpointLogEntry) so existing callers only need to change the logging function, not the data shape. :contentReference[oaicite:5]{index=5}

Expected Result

One logger.ts file.

No duplicated logger wrappers.

No file-based logging.

No JSONL.

Easy to read colored console output.

Centralized logging architecture.

Simple API

logger.info()
logger.success()
logger.warn()
logger.error()
logger.api()
logger.retry()
logger.provider()
logger.validation()
logger.worker()
logger.checkpoint()