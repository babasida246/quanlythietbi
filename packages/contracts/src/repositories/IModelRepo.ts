export interface ModelConfig {
    id: string
    provider: string
    tier: ModelTier
    contextWindow: number
    maxTokens: number
    costPer1kInput: number
    costPer1kOutput: number
    capabilities: {
        streaming: boolean
        tools: boolean
        vision: boolean
    }
    enabled: boolean
}

export enum ModelTier {
    T0_FREE = 0,
    T1_PAID_CHEAP = 1,
    T2_PAID_MEDIUM = 2,
    T3_PAID_PREMIUM = 3
}

export interface IModelRepo {
    findByTier(tier: ModelTier): Promise<ModelConfig[]>
    findById(id: string): Promise<ModelConfig | null>
    findEnabled(): Promise<ModelConfig[]>
}
