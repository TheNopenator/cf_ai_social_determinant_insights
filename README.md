# cf_ai_social_determinant_insights

An AI-powered conversational application that helps users explore how social determinants of health (SDoH) influence health outcomes over time. The system maintains long-term, user-specific context and adapts its responses based on prior interactions, using Cloudflare’s stateful edge primitives.

This project was built to demonstrate how modern LLMs, distributed systems, and persistent state can be combined to create context-aware, responsible AI applications, especially in sensitive domains like public health.

# Project Summary

Social determinants of health, such as housing stability, food access, discrimination, and social support, play a critical role in shaping health outcomes, yet they are often discussed in abstract or one-size-fits-all terms.

This application provides:

- A conversational interface for asking questions about social risk factors and health

- Persistent memory that remembers user context across sessions

- Adaptive explanations that evolve as the system learns what the user has already discussed

- A clear boundary between educational insights and medical advice

Rather than offering diagnoses, the system focuses on explaining relationships, trends, and context, encouraging informed discussion rather than prescriptive conclusions.

# Architecture Overview

```
        ┌──────────────┐
        │  Web Client  │  (Cloudflare Pages)
        │  (Chat UI)   │
        └──────┬───────┘
               │ HTTP (JSON)
               ▼
        ┌─────────────────────────┐
        │ Cloudflare Worker       |
        │ - Request validation    │
        │ - Prompt construction   │
        │ - LLM orchestration     │
        └──────┬──────────────────┘
               │ Durable Object stub
               ▼
        ┌──────────────────────────┐
        │ Durable Object (Memory)  │
        │ - User-specific state    │
        │ - Risk factors           │
        │ - Prior questions        │
        │ - Generated insights     │
        └──────────────────────────┘
               │
               ▼
        ┌──────────────────────────┐
        │ Workers AI (Llama 3.3)   │
        │ - Context-aware replies  │
        └──────────────────────────┘
```

# Tech Stack

- Cloudflare Workers — API layer and orchestration

- Durable Objects — persistent, strongly consistent user memory

- Workers AI (Llama 3.3) — large language model inference

- Cloudflare Pages — frontend chat interface

- TypeScript — end-to-end type safety

- Wrangler — local development and deployment

# How Memory Works (Durable Object Overview)

Each user is assigned a Durable Object instance that stores structured, queryable JSON state. This allows the system to:

- Remember previously mentioned risk factors (e.g. food insecurity, stress)

- Track recent questions and key insights

- Modify future responses based on prior context

- Persist state across sessions and devices

Example memory structure:

```
{
  "profile": {
    "riskFactors": ["food insecurity", "chronic stress"],
    "interests": ["diabetes prevention"]
  },
  "conversation": {
    "recentQuestions": [
      "How does housing instability affect diabetes?"
    ],
    "keyInsights": [
      "Food access significantly impacts glycemic control"
    ]
  },
  "meta": {
    "createdAt": 1710000000000,
    "lastActive": 1710000420000
  }
}
```

Durable Objects were chosen over KV or databases due to their strong consistency, low latency, and per-user isolation, which are essential for conversational state.

# How to Run Locally

Prerequisites

- Node.js (v18+)

- Cloudflare Wrangler

- Cloudflare account

Install dependencies

`
npm install
`

Start local development

`
npx wrangler dev
`

This runs:

- Worker API

- Durable Objects

- Pages frontend (if configured)

You can then send requests to:

`http://localhost:8787/api/chat`

# Deployment Instructions

1. Authenticate Wrangler

`npx wrangler login`

2. Deploy Worker + Durable Objects

`npx wrangler deploy`

3. Deploy frontend (Pages)

`npx wrangler pages deploy ./pages`

After deployment, the application runs fully on Cloudflare’s global edge.

# Example Interactions

Example API Request

```
{
  "userId": "user_123",
  "message": "How does food insecurity impact diabetes risk?"
}
```

Example Response:
```
{
  "reply": "Food insecurity can increase diabetes risk by limiting access to consistent, nutritious meals, which affects blood sugar regulation. Since you mentioned stress earlier, it’s worth noting that chronic stress can compound these effects."
}
```

# Design Decisions

- Durable Objects over databases: Enables fast, per-user state with minimal operational complexity.

- Educational framing: Responses focus on explanation, not diagnosis or treatment.

- Structured memory: JSON-based state enables transparent, debuggable behavior.

- Edge-first design: All logic runs close to users with minimal latency.

# Limitations and Ethical Considerations

This project intentionally avoids:

- Medical diagnoses

- Personalized treatment recommendations

- Claims of clinical accuracy

Key ethical considerations:

- The system provides educational insights only, not medical advice.

- Health-related responses include contextual framing and uncertainty.

- Memory is scoped per user and not shared or aggregated.

- No sensitive personal identifiers are required.

Users are encouraged to consult qualified healthcare professionals for medical decisions.

# Future Work & Expansion

Potential extensions include:

- Visual analytics (charts showing relationships between factors)

- Embedding-based semantic memory

- Voice input using WebRTC or Realtime APIs

- Cross-session summaries

- Exportable insight reports for research or education

- Multilingual support

# Closing Notes

This project was designed to showcase not just AI usage, but thoughtful system design, state management, and ethical responsibility when working in sensitive domains.
