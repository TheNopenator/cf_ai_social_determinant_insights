# PROMPTS.md

# Overview

This document records representative prompts used while developing the cf_ai_social_determinant_insights project.

AI assistance was used as a development aid to support architectural decisions, Cloudflare Workers best practices, Durable Object state modeling, LLM prompt design, and frontend UX planning.

All system design decisions, implementation details, and code were reviewed, adapted, and owned by me.

# 1. Project Setup & Cloudflare Architecture

AI was used to clarify Cloudflare-specific project setup choices and best practices.

Representative prompts:

- In which directory should I create a new Cloudflare application with npm create?

- Which template should I pick during npm create?

- Can you help me adjust the Wrangler file so that config has a compatibility date?

# 2. Durable Object Memory & State Modeling

AI was used to reason about Durable Object patterns and how to persist structured conversational state.

Representative prompts:

- How can I implement Durable Object Memory, which should store context like risk factors, previous questions, and generated insight?

- Where should I specifically store structured, queryable JSON? In memory.ts?

- Is my preliminary implementation of Durable Object Memory correct? It should store information like user risk factors, generated insights, and previous questions.

- There are currently some exceptions in worker-configuration.d.ts. Can you help me reconcile those with other files?

# 3. Worker Routing & Orchestration Logic

AI assistance supported the design of API routes and orchestration logic across Workers and Durable Objects.

Representative prompts:

- Can you help me implement worker routes and the orchestration logic?

  - POST /chat (main conversational endpoint)

  - POST /risk (enter numeric risk factors)

  - GET /context (return current Durable Object state)

  - GET /analytics (admin analytics view)

# 4. LLM Prompt Engineering & Workers AI Integration

AI was used to help structure a responsible and context-aware system prompt and integrate Llama 3.1 8B via Workers AI.

Representative prompts:

- Here is an example prompt that should be given as context to the agent:

  - SYSTEM:
    - You are a medical insight assistant specializing in social determinants of health. Use the user’s history and risk context when responding. Always be clear, explain mechanisms, and avoid giving medical advice.

- Help me integrate Llama 3.1 8B into Workers AI with the prompt above and a max token count of 300.

- This prompt should include the user's question, the last Durable Object summary, the risk factors dictionary, and a brief summary of the chat history.

# 5. Analytics & Observability

AI assistance was used to design lightweight analytics logging using Cloudflare KV.

Representative prompts:

- The next steps is to log analytics using KV, and this should be included in the GET /analytics route, which displays JSON stats.

# 6. Frontend UI Architecture (Cloudflare Pages)

AI was used to ideate and plan a frontend chat interface focused on usability and clarity.

Representative prompts:

- Help me architect the frontend chat UI using Cloudflare Pages:

  - Two-panel layout

  - Auto-scrolling chat window

  - User and assistant message bubbles

  - Quick reply suggestions

  - Session cookies for continuity

# Closing Note

These prompts reflect how AI was used as a collaborative development tool throughout the project.

All architectural choices, ethical considerations (especially for health-related insights), and final implementations were driven by human judgment, with AI providing guidance, iteration support, and clarification where helpful.
