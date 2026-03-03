/**
 * License Repository Tests
 * Unit tests for the license repository layer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LicenseRepository } from './license.repository.js'
import type { Pool } from 'pg'

// Mock Pool type
const createMockPool = () => {
    const queryFn = vi.fn()
    return {
        query: queryFn
    } as unknown as Pool
}

describe('LicenseRepository', () => {
    let mockPool: Pool
    let repo: LicenseRepository
    let queryFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mockPool = createMockPool()
        queryFn = mockPool.query as unknown as ReturnType<typeof vi.fn>
        repo = new LicenseRepository(mockPool)
    })

    // ==================== License CRUD Tests ====================

    describe('create', () => {
        it('should create a new license with all fields', async () => {
            const mockLicense = {
                id: 'lic-001',
                license_code: 'LIC-202412-0001',
                software_name: 'Microsoft Office 365',
                supplier_id: 'sup-001',
                category_id: 'cat-001',
                license_type: 'per_seat',
                product_key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
                seat_count: 100,
                unit_price: 1000000,
                currency: 'VND',
                purchase_date: '2024-01-01',
                expiry_date: '2025-01-01',
                warranty_date: null,
                invoice_number: 'INV-001',
                notes: 'Test license',
                organization_id: 'org-001',
                status: 'draft',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockLicense] })

            const result = await repo.create({
                licenseCode: 'LIC-202412-0001', // Provide licenseCode to skip generateLicenseCode()
                softwareName: 'Microsoft Office 365',
                supplierId: 'sup-001',
                categoryId: 'cat-001',
                licenseType: 'per_seat',
                productKey: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
                seatCount: 100,
                unitPrice: 1000000,
                currency: 'VND',
                purchaseDate: '2024-01-01',
                expiryDate: '2025-01-01',
                invoiceNumber: 'INV-001',
                notes: 'Test license',
                organizationId: 'org-001'
            }, 'user-001')

            expect(result).toBeDefined()
            expect(result.softwareName).toBe('Microsoft Office 365')
            expect(result.seatCount).toBe(100)
            expect(result.status).toBe('draft')
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO licenses'),
                expect.any(Array)
            )
        })
    })

    describe('findById', () => {
        it('should return license when found', async () => {
            const mockLicense = {
                id: 'lic-001',
                license_code: 'LIC-001',
                software_name: 'Test Software',
                supplier_id: null,
                category_id: null,
                license_type: 'per_seat',
                product_key: null,
                seat_count: 10,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                expiry_date: null,
                warranty_date: null,
                invoice_number: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockLicense] })

            const result = await repo.findById('lic-001')

            expect(result).toBeDefined()
            expect(result?.id).toBe('lic-001')
            expect(result?.softwareName).toBe('Test Software')
        })

        it('should return null when license not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.findById('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('findByIdWithUsage', () => {
        it('should return license with usage information', async () => {
            const mockRow = {
                id: 'lic-001',
                license_code: 'LIC-001',
                software_name: 'Microsoft Office',
                supplier_id: 'sup-001',
                category_id: 'cat-001',
                license_type: 'per_seat',
                product_key: 'KEY-123',
                seat_count: 100,
                unit_price: 500000,
                currency: 'VND',
                purchase_date: '2024-01-01',
                expiry_date: '2025-01-01',
                warranty_date: null,
                invoice_number: 'INV-001',
                notes: null,
                organization_id: 'org-001',
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date(),
                supplier_name: 'Microsoft',
                category_name: 'Office Suite',
                seats_used: '75'
            }

            queryFn.mockResolvedValueOnce({ rows: [mockRow] })

            const result = await repo.findByIdWithUsage('lic-001')

            expect(result).toBeDefined()
            expect(result?.seatsUsed).toBe(75)
            expect(result?.seatsAvailable).toBe(25)
            expect(result?.usagePercentage).toBe(75)
            expect(result?.supplierName).toBe('Microsoft')
            expect(result?.categoryName).toBe('Office Suite')
        })

        it('should handle license with no seats used', async () => {
            const mockRow = {
                id: 'lic-002',
                license_code: 'LIC-002',
                software_name: 'New Software',
                supplier_id: null,
                category_id: null,
                license_type: 'per_seat',
                product_key: null,
                seat_count: 50,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                expiry_date: null,
                warranty_date: null,
                invoice_number: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date(),
                supplier_name: null,
                category_name: null,
                seats_used: '0'
            }

            queryFn.mockResolvedValueOnce({ rows: [mockRow] })

            const result = await repo.findByIdWithUsage('lic-002')

            expect(result?.seatsUsed).toBe(0)
            expect(result?.seatsAvailable).toBe(50)
            expect(result?.usagePercentage).toBe(0)
        })
    })

    describe('list', () => {
        it('should return paginated list of licenses', async () => {
            // Count query result
            queryFn.mockResolvedValueOnce({ rows: [{ count: '2' }] })

            // Data query result
            const mockRows = [
                {
                    id: 'lic-001',
                    license_code: 'LIC-001',
                    software_name: 'Software A',
                    supplier_id: null,
                    category_id: null,
                    license_type: 'per_seat',
                    product_key: null,
                    seat_count: 10,
                    unit_price: 0,
                    currency: 'VND',
                    purchase_date: null,
                    expiry_date: null,
                    warranty_date: null,
                    invoice_number: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    supplier_name: null,
                    category_name: null,
                    seats_used: '5'
                },
                {
                    id: 'lic-002',
                    license_code: 'LIC-002',
                    software_name: 'Software B',
                    supplier_id: null,
                    category_id: null,
                    license_type: 'site_license',
                    product_key: null,
                    seat_count: 0,
                    unit_price: 0,
                    currency: 'VND',
                    purchase_date: null,
                    expiry_date: null,
                    warranty_date: null,
                    invoice_number: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    supplier_name: null,
                    category_name: null,
                    seats_used: '0'
                }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockRows })

            const result = await repo.list({ page: 1, limit: 20 })

            expect(result.data).toHaveLength(2)
            expect(result.pagination.total).toBe(2)
            expect(result.pagination.page).toBe(1)
            expect(result.pagination.limit).toBe(20)
        })

        it('should filter by status', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.list({ status: 'active', page: 1, limit: 20 })

            // Check first call (count query)
            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('status = ANY'),
                expect.arrayContaining([['active']])
            )
        })

        it('should filter by license type', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.list({ licenseType: 'per_seat', page: 1, limit: 20 })

            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('license_type'),
                expect.arrayContaining(['per_seat'])
            )
        })

        it('should search by software name', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ count: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.list({ search: 'Microsoft', page: 1, limit: 20 })

            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('ILIKE'),
                expect.arrayContaining(['%Microsoft%'])
            )
        })
    })

    describe('update', () => {
        it('should update license fields', async () => {
            const mockUpdatedLicense = {
                id: 'lic-001',
                license_code: 'LIC-001',
                software_name: 'Updated Software',
                supplier_id: null,
                category_id: null,
                license_type: 'per_seat',
                product_key: null,
                seat_count: 200,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                expiry_date: null,
                warranty_date: null,
                invoice_number: null,
                notes: 'Updated notes',
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-002',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockUpdatedLicense] })

            const result = await repo.update('lic-001', {
                softwareName: 'Updated Software',
                seatCount: 200,
                notes: 'Updated notes'
            }, 'user-002')

            expect(result).toBeDefined()
            expect(result?.softwareName).toBe('Updated Software')
            expect(result?.seatCount).toBe(200)
        })

        it('should return null if license not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.update('non-existent', {
                softwareName: 'Test'
            }, 'user-001')

            expect(result).toBeNull()
        })
    })

    describe('delete', () => {
        it('should delete a license', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await repo.delete('lic-001')

            expect(result).toBe(true)
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM licenses'),
                ['lic-001']
            )
        })

        it('should return false if license not found', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 0 })

            const result = await repo.delete('non-existent')

            expect(result).toBe(false)
        })
    })

    // ==================== Seat Management Tests ====================

    describe('assignSeat', () => {
        it('should assign a seat to a user', async () => {
            const mockSeat = {
                id: 'seat-001',
                license_id: 'lic-001',
                assignment_type: 'user',
                assigned_user_id: 'user-001',
                assigned_asset_id: null,
                assigned_at: new Date(),
                assigned_by: 'admin-001',
                notes: 'Test assignment',
                created_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockSeat] })

            const result = await repo.assignSeat('lic-001', {
                assignmentType: 'user',
                assignedUserId: 'user-001',
                notes: 'Test assignment'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.licenseId).toBe('lic-001')
            expect(result.assignedUserId).toBe('user-001')
            expect(result.assignmentType).toBe('user')
        })

        it('should assign a seat to an asset', async () => {
            const mockSeat = {
                id: 'seat-002',
                license_id: 'lic-001',
                assignment_type: 'asset',
                assigned_user_id: null,
                assigned_asset_id: 'asset-001',
                assigned_at: new Date(),
                assigned_by: 'admin-001',
                notes: 'Asset license',
                created_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockSeat] })

            const result = await repo.assignSeat('lic-001', {
                assignmentType: 'asset',
                assignedAssetId: 'asset-001',
                notes: 'Asset license'
            }, 'admin-001')

            expect(result.assignedAssetId).toBe('asset-001')
            expect(result.assignmentType).toBe('asset')
        })
    })

    describe('revokeSeat', () => {
        it('should revoke a seat assignment', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await repo.revokeSeat('seat-001')

            expect(result).toBe(true)
        })

        it('should return false if seat not found', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 0 })

            const result = await repo.revokeSeat('non-existent')

            expect(result).toBe(false)
        })
    })

    describe('getSeats', () => {
        it('should return all seats for a license', async () => {
            const mockSeats = [
                {
                    id: 'seat-001',
                    license_id: 'lic-001',
                    assignment_type: 'user',
                    assigned_user_id: 'user-001',
                    assigned_asset_id: null,
                    assigned_at: new Date(),
                    assigned_by: 'admin-001',
                    notes: null,
                    created_at: new Date(),
                    user_name: 'John Doe',
                    user_email: 'john@example.com',
                    asset_code: null,
                    asset_name: null
                },
                {
                    id: 'seat-002',
                    license_id: 'lic-001',
                    assignment_type: 'asset',
                    assigned_user_id: null,
                    assigned_asset_id: 'asset-001',
                    assigned_at: new Date(),
                    assigned_by: 'admin-001',
                    notes: null,
                    created_at: new Date(),
                    user_name: null,
                    user_email: null,
                    asset_code: 'LAPTOP-001',
                    asset_name: 'Dell Laptop'
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockSeats })

            const result = await repo.getSeats('lic-001')

            expect(result).toHaveLength(2)
            expect(result[0].userName).toBe('John Doe')
            expect(result[1].assetCode).toBe('LAPTOP-001')
        })
    })

    describe('countSeats', () => {
        it('should return seat count', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ count: '5' }] })

            const result = await repo.countSeats('lic-001')

            expect(result).toBe(5)
        })
    })

    // ==================== Supplier Tests ====================

    describe('getSuppliers', () => {
        it('should return list of suppliers', async () => {
            const mockSuppliers = [
                {
                    id: 'sup-001',
                    code: 'MS',
                    name: 'Microsoft',
                    contact_name: 'John',
                    contact_email: 'john@microsoft.com',
                    contact_phone: '123-456-7890',
                    address: '1 Microsoft Way',
                    website: 'microsoft.com',
                    notes: null,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockSuppliers })

            const result = await repo.getSuppliers()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Microsoft')
        })
    })

    describe('createSupplier', () => {
        it('should create a new supplier', async () => {
            const mockSupplier = {
                id: 'sup-001',
                code: 'NS',
                name: 'New Supplier',
                contact_name: 'Contact',
                contact_email: 'contact@supplier.com',
                contact_phone: null,
                address: null,
                website: null,
                notes: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockSupplier] })

            const result = await repo.createSupplier({
                code: 'NS',
                name: 'New Supplier',
                contactName: 'Contact',
                contactEmail: 'contact@supplier.com'
            })

            expect(result.name).toBe('New Supplier')
        })
    })

    // ==================== Category Tests ====================

    describe('getCategories', () => {
        it('should return list of license categories', async () => {
            const mockCategories = [
                {
                    id: 'cat-001',
                    name: 'Office Suite',
                    description: 'Office productivity software',
                    created_at: new Date()
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockCategories })

            const result = await repo.getCategories()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Office Suite')
        })
    })

    // ==================== Audit Log Tests ====================

    describe('logAudit', () => {
        it('should create an audit log entry', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.logAudit(
                'lic-001',
                'activate',
                'user-001',
                undefined,
                { status: 'active' },
                'License activated'
            )

            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO license_audit_logs'),
                expect.any(Array)
            )
        })
    })

    describe('getAuditLogs', () => {
        it('should return audit logs for a license', async () => {
            const mockLogs = [
                {
                    id: 'log-001',
                    license_id: 'lic-001',
                    action: 'created',
                    actor_user_id: 'user-001',
                    old_values: null,
                    new_values: { status: 'draft' },
                    notes: 'License created',
                    created_at: new Date()
                },
                {
                    id: 'log-002',
                    license_id: 'lic-001',
                    action: 'status_changed',
                    actor_user_id: 'user-001',
                    old_values: { status: 'draft' },
                    new_values: { status: 'active' },
                    notes: 'License activated',
                    created_at: new Date()
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockLogs })

            const result = await repo.getAuditLogs('lic-001')

            expect(result).toHaveLength(2)
            expect(result[0].action).toBe('created')
            expect(result[1].action).toBe('status_changed')
        })
    })
})
