# MASTER PROMPT — Design an Enterprise LangChain Folder Structure

You are a Principal AI Architect, Senior Software Engineer, LangChain Expert, TypeScript Architect, and Technical Documentation Writer.

Your objective is to design and scaffold an enterprise-grade LangChain project suitable for production.

The project is intended for an AI-powered entrance examination platform (JEE/NEET) supporting:

- Retrieval-Augmented Generation (RAG)
- PostgreSQL
- PGVector
- LangChain
- TypeScript
- Ollama
- Gemini
- OpenAI
- Anthropic
- Local embedding models
- PDF ingestion
- Question generation
- Duplicate detection
- Semantic retrieval
- Validation pipelines
- AI explanations

Do NOT build the application logic.

Instead, design the complete project architecture.

==================================================
OUTPUT REQUIREMENTS
==================================================

Your output must include ALL of the following.

1. High-level architecture overview.

2. Complete project folder structure.

3. Every folder explained.

4. Every file explained.

5. Generate placeholder TypeScript files.

6. Generate README.md files.

7. Generate barrel exports (index.ts).

8. Follow enterprise architecture.

9. Use dependency injection principles.

10. Use strict TypeScript.

==================================================
PROJECT TREE
==================================================

Generate the following project tree exactly.

```text
langchain-rag-platform/
│
├── src/
│
├── app/
│   ├── bootstrap.ts
│   ├── server.ts
│   ├── container.ts
│   ├── config.ts
│   └── env.ts
│
├── ai/
│
│   ├── chains/
│   │   ├── question-generation.chain.ts
│   │   ├── explanation.chain.ts
│   │   ├── validation.chain.ts
│   │   ├── duplicate-check.chain.ts
│   │   ├── difficulty-analysis.chain.ts
│   │   ├── topic-analysis.chain.ts
│   │   ├── answer-generation.chain.ts
│   │   └── index.ts
│   │
│   ├── prompts/
│   │
│   ├── parsers/
│   │
│   ├── models/
│   │
│   ├── embeddings/
│   │
│   ├── vectorstores/
│   │
│   ├── loaders/
│   │
│   ├── splitters/
│   │
│   ├── retrievers/
│   │
│   ├── memory/
│   │
│   ├── documents/
│   │
│   ├── templates/
│   │
│   ├── callbacks/
│   │
│   ├── cache/
│   │
│   ├── services/
│   │
│   ├── pipelines/
│   │
│   ├── utils/
│   │
│   ├── constants/
│   │
│   └── index.ts
│
├── database/
│   ├── migrations/
│   ├── schema/
│   ├── seeds/
│   └── pgvector/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── books/
│   ├── chapters/
│   ├── subjects/
│   ├── questions/
│   ├── exams/
│   └── analytics/
│
├── shared/
│
├── tests/
│
├── scripts/
│
├── storage/
│
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── README.md
```

==================================================
ROOT README
==================================================

Generate a professional README containing:

Project Overview

Architecture

Technology Stack

Folder Structure

Layered Architecture

Dependency Flow

Data Flow

Document Ingestion Pipeline

Embedding Pipeline

Retriever Pipeline

Question Generation Pipeline

Duplicate Detection Pipeline

Validation Pipeline

Caching Strategy

Logging Strategy

Testing Strategy

Development Workflow

Naming Conventions

Coding Standards

Contribution Guidelines

Future Improvements

==================================================
EVERY FOLDER MUST CONTAIN README
==================================================

Every folder must contain a README.md.

Each README must explain:

Purpose

Responsibilities

Why this folder exists

What belongs inside

What should NEVER be placed inside

Dependencies

Workflow

Example Usage

Best Practices

Common Mistakes

==================================================
EVERY TYPESCRIPT FILE
==================================================

Every TypeScript file should contain:

• file header

• responsibility

• architecture notes

• exported interface

• exported class

• TODO comments

• JSDoc documentation

==================================================
INDEX FILES
==================================================

Every directory should expose public members through index.ts.

Avoid deep imports.

==================================================
DEPENDENCY RULES
==================================================

Explain which folders may depend on others.

Example:

app
↓

modules

↓

ai services

↓

chains

↓

retrievers

↓

vectorstores

↓

database

No circular dependencies.

==================================================
ARCHITECTURE DIAGRAMS
==================================================

Generate Mermaid diagrams for:

Application Architecture

Folder Dependencies

LangChain Workflow

Document Ingestion

Embedding Flow

Retriever Flow

Question Generation Flow

Duplicate Detection

Validation Pipeline

==================================================
CODE STYLE
==================================================

Use:

SOLID

DRY

KISS

Composition over inheritance

Dependency Injection

Barrel exports

Feature isolation

Strict typing

ESM

==================================================
QUALITY
==================================================

The repository should resemble code maintained by:

OpenAI

Google

Anthropic

Stripe

Netflix

Microsoft

Every explanation should teach WHY the folder exists, not only WHAT it contains.

Avoid placeholder text such as:

"Coming soon"

"Lorem ipsum"

"TODO later"

Provide meaningful architectural guidance.

==================================================
FINAL OUTPUT
==================================================

Produce a complete repository scaffold.

Every folder should exist.

Every README should be complete.

Every TypeScript file should compile.

The resulting project should be suitable as the foundation of a production-scale LangChain application. 