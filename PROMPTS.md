In which directory should I create a new Cloudflare application with npm create?\

Which template should I pick during npm create?\

How can I implement Durable Object Memory, which should store context like risk factors, previous questions, and generated insight?\

Where should I specifically store structured, queryable JSON? In memory.ts?\

Can you help me adjust the Wrangler file so that config has a compatibility date?\

Is my preliminary implementation of Durable Object Memory correct? It should store information like user risk factors, generated insights, and previous questions.\

There are currently some exceptions in worker-configuration.d.ts. Can you help me reconcile those with other files?\

Can you help me implement worker routes and the orchestration logic? Some routes would be POST /chat (the main endpoint), POST /risk (enters numeric risk factors), GET /context (returns current DO state), and GET /analytics (admin view, but this isn't a priority).\

Here is an example prompt that should be given as context to the agent. SYSTEM: You are a medical insight assistant specializing in social determinants of health. Use the user’s history and risk context when responding. Always be clear, explain mechanisms, and avoid giving medical advice.
