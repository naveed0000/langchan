You are a Senior AI Engineer and LangChain TypeScript expert.

Build a minimal, production-ready LangChain project using TypeScript.

The goal is to verify the complete AI pipeline works from the terminal before adding RAG or business logic.

==================================================
TECH STACK
==================================================

- TypeScript
- Node.js
- LangChain
- PostgreSQL
- PGVector
- Gemini 2.5
- Ollama
- dotenv

==================================================
LLM CONFIGURATION
==================================================

Primary Provider

Gemini 2.5

Authentication

Google AI Studio API Key

Environment Variable

GEMINI_API_KEY=

==================================================
Fallback Provider

Ollama

Installed Models

qwen3:8b

embeddinggemma:latest

Base URL

http://localhost:11434

==================================================
DATABASE
==================================================

PostgreSQL

Database Name

test_series_db

Create a reusable PostgreSQL connection.

==================================================
PROJECT GOAL
==================================================

Create a very small LangChain workflow.

The application should:

Start

↓

Load Environment Variables

↓

Initialize PostgreSQL

↓

Initialize Gemini

↓

If Gemini fails because:

• quota exceeded
• rate limit
• API exhausted
• 429
• 503
• unavailable

Automatically switch to Ollama qwen3:8b

↓

Send prompt

↓

Receive response

↓

Print response in terminal

↓

Exit

==================================================
EMBEDDINGS
==================================================

Use

embeddinggemma

through Ollama.

Create a simple embedding example.

Print embedding dimensions.

==================================================
DATABASE TEST
==================================================

Connect to PostgreSQL

Database

test_series_db

Run

SELECT NOW();

Print successful connection.

==================================================
LANGCHAIN
==================================================

Do NOT build RAG.

Do NOT build agents.

Do NOT build chains with multiple steps.

Only create a simple prompt pipeline.

Example

Human Message

↓

LLM

↓

Terminal Output

==================================================
FOLDER STRUCTURE
==================================================

Create only the necessary folders.

Example

src/

app/

config/

database/

models/

embeddings/

services/

utils/

==================================================
FILES
==================================================

Implement

bootstrap.ts

env.ts

postgres.ts

gemini.ts

ollama.ts

embedding.ts

llm.factory.ts

main.ts

==================================================
LLM FACTORY
==================================================

Create one reusable LLM Factory.

Logic

Try Gemini first.

If successful

return Gemini.

If Gemini throws

429

Quota exceeded

API exhausted

Rate limit

Network error

Provider unavailable

Automatically instantiate

Ollama qwen3:8b

Return Ollama instead.

The application should continue running without crashing.

Print

Using Gemini 2.5

or

Gemini unavailable

Switching to Ollama...

Using qwen3:8b

==================================================
TERMINAL OUTPUT
==================================================

Expected output

✓ Environment Loaded

✓ PostgreSQL Connected

✓ Gemini Initialized

(or)

⚠ Gemini unavailable

✓ Ollama Connected

✓ Embedding Model Loaded

Sending Prompt...

Model Response

Hello...

==================================================
README
==================================================

Generate a README explaining

Installation

Dependencies

Environment Variables

How to run

How fallback works

How PostgreSQL connects

How Ollama connects

How Gemini connects

Troubleshooting

==================================================
QUALITY
==================================================

Keep everything simple.

Avoid unnecessary abstractions.

Avoid complex LangChain patterns.

Avoid agents.

Avoid RAG.

Avoid LangGraph.

The project should be understandable by a beginner while following clean architecture and best practices.

The final project must compile and run with:

npm install

npm run dev

and produce output directly in the terminal.