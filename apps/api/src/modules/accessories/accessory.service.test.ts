/**
 * Accessory Service Tests
 * Unit tests for the accessory service layer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccessoryService } from './accessory.service.js'
import type { Pool } from 'pg'

// Create mock pool with query function
const createMockPool = () => {
    const queryFn = vi.fn()
    return {
        query: queryFn,
        _queryFn: queryFn
    } as unknown as Pool & { _queryFn: ReturnType<typeof vi.fn> }
}

describe('AccessoryService', () => {
    let mockPool: Pool & { _queryFn: ReturnType<typeof vi.fn> }
    let service: AccessoryService
    let queryFn: ReturnType<typeof vi.fn>

    const mockAccessoryRow = {
        id: 'acc-001',
        accessory_code: 'ACC-202412-0001',
        name: 'Logitech MX Master 3',
        category_id: 'cat-001',
        manufacturer_id: 'mfr-001',
        model_number: 'MX3000',
        total_quantity: 50,
        available_quantity: 40,
        min_quantity: 10,
        unit_price: 2500000,
        currency: 'VND',
        purchase_date: '2024-01-01',
        image_url: null,
        supplier_id: 'sup-001',
        purchase_order: null,
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

    const mockAccessoryWithDetailsRow = {
        ...mockAccessoryRow,
        category_name: 'Mice',
        manufacturer_name: 'Logitech',
        supplier_name: null,
        checked_out_quantity: 10,
        stock_status: 'in_stock'
    }

    const mockCheckoutRow = {
        id: 'chk-001',
        accessory_id: 'acc-001',
        quantity: 2,
        quantity_returned: 0,
        assignment_type: 'user',
        assigned_user_id: 'user-001',
        assigned_asset_id: null,
        checkout_date: new Date(),
        expected_checkin_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        actual_checkin_date: null,
        checked_out_by: 'admin-001',
        checked_in_by: null,
        checkout_notes: 'For remote work',
        checkin_notes: null,
        status: 'checked_out',
        created_at: new Date(),
        updated_at: new Date()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPool = createMockPool()
        queryFn = mockPool._queryFn
        service = new AccessoryService(mockPool)
    })

    // ==================== Accessory CRUD Tests ====================

    describe('createAccessory', () => {
        it('should create an accessory successfully', async () => {
            // Mock generateAccessoryCode query - returns no existing codes
            queryFn.mockResolvedValueOnce({ rows: [] })
            // Mock create query
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // Mock audit log insert
            queryFn.mockResolvedValueOnce({ rows: [] })
            // Mock findByIdWithDetails for return
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryWithDetailsRow] })

            const result = await service.createAccessory({
                name: 'Logitech MX Master 3',
                categoryId: 'cat-001',
                manufacturerId: 'mfr-001',
                totalQuantity: 50,
                minQuantity: 10
            }, 'user-001')

            expect(result).toBeDefined()
            expect(result.name).toBe('Logitech MX Master 3')
        })
    })

    describe('getAccessory', () => {
        it('should return accessory with details', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryWithDetailsRow] })

            const result = await service.getAccessory('acc-001')

            expect(result).toBeDefined()
            expect(result?.categoryName).toBe('Mice')
            expect(result?.manufacturerName).toBe('Logitech')
            expect(result?.checkedOutQuantity).toBe(10)
        })

        it('should return null for non-existent accessory', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.getAccessory('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('listAccessories', () => {
        it('should return paginated list', async () => {
            // Count query
            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] })
            // Data query
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryWithDetailsRow] })

            const result = await service.listAccessories({ page: 1, limit: 20 })

            expect(result.data).toHaveLength(1)
            expect(result.pagination.total).toBe(1)
        })

        it('should apply filters', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] })
            queryFn.mockResolvedValueOnce({ rows: [] })

            await service.listAccessories({
                status: ['active'],
                categoryId: 'cat-001',
                page: 1,
                limit: 20
            })

            expect(queryFn).toHaveBeenNthCalledWith(1,
                expect.stringContaining('status'),
                expect.any(Array)
            )
        })
    })

    describe('updateAccessory', () => {
        it('should update accessory successfully', async () => {
            const updatedRow = { ...mockAccessoryRow, name: 'Updated Mouse' }
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // update
            queryFn.mockResolvedValueOnce({ rows: [updatedRow] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })
            // findByIdWithDetails
            queryFn.mockResolvedValueOnce({ rows: [{ ...updatedRow, category_name: 'Mice', manufacturer_name: 'Logitech', supplier_name: null, checked_out_quantity: 10, stock_status: 'in_stock' }] })

            const result = await service.updateAccessory('acc-001', {
                name: 'Updated Mouse'
            }, 'user-002')

            expect(result?.name).toBe('Updated Mouse')
        })

        it('should return null if accessory not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.updateAccessory('non-existent', {
                name: 'Test'
            }, 'user-001')

            expect(result).toBeNull()
        })
    })

    describe('deleteAccessory', () => {
        it('should delete accessory with no active checkouts', async () => {
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // countActiveCheckouts
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] })
            // delete
            queryFn.mockResolvedValueOnce({ rowCount: 1 })

            const result = await service.deleteAccessory('acc-001', 'user-001')

            expect(result).toBe(true)
        })

        it('should fail if accessory has active checkouts', async () => {
            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // countActiveCheckouts
            queryFn.mockResolvedValueOnce({ rows: [{ total: '5' }] })

            await expect(service.deleteAccessory('acc-001', 'user-001'))
                .rejects.toThrow('Cannot delete accessory: 5 items are still checked out')
        })

        it('should return false if accessory not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.deleteAccessory('non-existent', 'user-001')

            expect(result).toBe(false)
        })
    })

    // ==================== Checkout Tests ====================

    describe('checkoutAccessory', () => {
        it('should checkout accessory to user successfully', async () => {
            const accessoryWithEnoughStock = { ...mockAccessoryRow, available_quantity: 10 }
            // findById
            queryFn.mockResolvedValueOnce({ rows: [accessoryWithEnoughStock] })
            // checkout insert
            queryFn.mockResolvedValueOnce({ rows: [mockCheckoutRow] })
            // update available quantity
            queryFn.mockResolvedValueOnce({ rows: [] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.checkoutAccessory({
                accessoryId: 'acc-001',
                assignmentType: 'user',
                assignedUserId: 'user-001',
                quantity: 2
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.quantity).toBe(2)
            expect(result.assignedUserId).toBe('user-001')
        })

        it('should fail if accessory not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await expect(service.checkoutAccessory({
                accessoryId: 'non-existent',
                assignmentType: 'user',
                assignedUserId: 'user-001',
                quantity: 1
            }, 'admin-001')).rejects.toThrow('Accessory not found')
        })

        it('should fail if accessory status is not active', async () => {
            const inactiveAccessory = { ...mockAccessoryRow, status: 'archived' }
            queryFn.mockResolvedValueOnce({ rows: [inactiveAccessory] })

            await expect(service.checkoutAccessory({
                accessoryId: 'acc-001',
                assignmentType: 'user',
                assignedUserId: 'user-001',
                quantity: 1
            }, 'admin-001')).rejects.toThrow('Cannot checkout: Accessory status is archived')
        })

        it('should fail if insufficient quantity available', async () => {
            const lowStockAccessory = { ...mockAccessoryRow, available_quantity: 2 }
            queryFn.mockResolvedValueOnce({ rows: [lowStockAccessory] })

            await expect(service.checkoutAccessory({
                accessoryId: 'acc-001',
                assignmentType: 'user',
                assignedUserId: 'user-001',
                quantity: 5
            }, 'admin-001')).rejects.toThrow('Cannot checkout: Requested 5 but only 2 available')
        })
    })

    describe('checkinAccessory', () => {
        it('should checkin full quantity successfully', async () => {
            const activeCheckout = { ...mockCheckoutRow, quantity: 2, quantity_returned: 0, status: 'checked_out' }
            const returnedCheckout = { ...activeCheckout, quantity_returned: 2, status: 'returned', actual_checkin_date: new Date() }

            // findCheckoutById
            queryFn.mockResolvedValueOnce({ rows: [activeCheckout] })
            // checkin - get existing
            queryFn.mockResolvedValueOnce({ rows: [activeCheckout] })
            // checkin - update
            queryFn.mockResolvedValueOnce({ rows: [returnedCheckout] })
            // update available quantity
            queryFn.mockResolvedValueOnce({ rows: [] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.checkinAccessory('chk-001', 2, null, 'admin-001')

            expect(result).toBeDefined()
            expect(result.quantityReturned).toBe(2)
        })

        it('should fail if checkout not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await expect(service.checkinAccessory('non-existent', 1, null, 'admin-001'))
                .rejects.toThrow('Checkout record not found')
        })

        it('should fail if already fully returned', async () => {
            const fullyReturned = { ...mockCheckoutRow, quantity: 2, quantity_returned: 2, status: 'returned' }
            queryFn.mockResolvedValueOnce({ rows: [fullyReturned] })

            await expect(service.checkinAccessory('chk-001', 1, null, 'admin-001'))
                .rejects.toThrow('This checkout has already been fully returned')
        })

        it('should fail if returning more than remaining', async () => {
            const partiallyReturned = { ...mockCheckoutRow, quantity: 5, quantity_returned: 3, status: 'partially_returned' }
            queryFn.mockResolvedValueOnce({ rows: [partiallyReturned] })

            await expect(service.checkinAccessory('chk-001', 3, null, 'admin-001'))
                .rejects.toThrow('Cannot return 3: Only 2 items remaining')
        })
    })

    describe('getCheckouts', () => {
        it('should return all checkouts for accessory', async () => {
            const mockCheckouts = [
                { ...mockCheckoutRow, accessory_name: 'Mouse', accessory_code: 'ACC-001', remaining_quantity: 2, is_overdue: false }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockCheckouts })

            const result = await service.getCheckouts('acc-001', false)

            expect(result).toHaveLength(1)
        })

        it('should return only active checkouts when activeOnly is true', async () => {
            const mockCheckouts = [
                { ...mockCheckoutRow, accessory_name: 'Mouse', accessory_code: 'ACC-001', remaining_quantity: 2, is_overdue: false }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockCheckouts })

            const result = await service.getCheckouts('acc-001', true)

            expect(result).toHaveLength(1)
        })
    })

    // ==================== Stock Adjustment Tests ====================

    describe('adjustStock', () => {
        it('should add stock successfully (purchase)', async () => {
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
                reason: 'Restocking',
                notes: null,
                performed_by: 'admin-001',
                performed_at: new Date()
            }

            // findById
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // adjustStock - findById in repo
            queryFn.mockResolvedValueOnce({ rows: [mockAccessoryRow] })
            // adjustStock insert
            queryFn.mockResolvedValueOnce({ rows: [mockAdjustment] })
            // update accessory quantities
            queryFn.mockResolvedValueOnce({ rows: [] })
            // audit log
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.adjustStock({
                accessoryId: 'acc-001',
                adjustmentType: 'purchase',
                quantityChange: 10,
                reason: 'Restocking',
                referenceNumber: 'PO-001'
            }, 'admin-001')

            expect(result).toBeDefined()
            expect(result.quantityChange).toBe(10)
        })

        it('should fail if accessory not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            await expect(service.adjustStock({
                accessoryId: 'non-existent',
                adjustmentType: 'purchase',
                quantityChange: 10,
                reason: 'Test'
            }, 'admin-001')).rejects.toThrow('Accessory not found')
        })

        it('should fail if adjustment would result in negative total', async () => {
            const accessoryWithLowStock = { ...mockAccessoryRow, total_quantity: 5, available_quantity: 5 }
            queryFn.mockResolvedValueOnce({ rows: [accessoryWithLowStock] })

            await expect(service.adjustStock({
                accessoryId: 'acc-001',
                adjustmentType: 'lost',
                quantityChange: -10,
                reason: 'Too many lost'
            }, 'admin-001')).rejects.toThrow('Cannot adjust: Would result in negative total quantity')
        })

        it('should fail if adjustment would result in negative available', async () => {
            const accessoryWithCheckedOut = { ...mockAccessoryRow, total_quantity: 50, available_quantity: 3 }
            queryFn.mockResolvedValueOnce({ rows: [accessoryWithCheckedOut] })

            await expect(service.adjustStock({
                accessoryId: 'acc-001',
                adjustmentType: 'damaged',
                quantityChange: -10,
                reason: 'Damaged items'
            }, 'admin-001')).rejects.toThrow('Cannot adjust: Would result in negative available quantity')
        })
    })

    describe('getStockAdjustments', () => {
        it('should return adjustment history', async () => {
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

            const result = await service.getStockAdjustments('acc-001')

            expect(result).toHaveLength(1)
            expect(result[0].adjustmentType).toBe('purchase')
        })
    })

    // ==================== Alert Tests ====================

    describe('getLowStockItems', () => {
        it('should return items at or below minimum', async () => {
            const lowStockItem = { ...mockAccessoryWithDetailsRow, available_quantity: 5, min_quantity: 10, stock_status: 'low_stock' }
            queryFn.mockResolvedValueOnce({ rows: [lowStockItem] })

            const result = await service.getLowStockItems()

            expect(result).toHaveLength(1)
        })
    })

    describe('getOutOfStockItems', () => {
        it('should return items with zero available', async () => {
            const outOfStockItem = { ...mockAccessoryWithDetailsRow, available_quantity: 0, stock_status: 'out_of_stock' }
            queryFn.mockResolvedValueOnce({ rows: [outOfStockItem] })

            const result = await service.getOutOfStockItems()

            expect(result).toHaveLength(1)
        })
    })

    describe('getOverdueCheckouts', () => {
        it('should return overdue checkouts', async () => {
            const overdueCheckout = {
                ...mockCheckoutRow,
                expected_checkin_date: new Date('2024-01-01'),
                accessory_name: 'Mouse',
                accessory_code: 'ACC-001',
                remaining_quantity: 2,
                is_overdue: true
            }
            queryFn.mockResolvedValueOnce({ rows: [overdueCheckout] })

            const result = await service.getOverdueCheckouts()

            expect(result).toHaveLength(1)
        })
    })

    describe('getStockSummary', () => {
        it('should return stock summary', async () => {
            // list query - count
            queryFn.mockResolvedValueOnce({ rows: [{ total: '10' }] })
            // list query - data
            queryFn.mockResolvedValueOnce({
                rows: [
                    { ...mockAccessoryWithDetailsRow, stock_status: 'in_stock', total_quantity: 100, unit_price: 100000 },
                    { ...mockAccessoryWithDetailsRow, id: 'acc-002', stock_status: 'low_stock', total_quantity: 50, unit_price: 200000 },
                    { ...mockAccessoryWithDetailsRow, id: 'acc-003', stock_status: 'out_of_stock', total_quantity: 20, unit_price: 50000 }
                ]
            })

            const result = await service.getStockSummary()

            expect(result.totalItems).toBe(10)
            expect(result.inStock).toBe(1)
            expect(result.lowStock).toBe(1)
            expect(result.outOfStock).toBe(1)
        })
    })

    // ==================== Categories Tests ====================

    describe('getCategories', () => {
        it('should return all categories', async () => {
            const mockCategories = [
                { id: 'cat-001', code: 'MICE', name: 'Mice', description: 'Mice', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
                { id: 'cat-002', code: 'KBD', name: 'Keyboards', description: 'Keyboards', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockCategories })

            const result = await service.getCategories()

            expect(result).toHaveLength(2)
        })
    })

    describe('getCategory', () => {
        it('should return category by id', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ id: 'cat-001', code: 'MICE', name: 'Mice', description: 'Mice', parent_id: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }] })

            const result = await service.getCategory('cat-001')

            expect(result).toBeDefined()
            expect(result?.name).toBe('Mice')
        })

        it('should return null if not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.getCategory('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('createCategory', () => {
        it('should create category successfully', async () => {
            const newCategory = { id: 'cat-new', code: 'WEBCAM', name: 'Webcams', description: 'Cameras', parent_id: null, is_active: true, created_by: 'admin-001', created_at: new Date(), updated_at: new Date() }
            queryFn.mockResolvedValueOnce({ rows: [newCategory] })

            const result = await service.createCategory({ code: 'WEBCAM', name: 'Webcams', description: 'Cameras' }, 'admin-001')

            expect(result.name).toBe('Webcams')
        })
    })

    // ==================== Manufacturers Tests ====================

    describe('getManufacturers', () => {
        it('should return all manufacturers', async () => {
            const mockManufacturers = [
                { id: 'mfr-001', code: 'LOGI', name: 'Logitech', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() },
                { id: 'mfr-002', code: 'MSFT', name: 'Microsoft', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockManufacturers })

            const result = await service.getManufacturers()

            expect(result).toHaveLength(2)
        })
    })

    describe('getManufacturer', () => {
        it('should return manufacturer by id', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ id: 'mfr-001', code: 'LOGI', name: 'Logitech', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin', created_at: new Date(), updated_at: new Date() }] })

            const result = await service.getManufacturer('mfr-001')

            expect(result).toBeDefined()
            expect(result?.name).toBe('Logitech')
        })

        it('should return null if not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] })

            const result = await service.getManufacturer('non-existent')

            expect(result).toBeNull()
        })
    })

    describe('createManufacturer', () => {
        it('should create manufacturer successfully', async () => {
            const newManufacturer = { id: 'mfr-new', code: 'DELL', name: 'Dell', website: 'https://dell.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_by: 'admin-001', created_at: new Date(), updated_at: new Date() }
            queryFn.mockResolvedValueOnce({ rows: [newManufacturer] })

            const result = await service.createManufacturer({ code: 'DELL', name: 'Dell', website: 'https://dell.com' }, 'admin-001')

            expect(result.name).toBe('Dell')
        })
    })

    // ==================== Audit Log Tests ====================

    describe('getAuditLogs', () => {
        it('should return audit logs for accessory', async () => {
            const mockLogs = [
                { id: 'log-001', accessory_id: 'acc-001', action: 'created', field_name: null, old_value: null, new_value: '{}', checkout_id: null, adjustment_id: null, notes: null, performed_by: 'admin-001', performed_at: new Date() },
                { id: 'log-002', accessory_id: 'acc-001', action: 'updated', field_name: 'name', old_value: '"Old"', new_value: '"New"', checkout_id: null, adjustment_id: null, notes: null, performed_by: 'admin-001', performed_at: new Date() }
            ]
            queryFn.mockResolvedValueOnce({ rows: mockLogs })

            const result = await service.getAuditLogs('acc-001')

            expect(result).toHaveLength(2)
        })
    })
})
