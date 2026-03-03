/**
 * License Module - Service Layer
 * Business logic for license management
 */
import type { Pool } from 'pg';
import { LicenseRepository } from './license.repository.js';
import type {
    License,
    LicenseWithUsage,
    LicenseSeat,
    LicenseSeatWithDetails,
    LicenseAuditLog,
    Supplier,
    LicenseCategory,
    CreateLicenseDto,
    UpdateLicenseDto,
    AssignSeatDto,
    LicenseListQuery,
    PaginatedResult
} from './license.types.js';

export class LicenseService {
    private repository: LicenseRepository;

    constructor(db: Pool) {
        this.repository = new LicenseRepository(db);
    }

    // ==================== License CRUD ====================

    /**
     * Create a new license
     */
    async createLicense(data: CreateLicenseDto, userId: string): Promise<LicenseWithUsage> {
        const license = await this.repository.create(data, userId);

        // Log audit
        await this.repository.logAudit(
            license.id,
            'created',
            userId,
            undefined,
            { ...data },
            'License created'
        );

        return {
            ...license,
            seatsUsed: 0,
            seatsAvailable: license.seatCount,
            usagePercentage: 0
        };
    }

    /**
     * Get license by ID with usage info
     */
    async getLicense(id: string): Promise<LicenseWithUsage | null> {
        return this.repository.findByIdWithUsage(id);
    }

    /**
     * Get license by code
     */
    async getLicenseByCode(code: string): Promise<License | null> {
        return this.repository.findByCode(code);
    }

    /**
     * List licenses with filters and pagination
     */
    async listLicenses(query: LicenseListQuery): Promise<PaginatedResult<LicenseWithUsage>> {
        return this.repository.list(query);
    }

    /**
     * Update license
     */
    async updateLicense(id: string, data: UpdateLicenseDto, userId: string): Promise<LicenseWithUsage | null> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            return null;
        }

        // Validate seat count reduction
        if (data.seatCount !== undefined && data.seatCount < existing.seatCount) {
            const currentSeats = await this.repository.countSeats(id);
            if (data.seatCount < currentSeats) {
                throw new Error(`Cannot reduce seats below current usage (${currentSeats} seats in use)`);
            }
        }

        const updated = await this.repository.update(id, data, userId);
        if (!updated) return null;

        // Log audit
        await this.repository.logAudit(
            id,
            'updated',
            userId,
            this.licenseToRecord(existing),
            this.licenseToRecord(updated),
            'License updated'
        );

        return this.repository.findByIdWithUsage(id);
    }

    /**
     * Delete license (only draft licenses with no seats)
     */
    async deleteLicense(id: string, userId: string): Promise<boolean> {
        const license = await this.repository.findById(id);
        if (!license) {
            return false;
        }

        if (license.status !== 'draft') {
            throw new Error('Only draft licenses can be deleted. Use retire for active licenses.');
        }

        const seatsCount = await this.repository.countSeats(id);
        if (seatsCount > 0) {
            throw new Error('Cannot delete license with assigned seats.');
        }

        // Log audit before deletion
        await this.repository.logAudit(
            id,
            'deleted',
            userId,
            this.licenseToRecord(license),
            undefined,
            'License deleted'
        );

        return this.repository.delete(id);
    }

    /**
     * Activate a draft license
     */
    async activateLicense(id: string, userId: string): Promise<LicenseWithUsage | null> {
        const license = await this.repository.findById(id);
        if (!license) {
            return null;
        }

        if (license.status !== 'draft') {
            throw new Error(`Cannot activate license with status: ${license.status}`);
        }

        const updated = await this.repository.activate(id, userId);
        if (!updated) return null;

        await this.repository.logAudit(
            id,
            'status_changed',
            userId,
            { status: 'draft' },
            { status: 'active' },
            'License activated'
        );

        return this.repository.findByIdWithUsage(id);
    }

    /**
     * Retire a license (must have no assigned seats)
     */
    async retireLicense(id: string, userId: string): Promise<LicenseWithUsage | null> {
        const license = await this.repository.findById(id);
        if (!license) {
            return null;
        }

        if (license.status !== 'active' && license.status !== 'expired') {
            throw new Error(`Cannot retire license with status: ${license.status}`);
        }

        const updated = await this.repository.retire(id, userId);
        if (!updated) return null;

        await this.repository.logAudit(
            id,
            'status_changed',
            userId,
            { status: license.status },
            { status: 'retired' },
            'License retired'
        );

        return this.repository.findByIdWithUsage(id);
    }

    // ==================== Seat Management ====================

    /**
     * Assign a seat to user or asset
     */
    async assignSeat(licenseId: string, data: AssignSeatDto, userId: string): Promise<LicenseSeat> {
        const license = await this.repository.findById(licenseId);
        if (!license) {
            throw new Error('License not found');
        }

        if (license.status !== 'active') {
            throw new Error(`Cannot assign seat: License status is ${license.status}`);
        }

        // Check for duplicate assignment
        if (data.assignmentType === 'user' && data.assignedUserId) {
            const exists = await this.repository.checkUserSeatExists(licenseId, data.assignedUserId);
            if (exists) {
                throw new Error('User already has a seat for this license');
            }
        }

        if (data.assignmentType === 'asset' && data.assignedAssetId) {
            const exists = await this.repository.checkAssetSeatExists(licenseId, data.assignedAssetId);
            if (exists) {
                throw new Error('Asset already has a seat for this license');
            }
        }

        // Check seat availability (for non-unlimited licenses)
        if (license.licenseType !== 'unlimited') {
            const currentSeats = await this.repository.countSeats(licenseId);
            if (currentSeats >= license.seatCount) {
                throw new Error(`Cannot assign seat: License has reached maximum seats (${license.seatCount})`);
            }
        }

        const seat = await this.repository.assignSeat(licenseId, data, userId);

        await this.repository.logAudit(
            licenseId,
            'seat_assigned',
            userId,
            undefined,
            {
                seatId: seat.id,
                assignmentType: data.assignmentType,
                assignedUserId: data.assignedUserId,
                assignedAssetId: data.assignedAssetId
            },
            data.notes || 'Seat assigned'
        );

        return seat;
    }

    /**
     * Revoke a seat
     */
    async revokeSeat(licenseId: string, seatId: string, userId: string, reason?: string): Promise<boolean> {
        const seat = await this.repository.getSeat(seatId);
        if (!seat || seat.licenseId !== licenseId) {
            throw new Error('Seat not found');
        }

        await this.repository.logAudit(
            licenseId,
            'seat_revoked',
            userId,
            {
                seatId: seat.id,
                assignmentType: seat.assignmentType,
                assignedUserId: seat.assignedUserId,
                assignedAssetId: seat.assignedAssetId
            },
            undefined,
            reason || 'Seat revoked'
        );

        return this.repository.revokeSeat(seatId);
    }

    /**
     * Get all seats for a license
     */
    async getSeats(licenseId: string): Promise<LicenseSeatWithDetails[]> {
        return this.repository.getSeats(licenseId);
    }

    /**
     * Get seat count for a license
     */
    async getSeatCount(licenseId: string): Promise<number> {
        return this.repository.countSeats(licenseId);
    }

    // ==================== Audit & History ====================

    /**
     * Get audit logs for a license
     */
    async getAuditLogs(licenseId: string): Promise<LicenseAuditLog[]> {
        return this.repository.getAuditLogs(licenseId);
    }

    // ==================== Lookups ====================

    /**
     * Get all suppliers
     */
    async getSuppliers(): Promise<Supplier[]> {
        return this.repository.getSuppliers();
    }

    /**
     * Get supplier by ID
     */
    async getSupplier(id: string): Promise<Supplier | null> {
        return this.repository.getSupplierById(id);
    }

    /**
     * Create supplier
     */
    async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
        return this.repository.createSupplier(data);
    }

    /**
     * Get all license categories
     */
    async getCategories(): Promise<LicenseCategory[]> {
        return this.repository.getCategories();
    }

    // ==================== Alerts & Compliance ====================

    /**
     * Get licenses expiring within X days
     */
    async getExpiringLicenses(days: number = 30): Promise<LicenseWithUsage[]> {
        const result = await this.repository.list({
            status: 'active',
            expiringInDays: days,
            limit: 100
        });
        return result.data;
    }

    /**
     * Get over-licensed software (usage > seats)
     */
    async getOverLicensed(): Promise<LicenseWithUsage[]> {
        const result = await this.repository.list({
            status: 'active',
            overSeats: true,
            limit: 100
        });
        return result.data;
    }

    /**
     * Get compliance summary
     */
    async getComplianceSummary(): Promise<{
        total: number;
        active: number;
        expired: number;
        expiringIn30Days: number;
        overLicensed: number;
        totalSeats: number;
        usedSeats: number;
        usagePercentage: number;
    }> {
        const [allLicenses, expiring, overLicensed] = await Promise.all([
            this.repository.list({ limit: 1000 }),
            this.getExpiringLicenses(30),
            this.getOverLicensed()
        ]);

        const active = allLicenses.data.filter(l => l.status === 'active').length;
        const expired = allLicenses.data.filter(l => l.status === 'expired').length;

        const totalSeats = allLicenses.data
            .filter(l => l.licenseType !== 'unlimited')
            .reduce((sum, l) => sum + l.seatCount, 0);
        const usedSeats = allLicenses.data.reduce((sum, l) => sum + l.seatsUsed, 0);

        return {
            total: allLicenses.pagination.total,
            active,
            expired,
            expiringIn30Days: expiring.length,
            overLicensed: overLicensed.length,
            totalSeats,
            usedSeats,
            usagePercentage: totalSeats > 0
                ? Math.round((usedSeats / totalSeats) * 100 * 100) / 100
                : 0
        };
    }

    // ==================== Helpers ====================

    private licenseToRecord(license: License): Record<string, unknown> {
        return {
            softwareName: license.softwareName,
            supplierId: license.supplierId,
            categoryId: license.categoryId,
            licenseType: license.licenseType,
            seatCount: license.seatCount,
            unitPrice: license.unitPrice,
            purchaseDate: license.purchaseDate,
            expiryDate: license.expiryDate,
            status: license.status
        };
    }
}
