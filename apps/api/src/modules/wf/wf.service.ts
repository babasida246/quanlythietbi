/**
 * Workflow Request & Approval Module - Service / Business Logic
 * WorkflowEngine: submit → multi-step approve/reject → close
 */

import type { WfRepository } from './wf.repository.js';
import type { ApproverResolver } from './wf-approver-resolver.js';
import type {
    WfRequest,
    WfRequestWithDetails,
    WfApprovalWithDetails,
    WfDefinition,
    WfStep,
    WfRequestLine,
    CreateWfRequestDto,
    SubmitWfRequestDto,
    ApproveWfApprovalDto,
    RejectWfApprovalDto,
    CancelWfRequestDto,
    CommentWfRequestDto,
    WithdrawWfRequestDto,
    ClaimWfApprovalDto,
    DelegateWfApprovalDto,
    RequestInfoDto,
    CreateWfDefinitionDto,
    WfRequestListParams,
    PaginatedResult,
    InboxSummary,
} from './wf.types.js';

// ==================== Errors ====================

export class WfError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 400
    ) {
        super(message);
        this.name = 'WfError';
    }
}

export class WfNotFoundError extends WfError {
    constructor(entity: string, id: string) {
        super(`${entity} not found: ${id}`, 404);
    }
}

export class WfForbiddenError extends WfError {
    constructor(msg: string) {
        super(msg, 403);
    }
}

// ==================== Service ====================

export class WfService {
    constructor(
        private readonly repo: WfRepository,
        private readonly resolver: ApproverResolver
    ) { }

    // ---- Requests ----

    async createRequest(dto: CreateWfRequestDto): Promise<WfRequest> {
        const request = await this.repo.createRequest(dto);
        await this.repo.appendEvent({
            requestId: request.id,
            eventType: 'created',
            actorId: dto.requesterId,
            meta: {
                title: dto.title,
                requestType: dto.requestType,
                lineCount: dto.lines?.length ?? 0,
            },
        });
        return request;
    }

    async getRequest(id: string): Promise<WfRequestWithDetails & { approvals: WfApprovalWithDetails[]; events: ReturnType<WfRepository['listEvents']> extends Promise<infer T> ? T : never }> {
        const req = await this.repo.findRequestById(id);
        if (!req) throw new WfNotFoundError('Request', id);
        const [approvals, events] = await Promise.all([
            this.repo.findApprovalsByRequest(id),
            this.repo.listEvents(id),
        ]);
        return { ...req, approvals, events } as any;
    }

    async listRequests(params: WfRequestListParams): Promise<PaginatedResult<WfRequestWithDetails>> {
        return this.repo.listRequests(params);
    }

    /**
     * Submit a draft request:
     * 1. Find matching workflow definition for request type
     * 2. Set status = 'submitted' / 'in_review'
     * 3. Create approval tasks for step 1
     * 4. Append submitted event
     */
    async submitRequest(dto: SubmitWfRequestDto): Promise<WfRequestWithDetails> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);

        if (req.requesterId !== dto.actorId) {
            throw new WfForbiddenError('Only the requester may submit this request');
        }
        if (req.status !== 'draft') {
            throw new WfError(`Cannot submit a request with status '${req.status}'`);
        }

        // Find definition
        const def = await this.repo.findDefinitionByType(req.requestType);
        if (!def || !def.steps.length) {
            // No workflow defined → auto-approve
            await this.repo.updateRequestStatus(dto.requestId, 'approved', {
                submittedAt: new Date(),
                closedAt: new Date(),
                definitionId: def?.id,
            });
            await this.repo.appendEvent({
                requestId: dto.requestId,
                eventType: 'submitted',
                actorId: dto.actorId,
                meta: { note: 'No workflow definition; auto-approved' },
            });
            const updated = await this.repo.findRequestById(dto.requestId);
            return updated!;
        }

        // Transition to in_review at step 1
        await this.repo.updateRequestStatus(dto.requestId, 'in_review', {
            currentStepNo: 1,
            submittedAt: new Date(),
            definitionId: def.id,
        });

        await this.startStep(dto.requestId, def, def.steps[0], dto.actorId, req.requesterOuId);

        await this.repo.appendEvent({
            requestId: dto.requestId,
            eventType: 'submitted',
            actorId: dto.actorId,
        });

        const updated = await this.repo.findRequestById(dto.requestId);
        return updated!;
    }

    /**
     * Approve an approval task:
     * 1. Validate approval exists and is pending
     * 2. Record decision — concurrency-safe (no-op if already decided)
     * 3. Check if all step approvals approved → advance to next step or close
     */
    async approveApproval(dto: ApproveWfApprovalDto): Promise<WfRequestWithDetails> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval already decided: ${approval.status}`, 409);
        }

        const decision = await this.repo.updateApprovalDecision(dto.approvalId, 'approved', dto.actorId, dto.comment);
        if (!decision) {
            throw new WfError('Approval was already processed by another user. Please refresh and try again.', 409);
        }

        // Check if there are still pending approvals for this step
        const remaining = await this.repo.findPendingApprovalsByRequest(approval.requestId);

        if (remaining.length === 0) {
            // All approvals for current step are resolved → advance
            await this.advanceRequest(approval.requestId, approval.stepNo, 'approved', dto.actorId);
        }

        await this.repo.appendEvent({
            requestId: approval.requestId,
            eventType: 'approved',
            actorId: dto.actorId,
            meta: { approvalId: dto.approvalId, stepNo: approval.stepNo, comment: dto.comment },
        });

        const updated = await this.repo.findRequestById(approval.requestId);
        return updated!;
    }

    /**
     * Reject an approval task:
     * 1. Record decision as rejected
     * 2. Cancel all other pending approvals for the request
     * 3. Set request status = rejected (or follow on_reject rule)
     */
    async rejectApproval(dto: RejectWfApprovalDto): Promise<WfRequestWithDetails> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval already decided: ${approval.status}`, 409);
        }

        const decision = await this.repo.updateApprovalDecision(dto.approvalId, 'rejected', dto.actorId, dto.comment);
        if (!decision) {
            throw new WfError('Approval was already processed by another user. Please refresh and try again.', 409);
        }
        await this.repo.cancelPendingApprovals(approval.requestId);
        await this.repo.updateRequestStatus(approval.requestId, 'rejected', { currentStepNo: null });

        await this.repo.appendEvent({
            requestId: approval.requestId,
            eventType: 'rejected',
            actorId: dto.actorId,
            meta: { approvalId: dto.approvalId, stepNo: approval.stepNo, comment: dto.comment },
        });

        const updated = await this.repo.findRequestById(approval.requestId);
        return updated!;
    }

    async cancelRequest(dto: CancelWfRequestDto): Promise<WfRequestWithDetails> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);

        const cancellableStatuses: WfRequest['status'][] = ['draft', 'submitted', 'in_review'];
        if (!cancellableStatuses.includes(req.status)) {
            throw new WfError(`Cannot cancel a request with status '${req.status}'`);
        }

        await this.repo.cancelPendingApprovals(dto.requestId);
        await this.repo.updateRequestStatus(dto.requestId, 'cancelled', {
            currentStepNo: null,
            closedAt: new Date(),
        });
        await this.repo.appendEvent({
            requestId: dto.requestId,
            eventType: 'cancelled',
            actorId: dto.actorId,
            meta: { reason: dto.reason },
        });

        const updated = await this.repo.findRequestById(dto.requestId);
        return updated!;
    }

    async addComment(dto: CommentWfRequestDto): Promise<void> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);

        await this.repo.appendEvent({
            requestId: dto.requestId,
            eventType: 'commented',
            actorId: dto.actorId,
            meta: { comment: dto.comment },
        });
    }

    // ---- Withdraw (requester retracts a submitted/in_review request) ----

    async withdrawRequest(dto: WithdrawWfRequestDto): Promise<WfRequestWithDetails> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);
        if (req.requesterId !== dto.actorId) {
            throw new WfForbiddenError('Only the requester can withdraw this request');
        }
        if (!['submitted', 'in_review'].includes(req.status)) {
            throw new WfError(`Cannot withdraw a request with status '${req.status}'`);
        }
        await this.repo.cancelPendingApprovals(dto.requestId);
        await this.repo.updateRequestStatus(dto.requestId, 'draft', { currentStepNo: null });
        await this.repo.appendEvent({
            requestId: dto.requestId,
            eventType: 'withdrawn',
            actorId: dto.actorId,
            meta: { reason: dto.reason },
        });
        const updated = await this.repo.findRequestById(dto.requestId);
        return updated!;
    }

    // ---- Claim (grab an unassigned approval task) ----

    async claimApproval(dto: ClaimWfApprovalDto): Promise<WfApprovalWithDetails> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval is not pending: ${approval.status}`);
        }
        if (approval.assigneeUserId !== null) {
            throw new WfError('Approval is already assigned. Use delegate to reassign.', 409);
        }
        const claimed = await this.repo.claimApproval(dto.approvalId, dto.actorId);
        if (!claimed) {
            throw new WfError('Approval was claimed by another user. Please refresh.', 409);
        }
        await this.repo.appendEvent({
            requestId: approval.requestId,
            eventType: 'assigned',
            actorId: dto.actorId,
            meta: { approvalId: dto.approvalId, assigneeUserId: dto.actorId, note: 'claimed' },
        });
        const updated = await this.repo.findApprovalById(dto.approvalId);
        return updated!;
    }

    // ---- Delegate (current assignee hands off to another user) ----

    async delegateApproval(dto: DelegateWfApprovalDto): Promise<WfApprovalWithDetails> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval is not pending: ${approval.status}`);
        }
        if (approval.assigneeUserId !== dto.actorId) {
            throw new WfForbiddenError('Only the current assignee can delegate this approval');
        }
        if (dto.toUserId === dto.actorId) {
            throw new WfError('Cannot delegate to yourself');
        }
        const delegated = await this.repo.updateApprovalAssignee(dto.approvalId, dto.toUserId);
        if (!delegated) {
            throw new WfError('Delegation failed — approval may have already been processed', 409);
        }
        await this.repo.appendEvent({
            requestId: approval.requestId,
            eventType: 'delegated',
            actorId: dto.actorId,
            meta: { approvalId: dto.approvalId, fromUserId: dto.actorId, toUserId: dto.toUserId, reason: dto.reason },
        });
        const updated = await this.repo.findApprovalById(dto.approvalId);
        return updated!;
    }

    // ---- Request more information from the requester ----

    async requestMoreInfo(dto: RequestInfoDto): Promise<void> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval is not pending: ${approval.status}`);
        }
        if (approval.assigneeUserId !== dto.actorId) {
            throw new WfForbiddenError('Only the assignee can request additional info');
        }
        await this.repo.appendEvent({
            requestId: approval.requestId,
            eventType: 'info_requested',
            actorId: dto.actorId,
            meta: { approvalId: dto.approvalId, question: dto.question },
        });
    }

    // ---- Unassigned approvals (admin / manager view) ----

    async listUnassignedApprovals(
        page = 1,
        limit = 20
    ): Promise<PaginatedResult<WfApprovalWithDetails & { request: WfRequestWithDetails }>> {
        return this.repo.listUnassignedApprovals(page, limit) as any;
    }

    // ---- Inbox ----

    private static readonly FULL_INBOX_ROLES = new Set(['admin', 'super_admin', 'it_asset_manager']);

    async listInbox(
        assigneeId: string,
        page = 1,
        limit = 20,
        role?: string
    ): Promise<PaginatedResult<WfApprovalWithDetails & { request: WfRequestWithDetails }>> {
        const viewAll = role ? WfService.FULL_INBOX_ROLES.has(role) : false;
        return this.repo.listInboxApprovals(assigneeId, page, limit, viewAll) as any;
    }

    async getInboxSummary(assigneeId: string, role?: string): Promise<InboxSummary> {
        const viewAll = role ? WfService.FULL_INBOX_ROLES.has(role) : false;
        return this.repo.getInboxSummary(assigneeId, viewAll);
    }

    // ---- Definitions ----

    async listDefinitions(): Promise<WfDefinition[]> {
        return this.repo.listDefinitions();
    }

    async createDefinition(dto: CreateWfDefinitionDto): Promise<WfDefinition & { steps: WfStep[] }> {
        return this.repo.createDefinitionWithSteps(dto);
    }

    // ==================== Private helpers ====================

    /** Advance to next step or close when current step is fully approved */
    private async advanceRequest(
        requestId: string,
        currentStepNo: number,
        _decision: 'approved',
        actorId: string
    ): Promise<void> {
        const req = await this.repo.findRequestById(requestId);
        if (!req?.definitionId) return;

        const nextStep = await this.repo.findStepByDefAndNo(req.definitionId, currentStepNo + 1);

        if (!nextStep) {
            // Last step → close/approve
            await this.repo.updateRequestStatus(requestId, 'approved', {
                currentStepNo: null,
                closedAt: new Date(),
            });
            await this.repo.appendEvent({
                requestId,
                eventType: 'closed',
                actorId,
                meta: { note: 'All steps approved' },
            });
        } else {
            // Advance to next step
            await this.repo.updateRequestStatus(requestId, 'in_review', {
                currentStepNo: nextStep.stepNo,
            });
            const def = await this.repo.findDefinitionByType(req.requestType);
            if (def) {
                await this.startStep(requestId, def, nextStep, actorId, req.requesterOuId ?? null);
            }
        }
    }

    /** Create approval tasks for a step and emit step_started event */
    private async startStep(
        requestId: string,
        _def: WfDefinition & { steps: WfStep[] },
        step: WfStep,
        actorId: string,
        requesterOuId: string | null
    ): Promise<void> {
        // Resolve the approver from the step's approverRule
        const req = await this.repo.findRequestById(requestId);
        const assigneeUserId = await this.resolver.resolve(
            step.approverRule,
            req?.requesterId ?? actorId,
            req?.requesterOuId ?? requesterOuId
        );

        // Compute step-level SLA deadline
        const dueAt = step.slaHours
            ? new Date(Date.now() + step.slaHours * 60 * 60 * 1000)
            : null;

        await this.repo.createApproval({
            requestId,
            stepId: step.id,
            stepNo: step.stepNo,
            assigneeUserId,
            dueAt,
        });

        await this.repo.appendEvent({
            requestId,
            eventType: 'step_started',
            actorId,
            meta: { stepNo: step.stepNo, stepName: step.name },
        });

        if (assigneeUserId) {
            await this.repo.appendEvent({
                requestId,
                eventType: 'assigned',
                actorId,
                meta: { stepNo: step.stepNo, assigneeUserId },
            });
        }
    }
}
