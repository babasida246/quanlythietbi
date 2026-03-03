/**
 * License Routes Tests
 * Integration tests for the license API routes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { licenseRoutes } from './license.routes.js'
import type { LicenseService } from './license.service.js'
import type { AuthService } from '../auth/index.js'
import type { EntitlementService } from '../entitlements/entitlement.service.js'
import type { LicenseWithUsage, PaginatedResult } from './license.types.js'

// Use valid UUIDs for testing
const TEST_LICENSE_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440002'
const TEST_SUPPLIER_ID = '550e8400-e29b-41d4-a716-446655440003'
const TEST_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440004'
const TEST_SEAT_ID = '550e8400-e29b-41d4-a716-446655440005'
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440006'
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999'

// Mock data
const mockLicense: LicenseWithUsage = {
    id: TEST_LICENSE_ID,
    licenseCode: 'LIC-20241201-0001',
    softwareName: 'Microsoft Office 365',
    supplierId: TEST_SUPPLIER_ID,
    categoryId: TEST_CATEGORY_ID,
    licenseType: 'per_seat',
    productKey: 'XXXXX-XXXXX',
    seatCount: 100,
    unitPrice: 1000000,
    currency: 'VND',
    purchaseDate: '2024-01-01',
    expiryDate: '2025-01-01',
    warrantyDate: null,
    invoiceNumber: 'INV-001',
    notes: 'Test license',
    organizationId: TEST_ORG_ID,
    status: 'active',
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplierName: 'Microsoft',
    categoryName: 'Office Suite',
    seatsUsed: 50,
    seatsAvailable: 50,
    usagePercentage: 50
}

const mockPaginatedResult: PaginatedResult<LicenseWithUsage> = {
    data: [mockLicense],
    pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    }
}

describe('License Routes', () => {
    let app: FastifyInstance
    let mockService: Partial<LicenseService>
    let mockAuthService: Partial<AuthService>
    let mockEntitlementService: Partial<EntitlementService>

    beforeEach(async () => {
        // Create mock service
        mockService = {
            listLicenses: vi.fn().mockResolvedValue(mockPaginatedResult),
            getLicense: vi.fn().mockResolvedValue(mockLicense),
            createLicense: vi.fn().mockResolvedValue(mockLicense),
            updateLicense: vi.fn().mockResolvedValue(mockLicense),
            deleteLicense: vi.fn().mockResolvedValue(true),
            activateLicense: vi.fn().mockResolvedValue(mockLicense),
            retireLicense: vi.fn().mockResolvedValue(mockLicense),
            assignSeat: vi.fn().mockResolvedValue({
                id: TEST_SEAT_ID,
                licenseId: TEST_LICENSE_ID,
                userId: TEST_USER_ID,
                assetId: null,
                assignedBy: TEST_USER_ID,
                assignedAt: new Date(),
                notes: 'Test'
            }),
            revokeSeat: vi.fn().mockResolvedValue(true),
            getSeats: vi.fn().mockResolvedValue([]),
            getAuditLogs: vi.fn().mockResolvedValue([]),
            getSuppliers: vi.fn().mockResolvedValue([]),
            getSupplier: vi.fn().mockResolvedValue(null),
            createSupplier: vi.fn().mockResolvedValue({
                id: TEST_SUPPLIER_ID,
                code: 'SUP-001',
                name: 'Test Supplier',
                contactName: 'John Doe',
                email: 'john@example.com',
                phone: '0123456789',
                address: null,
                website: null,
                notes: null,
                isActive: true,
                createdBy: TEST_USER_ID,
                createdAt: new Date()
            }),
            getCategories: vi.fn().mockResolvedValue([])
        }

        // Create mock auth service
        mockAuthService = {
            verifyAccessToken: vi.fn().mockResolvedValue({
                sub: TEST_USER_ID,
                email: 'test@example.com',
                role: 'admin',
                tenantId: TEST_ORG_ID
            })
        }

        mockEntitlementService = {
            hasFeature: vi.fn().mockResolvedValue(true)
        }

        // Create Fastify app
        app = Fastify()
        await licenseRoutes(
            app,
            mockService as LicenseService,
            mockAuthService as AuthService,
            mockEntitlementService as EntitlementService
        )
        await app.ready()
    })

    afterEach(async () => {
        await app.close()
        vi.clearAllMocks()
    })

    // ==================== List Licenses ====================

    describe('GET /licenses', () => {
        it('should return paginated list of licenses', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/licenses',
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            const body = JSON.parse(response.body)
            expect(body.data).toHaveLength(1)
            expect(body.pagination.total).toBe(1)
            expect(mockService.listLicenses).toHaveBeenCalled()
        })

        it('should return 401 without authorization', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/licenses'
            })

            expect(response.statusCode).toBe(401)
        })
    })

    // ==================== Get License ====================

    describe('GET /licenses/:id', () => {
        it('should return license by ID', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/licenses/${TEST_LICENSE_ID}`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            const body = JSON.parse(response.body)
            expect(body.id).toBe(TEST_LICENSE_ID)
            expect(mockService.getLicense).toHaveBeenCalledWith(TEST_LICENSE_ID)
        })

        it('should return 404 for non-existent license', async () => {
            vi.mocked(mockService.getLicense!).mockResolvedValueOnce(null)

            const response = await app.inject({
                method: 'GET',
                url: `/licenses/${NON_EXISTENT_ID}`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(404)
        })
    })

    // ==================== Create License ====================

    describe('POST /licenses', () => {
        it('should create a new license', async () => {
            const newLicense = {
                softwareName: 'Microsoft Office 365',
                seatCount: 100,
                licenseType: 'per_seat'
            }

            const response = await app.inject({
                method: 'POST',
                url: '/licenses',
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: newLicense
            })

            expect(response.statusCode).toBe(201)
            expect(mockService.createLicense).toHaveBeenCalled()
        })

        it('should return 400 for invalid input', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/licenses',
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: { invalidField: 'test' }
            })

            // Should fail validation - seatCount is required
            expect(response.statusCode).toBeGreaterThanOrEqual(400)
        })
    })

    // ==================== Update License ====================

    describe('PATCH /licenses/:id', () => {
        it('should update license', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/licenses/${TEST_LICENSE_ID}`,
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: { softwareName: 'Updated Name' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.updateLicense).toHaveBeenCalledWith(TEST_LICENSE_ID, expect.any(Object), TEST_USER_ID)
        })

        it('should return 404 for non-existent license', async () => {
            vi.mocked(mockService.updateLicense!).mockResolvedValueOnce(null)

            const response = await app.inject({
                method: 'PATCH',
                url: `/licenses/${NON_EXISTENT_ID}`,
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: { softwareName: 'Updated' }
            })

            expect(response.statusCode).toBe(404)
        })
    })

    // ==================== Delete License ====================

    describe('DELETE /licenses/:id', () => {
        it('should delete license', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/licenses/${TEST_LICENSE_ID}`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(204)
            expect(mockService.deleteLicense).toHaveBeenCalledWith(TEST_LICENSE_ID, TEST_USER_ID)
        })

        it('should return 404 for non-existent license', async () => {
            vi.mocked(mockService.deleteLicense!).mockResolvedValueOnce(false)

            const response = await app.inject({
                method: 'DELETE',
                url: `/licenses/${NON_EXISTENT_ID}`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(404)
        })

        it('should return 400 for business rule violation', async () => {
            vi.mocked(mockService.deleteLicense!).mockRejectedValueOnce(new Error('Only draft licenses can be deleted'))

            const response = await app.inject({
                method: 'DELETE',
                url: `/licenses/${TEST_LICENSE_ID}`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(400)
        })
    })

    // ==================== Activate License ====================

    describe('POST /licenses/:id/activate', () => {
        it('should activate a draft license', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/licenses/${TEST_LICENSE_ID}/activate`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.activateLicense).toHaveBeenCalledWith(TEST_LICENSE_ID, TEST_USER_ID)
        })

        it('should return 400 for non-draft license', async () => {
            vi.mocked(mockService.activateLicense!).mockRejectedValueOnce(
                new Error('Cannot activate license with status: active')
            )

            const response = await app.inject({
                method: 'POST',
                url: `/licenses/${TEST_LICENSE_ID}/activate`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(400)
        })
    })

    // ==================== Retire License ====================

    describe('POST /licenses/:id/retire', () => {
        it('should retire an active license', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/licenses/${TEST_LICENSE_ID}/retire`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.retireLicense).toHaveBeenCalledWith(TEST_LICENSE_ID, TEST_USER_ID)
        })
    })

    // ==================== Assign Seat ====================

    describe('POST /licenses/:id/seats', () => {
        it('should assign a seat to a user', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/licenses/${TEST_LICENSE_ID}/seats`,
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: {
                    assignmentType: 'user',
                    assignedUserId: TEST_USER_ID,
                    notes: 'Test assignment'
                }
            })

            expect(response.statusCode).toBe(201)
            expect(mockService.assignSeat).toHaveBeenCalled()
        })
    })

    // ==================== Get Seats ====================

    describe('GET /licenses/:id/seats', () => {
        it('should return seats for a license', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/licenses/${TEST_LICENSE_ID}/seats`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.getSeats).toHaveBeenCalledWith(TEST_LICENSE_ID)
        })
    })

    // ==================== Audit Logs ====================

    describe('GET /licenses/:id/audit', () => {
        it('should return audit logs for a license', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/licenses/${TEST_LICENSE_ID}/audit`,
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.getAuditLogs).toHaveBeenCalledWith(TEST_LICENSE_ID)
        })
    })

    // ==================== Suppliers (separate prefix /suppliers) ====================

    describe('GET /suppliers', () => {
        it('should return list of suppliers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/suppliers',
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.getSuppliers).toHaveBeenCalled()
        })
    })

    describe('POST /suppliers', () => {
        it('should create a new supplier', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/suppliers',
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json'
                },
                payload: {
                    code: 'SUP-002',
                    name: 'New Supplier',
                    email: 'supplier@example.com'
                }
            })

            expect(response.statusCode).toBe(201)
            expect(mockService.createSupplier).toHaveBeenCalled()
        })
    })

    // ==================== Categories (separate prefix /license-categories) ====================

    describe('GET /license-categories', () => {
        it('should return list of categories', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/license-categories',
                headers: { authorization: 'Bearer valid-token' }
            })

            expect(response.statusCode).toBe(200)
            expect(mockService.getCategories).toHaveBeenCalled()
        })
    })
})
