/**
 * Workflow Module - Service Layer
 * @package @qltb/application
 *
 * WorkflowEngine: submit → multi-step approve/reject → close
 */

import type {
    WfRequest,
    WfRequestWithDetails,
    WfApproval,
    WfApprovalWithDetails,
    WfDefinition,
    WfStep,
    WfEvent,
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
    WfPaginatedResult,
    InboxSummary,
    WfRequestStatus,
    WfApprovalStatus,
    WfEventType,
    ApproverRule,
} from '@qltb/contracts';

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

// ==================== IWfRepository interface ====================

export interface IWfRepository {
    createRequest(dto: CreateWfRequestDto): Promise<WfRequest>;
    findRequestById(id: string): Promise<WfRequestWithDetails | null>;
    listRequests(params: WfRequestListParams): Promise<WfPaginatedResult<WfRequestWithDetails>>;
    updateRequestStatus(id: string, status: WfRequestStatus, extra?: Partial<{ currentStepNo: number | null; submittedAt: Date; closedAt: Date; definitionId: string }>): Promise<WfRequest | null>;
    updateRequestPayload(id: string, payload: Record<string, unknown>): Promise<void>;
    createApproval(data: { requestId: string; stepId: string; stepNo: number; assigneeUserId?: string | null; assigneeGroupId?: string | null; dueAt?: Date | null }): Promise<WfApproval>;
    findApprovalById(id: string): Promise<WfApprovalWithDetails | null>;
    findPendingApprovalsByRequest(requestId: string): Promise<WfApproval[]>;
    findApprovedApprovalForStep(requestId: string, stepNo: number): Promise<WfApprovalWithDetails | null>;
    findPendingApprovalsByRequestAndStep(requestId: string, stepNo: number): Promise<WfApproval[]>;
    findApprovalsByRequest(requestId: string): Promise<WfApprovalWithDetails[]>;
    listInboxApprovals(assigneeId: string, page?: number, limit?: number, viewAll?: boolean): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequest }>>;
    updateApprovalDecision(id: string, status: WfApprovalStatus, actorId: string, comment?: string): Promise<WfApproval | null>;
    skipPendingApprovalsInStep(requestId: string, stepNo: number): Promise<number>;
    updateApprovalAssignee(id: string, toUserId: string): Promise<WfApproval | null>;
    claimApproval(id: string, userId: string): Promise<WfApproval | null>;
    listUnassignedApprovals(page?: number, limit?: number): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequest }>>;
    cancelPendingApprovals(requestId: string): Promise<void>;
    cancelAllActiveApprovals(requestId: string): Promise<void>;
    getInboxSummary(assigneeId: string, viewAll?: boolean): Promise<InboxSummary>;
    findDefinitionByType(requestType: string): Promise<(WfDefinition & { steps: WfStep[] }) | null>;
    findStepByDefAndNo(definitionId: string, stepNo: number): Promise<WfStep | null>;
    listDefinitions(): Promise<WfDefinition[]>;
    createDefinitionWithSteps(dto: CreateWfDefinitionDto): Promise<WfDefinition & { steps: WfStep[] }>;
    appendEvent(data: { requestId: string; eventType: WfEventType; actorId?: string | null; meta?: Record<string, unknown> }): Promise<WfEvent>;
    listEvents(requestId: string): Promise<WfEvent[]>;
    findLinesByRequest(requestId: string): Promise<WfRequestLine[]>;
    updateLineStatus(lineId: string, status: WfRequestLine['status'], fulfilledQty?: number): Promise<WfRequestLine | null>;
}

// ==================== IApproverResolver interface ====================

export interface IApproverResolver {
    resolve(rule: ApproverRule, requesterId: string, requesterOuId: string | null): Promise<string | null>;
}

// ==================== Service ====================

export class WfService {
    constructor(
        private readonly repo: IWfRepository,
        private readonly resolver: IApproverResolver
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

    async getRequest(id: string): Promise<WfRequestWithDetails & { approvals: WfApprovalWithDetails[]; events: WfEvent[] }> {
        const req = await this.repo.findRequestById(id);
        if (!req) throw new WfNotFoundError('Request', id);
        const [approvals, events] = await Promise.all([
            this.repo.findApprovalsByRequest(id),
            this.repo.listEvents(id),
        ]);
        return { ...req, approvals, events } as WfRequestWithDetails & { approvals: WfApprovalWithDetails[]; events: WfEvent[] };
    }

    async listRequests(params: WfRequestListParams): Promise<WfPaginatedResult<WfRequestWithDetails>> {
        return this.repo.listRequests(params);
    }

    async submitRequest(dto: SubmitWfRequestDto): Promise<WfRequestWithDetails> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);

        if (req.requesterId !== dto.actorId) {
            throw new WfForbiddenError('Only the requester may submit this request');
        }
        if (req.status !== 'draft') {
            throw new WfError(`Cannot submit a request with status '${req.status}'`);
        }

        const def = await this.repo.findDefinitionByType(req.requestType);
        if (!def || !def.steps.length) {
            // Backward-compatible behavior: requests without definition are auto-approved.
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

        await this.repo.updateRequestStatus(dto.requestId, 'in_review', {
            currentStepNo: 1,
            submittedAt: new Date(),
            definitionId: def.id,
        });

        // Create pending approvals for the first workflow step.
        await this.startStep(dto.requestId, def, def.steps[0], dto.actorId, req.requesterOuId);

        await this.repo.appendEvent({
            requestId: dto.requestId,
            eventType: 'submitted',
            actorId: dto.actorId,
        });

        const updated = await this.repo.findRequestById(dto.requestId);
        return updated!;
    }

    async approveApproval(dto: ApproveWfApprovalDto): Promise<WfRequestWithDetails> {
        const approval = await this.repo.findApprovalById(dto.approvalId);
        if (!approval) throw new WfNotFoundError('Approval', dto.approvalId);
        if (approval.status !== 'pending') {
            throw new WfError(`Approval already decided: ${approval.status}`, 409);
        }

        let decision: WfApproval | null;
        try {
            decision = await this.repo.updateApprovalDecision(dto.approvalId, 'approved', dto.actorId, dto.comment);
        } catch (err: unknown) {
            if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
                const existing = await this.repo.findApprovedApprovalForStep(approval.requestId, approval.stepNo);
                const approverName = existing?.decisionByName ?? 'người dùng khác';
                throw new WfError(
                    `Bước phê duyệt này đã được xử lý bởi ${approverName}. Vui lòng tải lại trang.`,
                    409
                );
            }
            throw err;
        }
        if (!decision) {
            const existing = await this.repo.findApprovedApprovalForStep(approval.requestId, approval.stepNo);
            const approverName = existing?.decisionByName ?? 'người dùng khác';
            throw new WfError(
                `Bước phê duyệt này đã được xử lý bởi ${approverName}. Vui lòng tải lại trang.`,
                409
            );
        }

        // Auto-skip other pending approvals in the same step (constraint allows only one approved per step)
        await this.repo.skipPendingApprovalsInStep(approval.requestId, approval.stepNo);

        const remaining = await this.repo.findPendingApprovalsByRequest(approval.requestId);
        if (remaining.length === 0) {
            // Step is complete only when all pending approvals in that step are resolved.
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

    async withdrawRequest(dto: WithdrawWfRequestDto): Promise<WfRequestWithDetails> {
        const req = await this.repo.findRequestById(dto.requestId);
        if (!req) throw new WfNotFoundError('Request', dto.requestId);
        if (req.requesterId !== dto.actorId) {
            throw new WfForbiddenError('Only the requester can withdraw this request');
        }
        if (!['submitted', 'in_review'].includes(req.status)) {
            throw new WfError(`Cannot withdraw a request with status '${req.status}'`);
        }
        await this.repo.cancelAllActiveApprovals(dto.requestId);
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

    async listUnassignedApprovals(
        page = 1,
        limit = 20
    ): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequestWithDetails }>> {
        return this.repo.listUnassignedApprovals(page, limit) as any;
    }

    // ---- Inbox ----

    private static readonly FULL_INBOX_ROLES = new Set(['admin', 'super_admin', 'it_asset_manager']);

    async listInbox(
        assigneeId: string,
        page = 1,
        limit = 20,
        role?: string
    ): Promise<WfPaginatedResult<WfApprovalWithDetails & { request: WfRequestWithDetails }>> {
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
            await this.repo.updateRequestStatus(requestId, 'in_review', {
                currentStepNo: nextStep.stepNo,
            });
            const def = await this.repo.findDefinitionByType(req.requestType);
            if (def) {
                await this.startStep(requestId, def, nextStep, actorId, req.requesterOuId ?? null);
            }
        }
    }

    private async startStep(
        requestId: string,
        _def: WfDefinition & { steps: WfStep[] },
        step: WfStep,
        actorId: string,
        requesterOuId: string | null
    ): Promise<void> {
        const req = await this.repo.findRequestById(requestId);
        const assigneeUserId = await this.resolver.resolve(
            step.approverRule,
            req?.requesterId ?? actorId,
            req?.requesterOuId ?? requesterOuId
        );

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
