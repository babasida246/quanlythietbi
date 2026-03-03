/**
 * Entitlements Module (stub)
 * In self-hosted QuanLyThietBi, all features are enabled.
 */
export interface EntitlementService {
    checkFeature(feature: string): Promise<boolean>
}

export function createEntitlementService(): EntitlementService {
    return {
        async checkFeature() { return true }
    }
}
