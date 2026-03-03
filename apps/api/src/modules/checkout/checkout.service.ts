/**
 * Checkout Module - Service Layer
 * Business logic for asset checkout/checkin management
 */

import { Pool, PoolClient } from 'pg';
import { CheckoutRepository } from './checkout.repository.js';
import {
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
    PaginatedResponse,
    CheckoutSummary,
    OverdueCheckout,
    OverdueProcessingResult
} from './checkout.types.js';

export class CheckoutService {
    private readonly repository: CheckoutRepository;

    constructor(private readonly pool: Pool) {
        this.repository = new CheckoutRepository(pool);
    }

    // ==================== Checkout Operations ====================

    /**
     * Checkout an asset to a user, location, or another asset
     * Business Rules:
     * - CHK-R01: Only checkout asset with status = available
     * - CHK-R02: Only checkout to active user (for user type)
     * - CHK-R04: One asset = one active checkout
     */
    async checkoutAsset(data: CheckoutAssetDto): Promise<AssetCheckoutWithDetails> {
        const client = await this.repository.getClient();

        try {
            await this.repository.beginTransaction(client);

            // CHK-R04: Check for existing active checkout
            const existingCheckout = await this.repository.findActiveByAssetId(data.assetId);
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
            const checkout = await this.repository.checkout(data, client);

            // Update asset status to 'checked_out'
            await client.query(
                `UPDATE assets SET status = 'checked_out', updated_at = NOW() WHERE id = $1`,
                [data.assetId]
            );

            // Create audit log
            await this.repository.createAuditLog({
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

            await this.repository.commitTransaction(client);

            // Get full details
            const result = await this.repository.findByIdWithDetails(checkout.id);
            if (!result) {
                throw new Error('Failed to retrieve checkout details');
            }

            return result;
        } catch (error) {
            await this.repository.rollbackTransaction(client);
            throw error;
        } finally {
            this.repository.releaseClient(client);
        }
    }

    /**
     * Check in an asset
     * Business Rules:
     * - CHK-R05: Must be currently checked out
     */
    async checkinAsset(data: CheckinAssetDto): Promise<AssetCheckoutWithDetails> {
        const client = await this.repository.getClient();

        try {
            await this.repository.beginTransaction(client);

            // Get existing checkout
            const existingCheckout = await this.repository.findById(data.checkoutId);
            if (!existingCheckout) {
                throw new Error('Checkout record not found');
            }

            // CHK-R05: Must be currently checked out
            if (existingCheckout.status !== 'checked_out') {
                throw new Error('Asset is not currently checked out');
            }

            // Perform checkin
            const checkout = await this.repository.checkin(data, client);
            if (!checkout) {
                throw new Error('Failed to check in asset');
            }

            // Update asset status based on next action
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

            // Create audit log
            await this.repository.createAuditLog({
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

            await this.repository.commitTransaction(client);

            // Get full details
            const result = await this.repository.findByIdWithDetails(checkout.id);
            if (!result) {
                throw new Error('Failed to retrieve checkout details');
            }

            return result;
        } catch (error) {
            await this.repository.rollbackTransaction(client);
            throw error;
        } finally {
            this.repository.releaseClient(client);
        }
    }

    // ==================== Read Operations ====================

    async getCheckout(id: string): Promise<AssetCheckout | null> {
        return this.repository.findById(id);
    }

    async getCheckoutWithDetails(id: string): Promise<AssetCheckoutWithDetails | null> {
        return this.repository.findByIdWithDetails(id);
    }

    async getCheckoutByCode(code: string): Promise<AssetCheckout | null> {
        return this.repository.findByCode(code);
    }

    async getActiveCheckoutByAssetId(assetId: string): Promise<AssetCheckout | null> {
        return this.repository.findActiveByAssetId(assetId);
    }

    async listCheckouts(query: CheckoutListQuery): Promise<PaginatedResponse<AssetCheckoutWithDetails>> {
        return this.repository.list(query);
    }

    async getHistory(query: CheckoutHistoryQuery): Promise<PaginatedResponse<AssetCheckoutWithDetails>> {
        return this.repository.getHistory(query);
    }

    async getSummary(organizationId?: string): Promise<CheckoutSummary> {
        return this.repository.getSummary(organizationId);
    }

    // ==================== Extension Operations ====================

    /**
     * Extend a checkout's expected return date
     * Business Rules:
     * - Must be currently checked out
     * - New date must be in the future
     */
    async extendCheckout(data: ExtendCheckoutDto): Promise<CheckoutExtension> {
        const client = await this.repository.getClient();

        try {
            await this.repository.beginTransaction(client);

            // Validate checkout exists and is active
            const checkout = await this.repository.findById(data.checkoutId);
            if (!checkout) {
                throw new Error('Checkout record not found');
            }

            if (checkout.status !== 'checked_out') {
                throw new Error('Cannot extend a checkout that is not active');
            }

            // Validate new date is in the future
            const newDate = new Date(data.newExpectedDate);
            if (newDate <= new Date()) {
                throw new Error('New expected date must be in the future');
            }

            // Create extension
            const extension = await this.repository.createExtension(data, client);

            // Create audit log
            await this.repository.createAuditLog({
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

            await this.repository.commitTransaction(client);

            return extension;
        } catch (error) {
            await this.repository.rollbackTransaction(client);
            throw error;
        } finally {
            this.repository.releaseClient(client);
        }
    }

    async listExtensions(query: ExtensionListQuery): Promise<PaginatedResponse<CheckoutExtensionWithDetails>> {
        return this.repository.listExtensions(query);
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
        const client = await this.repository.getClient();

        try {
            await this.repository.beginTransaction(client);

            // Validate original checkout
            const originalCheckout = await this.repository.findById(data.checkoutId);
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

            // Validate target user exists and is active
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

            // Create transfer (handles checkin of original + checkout to new user)
            const result = await this.repository.createTransfer(data, client);

            // Create audit log
            await this.repository.createAuditLog({
                checkoutId: result.newCheckout.id,
                assetId: originalCheckout.assetId,
                action: `Asset transferred from user ${originalCheckout.targetUserId} to ${data.toUserId}`,
                actionType: 'transfer',
                oldValues: {
                    checkoutId: originalCheckout.id,
                    targetUserId: originalCheckout.targetUserId
                },
                newValues: {
                    checkoutId: result.newCheckout.id,
                    targetUserId: data.toUserId
                },
                performedBy: data.transferredBy,
                ipAddress: null,
                userAgent: null,
                notes: data.transferReason ?? null
            }, client);

            await this.repository.commitTransaction(client);

            return result;
        } catch (error) {
            await this.repository.rollbackTransaction(client);
            throw error;
        } finally {
            this.repository.releaseClient(client);
        }
    }

    async listTransfers(query: TransferListQuery): Promise<PaginatedResponse<CheckoutTransferWithDetails>> {
        return this.repository.listTransfers(query);
    }

    // ==================== Overdue Operations ====================

    /**
     * Get all overdue checkouts
     */
    async getOverdueCheckouts(): Promise<OverdueCheckout[]> {
        return this.repository.getOverdueCheckouts();
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
            // Update overdue status for all past-due checkouts
            const updated = await this.repository.updateOverdueStatus();
            result.processed = updated;

            // Get all overdue checkouts for notification
            const overdueCheckouts = await this.repository.getOverdueCheckouts();

            // Mark as notified and increment count
            const checkoutIds = overdueCheckouts.map(c => c.checkoutId);
            if (checkoutIds.length > 0) {
                await this.repository.markAsOverdue(checkoutIds);
                result.notificationsSent = checkoutIds.length;

                // Create audit logs for notifications
                for (const checkout of overdueCheckouts) {
                    await this.repository.createAuditLog({
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
        return this.repository.getAuditLogs(checkoutId, assetId, limit);
    }
}
