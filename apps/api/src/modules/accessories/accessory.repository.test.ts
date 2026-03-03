/**
 * Accessory Repository Tests
 * Unit tests for the accessory repository layer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccessoryRepository } from './accessory.repository.js'
import type { Pool } from 'pg'

// Mock Pool type
const createMockPool = () => {
    const queryFn = vi.fn()
    return {
        query: queryFn
    } as unknown as Pool
}

describe('AccessoryRepository', () => {
    let mockPool: Pool
    let repo: AccessoryRepository
    let queryFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
        mockPool = createMockPool()
        queryFn = mockPool.query as unknown as ReturnType<typeof vi.fn>
        repo = new AccessoryRepository(mockPool)
    })

    // ==================== Accessory CRUD Tests ====================

    describe('create', () => {
        it('should create a new accessory with all fields', async () => {
            const mockAccessory = {
                id: 'acc-001',
                accessory_code: 'ACC-202412-0001',
                name: 'Logitech MX Master 3',
                category_id: 'cat-001',
                manufacturer_id: 'mfr-001',
                model_number: 'MX3000',
                total_quantity: 50,
                available_quantity: 50,
                min_quantity: 10,
                unit_price: 2500000,
                currency: 'VND',
                purchase_date: '2024-01-01',
                image_url: null,
                supplier_id: 'sup-001',
                purchase_order: 'PO-001',
                location_id: null,
                location_name: 'HN Office',
                notes: 'Wireless mice',
                organization_id: 'org-001',
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            // Mock generateAccessoryCode - returns no existing codes
            queryFn.mockResolvedValueOnce({ rows: [] })
            // Mock insert
            queryFn.mockResolvedValueOnce({ rows: [mockAccessory] })

            const result = await repo.create({
                name: 'Logitech MX Master 3',
                categoryId: 'cat-001',
                manufacturerId: 'mfr-001',
                modelNumber: 'MX3000',
                totalQuantity: 50,
                minQuantity: 10,
                unitPrice: 2500000,
                currency: 'VND',
                purchaseDate: '2024-01-01',
                locationName: 'HN Office',
                notes: 'Wireless mice',
                organizationId: 'org-001'
            }, 'user-001')

            expect(result).toBeDefined()
            expect(result.name).toBe('Logitech MX Master 3')
            expect(result.totalQuantity).toBe(50)
            expect(result.status).toBe('active')
        })
    })

    describe('findById', () => {
        it('should return accessory when found', async () => {
            const mockAccessory = {
                id: 'acc-001',
                accessory_code: 'ACC-001',
                name: 'Test Accessory',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                total_quantity: 10,
                available_quantity: 10,
                min_quantity: 5,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                image_url: null,
                supplier_id: null,
                purchase_order: null,
                location_id: null,
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockAccessory] })

            const result = await repo.findById('acc-001')

            expect(result).toBeDefined()
            expect(result?.id).toBe('acc-001')
            expect(result?.name).toBe('Test Accessory')
        })

        it('should return null when accessory not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.findById('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('findByIdWithDetails', () => {
        it('should return accessory with category and manufacturer', async () => {
            const mockRow = {
                id: 'acc-001',
                accessory_code: 'ACC-001',
                name: 'Logitech Mouse',
                category_id: 'cat-001',
                manufacturer_id: 'mfr-001',
                model_number: 'MX3',
                total_quantity: 100,
                available_quantity: 75,
                min_quantity: 10,
                unit_price: 500000,
                currency: 'VND',
                purchase_date: '2024-01-01',
                image_url: null,
                supplier_id: 'sup-001',
                purchase_order: null,
                location_id: null,
                location_name: 'HN Office',
                notes: null,
                organization_id: 'org-001',
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date(),
                category_name: 'Mice',
                manufacturer_name: 'Logitech',
                supplier_name: null,
                checked_out_quantity: 25,
                stock_status: 'in_stock'
            }

            queryFn.mockResolvedValueOnce({ rows: [mockRow] })

            const result = await repo.findByIdWithDetails('acc-001')

            expect(result).toBeDefined()
            expect(result?.checkedOutQuantity).toBe(25)
            expect(result?.categoryName).toBe('Mice')
            expect(result?.manufacturerName).toBe('Logitech')
        })
    })

    describe('findByCode', () => {
        it('should return accessory when found by code', async () => {
            const mockAccessory = {
                id: 'acc-001',
                accessory_code: 'ACC-001',
                name: 'Test Mouse',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                total_quantity: 10,
                available_quantity: 10,
                min_quantity: 5,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                image_url: null,
                supplier_id: null,
                purchase_order: null,
                location_id: null,
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockAccessory] })

            const result = await repo.findByCode('ACC-001')

            expect(result).toBeDefined()
            expect(result?.accessoryCode).toBe('ACC-001')
        })

        it('should return null when code not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.findByCode('NON-EXISTENT')

            expect(result).toBeNull()
        })
    })

    describe('list', () => {
        it('should return paginated list of accessories', async () => {
            // Count query result
            queryFn.mockResolvedValueOnce({ rows: [{ total: '2' }] })

            // Data query result
            const mockRows = [
                {
                    id: 'acc-001',
                    accessory_code: 'ACC-001',
                    name: 'Mouse A',
                    category_id: 'cat-001',
                    manufacturer_id: null,
                    model_number: null,
                    total_quantity: 10,
                    available_quantity: 8,
                    min_quantity: 5,
                    unit_price: 100000,
                    currency: 'VND',
                    purchase_date: null,
                    image_url: null,
                    supplier_id: null,
                    purchase_order: null,
                    location_id: null,
                    location_name: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    category_name: 'Mice',
                    manufacturer_name: null,
                    supplier_name: null,
                    checked_out_quantity: 2,
                    stock_status: 'in_stock'
                },
                {
                    id: 'acc-002',
                    accessory_code: 'ACC-002',
                    name: 'Keyboard B',
                    category_id: 'cat-002',
                    manufacturer_id: null,
                    model_number: null,
                    total_quantity: 20,
                    available_quantity: 20,
                    min_quantity: 10,
                    unit_price: 200000,
                    currency: 'VND',
                    purchase_date: null,
                    image_url: null,
                    supplier_id: null,
                    purchase_order: null,
                    location_id: null,
                    location_name: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    category_name: 'Keyboards',
                    manufacturer_name: null,
                    supplier_name: null,
                    checked_out_quantity: 0,
                    stock_status: 'in_stock'
                }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockRows })

            const result = await repo.list({ page: 1, limit: 20 })

            expect(result.data).toHaveLength(2)
            expect(result.pagination.total).toBe(2)
            expect(result.pagination.page).toBe(1)
            expect(result.pagination.limit).toBe(20)
        })

        it('should filter by status array', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.list({ status: ['active'], page: 1, limit: 20 })

            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('status = ANY'),
                expect.arrayContaining([['active']])
            )
        })

        it('should filter by category', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.list({ categoryId: 'cat-001', page: 1, limit: 20 })

            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('category_id'),
                expect.arrayContaining(['cat-001'])
            )
        })

        it('should search by name and code', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] })
            queryFn.mockResolvedValueOnce({
                rows: [{
                    id: 'acc-001',
                    accessory_code: 'ACC-001',
                    name: 'Logitech Mouse',
                    category_id: null,
                    manufacturer_id: null,
                    model_number: null,
                    total_quantity: 10,
                    available_quantity: 10,
                    min_quantity: 5,
                    unit_price: 0,
                    currency: 'VND',
                    purchase_date: null,
                    image_url: null,
                    supplier_id: null,
                    purchase_order: null,
                    location_id: null,
                    location_name: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    category_name: null,
                    manufacturer_name: null,
                    supplier_name: null,
                    checked_out_quantity: 0,
                    stock_status: 'in_stock'
                }]
            })

            const result = await repo.list({ search: 'Logitech', page: 1, limit: 20 })

            expect(result.data).toHaveLength(1)
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                expect.arrayContaining(['%Logitech%'])
            )
        })
    })

    describe('update', () => {
        it('should update accessory fields', async () => {
            const updatedRow = {
                id: 'acc-001',
                accessory_code: 'ACC-001',
                name: 'Updated Mouse',
                category_id: 'cat-002',
                manufacturer_id: null,
                model_number: null,
                total_quantity: 10,
                available_quantity: 10,
                min_quantity: 5,
                unit_price: 150000,
                currency: 'VND',
                purchase_date: null,
                image_url: null,
                supplier_id: null,
                purchase_order: null,
                location_id: null,
                location_name: 'SG Office',
                notes: 'Updated notes',
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-002',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [updatedRow] })

            const result = await repo.update('acc-001', {
                name: 'Updated Mouse',
                categoryId: 'cat-002',
                unitPrice: 150000,
                locationName: 'SG Office',
                notes: 'Updated notes'
            }, 'user-002')

            expect(result).toBeDefined()
            expect(result?.name).toBe('Updated Mouse')
            expect(result?.locationName).toBe('SG Office')
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE accessories'),
                expect.any(Array)
            )
        })

        it('should return null when updating non-existent accessory', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.update('non-existent', {
                name: 'Updated Name'
            }, 'user-001')

            expect(result).toBeNull()
        })
    })

    describe('delete', () => {
        it('should delete accessory', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await repo.delete('acc-001')

            expect(result).toBe(true)
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM accessories'),
                expect.arrayContaining(['acc-001'])
            )
        })

        it('should return false when deleting non-existent accessory', async () => {
            queryFn.mockResolvedValueOnce({ rowCount: 0 })

            const result = await repo.delete('non-existent')

            expect(result).toBe(false)
        })
    })

    // ==================== Checkout Tests ====================

    describe('checkout', () => {
        it('should checkout accessory to user', async () => {
            const mockCheckout = {
                id: 'chk-001',
                accessory_id: 'acc-001',
                quantity: 2,
                quantity_returned: 0,
                assignment_type: 'user',
                assigned_user_id: 'user-001',
                assigned_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: new Date(),
                actual_checkin_date: null,
                checked_out_by: 'admin-001',
                checked_in_by: null,
                checkout_notes: 'For remote work',
                checkin_notes: null,
                status: 'checked_out',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockCheckout] })
            queryFn.mockResolvedValueOnce({ rows: [] }) // update available

            const result = await repo.checkout({
                accessoryId: 'acc-001',
                assignmentType: 'user',
                assignedUserId: 'user-001',
                quantity: 2,
                expectedCheckinDate: new Date().toISOString().split('T')[0],
                notes: 'For remote work'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.assignedUserId).toBe('user-001')
            expect(result.quantity).toBe(2)
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO accessory_checkouts'),
                expect.any(Array)
            )
        })
    })

    describe('checkin', () => {
        it('should checkin full quantity', async () => {
            const existingCheckout = {
                id: 'chk-001',
                accessory_id: 'acc-001',
                quantity: 2,
                quantity_returned: 0,
                status: 'checked_out'
            }

            const returnedCheckout = {
                id: 'chk-001',
                accessory_id: 'acc-001',
                quantity: 2,
                quantity_returned: 2,
                assignment_type: 'user',
                assigned_user_id: 'user-001',
                assigned_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: new Date(),
                actual_checkin_date: new Date(),
                checked_out_by: 'admin-001',
                checked_in_by: 'admin-001',
                checkout_notes: null,
                checkin_notes: 'Returned',
                status: 'returned',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [existingCheckout] })
            queryFn.mockResolvedValueOnce({ rows: [returnedCheckout] })
            queryFn.mockResolvedValueOnce({ rows: [] }) // update available

            const result = await repo.checkin('chk-001', 2, 'Returned', 'admin-001')

            expect(result).toBeDefined()
            expect(result?.quantityReturned).toBe(2)
            expect(result?.actualCheckinDate).toBeDefined()
        })

        it('should return null for non-existent checkout', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.checkin('non-existent', 1, null, 'admin-001')

            expect(result).toBeNull()
        })
    })

    describe('findCheckoutById', () => {
        it('should return checkout when found', async () => {
            const mockCheckout = {
                id: 'chk-001',
                accessory_id: 'acc-001',
                quantity: 2,
                quantity_returned: 0,
                assignment_type: 'user',
                assigned_user_id: 'user-001',
                assigned_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: null,
                actual_checkin_date: null,
                checked_out_by: 'admin-001',
                checked_in_by: null,
                checkout_notes: null,
                checkin_notes: null,
                status: 'checked_out',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockCheckout] })

            const result = await repo.findCheckoutById('chk-001')

            expect(result).toBeDefined()
            expect(result?.id).toBe('chk-001')
        })

        it('should return null when checkout not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.findCheckoutById('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('getCheckouts', () => {
        it('should return all checkouts for an accessory', async () => {
            const mockCheckouts = [
                {
                    id: 'chk-001',
                    accessory_id: 'acc-001',
                    quantity: 2,
                    quantity_returned: 0,
                    assignment_type: 'user',
                    assigned_user_id: 'user-001',
                    assigned_asset_id: null,
                    checkout_date: new Date(),
                    expected_checkin_date: null,
                    actual_checkin_date: null,
                    checked_out_by: 'admin-001',
                    checked_in_by: null,
                    checkout_notes: null,
                    checkin_notes: null,
                    status: 'checked_out',
                    created_at: new Date(),
                    updated_at: new Date(),
                    accessory_name: 'Mouse',
                    accessory_code: 'ACC-001',
                    remaining_quantity: 2,
                    is_overdue: false
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockCheckouts })

            const result = await repo.getCheckouts('acc-001')

            expect(result).toHaveLength(1)
            expect(result[0].accessoryName).toBe('Mouse')
        })

        it('should filter by status when provided', async () => {
            const mockCheckouts = [
                {
                    id: 'chk-001',
                    accessory_id: 'acc-001',
                    quantity: 2,
                    quantity_returned: 0,
                    assignment_type: 'user',
                    assigned_user_id: 'user-001',
                    assigned_asset_id: null,
                    checkout_date: new Date(),
                    expected_checkin_date: null,
                    actual_checkin_date: null,
                    checked_out_by: 'admin-001',
                    checked_in_by: null,
                    checkout_notes: null,
                    checkin_notes: null,
                    status: 'checked_out',
                    created_at: new Date(),
                    updated_at: new Date(),
                    accessory_name: 'Mouse',
                    accessory_code: 'ACC-001',
                    remaining_quantity: 2,
                    is_overdue: false
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockCheckouts })

            const result = await repo.getCheckouts('acc-001', ['checked_out'])

            expect(result).toHaveLength(1)
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('status = ANY'),
                expect.any(Array)
            )
        })
    })

    describe('countActiveCheckouts', () => {
        it('should return count of checked out items', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '5' }] })

            const result = await repo.countActiveCheckouts('acc-001')

            expect(result).toBe(5)
        })

        it('should return 0 when no active checkouts', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] })

            const result = await repo.countActiveCheckouts('acc-001')

            expect(result).toBe(0)
        })
    })

    // ==================== Stock Adjustment Tests ====================

    describe('adjustStock', () => {
        it('should create stock adjustment and update quantities', async () => {
            const accessoryRow = {
                id: 'acc-001',
                accessory_code: 'ACC-001',
                name: 'Mouse',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                total_quantity: 50,
                available_quantity: 50,
                min_quantity: 5,
                unit_price: 0,
                currency: 'VND',
                purchase_date: null,
                image_url: null,
                supplier_id: null,
                purchase_order: null,
                location_id: null,
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            const mockAdjustment = {
                id: 'adj-001',
                accessory_id: 'acc-001',
                adjustment_type: 'purchase',
                quantity_change: 10,
                quantity_before: 50,
                quantity_after: 60,
                reference_type: null,
                reference_id: null,
                reference_number: 'PO-001',
                reason: 'New stock arrived',
                notes: null,
                performed_by: 'admin-001',
                performed_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [accessoryRow] }) // findById
            queryFn.mockResolvedValueOnce({ rows: [mockAdjustment] }) // insert adjustment
            queryFn.mockResolvedValueOnce({ rows: [] }) // update accessory

            const result = await repo.adjustStock({
                accessoryId: 'acc-001',
                adjustmentType: 'purchase',
                quantityChange: 10,
                reason: 'New stock arrived',
                referenceNumber: 'PO-001'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.adjustmentType).toBe('purchase')
            expect(result.quantityChange).toBe(10)
        })
    })

    describe('getStockAdjustments', () => {
        it('should return stock adjustment history', async () => {
            const mockAdjustments = [
                {
                    id: 'adj-001',
                    accessory_id: 'acc-001',
                    adjustment_type: 'purchase',
                    quantity_change: 10,
                    quantity_before: 50,
                    quantity_after: 60,
                    reference_type: null,
                    reference_id: null,
                    reference_number: 'PO-001',
                    reason: 'Restocking',
                    notes: null,
                    performed_by: 'admin-001',
                    performed_at: new Date()
                }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockAdjustments })

            const result = await repo.getStockAdjustments('acc-001')

            expect(result).toHaveLength(1)
            expect(result[0].adjustmentType).toBe('purchase')
        })
    })

    // ==================== Categories Tests ====================

    describe('getCategories', () => {
        it('should return all categories', async () => {
            const mockCategories = [
                { id: 'cat-001', code: 'MICE', name: 'Mice', description: 'Computer mice', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
                { id: 'cat-002', code: 'KBD', name: 'Keyboards', description: 'Keyboards', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockCategories })

            const result = await repo.getCategories()

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('Mice')
            expect(result[1].name).toBe('Keyboards')
        })
    })

    describe('getCategoryById', () => {
        it('should return category when found', async () => {
            const mockCategory = { id: 'cat-001', code: 'MICE', name: 'Mice', description: 'Computer mice', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }

            queryFn.mockResolvedValueOnce({ rows: [mockCategory] })

            const result = await repo.getCategoryById('cat-001')

            expect(result).toBeDefined()
            expect(result?.name).toBe('Mice')
        })

        it('should return null when category not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.getCategoryById('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('createCategory', () => {
        it('should create new category', async () => {
            const mockCategory = {
                id: 'cat-new',
                code: 'WEBCAM',
                name: 'Webcams',
                description: 'Video cameras',
                parent_id: null,
                is_active: true,
                created_by: 'admin-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockCategory] })

            const result = await repo.createCategory({
                code: 'WEBCAM',
                name: 'Webcams',
                description: 'Video cameras'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.name).toBe('Webcams')
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO accessory_categories'),
                expect.any(Array)
            )
        })
    })

    // ==================== Manufacturers Tests ====================

    describe('getManufacturers', () => {
        it('should return all manufacturers', async () => {
            const mockManufacturers = [
                { id: 'mfr-001', code: 'LOGI', name: 'Logitech', website: 'https://logitech.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
                { id: 'mfr-002', code: 'MSFT', name: 'Microsoft', website: 'https://microsoft.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockManufacturers })

            const result = await repo.getManufacturers()

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('Logitech')
            expect(result[1].name).toBe('Microsoft')
        })
    })

    describe('getManufacturerById', () => {
        it('should return manufacturer when found', async () => {
            const mockManufacturer = { id: 'mfr-001', code: 'LOGI', name: 'Logitech', website: 'https://logitech.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }

            queryFn.mockResolvedValueOnce({ rows: [mockManufacturer] })

            const result = await repo.getManufacturerById('mfr-001')

            expect(result).toBeDefined()
            expect(result?.name).toBe('Logitech')
        })

        it('should return null when manufacturer not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await repo.getManufacturerById('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('createManufacturer', () => {
        it('should create new manufacturer', async () => {
            const mockManufacturer = {
                id: 'mfr-new',
                code: 'DELL',
                name: 'Dell',
                website: 'https://dell.com',
                support_url: null,
                support_phone: null,
                support_email: null,
                notes: null,
                is_active: true,
                created_by: 'admin-001',
                created_at: new Date(),
                updated_at: new Date()
            }

            queryFn.mockResolvedValueOnce({ rows: [mockManufacturer] })

            const result = await repo.createManufacturer({
                code: 'DELL',
                name: 'Dell',
                website: 'https://dell.com'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.name).toBe('Dell')
            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO accessory_manufacturers'),
                expect.any(Array)
            )
        })
    })

    // ==================== Audit Log Tests ====================

    describe('logAudit', () => {
        it('should create audit log entry', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await repo.logAudit('acc-001', 'created', 'admin-001', null, { name: 'New Mouse' })

            expect(queryFn).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO accessory_audit_logs'),
                expect.any(Array)
            )
        })
    })

    describe('getAuditLogs', () => {
        it('should return audit logs for accessory', async () => {
            const mockLogs = [
                { id: 'log-001', accessory_id: 'acc-001', action: 'created', field_name: null, old_value: null, new_value: '{}', checkout_id: null, adjustment_id: null, notes: null, performed_by: 'admin-001', performed_at: new Date() },
                { id: 'log-002', accessory_id: 'acc-001', action: 'updated', field_name: 'name', old_value: '"Old"', new_value: '"New"', checkout_id: null, adjustment_id: null, notes: null, performed_by: 'admin-002', performed_at: new Date() }
            ]

            queryFn.mockResolvedValueOnce({ rows: mockLogs })

            const result = await repo.getAuditLogs('acc-001')

            expect(result).toHaveLength(2)
            expect(result[0].action).toBe('created')
            expect(result[1].action).toBe('updated')
        })
    })
})
