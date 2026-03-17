/**
 * Checkout Module - Service Layer
 * Business logic for asset checkout/checkin management
 */

import type { PoolClient } from 'pg';
import type {
    AssetCheckout,
    AssetCheckoutWithDetails,
    CheckoutExtension,
    CheckoutExtensionWithDetails,
    CheckoutTransfer,
    CheckoutTransferWithDetails,
    CheckoutAuditLog,
    CheckoutAssetDto,
    CheckinAssetDto,
    ExtendCheckoutDto,
    TransferAssetDto,
    CheckoutListQuery,
    CheckoutHistoryQuery,
    ExtensionListQuery,
    TransferListQuery,
    CheckoutPaginatedResponse,
    CheckoutSummary,
    OverdueCheckout,
    OverdueProcessingResult
} from '@qltb/contracts';

// ==================== Repository Interface ====================

export interface ICheckoutRepository {
    checkout(dto: CheckoutAssetDto, client?: PoolClient): Promise<AssetCheckout>;
    checkin(dto: CheckinAssetDto, client?: PoolClient): Promise<AssetCheckout | null>;
    findById(id: string): Promise<AssetCheckout | null>;
    findByIdWithDetails(id: string): Promise<AssetCheckoutWithDetails | null>;
    findByCode(code: string): Promise<AssetCheckout | null>;
    findActiveByAssetId(assetId: string): Promise<AssetCheckout | null>;
    list(query: CheckoutListQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>>;
    createExtension(dto: ExtendCheckoutDto, client?: PoolClient): Promise<CheckoutExtension>;
    listExtensions(query: ExtensionListQuery): Promise<CheckoutPaginatedResponse<CheckoutExtensionWithDetails>>;
    createTransfer(dto: TransferAssetDto, client?: PoolClient): Promise<{ transfer: CheckoutTransfer; newCheckout: AssetCheckout }>;
    listTransfers(query: TransferListQuery): Promise<CheckoutPaginatedResponse<CheckoutTransferWithDetails>>;
    getOverdueCheckouts(): Promise<OverdueCheckout[]>;
    markAsOverdue(checkoutIds: string[]): Promise<number>;
    updateOverdueStatus(): Promise<number>;
    getHistory(query: CheckoutHistoryQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>>;
    getSummary(organizationId?: string): Promise<CheckoutSummary>;
    createAuditLog(log: Omit<CheckoutAuditLog, 'id' | 'performedAt'>, client?: PoolClient): Promise<CheckoutAuditLog>;
    getAuditLogs(checkoutId?: string, assetId?: string, limit?: number): Promise<CheckoutAuditLog[]>;
    getClient(): Promise<PoolClient>;
    beginTransaction(client: PoolClient): Promise<void>;
    commitTransaction(client: PoolClient): Promise<void>;
    rollbackTransaction(client: PoolClient): Promise<void>;
    releaseClient(client: PoolClient): void;
}

// ==================== Service Class ====================

export class CheckoutService {
    constructor(private readonly repo: ICheckoutRepository) { }

    // ==================== Checkout Operations ====================

    /**
     * Checkout an asset to a user, location, or another asset
     * Business Rules:
     * - CHK-R01: Only checkout asset with status = available
     * - CHK-R02: Only checkout to active user (for user type)
     * - CHK-R04: One asset = one active checkout
     */
    async checkoutAsset(data: CheckoutAssetDto): Promise<AssetCheckoutWithDetails> {
        const client = await this.repo.getClient();

        try {
            await this.repo.beginTransaction(client);

            // CHK-R04: Check for existing active checkout
            const existingCheckout = await this.repo.findActiveByAssetId(data.assetId);
            if (existingCheckout) {
                throw new Error('Asset already has an active checkout. Please check it in first.');
            }

            // CHK-R01: Validate asset is available
            const assetResult = await client.query(
                `SELECT id, asset_tag, name, status FROM assets WHERE id = $1`,
                [data.assetId]
            );

            if (assetResult.rows.length === 0) {
                throw new Error('Asset not found');
            }

            const asset = assetResult.rows[0];
            if (asset.status !== 'available') {
                throw new Error(`Asset is not available for checkout (current status: ${asset.status})`);
            }

            // CHK-R02: Validate target based on checkout type
            if (data.checkoutType === 'user') {
                if (!data.targetUserId) {
                    throw new Error('Target user is required for user checkout');
                }

                const userResult = await client.query(
                    `SELECT id, name, is_active FROM users WHERE id = $1`,
                    [data.targetUserId]
                );

                if (userResult.rows.length === 0) {
                    throw new Error('Target user not found');
                }

                if (!userResult.rows[0].is_active) {
                    throw new Error('Cannot checkout to inactive user');
                }
            } else if (data.checkoutType === 'location') {
                if (!data.targetLocationId) {
                    throw new Error('Target location is required for location checkout');
                }

                const locationResult = await client.query(
                    `SELECT id, name FROM locations WHERE id = $1`,
                    [data.targetLocationId]
                );

                if (locationResult.rows.length === 0) {
                    throw new Error('Target location not found');
                }
            } else if (data.checkoutType === 'asset') {
                if (!data.targetAssetId) {
                    throw new Error('Target asset is required for asset checkout');
                }

                const targetAssetResult = await client.query(
                    `SELECT id, asset_tag, name FROM assets WHERE id = $1`,
                    [data.targetAssetId]
                );

                if (targetAssetResult.rows.length === 0) {
                    throw new Error('Target asset not found');
                }
            }

            // Create checkout record
            const checkout = await this.repo.checkout(data, client);

            // Update asset status to 'checked_out'
            await client.query(
                `UPDATE assets SET status = 'checked_out', updated_at = NOW() WHERE id = $1`,
                [data.assetId]
            );

            // Create audit log
            await this.repo.createAuditLog({
                checkoutId: checkout.id,
                assetId: data.assetId,
                action: `Asset checked out to ${data.checkoutType}`,
                actionType: 'checkout',
                oldValues: null,
                newValues: data as unknown as Record<string, unknown>,
                performedBy: data.checkedOutBy,
                ipAddress: null,
                userAgent: null,
                notes: data.checkoutNotes ?? null
            }, client);

            await this.repo.commitTransaction(client);

            const result = await this.repo.findByIdWithDetails(checkout.id);
            if (!result) {
                throw new Error('Failed to retrieve checkout details');
            }

            return result;
        } catch (error) {
            await this.repo.rollbackTransaction(client);
            throw error;
        } finally {
            this.repo.releaseClient(client);
        }
    }

    /**
     * Check in an asset
     * Business Rules:
     * - CHK-R05: Must be currently checked out
     */
    async checkinAsset(data: CheckinAssetDto): Promise<AssetCheckoutWithDetails> {
        const client = await this.repo.getClient();

        try {
            await this.repo.beginTransaction(client);

            const existingCheckout = await this.repo.findById(data.checkoutId);
            if (!existingCheckout) {
                throw new Error('Checkout record not found');
            }

            // CHK-R05: Must be currently checked out
            if (existingCheckout.status !== 'checked_out') {
                throw new Error('Asset is not currently checked out');
            }

            const checkout = await this.repo.checkin(data, client);
            if (!checkout) {
                throw new Error('Failed to check in asset');
            }

            let newStatus = 'available';
            if (data.nextAction === 'maintenance') {
                newStatus = 'maintenance';
            } else if (data.nextAction === 'retire') {
                newStatus = 'retired';
            }

            await client.query(
                `UPDATE assets SET status = $1, updated_at = NOW() WHERE id = $2`,
                [newStatus, existingCheckout.assetId]
            );

            await this.repo.createAuditLog({
                checkoutId: checkout.id,
                assetId: existingCheckout.assetId,
                action: `Asset checked in (condition: ${data.checkinCondition}, next: ${data.nextAction})`,
                actionType: 'checkin',
                oldValues: existingCheckout as unknown as Record<string, unknown>,
                newValues: data as unknown as Record<string, unknown>,
                performedBy: data.checkedInBy,
                ipAddress: null,
                userAgent: null,
                notes: data.checkinNotes ?? null
            }, client);

            await this.repo.commitTransaction(client);

            const result = await this.repo.findByIdWithDetails(checkout.id);
            if (!result) {
                throw new Error('Failed to retrieve checkout details');
            }

            return result;
        } catch (error) {
            await this.repo.rollbackTransaction(client);
            throw error;
        } finally {
            this.repo.releaseClient(client);
        }
    }

    // ==================== Read Operations ====================

    async getCheckout(id: string): Promise<AssetCheckout | null> {
        return this.repo.findById(id);
    }

    async getCheckoutWithDetails(id: string): Promise<AssetCheckoutWithDetails | null> {
        return this.repo.findByIdWithDetails(id);
    }

    async getCheckoutByCode(code: string): Promise<AssetCheckout | null> {
        return this.repo.findByCode(code);
    }

    async getActiveCheckoutByAssetId(assetId: string): Promise<AssetCheckout | null> {
        return this.repo.findActiveByAssetId(assetId);
    }

    async listCheckouts(query: CheckoutListQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>> {
        return this.repo.list(query);
    }

    async getHistory(query: CheckoutHistoryQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>> {
        return this.repo.getHistory(query);
    }

    async getSummary(organizationId?: string): Promise<CheckoutSummary> {
        return this.repo.getSummary(organizationId);
    }

    // ==================== Extension Operations ====================

    /**
     * Extend a checkout's expected return date
     * Business Rules:
     * - Must be currently checked out
     * - New date must be in the future
     */
    async extendCheckout(data: ExtendCheckoutDto): Promise<CheckoutExtension> {
        const client = await this.repo.getClient();

        try {
            await this.repo.beginTransaction(client);

            const checkout = await this.repo.findById(data.checkoutId);
            if (!checkout) {
                throw new Error('Checkout record not found');
            }

            if (checkout.status !== 'checked_out') {
                throw new Error('Cannot extend a checkout that is not active');
            }

            const newDate = new Date(data.newExpectedDate);
            if (newDate <= new Date()) {
                throw new Error('New expected date must be in the future');
            }

            const extension = await this.repo.createExtension(data, client);

            await this.repo.createAuditLog({
                checkoutId: checkout.id,
                assetId: checkout.assetId,
                action: `Checkout extended to ${data.newExpectedDate}`,
                actionType: 'extend',
                oldValues: { expectedCheckinDate: checkout.expectedCheckinDate },
                newValues: { expectedCheckinDate: data.newExpectedDate },
                performedBy: data.extendedBy,
                ipAddress: null,
                userAgent: null,
                notes: data.extensionReason ?? null
            }, client);

            await this.repo.commitTransaction(client);

            return extension;
        } catch (error) {
            await this.repo.rollbackTransaction(client);
            throw error;
        } finally {
            this.repo.releaseClient(client);
        }
    }

    async listExtensions(query: ExtensionListQuery): Promise<CheckoutPaginatedResponse<CheckoutExtensionWithDetails>> {
        return this.repo.listExtensions(query);
    }

    // ==================== Transfer Operations ====================

    /**
     * Transfer an asset from one user to another
     * Business Rules:
     * - CHK-R07: Transfer = Checkin from A + Checkout to B
     * - Original checkout must be active and to a user
     * - Target user must be active
     */
    async transferAsset(data: TransferAssetDto): Promise<{ transfer: CheckoutTransfer; newCheckout: AssetCheckout }> {
        const client = await this.repo.getClient();

        try {
            await this.repo.beginTransaction(client);

            const originalCheckout = await this.repo.findById(data.checkoutId);
            if (!originalCheckout) {
                throw new Error('Checkout record not found');
            }

            if (originalCheckout.status !== 'checked_out') {
                throw new Error('Cannot transfer a checkout that is not active');
            }

            if (originalCheckout.checkoutType !== 'user') {
                throw new Error('Transfers are only supported for user checkouts');
            }

            if (originalCheckout.targetUserId === data.toUserId) {
                throw new Error('Cannot transfer to the same user');
            }

            const userResult = await client.query(
                `SELECT id, name, is_active FROM users WHERE id = $1`,
                [data.toUserId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Target user not found');
            }

            if (!userResult.rows[0].is_active) {
                throw new Error('Cannot transfer to inactive user');
            }

            const result = await this.repo.createTransfer(data, client);

            await this.repo.createAuditLog({
                checkoutId: result.newCheckout.id,
                assetId: originalCheckout.assetId,
                action: `Asset transferred from user ${originalCheckout.targetUserId} to ${data.toUserId}`,
                actionType: 'transfer',
                oldValues: { checkoutId: originalCheckout.id, targetUserId: originalCheckout.targetUserId },
                newValues: { checkoutId: result.newCheckout.id, targetUserId: data.toUserId },
                performedBy: data.transferredBy,
                ipAddress: null,
                userAgent: null,
                notes: data.transferReason ?? null
            }, client);

            await this.repo.commitTransaction(client);

            return result;
        } catch (error) {
            await this.repo.rollbackTransaction(client);
            throw error;
        } finally {
            this.repo.releaseClient(client);
        }
    }

    async listTransfers(query: TransferListQuery): Promise<CheckoutPaginatedResponse<CheckoutTransferWithDetails>> {
        return this.repo.listTransfers(query);
    }

    // ==================== Overdue Operations ====================

    async getOverdueCheckouts(): Promise<OverdueCheckout[]> {
        return this.repo.getOverdueCheckouts();
    }

    /**
     * Process overdue checkouts - update status and prepare notifications
     * Business Rules:
     * - CHK-R06: Overdue → daily reminder
     */
    async processOverdueCheckouts(): Promise<OverdueProcessingResult> {
        const result: OverdueProcessingResult = {
            processed: 0,
            notificationsSent: 0,
            errors: []
        };

        try {
            const updated = await this.repo.updateOverdueStatus();
            result.processed = updated;

            const overdueCheckouts = await this.repo.getOverdueCheckouts();

            const checkoutIds = overdueCheckouts.map(c => c.checkoutId);
            if (checkoutIds.length > 0) {
                await this.repo.markAsOverdue(checkoutIds);
                result.notificationsSent = checkoutIds.length;

                for (const checkout of overdueCheckouts) {
                    await this.repo.createAuditLog({
                        checkoutId: checkout.checkoutId,
                        assetId: checkout.assetId,
                        action: `Overdue reminder sent (${checkout.daysOverdue} days overdue)`,
                        actionType: 'overdue_reminder',
                        oldValues: null,
                        newValues: { daysOverdue: checkout.daysOverdue },
                        performedBy: 'system',
                        ipAddress: null,
                        userAgent: null,
                        notes: `Notification #${checkout.notificationCount + 1}`
                    });
                }
            }
        } catch (error) {
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        return result;
    }

    // ==================== Audit Log Operations ====================

    async getAuditLogs(checkoutId?: string, assetId?: string, limit = 50): Promise<CheckoutAuditLog[]> {
        return this.repo.getAuditLogs(checkoutId, assetId, limit);
    }
}
