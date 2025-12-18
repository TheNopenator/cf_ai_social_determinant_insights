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

export class UserMemoryDO {
  constructor(private state: DurableObjectState) {}

  async getMemory(): Promise<UserMemory> {
    let memory = await this.state.storage.get<UserMemory>("memory")
    if (!memory) {
      memory = DEFAULT_MEMORY
      await this.state.storage.put("memory", memory)
    }
    return memory
  }

  async updateMemory(patch: Partial<UserMemory>) {
    const current = await this.getMemory()
    const updated = deepMerge(current, patch)
    updated.meta.lastActive = Date.now()
    await this.state.storage.put("memory", updated)
    return updated
  }
}
