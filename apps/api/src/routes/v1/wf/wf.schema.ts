/**
 * Workflow Request & Approval Module - Zod Validation Schemas
 */

import { z } from 'zod';
import {
    WF_REQUEST_TYPES,
    WF_PRIORITIES,
    WF_REQUEST_STATUSES,
    WF_LINE_ITEM_TYPES,
    WF_APPROVER_RULE_TYPES,
} from '@qltb/contracts';

// ==================== Shared ====================

export const wfRequestTypeSchema = z.enum(WF_REQUEST_TYPES);
export const wfPrioritySchema = z.enum(WF_PRIORITIES).default('normal');
export const wfRequestStatusSchema = z.enum(WF_REQUEST_STATUSES);

// ==================== Request line schema (used inside create) ====================

export const wfRequestLineSchema = z.object({
    lineNo: z.number().int().positive().optional(),
    itemType: z.enum(WF_LINE_ITEM_TYPES).default('part'),
    assetId: z.string().uuid().optional(),
    partId: z.string().uuid().optional(),
    requestedQty: z.coerce.number().int().positive().default(1),
    unitCost: z.number().nonnegative().optional(),
    note: z.string().max(500).optional(),
    metadata: z.record(z.unknown()).optional(),
}).refine(
    (d) => d.itemType === 'service' || d.assetId != null || d.partId != null,
    { message: 'asset line requires assetId; part line requires partId', path: ['assetId'] }
)

// ==================== Request CRUD ====================

export const createWfRequestSchema = z.object({
    title: z.string().min(3).max(500),
    requestType: wfRequestTypeSchema,
    priority: wfPrioritySchema.optional(),
    requesterOuId: z.string().uuid().optional(),
    dueAt: z.string().optional().transform((v) => {
        if (!v) return undefined;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T23:59:59Z').toISOString();
        return v;
    }),
    payload: z.record(z.unknown()).optional().default({}),
    lines: z.array(wfRequestLineSchema).optional(),
});

export const updateWfRequestSchema = z.object({
    title: z.string().min(3).max(500).optional(),
    priority: wfPrioritySchema.optional(),
    dueAt: z.string().optional().nullable().transform((v) => {
        if (!v) return v;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T23:59:59Z').toISOString();
        return v;
    }),
    payload: z.record(z.unknown()).optional(),
});

// ==================== Workflow Actions ====================

export const submitWfRequestSchema = z.object({});

export const approveWfApprovalSchema = z.object({
    comment: z.string().max(1000).optional(),
});

export const rejectWfApprovalSchema = z.object({
    comment: z.string().max(1000).optional(),
});

export const cancelWfRequestSchema = z.object({
    reason: z.string().max(500).optional(),
});

export const withdrawWfRequestSchema = z.object({
    reason: z.string().max(500).optional(),
});

export const delegateWfApprovalSchema = z.object({
    toUserId: z.string().uuid({ message: 'toUserId must be a valid UUID' }),
    reason: z.string().max(500).optional(),
});

export const claimWfApprovalSchema = z.object({});

export const requestInfoSchema = z.object({
    question: z.string().min(1).max(2000),
});

export const commentWfRequestSchema = z.object({
    comment: z.string().min(1).max(2000),
});

// ==================== Query params ====================

export const wfRequestListQuerySchema = z.object({
    status: wfRequestStatusSchema.optional(),
    requestType: wfRequestTypeSchema.optional(),
    priority: wfPrioritySchema.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const inboxQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== Path params ====================

export const idParamSchema = z.object({ id: z.string().uuid() });

// ==================== Admin: Definition CRUD ====================

const approverRuleSchema = z.object({
    type: z.enum(WF_APPROVER_RULE_TYPES),
    value: z.string().optional(),
});

const stepActionSchema = z.object({
    nextStep: z.number().int().positive().optional(),
    complete: z.boolean().optional(),
    cancel: z.boolean().optional(),
});

export const createWfDefinitionSchema = z.object({
    key: z.string().min(2).max(100).regex(/^[a-z0-9_]+$/, 'key must be snake_case'),
    name: z.string().min(3).max(255),
    requestType: wfRequestTypeSchema,
    version: z.number().int().min(1).default(1),
    steps: z.array(z.object({
        stepNo: z.number().int().min(1),
        name: z.string().min(2).max(255),
        approverRule: approverRuleSchema,
        onApprove: stepActionSchema.optional(),
        onReject: stepActionSchema.optional(),
    })).min(1),
});

// ==================== Exported types ====================

export type CreateWfRequestInput = z.infer<typeof createWfRequestSchema>;
export type UpdateWfRequestInput = z.infer<typeof updateWfRequestSchema>;
export type ApproveInput = z.infer<typeof approveWfApprovalSchema>;
export type RejectInput = z.infer<typeof rejectWfApprovalSchema>;
export type CancelInput = z.infer<typeof cancelWfRequestSchema>;
export type WithdrawInput = z.infer<typeof withdrawWfRequestSchema>;
export type DelegateInput = z.infer<typeof delegateWfApprovalSchema>;
export type RequestInfoInput = z.infer<typeof requestInfoSchema>;
export type CommentInput = z.infer<typeof commentWfRequestSchema>;
export type WfRequestListQuery = z.infer<typeof wfRequestListQuerySchema>;
export type InboxQuery = z.infer<typeof inboxQuerySchema>;
export type CreateWfDefinitionInput = z.infer<typeof createWfDefinitionSchema>;
