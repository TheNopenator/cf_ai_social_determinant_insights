# cf_ai_social_determinant_insights
My AI assistant will explain relationships between the social determinants of health (SDoH) and public health outcomes. It runs on Cloudflare Workers and Durable Objects, uses Llama 3.3 on Workers AI, and deploys a chat UI using Cloudflare pages.

Client (Pages Chat UI)
        │
        ▼
Worker Router (HTTP API)
        │
        ├── calls → Durable Object (UserContextDO)
        │         • load memory
        │         • store updated insights
        │
        ├── calls → Workers AI (Llama 3.3)
        │         • health insights
        │         • explanation + reasoning
        │
        └── writes → KV/D1 Analytics
                  • query logs
                  • risk factor categories
