/**
 * Workflow Module – ApproverResolver (Infrastructure)
 * @package @qltb/infra-postgres
 *
 * Resolves an ApproverRule to a concrete assignee_user_id.
 * Supports: user (direct), role (first active user with that role),
 *           ou_head (department head via rbac_users), any_manager (fallback).
 */

import type { PgClient } from '../PgClient.js';
import type { ApproverRule } from '@qltb/contracts';

export class WfApproverResolverRepo {
    constructor(private readonly db: PgClient) { }

    /**
     * Resolve an approverRule to a user UUID (or null if unresolvable).
     * @param rule          The step's approver rule from wf_steps.approver_rule
     * @param requesterId   The UUID of the user who submitted the request
     * @param requesterOuId OU the requester belongs to (may be null)
     */
    async resolve(
        rule: ApproverRule,
        requesterId: string,
        requesterOuId: string | null
    ): Promise<string | null> {
        switch (rule.type) {
            case 'user':
                return rule.value ?? null;

            case 'role':
                if (!rule.value) return null;
                return this.findFirstByRole(rule.value, requesterId);

            case 'ou_head':
                if (!requesterOuId) return this.findAnyManager(requesterId);
                return this.findOuHead(requesterOuId, requesterId);

            case 'any_manager':
                return this.findAnyManager(requesterId);

            default:
                return null;
        }
    }

    /** Return the first active user with the given role (excluding requester) */
    private async findFirstByRole(role: string, excludeUserId: string): Promise<string | null> {
        const { rows } = await this.db.query<{ id: string }>(
            `SELECT id FROM users
             WHERE role = $1 AND is_active = true AND id != $2
             ORDER BY created_at ASC
             LIMIT 1`,
            [role, excludeUserId]
        );
        if (rows.length) return rows[0].id;

        // Fallback: if no other user has that role, try including requester
        const { rows: fallback } = await this.db.query<{ id: string }>(
            `SELECT id FROM users
             WHERE role = $1 AND is_active = true
             ORDER BY created_at ASC
             LIMIT 1`,
            [role]
        );
        return fallback.length ? fallback[0].id : null;
    }

    /** Return the head of an org unit using rbac_users (linked_user_id) or fall back */
    private async findOuHead(ouId: string, excludeUserId: string): Promise<string | null> {
        const { rows } = await this.db.query<{ linked_user_id: string | null }>(
            `SELECT ru.linked_user_id
             FROM   rbac_users ru
             WHERE  ru.ou_id = $1
               AND  ru.status = 'active'
               AND  ru.linked_user_id IS NOT NULL
               AND  ru.linked_user_id != $2
             ORDER BY ru.created_at ASC
             LIMIT 1`,
            [ouId, excludeUserId]
        );
        if (rows.length && rows[0].linked_user_id) return rows[0].linked_user_id;
        return this.findAnyManager(excludeUserId);
    }

    /** Fallback: any active admin or it_asset_manager */
    private async findAnyManager(excludeUserId: string): Promise<string | null> {
        const { rows } = await this.db.query<{ id: string }>(
            `SELECT id FROM users
             WHERE role IN ('admin', 'it_asset_manager')
               AND is_active = true
               AND id != $1
             ORDER BY
               CASE role WHEN 'it_asset_manager' THEN 0 ELSE 1 END,
               created_at ASC
             LIMIT 1`,
            [excludeUserId]
        );
        return rows.length ? rows[0].id : null;
    }
}
