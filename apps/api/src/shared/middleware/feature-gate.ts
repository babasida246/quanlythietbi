/**
 * Feature Gate Middleware (stub)
 * In self-hosted QuanLyThietBi, all features are enabled.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface EntitlementService {
    checkFeature(feature: string): Promise<boolean>
}

/**
 * Create a feature gate hook that always allows access.
 * In MCP server cloud edition, this checks entitlements.
 * In QuanLyThietBi self-hosted, all features are available.
 */
export function createFeatureGate(
    _entitlementService: EntitlementService,
    _featureCode: string
) {
    return async (_request: FastifyRequest, _reply: FastifyReply) => {
        // All features enabled in self-hosted mode
    }
}
