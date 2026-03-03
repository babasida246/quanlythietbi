import { describe, it, expect } from 'vitest'
import {
    exportCiInventoryReportToCSV,
    exportRelationshipAnalyticsToCSV,
    exportAuditTrailToCSV,
    exportCiInventoryReportToPDF,
    exportRelationshipAnalyticsToPDF,
    exportAuditTrailToPDF
} from './export/index.js'

describe('CMDB Reports - Export Utilities', () => {
    describe('CSV Export', () => {
        describe('CI Inventory Report', () => {
            it('exports CI inventory report to CSV format', () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z'),
                    totalCiCount: 100,
                    orphanedCiCount: 5,
                    countByType: [
                        { typeId: 'server', typeName: 'Server', count: 60 },
                        { typeId: 'db', typeName: 'Database', count: 40 }
                    ],
                    countByStatus: [
                        { status: 'active', count: 95 },
                        { status: 'inactive', count: 5 }
                    ],
                    countByEnvironment: [
                        { environment: 'production', count: 70 },
                        { environment: 'staging', count: 30 }
                    ],
                    complianceIssues: [
                        { ciId: 'ci-001', ciName: 'Server-01', issue: 'Missing location' },
                        { ciId: 'ci-002', ciName: 'Server-02', issue: 'No owner assigned' }
                    ]
                }

                const csv = exportCiInventoryReportToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('CI INVENTORY REPORT')
                expect(csv).toContain('Total CIs,100')
                expect(csv).toContain('Orphaned CIs,5')
                expect(csv).toContain('Server,60')
                expect(csv).toContain('Database,40')
                expect(csv).toContain('active,95')
                expect(csv).toContain('production,70')
                expect(csv).toContain('Missing location')
                expect(csv).toContain('No owner assigned')
            })

            it('handles empty report gracefully', () => {
                const report = {
                    generatedAt: new Date(),
                    totalCiCount: 0
                }

                const csv = exportCiInventoryReportToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('Total CIs,0')
            })

            it('escapes CSV special characters', () => {
                const report = {
                    generatedAt: new Date(),
                    totalCiCount: 10,
                    orphanedCiCount: 1,
                    complianceIssues: [
                        { ciId: 'ci-001', ciName: 'Server with "quotes"', issue: 'Issue with, comma' }
                    ]
                }

                const csv = exportCiInventoryReportToCSV(report)

                expect(csv).toContain('Server with ""quotes""')
                expect(csv).toContain('Issue with, comma')
            })
        })

        describe('Relationship Analytics Report', () => {
            it('exports relationship analytics to CSV format', () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z'),
                    totalRelationshipCount: 250,
                    hubCis: [
                        {
                            ciId: 'ci-001',
                            ciName: 'MainServer',
                            ciType: 'server',
                            incomingCount: 15,
                            outgoingCount: 20,
                            totalConnectionCount: 35
                        },
                        {
                            ciId: 'ci-002',
                            ciName: 'Database',
                            ciType: 'database',
                            incomingCount: 20,
                            outgoingCount: 10,
                            totalConnectionCount: 30
                        }
                    ],
                    brokenRelationships: [
                        {
                            relationshipId: 'rel-001',
                            fromCiId: 'ci-missing-1',
                            toCiId: 'ci-001',
                            relationshipType: 'depends_on'
                        }
                    ]
                }

                const csv = exportRelationshipAnalyticsToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('RELATIONSHIP ANALYTICS REPORT')
                expect(csv).toContain('Total Relationships,250')
                expect(csv).toContain('MainServer')
                expect(csv).toContain('35')
                expect(csv).toContain('ci-missing-1')
            })

            it('handles empty analytics report', () => {
                const report = {
                    generatedAt: new Date(),
                    totalRelationshipCount: 0
                }

                const csv = exportRelationshipAnalyticsToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('Total Relationships,0')
            })
        })

        describe('Audit Trail Report', () => {
            it('exports audit trail to CSV format', () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z'),
                    ciChangeHistory: [
                        {
                            timestamp: '2026-01-22T20:00:00Z',
                            operation: 'CREATE',
                            ciId: 'ci-001',
                            ciName: 'Server-01'
                        },
                        {
                            timestamp: '2026-01-22T21:00:00Z',
                            operation: 'UPDATE',
                            ciId: 'ci-001',
                            ciName: 'Server-01'
                        }
                    ],
                    relationshipChangeHistory: [
                        {
                            timestamp: '2026-01-22T20:30:00Z',
                            operation: 'CREATE',
                            fromCiId: 'ci-001',
                            toCiId: 'ci-002',
                            relationshipType: 'depends_on'
                        }
                    ]
                }

                const csv = exportAuditTrailToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('AUDIT TRAIL REPORT')
                expect(csv).toContain('CI CHANGES')
                expect(csv).toContain('CREATE')
                expect(csv).toContain('Server-01')
                expect(csv).toContain('RELATIONSHIP CHANGES')
                expect(csv).toContain('ci-001')
                expect(csv).toContain('ci-002')
            })

            it('handles empty audit trail', () => {
                const report = {
                    generatedAt: new Date()
                }

                const csv = exportAuditTrailToCSV(report)

                expect(csv).toBeDefined()
                expect(csv).toContain('AUDIT TRAIL REPORT')
            })
        })
    })

    describe('PDF Export', () => {
        describe('CI Inventory Report', () => {
            it('exports CI inventory report to PDF format', async () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z'),
                    totalCiCount: 100,
                    orphanedCiCount: 5
                }

                const pdf = await exportCiInventoryReportToPDF(report)

                expect(pdf).toBeDefined()
                expect(Buffer.isBuffer(pdf)).toBe(true)
                expect(pdf.length).toBeGreaterThan(0)
            })

            it('returns buffer with PDF header', async () => {
                const report = {
                    generatedAt: new Date(),
                    totalCiCount: 50
                }

                const pdf = await exportCiInventoryReportToPDF(report)
                const pdfString = pdf.toString('utf-8')

                expect(pdfString).toContain('%PDF')
            })
        })

        describe('Relationship Analytics Report', () => {
            it('exports relationship analytics to PDF format', async () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z'),
                    totalRelationshipCount: 250
                }

                const pdf = await exportRelationshipAnalyticsToPDF(report)

                expect(pdf).toBeDefined()
                expect(Buffer.isBuffer(pdf)).toBe(true)
                expect(pdf.length).toBeGreaterThan(0)
            })
        })

        describe('Audit Trail Report', () => {
            it('exports audit trail to PDF format', async () => {
                const report = {
                    generatedAt: new Date('2026-01-22T21:00:00Z')
                }

                const pdf = await exportAuditTrailToPDF(report)

                expect(pdf).toBeDefined()
                expect(Buffer.isBuffer(pdf)).toBe(true)
                expect(pdf.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Export Format Validation', () => {
        it('CSV export contains valid structure with headers', () => {
            const report = {
                generatedAt: new Date(),
                totalCiCount: 10,
                countByType: [{ typeId: 'server', typeName: 'Server', count: 10 }]
            }

            const csv = exportCiInventoryReportToCSV(report)
            const lines = csv.split('\n')

            // Should have multiple lines
            expect(lines.length).toBeGreaterThan(3)

            // Should have title
            expect(lines[0]).toContain('CI INVENTORY REPORT')

            // Should have headers
            expect(csv).toContain('Metric,Value')
        })

        it('PDF export size is reasonable', async () => {
            const largeReport = {
                generatedAt: new Date(),
                totalCiCount: 1000,
                orphanedCiCount: 100,
                countByType: Array(50)
                    .fill(0)
                    .map((_, i) => ({ typeId: `type-${i}`, typeName: `Type ${i}`, count: 20 }))
            }

            const pdf = await exportCiInventoryReportToPDF(largeReport)

            // PDF should be reasonable size (not too large)
            expect(pdf.length).toBeLessThan(1024 * 1024) // Less than 1MB
        })

        it('handles null/undefined values gracefully in CSV', () => {
            const report = {
                generatedAt: new Date(),
                totalCiCount: 10,
                orphanedCiCount: undefined,
                countByType: [{ typeId: 'server', typeName: null, count: 10 }]
            }

            const csv = exportCiInventoryReportToCSV(report)

            expect(csv).toBeDefined()
            expect(csv).toContain('Total CIs,10')
        })
    })
})
