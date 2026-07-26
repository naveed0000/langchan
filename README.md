# langchan — AI-Powered Entrance Exam Platform

Enterprise-grade backend architecture for a JEE/NEET question platform built on
LangChain, TypeScript, PostgreSQL + PGVector, and multiple LLM providers
(Ollama, Gemini, OpenAI, Anthropic). This repository contains the **architecture
scaffold**: folder structure, contracts, and composition wiring. Feature logic
is implemented incrementally on top of these seams.

## Project Overview

The platform ingests source material (textbook PDFs), chunks and embeds it into
PGVector, and uses that indexed content to generate, validate, and deduplicate
exam questions with AI assistance. Every stage — ingestion, retrieval,
generation, validation — is a separate, independently testable unit connected
through explicit interfaces rather than direct imports across layers.

## Technology Stack

| Concern            | Choice                                              |
|--------------------|------------------------------------------------------|
| Language           | TypeScript (strict, ESM)                             |
| AI orchestration   | LangChain (`@langchain/core`, `@langchain/community`)|
| LLM providers      | Ollama (local), Gemini, OpenAI, Anthropic             |
| Embeddings         | Local models + provider-hosted embeddings             |
| Vector storage     | PostgreSQL + PGVector                                 |
| Runtime            | Node.js                                               |
| Testing            | Vitest                                                |

## Folder Structure

```
langchan/
├── app/          composition root: env, config, DI container, server
├── ai/           all LangChain building blocks (chains, retrievers, vectorstores, ...)
├── database/     schema, migrations, seeds, pgvector setup
├── modules/      business domains (auth, users, books, questions, exams, ...)
├── shared/       cross-cutting types/errors/logging used by 2+ layers
├── tests/        test suites, mirroring app/ai/modules structure
├── scripts/      one-off operational scripts (migrate, seed, ingest)
├── storage/      local runtime file storage (uploaded PDFs, cache) — gitignored
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

> The original design brief included an empty top-level `src/`. It was dropped
> here because it held nothing and every real folder already sits at the
> repository root — an empty directory with no purpose is not scaffolding, it's
> noise.

### Folder responsibilities

- **`app/`** — the only place that knows how to *start* the process: reads env,
  builds config, constructs the DI container, boots the HTTP server. Nothing
  else in the repo should read `process.env` directly.
- **`ai/`** — every LangChain primitive, organized by kind (chains, prompts,
  parsers, models, embeddings, vectorstores, loaders, splitters, retrievers,
  memory, documents, templates, callbacks, cache, services, pipelines, utils,
  constants). This is the only layer allowed to import LangChain packages.
- **`database/`** — schema definitions, migrations, seed data, and PGVector
  extension/index setup. No business logic; just structure and DDL.
- **`modules/`** — one folder per business domain. Each module composes `ai/`
  services and `database/` access into use cases; modules do not import each
  other directly.
- **`shared/`** — code needed by two or more of the layers above (shared types,
  error classes, logger). If only one layer needs it, it belongs in that
  layer, not here.
- **`tests/`**, **`scripts/`**, **`storage/`** — supporting concerns: test
  suites, operational one-off scripts, and local runtime file storage.

## Layered Architecture & Dependency Flow

Dependencies only flow downward. A layer may depend on anything below it, never
above it or sideways across siblings at the same level (e.g. `modules/questions`
must not import from `modules/exams`).

```mermaid
graph TD
    App["app/ (bootstrap, server, container)"]
    Modules["modules/ (auth, users, books, questions, exams, ...)"]
    AIServices["ai/services + ai/pipelines"]
    Chains["ai/chains"]
    Retrievers["ai/retrievers"]
    VectorStores["ai/vectorstores"]
    Database["database/"]
    Shared["shared/ (types, errors, logging)"]

    App --> Modules
    Modules --> AIServices
    AIServices --> Chains
    Chains --> Retrievers
    Retrievers --> VectorStores
    VectorStores --> Database

    Shared -.-> App
    Shared -.-> Modules
    Shared -.-> AIServices
```

No circular dependencies are permitted. `shared/` is depended *on*, never
depends on anything above it — that would make it not shared.

## Application Architecture

```mermaid
graph LR
    Client[Client / API Consumer] --> Server[app/server.ts]
    Server --> Container[app/container.ts]
    Container --> AuthModule[modules/auth]
    Container --> QuestionsModule[modules/questions]
    Container --> ExamsModule[modules/exams]
    QuestionsModule --> AIServices[ai/services]
    AIServices --> Chains[ai/chains]
    Chains --> Models[ai/models]
    Chains --> Retrievers[ai/retrievers]
    Retrievers --> VectorStores[ai/vectorstores]
    VectorStores --> Postgres[(PostgreSQL + PGVector)]
    Models --> Providers{Ollama / Gemini / OpenAI / Anthropic}
```

## Data Flow Pipelines

### Document Ingestion Pipeline

PDFs are loaded, split into chunks sized for embedding, embedded, and written
to PGVector alongside metadata (book, chapter, subject) needed for filtered
retrieval later.

```mermaid
flowchart LR
    PDF[PDF Source] --> Loader[ai/loaders]
    Loader --> Splitter[ai/splitters]
    Splitter --> Embeddings[ai/embeddings]
    Embeddings --> VectorStore[ai/vectorstores]
    VectorStore --> PGVector[(PGVector table)]
```

### Embedding Pipeline

```mermaid
flowchart LR
    Chunk[Text Chunk] --> Provider{Local model / OpenAI / Gemini}
    Provider --> Vector[Embedding Vector]
    Vector --> Store[(pgvector column)]
```

### Retriever Pipeline

```mermaid
flowchart LR
    Query[Query Text] --> EmbedQuery[ai/embeddings]
    EmbedQuery --> Search[Similarity Search]
    Search --> PGVector[(PGVector)]
    PGVector --> TopK[Top-K Documents]
    TopK --> Context[Context for Chain]
```

### Question Generation Pipeline

```mermaid
flowchart TD
    Topic[Topic + Retrieved Context] --> Prompt[ai/prompts]
    Prompt --> Model[ai/models]
    Model --> Parser[ai/parsers]
    Parser --> QGChain[question-generation.chain]
    QGChain --> DupCheck[duplicate-check.chain]
    DupCheck -->|unique| Validation[validation.chain]
    DupCheck -->|duplicate| Reject[Reject]
    Validation -->|pass| Store[(questions table)]
    Validation -->|fail| Review[Human Review Queue]
```

### Duplicate Detection Pipeline

```mermaid
flowchart LR
    NewQuestion[New Question] --> Embed[ai/embeddings]
    Embed --> Compare[Similarity Search vs Existing Question Vectors]
    Compare --> Threshold{Similarity > threshold?}
    Threshold -->|yes| Flag[Flag as Duplicate]
    Threshold -->|no| Accept[Accept as Unique]
```

### Validation Pipeline

```mermaid
flowchart LR
    Draft[Draft Question] --> Checks[validation.chain: correctness, difficulty, clarity]
    Checks -->|pass| Approved[Auto-Approved]
    Checks -->|borderline| Human[Human Review]
    Checks -->|fail| Rejected[Rejected]
```

## Caching Strategy

`ai/cache/` holds LLM response caching (exact-match and semantic) so repeated
prompts — common during question review/regeneration — don't re-pay model
latency or cost. Cache keys should include model name, prompt hash, and
temperature so cached results stay correct across provider/parameter changes.

## Logging Strategy

Logging is a `shared/` concern: a single logger instance is constructed once in
`app/container.ts` and injected wherever needed. `ai/callbacks/` hooks into
LangChain's callback system to log token usage, latency, and chain
start/end/error events without instrumenting every chain by hand.

## Testing Strategy

`tests/` mirrors the source tree (`tests/ai/chains/...`, `tests/modules/...`).
Chains and services are tested against interfaces with fake/stub model and
vector-store implementations — real provider calls and a real Postgres
instance are reserved for integration tests, kept separate from unit tests so
the default `test` script stays fast and offline.

## Development Workflow

1. Copy `.env.example` to `.env` and fill in provider keys / `DATABASE_URL`.
2. `docker compose up -d` to start Postgres (with PGVector) and Ollama.
3. `npm run dev` to boot the server with hot reload.
4. `npm run typecheck` and `npm test` before opening a PR.

## Naming Conventions

- Files: `kebab-case`, suffixed by role — `question-generation.chain.ts`,
  `pgvector.store.ts`, `openai.embeddings.ts`.
- Classes/interfaces: `PascalCase`. Chain classes end in `Chain`, stores end in
  `Store`, services end in `Service`.
- Every non-trivial directory exposes its public surface through `index.ts`;
  import from the folder, not the file (`@ai/chains`, not
  `@ai/chains/question-generation.chain`).

## Coding Standards

SOLID, DRY, KISS, composition over inheritance, dependency injection through
constructor parameters (no service-locator globals), strict TypeScript
(`strict: true`, no implicit `any`), ESM throughout.

## Contribution Guidelines

- Respect the dependency flow above — if a PR introduces an upward or sideways
  import, that's a design smell to fix before merging, not to silence.
- New LangChain primitives go in the matching `ai/` subfolder and get
  re-exported from its `index.ts`.
- New business domains get their own `modules/<name>/` folder rather than
  growing an existing one to cover unrelated concerns.

## Future Improvements

- Add a semantic cache backend in `ai/cache/` once real usage patterns justify
  the extra moving part.
- Add streaming responses for question generation once the UI can consume
  them.
- Add a hybrid (lexical + vector) retriever in `ai/retrievers/` if pure
  similarity search proves insufficient for exam-terminology queries.
