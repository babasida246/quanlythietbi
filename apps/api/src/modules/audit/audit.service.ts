/**
 * Audit Module - Service Layer
 * Module: 07-AUDIT (Asset Audit/Inventory Check)
 */

import { AuditRepository } from './audit.repository.js';
import {
    AuditSession,
    AuditSessionWithDetails,
    AuditItem,
    AuditItemWithDetails,
    UnregisteredAsset,
    UnregisteredAssetWithDetails,
    AuditAuditorWithDetails,
    AuditLocationWithDetails,
    AuditCategoryWithDetails,
    AuditHistoryWithDetails,
    CreateAuditDto,
    UpdateAuditDto,
    StartAuditDto,
    CompleteAuditDto,
    CancelAuditDto,
    AuditItemDto,
    BulkAuditItemDto,
    ResolveDiscrepancyDto,
    CreateUnregisteredAssetDto,
    UpdateUnregisteredAssetDto,
    AssignAuditorDto,
    AuditListQuery,
    AuditItemListQuery,
    DiscrepancyQuery,
    UnregisteredAssetQuery,
    AuditResult,
    AuditItemResult,
    BulkAuditResult,
    AuditCompletionCheck,
    AuditStatistics,
    AuditProgress,
    PaginatedAudits,
    PaginatedAuditItems,
    PaginatedUnregisteredAssets,
    ScanResult,
} from './audit.types.js';

export class AuditService {
    constructor(private repository: AuditRepository) { }

    // ==================== Audit Session Operations ====================

    async createAudit(dto: CreateAuditDto): Promise<AuditResult> {
        try {
            // AUD-R01: Warn if location has active audit
            for (const locationId of dto.locationIds) {
                const hasActive = await this.repository.hasActiveAuditForLocation(locationId);
                if (hasActive) {
                    console.warn(`Location ${locationId} already has an active audit in progress`);
                }
            }

            // AUD-R02: Must have at least 1 auditor
            if (!dto.auditorIds || dto.auditorIds.length === 0) {
                return {
                    success: false,
                    error: 'At least one auditor is required',
                };
            }

            const audit = await this.repository.withTransaction(async (client) => {
                // Create audit session
                const session = await this.repository.create(dto, client);

                // Add locations
                await this.repository.addLocations(session.id, dto.locationIds, client);

                // Add categories if specified
                if (dto.categoryIds && dto.categoryIds.length > 0) {
                    await this.repository.addCategories(session.id, dto.categoryIds, client);
                }

                // Add auditors
                if (dto.auditorAssignments && dto.auditorAssignments.length > 0) {
                    await this.repository.addAuditors(session.id, dto.auditorAssignments, client);
                } else {
                    // Simple assignment without location
                    await this.repository.addAuditors(
                        session.id,
                        dto.auditorIds.map((userId) => ({ userId })),
                        client
                    );
                }

                // Populate audit items from scope
                const itemCount = await this.repository.populateAuditItemsFromScope(
                    session.id,
                    dto.locationIds,
                    dto.categoryIds,
                    client
                );

                // Update total items count
                await this.repository.updateTotalItems(session.id, itemCount, client);

                // Create history entry
                await this.repository.createHistory(
                    session.id,
                    'created',
                    dto.createdBy,
                    undefined,
                    'draft',
                    { itemCount },
                    client
                );

                return session;
            });

            return {
                success: true,
                audit,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create audit',
            };
        }
    }

    async getAuditById(id: string): Promise<AuditSession | null> {
        return this.repository.findById(id);
    }

    async getAuditDetail(id: string): Promise<{
        audit: AuditSessionWithDetails;
        locations: AuditLocationWithDetails[];
        categories: AuditCategoryWithDetails[];
        auditors: AuditAuditorWithDetails[];
        progress: AuditProgress;
        history: AuditHistoryWithDetails[];
    } | null> {
        const audit = await this.repository.findByIdWithDetails(id);
        if (!audit) return null;

        const [locations, categories, auditors, progress, history] = await Promise.all([
            this.repository.findLocationsByAuditId(id),
            this.repository.findCategoriesByAuditId(id),
            this.repository.findAuditorsByAuditId(id),
            this.repository.getAuditProgress(id),
            this.repository.findHistoryByAuditId(id),
        ]);

        return { audit, locations, categories, auditors, progress, history };
    }

    async updateAudit(
        id: string,
        dto: UpdateAuditDto,
        updatedBy: string
    ): Promise<AuditResult> {
        try {
            const audit = await this.repository.findById(id);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (audit.status !== 'draft') {
                return { success: false, error: 'Can only update audits in draft status' };
            }

            const updated = await this.repository.update(id, dto);
            if (updated) {
                await this.repository.createHistory(
                    id,
                    'updated',
                    updatedBy,
                    undefined,
                    undefined,
                    dto as Record<string, unknown>
                );
            }

            return { success: true, audit: updated || audit };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update audit',
            };
        }
    }

    async deleteAudit(id: string, deletedBy: string): Promise<{ success: boolean; error?: string }> {
        try {
            const audit = await this.repository.findById(id);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (audit.status !== 'draft') {
                return { success: false, error: 'Can only delete audits in draft status' };
            }

            const deleted = await this.repository.delete(id);
            return { success: deleted };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete audit',
            };
        }
    }

    async startAudit(dto: StartAuditDto): Promise<AuditResult> {
        try {
            const audit = await this.repository.findById(dto.auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (audit.status !== 'draft') {
                return { success: false, error: 'Can only start audits in draft status' };
            }

            if (audit.totalItems === 0) {
                return { success: false, error: 'Audit has no items to audit' };
            }

            const updated = await this.repository.updateStatus(dto.auditId, 'in_progress');
            await this.repository.createHistory(
                dto.auditId,
                'started',
                dto.startedBy,
                'draft',
                'in_progress'
            );

            return { success: true, audit: updated || audit };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to start audit',
            };
        }
    }

    async submitForReview(
        auditId: string,
        submittedBy: string
    ): Promise<AuditResult> {
        try {
            const audit = await this.repository.findById(auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (audit.status !== 'in_progress') {
                return { success: false, error: 'Can only submit in_progress audits for review' };
            }

            const updated = await this.repository.updateStatus(auditId, 'reviewing');
            await this.repository.createHistory(
                auditId,
                'submitted_for_review',
                submittedBy,
                'in_progress',
                'reviewing'
            );

            return { success: true, audit: updated || audit };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to submit for review',
            };
        }
    }

    async checkCompletion(auditId: string): Promise<AuditCompletionCheck> {
        const progress = await this.repository.getAuditProgress(auditId);
        const discrepancies = await this.repository.findDiscrepancies(auditId, {
            resolutionStatus: 'unresolved',
        });

        const percentComplete = progress.progressPercent;
        const canComplete = percentComplete >= 95; // AUD-R03: 95% threshold

        const warnings: string[] = [];
        if (percentComplete < 100) {
            warnings.push(`${progress.pendingItems} items have not been audited`);
        }
        if (discrepancies.total > 0) {
            warnings.push(`${discrepancies.total} unresolved discrepancies`); // AUD-R04
        }

        return {
            canComplete,
            totalItems: progress.totalItems,
            auditedItems: progress.auditedItems,
            pendingItems: progress.pendingItems,
            percentComplete,
            hasUnresolvedDiscrepancies: discrepancies.total > 0,
            unresolvedCount: discrepancies.total,
            warnings,
        };
    }

    async completeAudit(dto: CompleteAuditDto): Promise<AuditResult> {
        try {
            const audit = await this.repository.findById(dto.auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (!['in_progress', 'reviewing'].includes(audit.status)) {
                return { success: false, error: 'Audit is not in a completable status' };
            }

            // AUD-R03: Check completion threshold
            const check = await this.checkCompletion(dto.auditId);
            if (!check.canComplete && !dto.overrideIncomplete) {
                return {
                    success: false,
                    error: `Cannot complete: less than 95% audited (${check.percentComplete}%). Use overrideIncomplete to force.`,
                };
            }

            const updated = await this.repository.updateStatus(
                dto.auditId,
                'completed',
                {
                    completedAt: new Date(),
                    completedBy: dto.completedBy,
                    completionNotes: dto.completionNotes,
                }
            );

            await this.repository.createHistory(
                dto.auditId,
                'completed',
                dto.completedBy,
                audit.status,
                'completed',
                {
                    overrideIncomplete: dto.overrideIncomplete,
                    completionNotes: dto.completionNotes,
                }
            );

            return { success: true, audit: updated || audit };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to complete audit',
            };
        }
    }

    async cancelAudit(dto: CancelAuditDto): Promise<AuditResult> {
        try {
            const audit = await this.repository.findById(dto.auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (['completed', 'cancelled'].includes(audit.status)) {
                return { success: false, error: 'Audit is already completed or cancelled' };
            }

            const updated = await this.repository.updateStatus(
                dto.auditId,
                'cancelled',
                {
                    cancelledAt: new Date(),
                    cancelledBy: dto.cancelledBy,
                    cancelReason: dto.reason,
                }
            );

            await this.repository.createHistory(
                dto.auditId,
                'cancelled',
                dto.cancelledBy,
                audit.status,
                'cancelled',
                { reason: dto.reason }
            );

            return { success: true, audit: updated || audit };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel audit',
            };
        }
    }

    async getAudits(query: AuditListQuery): Promise<PaginatedAudits> {
        const { data, total } = await this.repository.findAll(query);
        const page = query.page || 1;
        const limit = query.limit || 20;

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getMyAssignedAudits(userId: string): Promise<AuditSessionWithDetails[]> {
        return this.repository.findAuditsByAuditor(userId);
    }

    // ==================== Audit Item Operations ====================

    async auditItem(dto: AuditItemDto): Promise<AuditItemResult> {
        try {
            const audit = await this.repository.findById(dto.auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (audit.status !== 'in_progress') {
                return { success: false, error: 'Audit is not in progress' };
            }

            // Check if user is an auditor
            const isAuditor = await this.repository.isAuditor(dto.auditId, dto.auditedBy);
            if (!isAuditor) {
                return { success: false, error: 'User is not assigned as an auditor' };
            }

            const item = await this.repository.createAuditItem(dto);

            // AUD-R05: Log the audit action
            await this.repository.createHistory(
                dto.auditId,
                'item_audited',
                dto.auditedBy,
                undefined,
                undefined,
                {
                    assetId: dto.assetId,
                    status: dto.auditStatus,
                }
            );

            return { success: true, item };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to audit item',
            };
        }
    }

    async bulkAuditItems(dto: BulkAuditItemDto): Promise<BulkAuditResult> {
        const errors: Array<{ assetId: string; error: string }> = [];
        let processed = 0;

        for (const item of dto.items) {
            try {
                await this.repository.createAuditItem({
                    auditId: dto.auditId,
                    assetId: item.assetId,
                    auditStatus: item.auditStatus,
                    actualLocationId: item.actualLocationId,
                    notes: item.notes,
                    auditedBy: dto.auditedBy,
                });
                processed++;
            } catch (error) {
                errors.push({
                    assetId: item.assetId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return {
            success: errors.length === 0,
            processed,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    async getAuditItems(
        auditId: string,
        query: AuditItemListQuery
    ): Promise<PaginatedAuditItems> {
        const { data, total } = await this.repository.findAuditItemsByAuditId(
            auditId,
            query
        );
        const page = query.page || 1;
        const limit = query.limit || 20;

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getDiscrepancies(
        auditId: string,
        query: DiscrepancyQuery
    ): Promise<PaginatedAuditItems> {
        const { data, total } = await this.repository.findDiscrepancies(
            auditId,
            query
        );
        const page = query.page || 1;
        const limit = query.limit || 20;

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async resolveDiscrepancy(dto: ResolveDiscrepancyDto): Promise<AuditItemResult> {
        try {
            const item = await this.repository.findAuditItemById(dto.itemId);
            if (!item) {
                return { success: false, error: 'Audit item not found' };
            }

            if (!['missing', 'misplaced', 'condition_issue'].includes(item.auditStatus)) {
                return { success: false, error: 'Item is not a discrepancy' };
            }

            const resolved = await this.repository.resolveDiscrepancy(
                dto.itemId,
                dto.resolutionAction,
                dto.resolvedBy
            );

            // TODO: If updateAssetLocation is true, update the asset's location

            return { success: true, item: resolved || item };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resolve discrepancy',
            };
        }
    }

    async scanAsset(
        auditId: string,
        assetTag: string,
        scannedBy: string
    ): Promise<ScanResult> {
        const audit = await this.repository.findById(auditId);
        if (!audit || audit.status !== 'in_progress') {
            return {
                found: false,
                inAudit: false,
                message: 'Audit not active',
            };
        }

        // Look up asset by tag (would need assets repository)
        // For now, we'll search in audit items
        const items = await this.repository.findAuditItemsByAuditId(auditId, {
            search: assetTag,
            limit: 1,
        });

        if (items.data.length === 0) {
            return {
                found: false,
                inAudit: false,
                message: 'Asset not found in this audit scope. Add as unregistered?',
            };
        }

        const item = items.data[0];
        return {
            found: true,
            inAudit: true,
            asset: {
                id: item.assetId,
                assetTag: item.assetTag,
                name: item.assetName,
                expectedLocation: item.expectedLocationName,
                currentStatus: item.auditStatus,
            },
            message:
                item.auditStatus === 'pending'
                    ? 'Ready to audit'
                    : `Already audited: ${item.auditStatus}`,
        };
    }

    async getProgress(auditId: string): Promise<AuditProgress> {
        return this.repository.getAuditProgress(auditId);
    }

    // ==================== Unregistered Assets ====================

    async addUnregisteredAsset(
        dto: CreateUnregisteredAssetDto
    ): Promise<UnregisteredAsset> {
        const audit = await this.repository.findById(dto.auditId);
        if (!audit || !['in_progress', 'reviewing'].includes(audit.status)) {
            throw new Error('Audit not active');
        }

        const asset = await this.repository.createUnregisteredAsset(dto);

        await this.repository.createHistory(
            dto.auditId,
            'unregistered_asset_found',
            dto.foundBy,
            undefined,
            undefined,
            { temporaryId: dto.temporaryId, description: dto.description }
        );

        return asset;
    }

    async getUnregisteredAssets(
        auditId: string,
        query: UnregisteredAssetQuery
    ): Promise<PaginatedUnregisteredAssets> {
        const { data, total } = await this.repository.findUnregisteredAssetsByAuditId(
            auditId,
            query
        );
        const page = query.page || 1;
        const limit = query.limit || 20;

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateUnregisteredAsset(
        id: string,
        dto: UpdateUnregisteredAssetDto
    ): Promise<UnregisteredAsset | null> {
        return this.repository.updateUnregisteredAsset(id, dto);
    }

    // ==================== Auditor Management ====================

    async assignAuditor(dto: AssignAuditorDto): Promise<{ success: boolean; error?: string }> {
        try {
            const audit = await this.repository.findById(dto.auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (['completed', 'cancelled'].includes(audit.status)) {
                return { success: false, error: 'Cannot modify completed or cancelled audit' };
            }

            await this.repository.addAuditor(
                dto.auditId,
                dto.userId,
                dto.locationId,
                dto.isLead
            );

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to assign auditor',
            };
        }
    }

    async removeAuditor(
        auditId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const audit = await this.repository.findById(auditId);
            if (!audit) {
                return { success: false, error: 'Audit not found' };
            }

            if (['completed', 'cancelled'].includes(audit.status)) {
                return { success: false, error: 'Cannot modify completed or cancelled audit' };
            }

            // Check we're not removing the last auditor (AUD-R02)
            const auditors = await this.repository.findAuditorsByAuditId(auditId);
            if (auditors.length <= 1) {
                return { success: false, error: 'Cannot remove the last auditor' };
            }

            const removed = await this.repository.removeAuditor(auditId, userId);
            return { success: removed };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to remove auditor',
            };
        }
    }

    async getAuditors(auditId: string): Promise<AuditAuditorWithDetails[]> {
        return this.repository.findAuditorsByAuditId(auditId);
    }

    // ==================== Statistics ====================

    async getStatistics(organizationId?: string): Promise<AuditStatistics> {
        return this.repository.getStatistics(organizationId);
    }
}
