import type {
    PurchasePlanStatus,
    AssetIncreaseStatus,
    ApprovalRecord
} from '@qltb/contracts'
import type { PgClient } from '@qltb/infra-postgres'
import type { ApprovalRepo } from '@qltb/infra-postgres'

export type WorkflowEntityType = 'purchase_plan' | 'asset_increase'

export interface WorkflowTransition {
    from: string
    to: string
    allowedBy: 'creator' | 'approver' | 'poster' | 'any'
    requiresApproval?: boolean
}

export interface WorkflowConfig {
    entityType: WorkflowEntityType
    transitions: WorkflowTransition[]
    approvalSteps: number
}

export class WorkflowService {
    private configs: Map<WorkflowEntityType, WorkflowConfig>

    constructor(
        private pg: PgClient,
        private approvalRepo: ApprovalRepo
    ) {
        this.configs = new Map([
            ['purchase_plan', {
                entityType: 'purchase_plan',
                approvalSteps: 2,
                transitions: [
                    { from: 'draft', to: 'submitted', allowedBy: 'creator' },
                    { from: 'submitted', to: 'approved', allowedBy: 'approver', requiresApproval: true },
                    { from: 'submitted', to: 'rejected', allowedBy: 'approver' },
                    { from: 'approved', to: 'posted', allowedBy: 'poster' },
                    { from: 'draft', to: 'cancelled', allowedBy: 'creator' },
                    { from: 'submitted', to: 'cancelled', allowedBy: 'creator' },
                ]
            }],
            ['asset_increase', {
                entityType: 'asset_increase',
                approvalSteps: 1,
                transitions: [
                    { from: 'draft', to: 'submitted', allowedBy: 'creator' },
                    { from: 'submitted', to: 'approved', allowedBy: 'approver', requiresApproval: true },
                    { from: 'submitted', to: 'rejected', allowedBy: 'approver' },
                    { from: 'approved', to: 'posted', allowedBy: 'poster' },
                    { from: 'draft', to: 'cancelled', allowedBy: 'creator' },
                    { from: 'submitted', to: 'cancelled', allowedBy: 'creator' },
                ]
            }]
        ])
    }

    async canTransition(
        entityType: WorkflowEntityType,
        entityId: string,
        fromStatus: string,
        toStatus: string,
        userId: string
    ): Promise<{ allowed: boolean; reason?: string }> {
        const config = this.configs.get(entityType)
        if (!config) {
            return { allowed: false, reason: 'Unknown entity type' }
        }

        const transition = config.transitions.find(t => t.from === fromStatus && t.to === toStatus)
        if (!transition) {
            return { allowed: false, reason: `Transition from ${fromStatus} to ${toStatus} not allowed` }
        }

        if (transition.requiresApproval) {
            const approvals = await this.approvalRepo.getByEntity(entityType, entityId)
            const approvedSteps = approvals.filter((a: any) => a.decision === 'approved').length
            if (approvedSteps < config.approvalSteps) {
                return {
                    allowed: false,
                    reason: `Requires ${config.approvalSteps} approvals, only ${approvedSteps} approved`
                }
            }
        }

        return { allowed: true }
    }

    async submitForApproval(
        entityType: WorkflowEntityType,
        entityId: string,
        approvers: string[]
    ): Promise<ApprovalRecord[]> {
        const config = this.configs.get(entityType)
        if (!config) throw new Error('Unknown entity type')

        const records: ApprovalRecord[] = []
        for (let i = 0; i < Math.min(approvers.length, config.approvalSteps); i++) {
            const record = await this.approvalRepo.create({
                entityType,
                entityId,
                stepNo: i + 1,
                approverId: approvers[i],
                approverName: null
            })
            records.push(record)
        }

        return records
    }

    async approve(
        approvalId: string,
        approverId: string,
        note?: string
    ): Promise<void> {
        await this.approvalRepo.updateDecision(approvalId, {
            decision: 'approved',
            note: note ?? null
        }, approverId)
    }

    async reject(
        approvalId: string,
        approverId: string,
        reason: string
    ): Promise<void> {
        await this.approvalRepo.updateDecision(approvalId, {
            decision: 'rejected',
            note: reason
        }, approverId)
    }

    async getPendingApprovals(userId: string): Promise<ApprovalRecord[]> {
        return await this.approvalRepo.getPendingForApprover(userId)
    }

    async getApprovalHistory(
        entityType: WorkflowEntityType,
        entityId: string
    ): Promise<ApprovalRecord[]> {
        return await this.approvalRepo.getByEntity(entityType, entityId)
    }
}
