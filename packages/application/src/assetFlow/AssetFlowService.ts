/**
 * AssetFlowService — Auto-generates warehouse documents when a workflow
 * request reaches the "approved" state.
 *
 * Mapping:
 *   asset_request  → issue document  (cấp phát)
 *   asset_recall   → return document (thu hồi về kho)
 *   asset_transfer → transfer document (điều chuyển giữa kho)
 *
 * For asset_request, the service can auto-progress the generated issue document
 * to posted (when warehouse info is available and StockDocumentService is wired),
 * so stock is deducted immediately after workflow approval.
 */

import type {
    IStockDocumentRepo,
    StockDocumentLineInput,
    StockDocumentRecord,
    WfRequestLine,
    WfRequestWithDetails,
} from '@qltb/contracts';
import type { StockDocumentService } from '../maintenanceWarehouse/StockDocumentService.js';
import type { MaintenanceWarehouseContext } from '../maintenanceWarehouse/types.js';

export class AssetFlowService {
    constructor(
        private readonly stockDocRepo: IStockDocumentRepo,
        private readonly stockDocumentService?: StockDocumentService
    ) { }

    async onRequestApproved(
        request: WfRequestWithDetails,
        actorId: string
    ): Promise<StockDocumentRecord | null> {
        const today = new Date().toISOString().slice(0, 10);
        const refType = 'wf_request';
        const refId = request.id;
        const requestCode = this.normalizeCodeToken(request.code || request.id);

        switch (request.requestType) {
            case 'asset_request': {
                const existing = await this.stockDocRepo.findByRefRequest(request.id, 'issue');
                const issueCtx = this.resolveIssueContext(request);
                const lines = (request.lines && request.lines.length > 0)
                    ? this.mapRequestLinesToIssueLines(request.lines)
                    : this.mapPayloadLinesToIssueLines(request.payload);

                // Guard: only auto-generate stock issue when request actually contains
                // stock-movable lines and a source warehouse.
                if (!existing) {
                    if (!issueCtx.warehouseId) return null;
                    if (!this.hasStockMovableLines(lines)) return null;
                }

                if (existing) {
                    await this.ensureIssueLines(existing.id, lines);
                    const progressed = await this.tryAutoPostIssue(existing.id, request, actorId);
                    return progressed ?? existing;
                }

                const created = await this.stockDocRepo.create({
                    docType: 'issue',
                    code: `ISS-WF-${requestCode}`,
                    warehouseId: issueCtx.warehouseId,
                    docDate: today,
                    refType,
                    refId,
                    refRequestId: request.id,
                    locationId: issueCtx.locationId,
                    receiverName: issueCtx.receiverName,
                    department: issueCtx.department,
                    recipientOuId: issueCtx.recipientOuId,
                    note: `Sinh tự động từ yêu cầu cấp phát: ${request.title}`,
                    createdBy: request.requesterId,
                });
                await this.ensureIssueLines(created.id, lines);
                await this.stockDocRepo.setStatus(created.id, 'submitted');
                const progressed = await this.tryAutoPostIssue(created.id, request, actorId);
                return progressed ?? { ...created, status: 'submitted' };
            }

            case 'asset_recall': {
                const existing = await this.stockDocRepo.findByRefRequest(request.id, 'return');
                if (existing) return existing;
                const recallDoc = await this.stockDocRepo.create({
                    docType: 'return',
                    code: `RET-WF-${requestCode}`,
                    docDate: today,
                    refType,
                    refId,
                    refRequestId: request.id,
                    note: `Sinh tự động từ yêu cầu thu hồi: ${request.title}`,
                    createdBy: actorId,
                });
                const recallLines = (request.lines && request.lines.length > 0)
                    ? this.mapRequestLinesToReturnLines(request.lines)
                    : [];
                await this.ensureIssueLines(recallDoc.id, recallLines);
                await this.stockDocRepo.setStatus(recallDoc.id, 'submitted');
                return { ...recallDoc, status: 'submitted' };
            }

            case 'asset_transfer': {
                const existing = await this.stockDocRepo.findByRefRequest(request.id, 'transfer');
                if (existing) return existing;
                const transferDoc = await this.stockDocRepo.create({
                    docType: 'transfer',
                    code: `TRF-WF-${requestCode}`,
                    docDate: today,
                    refType,
                    refId,
                    refRequestId: request.id,
                    note: `Sinh tự động từ yêu cầu điều chuyển: ${request.title}`,
                    createdBy: actorId,
                });
                await this.stockDocRepo.setStatus(transferDoc.id, 'submitted');
                return { ...transferDoc, status: 'submitted' };
            }

            default:
                return null;
        }
    }

    private normalizeCodeToken(input: string): string {
        return input
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48) || 'WF';
    }

    private async tryAutoPostIssue(
        documentId: string,
        request: WfRequestWithDetails,
        approverId: string
    ): Promise<StockDocumentRecord | null> {
        if (!this.stockDocumentService) return null;

        let current = await this.stockDocRepo.getById(documentId);
        if (!current || current.docType !== 'issue') return null;
        if (!current.warehouseId) return null;

        const correlationId = `wf-auto-stock:${request.id}`;
        const requesterId = request.requesterId;

        if (current.status === 'draft') {
            const submitActor = requesterId || this.pickSystemActor(new Set<string | null | undefined>([current.createdBy]));
            current = await this.stockDocumentService.submitDocument(
                current.id,
                this.ctx(submitActor, correlationId)
            );
        }

        if (current.status === 'submitted') {
            const approveActor = (!current.createdBy || current.createdBy !== approverId)
                ? approverId
                : this.pickSystemActor(new Set<string | null | undefined>([current.createdBy]));
            current = await this.stockDocumentService.approveDocument(
                current.id,
                this.ctx(approveActor, correlationId)
            );
        }

        if (current.status === 'approved') {
            const postActor = this.pickSystemActor(new Set<string | null | undefined>([
                current.createdBy,
                current.approvedBy,
                approverId
            ]));
            current = await this.stockDocumentService.postDocument(
                current.id,
                this.ctx(postActor, correlationId)
            );
        }

        return current;
    }

    private resolveIssueContext(request: WfRequestWithDetails): {
        warehouseId: string | null
        locationId: string | null
        receiverName: string | null
        department: string | null
        recipientOuId: string | null
    } {
        const payload = request.payload ?? {};
        return {
            warehouseId: this.readString(payload, ['warehouseId', 'sourceWarehouseId', 'fromWarehouseId']),
            locationId: this.readString(payload, ['locationId', 'targetLocationId', 'deliveryLocationId']),
            receiverName: this.readString(payload, ['receiverName']),
            department: this.readString(payload, ['department']),
            recipientOuId: this.readString(payload, ['recipientOuId', 'requesterOuId'])
        };
    }

    private readString(payload: Record<string, unknown>, keys: string[]): string | null {
        for (const key of keys) {
            const value = payload[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
        return null;
    }

    private hasStockMovableLines(lines: StockDocumentLineInput[]): boolean {
        return lines.some((line) => Boolean(line.assetId || line.assetModelId));
    }

    private ctx(userId: string, correlationId: string): MaintenanceWarehouseContext {
        return { userId, correlationId };
    }

    private pickSystemActor(blocked: Set<string | null | undefined>): string {
        const candidates = [
            'wf-system-auto-post',
            'wf-system-auto-post-2',
            'wf-system-auto-post-3'
        ];
        for (const candidate of candidates) {
            if (!blocked.has(candidate)) return candidate;
        }
        return `wf-system-auto-post-${Date.now().toString(36)}`;
    }

    private async ensureIssueLines(documentId: string, lines: StockDocumentLineInput[]): Promise<void> {
        if (lines.length === 0) return;

        const existingLines = await this.stockDocRepo.listLines(documentId);
        if (existingLines.length > 0) return;

        await this.stockDocRepo.replaceLines(documentId, lines);
    }

    private mapRequestLinesToIssueLines(requestLines: WfRequestLine[]): StockDocumentLineInput[] {
        const output: StockDocumentLineInput[] = [];

        for (const line of requestLines) {
            if (line.itemType === 'service') continue;

            const requestedQty = Number(line.requestedQty ?? 0);
            const fulfilledQty = Number(line.fulfilledQty ?? 0);
            const remainingQty = Math.max(requestedQty - fulfilledQty, 0);
            if (remainingQty <= 0) continue;

            if (line.itemType === 'part' && line.partId) {
                output.push({
                    lineType: 'qty',
                    assetModelId: line.partId,
                    qty: remainingQty,
                    unitCost: line.unitCost ?? null,
                    note: line.note ?? null,
                });
                continue;
            }

            if (line.itemType === 'asset' && line.assetId) {
                output.push({
                    lineType: 'serial',
                    assetId: line.assetId,
                    qty: 1,
                    unitCost: line.unitCost ?? null,
                    note: line.note ?? null,
                });
                continue;
            }

            if (line.itemType === 'asset' && line.metadata && typeof line.metadata === 'object') {
                const metadata = line.metadata as Record<string, unknown>;
                const assetModelId = typeof metadata.assetModelId === 'string'
                    ? metadata.assetModelId
                    : (typeof metadata.modelId === 'string' ? metadata.modelId : null);
                if (assetModelId) {
                    output.push({
                        lineType: 'serial',
                        assetModelId,
                        qty: 1,
                        unitCost: line.unitCost ?? null,
                        note: line.note ?? null,
                    });
                    continue;
                }
            }

            // Fallback: generic asset request with only a text description (no model/asset linked yet).
            // Use note as assetName so the warehouse keeper can see what's needed.
            if (line.itemType === 'asset' && line.note) {
                output.push({
                    lineType: 'qty',
                    assetName: line.note,
                    qty: remainingQty,
                    unitCost: line.unitCost ?? null,
                    note: line.note,
                });
            }
        }

        return output;
    }

    private mapRequestLinesToReturnLines(requestLines: WfRequestLine[]): StockDocumentLineInput[] {
        const output: StockDocumentLineInput[] = [];
        for (const line of requestLines) {
            if (line.itemType !== 'asset' || !line.assetId) continue;
            output.push({
                lineType: 'serial',
                assetId: line.assetId,
                qty: 1,
                note: line.note ?? null,
            });
        }
        return output;
    }

    private mapPayloadLinesToIssueLines(payload: Record<string, unknown> | undefined): StockDocumentLineInput[] {
        if (!payload || typeof payload !== 'object') return [];

        const raw = Array.isArray(payload.lines)
            ? payload.lines
            : Array.isArray(payload.items)
                ? payload.items
                : [];

        const output: StockDocumentLineInput[] = [];
        for (const item of raw) {
            if (!item || typeof item !== 'object') continue;
            const row = item as Record<string, unknown>;

            const itemType = typeof row.itemType === 'string' ? row.itemType : undefined;
            if (itemType !== 'part' && itemType !== 'asset') continue;
            const qtyRaw = Number(row.requestedQty ?? row.qty ?? 1);
            const qty = Number.isFinite(qtyRaw) ? Math.max(1, Math.trunc(qtyRaw)) : 1;
            const unitCost = row.unitCost == null ? null : Number(row.unitCost);
            const note = typeof row.note === 'string' ? row.note : null;

            const partId = typeof row.partId === 'string' ? row.partId : null;
            const assetId = typeof row.assetId === 'string' ? row.assetId : null;
            const assetModelId = typeof row.assetModelId === 'string'
                ? row.assetModelId
                : (typeof row.modelId === 'string' ? row.modelId : null);

            if (itemType === 'part' && partId) {
                output.push({
                    lineType: 'qty',
                    assetModelId: partId,
                    qty,
                    unitCost: Number.isFinite(unitCost ?? NaN) ? unitCost : null,
                    note,
                });
                continue;
            }

            if (itemType === 'asset' && (assetId || assetModelId)) {
                output.push({
                    lineType: 'serial',
                    assetId,
                    assetModelId,
                    qty: 1,
                    unitCost: Number.isFinite(unitCost ?? NaN) ? unitCost : null,
                    note,
                });
            }
        }

        return output;
    }
}
