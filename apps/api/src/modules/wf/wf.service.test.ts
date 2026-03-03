/**
 * WorkflowEngine (WfService) – Unit Tests
 *
 * All WfRepository methods are mocked with vi.fn().
 * Tests focus on business rules: state transitions, error conditions,
 * event emission, and step advancement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WfService, WfError, WfNotFoundError, WfForbiddenError } from './wf.service.js';
import type { WfRepository } from './wf.repository.js';
import type {
    WfRequest,
    WfRequestWithDetails,
    WfApprovalWithDetails,
    WfDefinition,
    WfStep,
    CreateWfRequestDto,
    SubmitWfRequestDto,
    ApproveWfApprovalDto,
    RejectWfApprovalDto,
    CancelWfRequestDto,
    CommentWfRequestDto,
} from './wf.types.js';

// ==================== Mock Factory ====================

function createMockRepo(): WfRepository {
    return {
        createRequest: vi.fn(),
        findRequestById: vi.fn(),
        listRequests: vi.fn(),
        updateRequestStatus: vi.fn(),
        updateRequestPayload: vi.fn(),
        createApproval: vi.fn(),
        findApprovalById: vi.fn(),
        findPendingApprovalsByRequest: vi.fn(),
        findApprovalsByRequest: vi.fn(),
        listInboxApprovals: vi.fn(),
        updateApprovalDecision: vi.fn(),
        cancelPendingApprovals: vi.fn(),
        getInboxSummary: vi.fn(),
        findDefinitionByType: vi.fn(),
        findStepByDefAndNo: vi.fn(),
        listDefinitions: vi.fn(),
        createDefinitionWithSteps: vi.fn(),
        appendEvent: vi.fn(),
        listEvents: vi.fn(),
        addAttachment: vi.fn(),
    } as unknown as WfRepository;
}

// ==================== Fixture Helpers ====================

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const REQ_ID = 'req00000-0000-0000-0000-000000000001';
const DEF_ID = 'def00000-0000-0000-0000-000000000001';
const STEP1_ID = 'step0001-0000-0000-0000-000000000001';
const STEP2_ID = 'step0002-0000-0000-0000-000000000002';
const APR_ID = 'apr00000-0000-0000-0000-000000000001';

function makeDraftRequest(
    overrides: Partial<WfRequest> = {}
): WfRequestWithDetails {
    return {
        id: REQ_ID,
        code: 'REQ-2026-000001',
        title: 'Need new laptop',
        requestType: 'assign_asset',
        priority: 'normal',
        status: 'draft',
        requesterId: USER_A,
        requesterOuId: null,
        definitionId: null,
        currentStepNo: null,
        dueAt: null,
        payload: {},
        submittedAt: null,
        closedAt: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
        requesterName: 'Alice',
        ...overrides,
    } as WfRequestWithDetails;
}

function makeDefinition(steps: WfStep[]): WfDefinition & { steps: WfStep[] } {
    return {
        id: DEF_ID,
        key: 'assign_asset_v1',
        name: 'Assign Asset – 2 Step',
        requestType: 'assign',
        version: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        steps,
    };
}

function makeStep(stepNo: number, id: string): WfStep {
    return {
        id,
        definitionId: DEF_ID,
        stepNo,
        name: `Step ${stepNo}`,
        approverRule: { type: 'role' },
        onApprove: {},
        onReject: { cancel: true },
    };
}

function makeApproval(
    overrides: Partial<WfApprovalWithDetails> = {}
): WfApprovalWithDetails {
    return {
        id: APR_ID,
        requestId: REQ_ID,
        stepId: STEP1_ID,
        stepNo: 1,
        assigneeUserId: USER_B,
        assigneeGroupId: null,
        status: 'pending',
        comment: null,
        decisionAt: null,
        decisionBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assigneeName: 'Bob',
        ...overrides,
    } as WfApprovalWithDetails;
}

// ==================== Tests ====================

describe('WfService', () => {
    let repo: WfRepository;
    let svc: WfService;

    beforeEach(() => {
        repo = createMockRepo();
        svc = new WfService(repo);
        vi.clearAllMocks();
    });

    // ──────────── createRequest ────────────

    describe('createRequest', () => {
        it('creates a record and appends a created event', async () => {
            const created = makeDraftRequest();
            vi.mocked(repo.createRequest).mockResolvedValue(created);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const dto: CreateWfRequestDto = {
                title: 'Need new laptop',
                requestType: 'assign',
                requesterId: USER_A,
                priority: 'normal',
                payload: {},
            };

            const result = await svc.createRequest(dto);

            expect(result).toBe(created);
            expect(repo.createRequest).toHaveBeenCalledOnce();
            expect(repo.appendEvent).toHaveBeenCalledOnce();
            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'created', actorId: USER_A })
            );
        });
    });

    // ──────────── getRequest ────────────

    describe('getRequest', () => {
        it('throws WfNotFoundError when request does not exist', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(null);

            await expect(svc.getRequest('nonexistent')).rejects.toThrow(WfNotFoundError);
        });

        it('returns request merged with approvals and events', async () => {
            const req = makeDraftRequest();
            vi.mocked(repo.findRequestById).mockResolvedValue(req);
            vi.mocked(repo.findApprovalsByRequest).mockResolvedValue([]);
            vi.mocked(repo.listEvents).mockResolvedValue([]);

            const result = await svc.getRequest(REQ_ID);

            expect(result.id).toBe(REQ_ID);
            expect((result as any).approvals).toEqual([]);
            expect((result as any).events).toEqual([]);
        });
    });

    // ──────────── submitRequest ────────────

    describe('submitRequest', () => {
        const dto: SubmitWfRequestDto = { requestId: REQ_ID, actorId: USER_A };

        it('throws WfNotFoundError when request does not exist', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(null);

            await expect(svc.submitRequest(dto)).rejects.toThrow(WfNotFoundError);
        });

        it('throws WfForbiddenError when non-owner tries to submit', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(makeDraftRequest({ requesterId: USER_B }));

            await expect(svc.submitRequest(dto)).rejects.toThrow(WfForbiddenError);
        });

        it('throws WfError when request is not in draft status', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(makeDraftRequest({ status: 'in_review' }));

            await expect(svc.submitRequest(dto)).rejects.toThrow(WfError);
        });

        it('auto-approves when no workflow definition exists', async () => {
            const req = makeDraftRequest();
            const updated = makeDraftRequest({ status: 'approved', closedAt: new Date() });

            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(req)     // initial fetch
                .mockResolvedValueOnce(updated); // after update
            vi.mocked(repo.findDefinitionByType).mockResolvedValue(null);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const result = await svc.submitRequest(dto);

            expect(repo.updateRequestStatus).toHaveBeenCalledWith(
                REQ_ID,
                'approved',
                expect.objectContaining({ submittedAt: expect.any(Date) })
            );
            expect(result.status).toBe('approved');
        });

        it('auto-approves when definition has no steps', async () => {
            const req = makeDraftRequest();
            const def = makeDefinition([]); // empty steps
            const updated = makeDraftRequest({ status: 'approved' });

            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(req)
                .mockResolvedValueOnce(updated);
            vi.mocked(repo.findDefinitionByType).mockResolvedValue(def);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const result = await svc.submitRequest(dto);

            expect(result.status).toBe('approved');
            expect(repo.createApproval).not.toHaveBeenCalled();
        });

        it('transitions to in_review and creates step-1 approval when definition exists', async () => {
            const req = makeDraftRequest();
            const step1 = makeStep(1, STEP1_ID);
            const def = makeDefinition([step1]);
            const updated = makeDraftRequest({ status: 'in_review', currentStepNo: 1, definitionId: DEF_ID });

            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(req)
                .mockResolvedValueOnce(updated);
            vi.mocked(repo.findDefinitionByType).mockResolvedValue(def);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.createApproval).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const result = await svc.submitRequest(dto);

            expect(repo.updateRequestStatus).toHaveBeenCalledWith(REQ_ID, 'in_review', expect.any(Object));
            expect(repo.createApproval).toHaveBeenCalledOnce();
            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'step_started' })
            );
            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'submitted' })
            );
            expect(result.status).toBe('in_review');
        });
    });

    // ──────────── approveApproval ────────────

    describe('approveApproval', () => {
        const dto: ApproveWfApprovalDto = { approvalId: APR_ID, actorId: USER_B };

        it('throws WfNotFoundError when approval does not exist', async () => {
            vi.mocked(repo.findApprovalById).mockResolvedValue(null);

            await expect(svc.approveApproval(dto)).rejects.toThrow(WfNotFoundError);
        });

        it('throws WfError when approval is already decided', async () => {
            vi.mocked(repo.findApprovalById).mockResolvedValue(makeApproval({ status: 'approved' }));

            await expect(svc.approveApproval(dto)).rejects.toThrow(WfError);
        });

        it('stays in_review and advances to step 2 when more steps remain', async () => {
            const approval = makeApproval();
            const reqInReview = makeDraftRequest({ status: 'in_review', definitionId: DEF_ID, currentStepNo: 1 });
            const step2 = makeStep(2, STEP2_ID);
            const def = makeDefinition([makeStep(1, STEP1_ID), step2]);
            const updated = makeDraftRequest({ status: 'in_review', currentStepNo: 2 });

            vi.mocked(repo.findApprovalById).mockResolvedValue(approval);
            vi.mocked(repo.updateApprovalDecision).mockResolvedValue(undefined as any);
            vi.mocked(repo.findPendingApprovalsByRequest).mockResolvedValue([]); // no remaining pending
            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(reqInReview) // advanceRequest fetch
                .mockResolvedValueOnce(updated);    // final fetch
            vi.mocked(repo.findStepByDefAndNo).mockResolvedValue(step2); // next step exists
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.findDefinitionByType).mockResolvedValue(def);
            vi.mocked(repo.createApproval).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const result = await svc.approveApproval(dto);

            // Should NOT close the request — next step exists
            expect(repo.updateRequestStatus).toHaveBeenCalledWith(
                REQ_ID, 'in_review', expect.objectContaining({ currentStepNo: 2 })
            );
            expect(repo.createApproval).toHaveBeenCalledOnce(); // step 2 approval created
            expect(result.currentStepNo).toBe(2);
        });

        it('closes request as approved when last step is approved', async () => {
            const approval = makeApproval();
            const reqInReview = makeDraftRequest({ status: 'in_review', definitionId: DEF_ID, currentStepNo: 1 });
            const updated = makeDraftRequest({ status: 'approved', closedAt: new Date() });

            vi.mocked(repo.findApprovalById).mockResolvedValue(approval);
            vi.mocked(repo.updateApprovalDecision).mockResolvedValue(undefined as any);
            vi.mocked(repo.findPendingApprovalsByRequest).mockResolvedValue([]);
            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(reqInReview) // advanceRequest
                .mockResolvedValueOnce(updated);    // final
            vi.mocked(repo.findStepByDefAndNo).mockResolvedValue(null); // no next step
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            const result = await svc.approveApproval(dto);

            expect(repo.updateRequestStatus).toHaveBeenCalledWith(
                REQ_ID, 'approved', expect.objectContaining({ closedAt: expect.any(Date) })
            );
            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'closed' })
            );
            expect(result.status).toBe('approved');
        });

        it('stays in_review when other pending approvals remain in current step', async () => {
            const approval = makeApproval();
            const anotherPending = makeApproval({ id: 'apr2-0000-0000-0000-000000000002' });
            const updated = makeDraftRequest({ status: 'in_review' });

            vi.mocked(repo.findApprovalById).mockResolvedValue(approval);
            vi.mocked(repo.updateApprovalDecision).mockResolvedValue(undefined as any);
            vi.mocked(repo.findPendingApprovalsByRequest).mockResolvedValue([anotherPending]);
            vi.mocked(repo.findRequestById).mockResolvedValue(updated);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            await svc.approveApproval(dto);

            // Should NOT call advanceRequest (findStepByDefAndNo should not be called)
            expect(repo.findStepByDefAndNo).not.toHaveBeenCalled();
            expect(repo.updateRequestStatus).not.toHaveBeenCalled();
        });

        it('emits approved event with correct metadata', async () => {
            const approval = makeApproval();
            const req = makeDraftRequest({ status: 'in_review', definitionId: DEF_ID });
            const updated = makeDraftRequest({ status: 'approved' });

            vi.mocked(repo.findApprovalById).mockResolvedValue(approval);
            vi.mocked(repo.updateApprovalDecision).mockResolvedValue(undefined as any);
            vi.mocked(repo.findPendingApprovalsByRequest).mockResolvedValue([]);
            vi.mocked(repo.findRequestById).mockResolvedValueOnce(req).mockResolvedValueOnce(updated);
            vi.mocked(repo.findStepByDefAndNo).mockResolvedValue(null);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            await svc.approveApproval({ ...dto, comment: 'LGTM' });

            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'approved',
                    actorId: USER_B,
                    meta: expect.objectContaining({ approvalId: APR_ID, stepNo: 1, comment: 'LGTM' }),
                })
            );
        });
    });

    // ──────────── rejectApproval ────────────

    describe('rejectApproval', () => {
        const dto: RejectWfApprovalDto = { approvalId: APR_ID, actorId: USER_B, comment: 'Not needed' };

        it('throws WfNotFoundError when approval does not exist', async () => {
            vi.mocked(repo.findApprovalById).mockResolvedValue(null);

            await expect(svc.rejectApproval(dto)).rejects.toThrow(WfNotFoundError);
        });

        it('throws WfError when approval is already decided', async () => {
            vi.mocked(repo.findApprovalById).mockResolvedValue(makeApproval({ status: 'rejected' }));

            await expect(svc.rejectApproval(dto)).rejects.toThrow(WfError);
        });

        it('cancels all pending approvals and sets request to rejected', async () => {
            const approval = makeApproval();
            const updated = makeDraftRequest({ status: 'rejected' });

            vi.mocked(repo.findApprovalById).mockResolvedValue(approval);
            vi.mocked(repo.updateApprovalDecision).mockResolvedValue(undefined as any);
            vi.mocked(repo.cancelPendingApprovals).mockResolvedValue(undefined as any);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);
            vi.mocked(repo.findRequestById).mockResolvedValue(updated);

            const result = await svc.rejectApproval(dto);

            expect(repo.cancelPendingApprovals).toHaveBeenCalledWith(REQ_ID);
            expect(repo.updateRequestStatus).toHaveBeenCalledWith(
                REQ_ID, 'rejected', { currentStepNo: null }
            );
            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'rejected', actorId: USER_B })
            );
            expect(result.status).toBe('rejected');
        });
    });

    // ──────────── cancelRequest ────────────

    describe('cancelRequest', () => {
        const dto: CancelWfRequestDto = { requestId: REQ_ID, actorId: USER_A, reason: 'Changed mind' };

        it('throws WfNotFoundError when request does not exist', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(null);

            await expect(svc.cancelRequest(dto)).rejects.toThrow(WfNotFoundError);
        });

        it('throws WfError when request is already approved', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(makeDraftRequest({ status: 'approved' }));

            await expect(svc.cancelRequest(dto)).rejects.toThrow(WfError);
        });

        it('throws WfError when request is already rejected', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(makeDraftRequest({ status: 'rejected' }));

            await expect(svc.cancelRequest(dto)).rejects.toThrow(WfError);
        });

        it.each(['draft', 'submitted', 'in_review'] as const)(
            'successfully cancels a %s request',
            async (status) => {
                const req = makeDraftRequest({ status });
                const updated = makeDraftRequest({ status: 'cancelled' });

                vi.mocked(repo.findRequestById)
                    .mockResolvedValueOnce(req)
                    .mockResolvedValueOnce(updated);
                vi.mocked(repo.cancelPendingApprovals).mockResolvedValue(undefined as any);
                vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
                vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

                const result = await svc.cancelRequest(dto);

                expect(repo.cancelPendingApprovals).toHaveBeenCalledWith(REQ_ID);
                expect(repo.updateRequestStatus).toHaveBeenCalledWith(
                    REQ_ID, 'cancelled', expect.objectContaining({ closedAt: expect.any(Date) })
                );
                expect(result.status).toBe('cancelled');
            }
        );

        it('emits cancelled event with reason', async () => {
            const req = makeDraftRequest({ status: 'draft' });
            const updated = makeDraftRequest({ status: 'cancelled' });

            vi.mocked(repo.findRequestById)
                .mockResolvedValueOnce(req)
                .mockResolvedValueOnce(updated);
            vi.mocked(repo.cancelPendingApprovals).mockResolvedValue(undefined as any);
            vi.mocked(repo.updateRequestStatus).mockResolvedValue(undefined as any);
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            await svc.cancelRequest(dto);

            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'cancelled',
                    meta: expect.objectContaining({ reason: 'Changed mind' }),
                })
            );
        });
    });

    // ──────────── addComment ────────────

    describe('addComment', () => {
        const dto: CommentWfRequestDto = { requestId: REQ_ID, actorId: USER_A, comment: 'Please expedite' };

        it('throws WfNotFoundError when request does not exist', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(null);

            await expect(svc.addComment(dto)).rejects.toThrow(WfNotFoundError);
        });

        it('appends a commented event', async () => {
            vi.mocked(repo.findRequestById).mockResolvedValue(makeDraftRequest());
            vi.mocked(repo.appendEvent).mockResolvedValue(undefined as any);

            await svc.addComment(dto);

            expect(repo.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'commented',
                    actorId: USER_A,
                    meta: expect.objectContaining({ comment: 'Please expedite' }),
                })
            );
        });
    });

    // ──────────── listInbox / getInboxSummary ────────────

    describe('listInbox', () => {
        it('delegates to repo.listInboxApprovals with defaults', async () => {
            vi.mocked(repo.listInboxApprovals).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 } as any);

            await svc.listInbox(USER_B);

            expect(repo.listInboxApprovals).toHaveBeenCalledWith(USER_B, 1, 20);
        });
    });

    describe('getInboxSummary', () => {
        it('delegates to repo.getInboxSummary', async () => {
            const summary = { pendingCount: 5, urgentCount: 1, overdueCount: 0 };
            vi.mocked(repo.getInboxSummary).mockResolvedValue(summary);

            const result = await svc.getInboxSummary(USER_B);

            expect(result).toBe(summary);
            expect(repo.getInboxSummary).toHaveBeenCalledWith(USER_B);
        });
    });

    // ──────────── listDefinitions / createDefinition ────────────

    describe('listDefinitions', () => {
        it('returns all definitions from repo', async () => {
            const defs = [makeDefinition([])];
            vi.mocked(repo.listDefinitions).mockResolvedValue(defs as WfDefinition[]);

            const result = await svc.listDefinitions();

            expect(result).toBe(defs);
        });
    });

    describe('createDefinition', () => {
        it('delegates to repo.createDefinitionWithSteps', async () => {
            const def = makeDefinition([makeStep(1, STEP1_ID)]);
            vi.mocked(repo.createDefinitionWithSteps).mockResolvedValue(def);

            const dto = {
                key: 'test_v1',
                name: 'Test',
                requestType: 'assign' as const,
                steps: [{ stepNo: 1, name: 'Step 1', approverRule: { type: 'role' as const }, onApprove: {}, onReject: {} }],
            };

            const result = await svc.createDefinition(dto);

            expect(result).toBe(def);
            expect(repo.createDefinitionWithSteps).toHaveBeenCalledWith(dto);
        });
    });

    // ──────────── Error class behaviour ────────────

    describe('Error classes', () => {
        it('WfError defaults statusCode to 400', () => {
            const err = new WfError('bad request');
            expect(err.statusCode).toBe(400);
            expect(err.name).toBe('WfError');
        });

        it('WfNotFoundError has statusCode 404', () => {
            const err = new WfNotFoundError('Request', '123');
            expect(err.statusCode).toBe(404);
            expect(err.message).toContain('Request');
            expect(err.message).toContain('123');
        });

        it('WfForbiddenError has statusCode 403', () => {
            const err = new WfForbiddenError('no access');
            expect(err.statusCode).toBe(403);
        });

        it('WfNotFoundError is instanceof WfError', () => {
            const err = new WfNotFoundError('X', 'y');
            expect(err).toBeInstanceOf(WfError);
        });
    });
});
