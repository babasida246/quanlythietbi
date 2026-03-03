import type { IModelRepo, ModelConfig, ModelTier } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

export class ModelRepo implements IModelRepo {
    constructor(private pg: PgClient) { }

    async findByTier(tier: ModelTier): Promise<ModelConfig[]> {
        const result = await this.pg.query(
            `SELECT * FROM model_configs 
       WHERE tier = $1 AND enabled = true
       ORDER BY cost_per_1k_input ASC`,
            [tier]
        )

        return result.rows.map(this.mapToModel)
    }

    async findById(id: string): Promise<ModelConfig | null> {
        const result = await this.pg.query(
            `SELECT * FROM model_configs WHERE id = $1`,
            [id]
        )

        if (result.rows.length === 0) return null

        return this.mapToModel(result.rows[0])
    }

    async findEnabled(): Promise<ModelConfig[]> {
        const result = await this.pg.query(
            `SELECT * FROM model_configs WHERE enabled = true
       ORDER BY tier ASC, cost_per_1k_input ASC`
        )

        return result.rows.map(this.mapToModel)
    }

    private mapToModel(row: any): ModelConfig {
        return {
            id: row.id,
            provider: row.provider,
            tier: row.tier,
            contextWindow: row.context_window,
            maxTokens: row.max_tokens,
            costPer1kInput: parseFloat(row.cost_per_1k_input),
            costPer1kOutput: parseFloat(row.cost_per_1k_output),
            capabilities: row.capabilities,
            enabled: row.enabled
        }
    }
}
