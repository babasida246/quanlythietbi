/**
 * License Service Tests
 * Unit tests for the license service layer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LicenseService } from './license.service.js'
import type { Pool } from 'pg'

// Create mock pool with query function
const createMockPool = () => {
    const queryFn = vi.fn()
    return {
        query: queryFn,
        _queryFn: queryFn
    } as unknown as Pool & { _queryFn: ReturnType<typeof vi.fn> }
}

describe('LicenseService', () => {
    let mockPool: Pool & { _queryFn: ReturnType<typeof vi.fn> }
    let service: LicenseService
    let queryFn: ReturnType<typeof vi.fn>

    const mockLicenseRow = {
        id: 'lic-001',
        license_code: 'LIC-20241201-0001',
        software_name: 'Microsoft Office 365',
        supplier_id: 'sup-001',
        category_id: 'cat-001',
        license_type: 'per_seat',
        product_key: 'XXXXX-XXXXX',
        seat_count: 100,
        unit_price: 1000000,
        currency: 'VND',
        purchase_date: '2024-01-01',
        expiry_date: '2025-01-01',
        warranty_date: null,
        invoice_number: 'INV-001',
        notes: 'Test',
        organization_id: 'org-001',
        status: 'draft',
        created_by: 'user-001',
        updated_by: 'user-001',
        created_at: new Date(),
        updated_at: new Date()
    }

    const mockLicenseWithUsageRow = {
        ...mockLicenseRow,
        supplier_name: 'Microsoft',
        category_name: 'Office Suite',
        seats_used: '50'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPool = createMockPool()
        queryFn = mockPool._queryFn
        service = new LicenseService(mockPool)
    })

    // ==================== License CRUD Tests ====================

    describe('createLicense', () => {
        it('should create a license successfully', async () => {
            // Mock generateLicenseCode query (no existing license codes)
            queryFn.mockResolvedValueOnce({ rows: [] })
            // Mock create query
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] })
            // Mock audit log insert (returns nothing)
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.createLicense({
                softwareName: 'Microsoft Office 365',
                seatCount: 100,
                supplierId: 'sup-001',
                categoryId: 'cat-001',
                licenseType: 'per_seat'
            }, 'user-001')

            expect(result).toBeDefined()
            expect(result.softwareName).toBe('Microsoft Office 365')
            expect(result.seatsUsed).toBe(0)
            expect(result.seatsAvailable).toBe(100)
            expect(queryFn).toHaveBeenCalledTimes(3) // generateLicenseCode + create + audit
        })
    })

    describe('getLicense', () => {
        it('should return license with usage', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseWithUsageRow] })

            const result = await service.getLicense('lic-001')

            expect(result).toBeDefined()
            expect(result?.seatsUsed).toBe(50)
            expect(result?.seatsAvailable).toBe(50)
        })

        it('should return null for non-existent license', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.getLicense('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('listLicenses', () => {
        it('should return paginated list', async () => {
            // Count query
            queryFn.mockResolvedValueOnce({ rows: [{ count: '1' }] })
            // Data query
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseWithUsageRow] })

            const result = await service.listLicenses({ page: 1, limit: 20 })

            expect(result.data).toHaveLength(1)
            expect(result.pagination.total).toBe(1)
        })
    })

    describe('updateLicense', () => {
        it('should update license successfully', async () => {
            const updatedRow = { ...mockLicenseRow, software_name: 'Updated Software' }
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] })
            // update
            queryFn.mockResolvedValueOnce({ rows: [updatedRow] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // findByIdWithUsage
            queryFn.mockResolvedValueOnce({ rows: [{ ...updatedRow, seats_used: '0', supplier_name: null, category_name: null }] })

            const result = await service.updateLicense('lic-001', {
                softwareName: 'Updated Software'
            }, 'user-002')

            expect(result?.softwareName).toBe('Updated Software')
        })

        it('should return null if license not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.updateLicense('non-existent', {
                softwareName: 'Test'
            }, 'user-001')

            expect(result).toBeNull()
        })
    })

    describe('deleteLicense', () => {
        it('should delete draft license with no seats', async () => {
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] }) // status: draft
            // countSeats
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // delete
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await service.deleteLicense('lic-001', 'user-001')

            expect(result).toBe(true)
        })

        it('should throw error if license is not draft', async () => {
            const activeRow = { ...mockLicenseRow, status: 'active' }
            queryFn.mockResolvedValueOnce({ rows: [activeRow] })

            await expect(service.deleteLicense('lic-001', 'user-001'))
                .rejects.toThrow('Only draft licenses can be deleted')
        })

        it('should throw error if license has assigned seats', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] })
            queryFn.mockResolvedValueOnce({ rows: [{ count: '5' }] })

            await expect(service.deleteLicense('lic-001', 'user-001'))
                .rejects.toThrow('Cannot delete license with assigned seats')
        })
    })

    // ==================== Status Management Tests ====================

    describe('activateLicense', () => {
        it('should activate a draft license', async () => {
            const activatedRow = { ...mockLicenseRow, status: 'active' }
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] })
            // update (activate)
            queryFn.mockResolvedValueOnce({ rows: [activatedRow] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // findByIdWithUsage
            queryFn.mockResolvedValueOnce({ rows: [{ ...activatedRow, seats_used: '0', supplier_name: null, category_name: null }] })

            const result = await service.activateLicense('lic-001', 'user-001')

            expect(result?.status).toBe('active')
        })

        it('should throw error when activating non-draft license', async () => {
            const activeRow = { ...mockLicenseRow, status: 'active' }
            queryFn.mockResolvedValueOnce({ rows: [activeRow] })

            await expect(service.activateLicense('lic-001', 'user-001'))
                .rejects.toThrow('Cannot activate license with status: active')
        })
    })

    describe('retireLicense', () => {
        it('should retire an active license with no seats', async () => {
            const activeRow = { ...mockLicenseRow, status: 'active' }
            const retiredRow = { ...mockLicenseRow, status: 'retired' }
            // findById
            queryFn.mockResolvedValueOnce({ rows: [activeRow] })
            // countSeats (via retire)
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            // update (retire)
            queryFn.mockResolvedValueOnce({ rows: [retiredRow] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // findByIdWithUsage
            queryFn.mockResolvedValueOnce({ rows: [{ ...retiredRow, seats_used: '0', supplier_name: null, category_name: null }] })

            const result = await service.retireLicense('lic-001', 'user-001')

            expect(result?.status).toBe('retired')
        })

        it('should throw error when retiring draft license', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] })

            await expect(service.retireLicense('lic-001', 'user-001'))
                .rejects.toThrow('Cannot retire license with status: draft')
        })
    })

    // ==================== Seat Management Tests ====================

    describe('assignSeat', () => {
        it('should assign seat to user', async () => {
            const activeRow = { ...mockLicenseRow, status: 'active' }
            const mockSeat = {
                id: 'seat-001',
                license_id: 'lic-001',
                assignment_type: 'user',
                assigned_user_id: 'user-002',
                assigned_asset_id: null,
                assigned_at: new Date(),
                assigned_by: 'admin-001',
                notes: null,
                created_at: new Date()
            }

            // findById
            queryFn.mockResolvedValueOnce({ rows: [activeRow] })
            // checkUserSeatExists
            queryFn.mockResolvedValueOnce({ rows: [] })
            // countSeats
            queryFn.mockResolvedValueOnce({ rows: [{ count: '50' }] })
            // assignSeat
            queryFn.mockResolvedValueOnce({ rows: [mockSeat] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.assignSeat('lic-001', {
                assignmentType: 'user',
                assignedUserId: 'user-002'
            }, 'admin-001')

            expect(result.assignedUserId).toBe('user-002')
        })

        it('should throw error when license is not active', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseRow] }) // draft status

            await expect(service.assignSeat('lic-001', {
                assignmentType: 'user',
                assignedUserId: 'user-002'
            }, 'admin-001')).rejects.toThrow('Cannot assign seat: License status is draft')
        })

        it('should throw error when no seats available', async () => {
            const activeRow = { ...mockLicenseRow, status: 'active' }

            // findById
            queryFn.mockResolvedValueOnce({ rows: [activeRow] })
            // checkUserSeatExists
            queryFn.mockResolvedValueOnce({ rows: [] })
            // countSeats - all seats used
            queryFn.mockResolvedValueOnce({ rows: [{ count: '100' }] })

            await expect(service.assignSeat('lic-001', {
                assignmentType: 'user',
                assignedUserId: 'user-002'
            }, 'admin-001')).rejects.toThrow('Cannot assign seat: License has reached maximum seats')
        })
    })

    describe('revokeSeat', () => {
        it('should revoke seat successfully', async () => {
            const mockSeat = {
                id: 'seat-001',
                license_id: 'lic-001',
                assignment_type: 'user',
                assigned_user_id: 'user-002',
                assigned_asset_id: null,
                assigned_at: new Date(),
                assigned_by: 'admin-001',
                notes: null,
                created_at: new Date()
            }

            // getSeat
            queryFn.mockResolvedValueOnce({ rows: [mockSeat] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // revokeSeat
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await service.revokeSeat('lic-001', 'seat-001', 'admin-001')

            expect(result).toBe(true)
        })

        it('should throw error if seat not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await expect(service.revokeSeat('lic-001', 'non-existent', 'admin-001'))
                .rejects.toThrow('Seat not found')
        })
    })

    // ==================== Lookups Tests ====================

    describe('getSuppliers', () => {
        it('should return list of suppliers', async () => {
            const mockSuppliers = [{
                id: 'sup-001',
                code: 'MS',
                name: 'Microsoft',
                contact_name: 'John',
                contact_email: 'john@microsoft.com',
                contact_phone: null,
                address: null,
                website: null,
                notes: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }]
            queryFn.mockResolvedValueOnce({ rows: mockSuppliers })

            const result = await service.getSuppliers()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Microsoft')
        })
    })

    describe('getCategories', () => {
        it('should return list of categories', async () => {
            const mockCategories = [{
                id: 'cat-001',
                name: 'Office Suite',
                description: 'Office productivity',
                created_at: new Date()
            }]
            queryFn.mockResolvedValueOnce({ rows: mockCategories })

            const result = await service.getCategories()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Office Suite')
        })
    })

    // ==================== Compliance Tests ====================

    describe('getComplianceSummary', () => {
        it('should return compliance summary', async () => {
            // First call - listLicenses for all
            queryFn.mockResolvedValueOnce({ rows: [{ count: '10' }] }) // count
            queryFn.mockResolvedValueOnce({
                rows: [
                    { ...mockLicenseWithUsageRow, status: 'active' },
                    { ...mockLicenseWithUsageRow, id: 'lic-002', status: 'expired', seats_used: '0' }
                ]
            }) // data

            // Second call - getExpiringLicenses
            queryFn.mockResolvedValueOnce({ rows: [{ count: '2' }] })
            queryFn.mockResolvedValueOnce({ rows: [mockLicenseWithUsageRow] })

            // Third call - getOverLicensed
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.getComplianceSummary()

            expect(result.total).toBe(10)
            expect(result).toHaveProperty('active')
            expect(result).toHaveProperty('expired')
            expect(result).toHaveProperty('totalSeats')
            expect(result).toHaveProperty('usedSeats')
        })
    })
})
