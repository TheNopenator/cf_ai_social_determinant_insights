import { DurableObject } from "cloudflare:workers"; 

export interface UserMemory {
  profile: {
    riskFactors: string[]
    conditions: string[]
    interests: string[]
  }
  conversation: {
    recentQuestions: string[]
    keyInsights: string[]
  }
  meta: {
    createdAt: number
    lastActive: number
  }
}

const DEFAULT_MEMORY: UserMemory = {
  profile: { riskFactors: [], conditions: [], interests: [] },
  conversation: { recentQuestions: [], keyInsights: [] },
  meta: { createdAt: Date.now(), lastActive: Date.now() },
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = JSON.parse(JSON.stringify(target)) as T
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key], source[key] as any)
      } else {
        result[key] = source[key]
      }
    }
  }
  
  return result
}

export class UserContextDO extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
  }

  async getMemory(): Promise<UserMemory> {
    let memory = await this.state.storage.get<UserMemory>("memory")
    if (!memory) {
      memory = { ...DEFAULT_MEMORY, meta: { createdAt: Date.now(), lastActive: Date.now() } }
      await this.state.storage.put("memory", memory)
    }
    return memory
  }

  async updateMemory(patch: Partial<UserMemory>): Promise<UserMemory> {
    const current = await this.getMemory()
    const updated = deepMerge(current, patch)
    updated.meta.lastActive = Date.now()
    await this.state.storage.put("memory", updated)
    return updated
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/memory' && request.method === 'GET') {
        const memory = await this.getMemory()
        return new Response(JSON.stringify(memory), { headers: { 'Content-Type': 'application/json' } })
      }

      if (path === '/memory' && request.method === 'POST') {
        const patch = await request.json<Partial<UserMemory>>()
        const updated = await this.updateMemory(patch)
        return new Response(JSON.stringify(updated), { headers: { 'Content-Type': 'application/json' } })
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
  }
}
