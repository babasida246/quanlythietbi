import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CiInventoryReportService } from './CiInventoryReportService.js'
import type { CiRecord, IRelRepo, ICiRepo, IRelTypeRepo } from '@qltb/contracts'

describe('CMDB Reports - CI Inventory Report', () => {
    let mockCiRepo: any
    let mockRelRepo: any
    let mockRelTypeRepo: any
    let service: CiInventoryReportService

    const mockCis: CiRecord[] = [
        {
            id: 'ci-1',
            ci_code: 'APP-001',
            name: 'Web Application',
            ci_type_id: 'type-1',
            status: 'active',
            source_id: null,
            asset_id: null,
            metadata: { environment: 'production' },
            created_at: new Date('2025-12-01'),
            updated_at: new Date('2026-01-20')
        },
        {
            id: 'ci-2',
            ci_code: 'DB-001',
            name: 'Database Server',
            ci_type_id: 'type-2',
            status: 'active',
            source_id: null,
            asset_id: null,
            metadata: { environment: 'production' },
            created_at: new Date('2025-11-01'),
            updated_at: new Date('2026-01-20')
        },
        {
            id: 'ci-3',
            ci_code: 'CACHE-001',
            name: 'Cache Server',
            ci_type_id: 'type-1',
            status: 'maintenance',
            source_id: null,
            asset_id: null,
            metadata: { environment: 'staging' },
            created_at: new Date('2026-01-10'),
            updated_at: new Date('2026-01-20')
        }
    ]

    beforeEach(() => {
        mockCiRepo = {
            list: vi.fn().mockResolvedValue(mockCis)
        }
        mockRelRepo = {
            list: vi.fn().mockResolvedValue([
                {
                    id: 'rel-1',
                    from_ci_id: 'ci-1',
                    to_ci_id: 'ci-2',
                    rel_type_id: 'depends_on',
                    status: 'active'
                },
                {
                    id: 'rel-2',
                    from_ci_id: 'ci-2',
                    to_ci_id: 'ci-3',
                    rel_type_id: 'hosts',
                    status: 'active'
                }
            ])
        }
        mockRelTypeRepo = {}

        service = new CiInventoryReportService(mockCiRepo, mockRelRepo, mockRelTypeRepo)
    })

    describe('generateCiInventoryReport', () => {
        it('should generate complete CI inventory report', async () => {
            const report = await service.generateCiInventoryReport()

            expect(report).toBeDefined()
            expect(report.totalCiCount).toBe(3)
            expect(report.generatedAt).toBeDefined()
            expect(report.countByType).toHaveLength(2)
            expect(report.countByStatus).toHaveLength(2)
        })

        it('should count CIs by type correctly', async () => {
            const report = await service.generateCiInventoryReport()

            const type1 = report.countByType.find(t => t.typeId === 'type-1')
            const type2 = report.countByType.find(t => t.typeId === 'type-2')

            expect(type1?.count).toBe(2)
            expect(type2?.count).toBe(1)
        })

        it('should count CIs by status correctly', async () => {
            const report = await service.generateCiInventoryReport()

            const active = report.countByStatus.find(s => s.status === 'active')
            const maintenance = report.countByStatus.find(s => s.status === 'maintenance')

            expect(active?.count).toBe(2)
            expect(maintenance?.count).toBe(1)
        })

        it('should count CIs by environment', async () => {
            const report = await service.generateCiInventoryReport()

            const prod = report.countByEnvironment.find(e => e.environment === 'production')
            const staging = report.countByEnvironment.find(e => e.environment === 'staging')

            expect(prod?.count).toBe(2)
            expect(staging?.count).toBe(1)
        })

        it('should identify orphaned CIs', async () => {
            mockCiRepo.list.mockResolvedValueOnce([
                ...mockCis,
                {
                    id: 'ci-4',
                    ci_code: 'ORPHAN-001',
                    name: 'Orphaned CI',
                    ci_type_id: 'type-1',
                    status: 'inactive',
                    source_id: null,
                    asset_id: null,
                    metadata: {},
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ])

            service = new CiInventoryReportService(mockCiRepo, mockRelRepo, mockRelTypeRepo)
            const report = await service.generateCiInventoryReport()

            expect(report.orphanedCiCount).toBeGreaterThan(0)
            expect(report.orphanedCis.length).toBeGreaterThan(0)
        })

        it('should calculate age distribution', async () => {
            const report = await service.generateCiInventoryReport()

            expect(report.ageDistribution).toBeDefined()
            expect(report.ageDistribution.length).toBeGreaterThan(0)
            expect(report.ageDistribution[0]).toHaveProperty('rangeLabel')
            expect(report.ageDistribution[0]).toHaveProperty('minDays')
            expect(report.ageDistribution[0]).toHaveProperty('maxDays')
            expect(report.ageDistribution[0]).toHaveProperty('count')
        })

        it('should identify compliance issues', async () => {
            mockCiRepo.list.mockResolvedValueOnce([
                {
                    id: 'ci-5',
                    ci_code: 'BAD-001',
                    name: 'Non-compliant CI',
                    ci_type_id: 'type-1',
                    status: 'active',
                    source_id: null,
                    asset_id: null,
                    metadata: {}, // Missing environment
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ])

            service = new CiInventoryReportService(mockCiRepo, mockRelRepo, mockRelTypeRepo)
            const report = await service.generateCiInventoryReport()

            expect(report.complianceIssues).toBeDefined()
            expect(report.complianceIssues.length).toBeGreaterThan(0)
        })
    })
})
