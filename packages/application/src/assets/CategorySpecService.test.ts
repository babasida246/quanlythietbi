import { describe, it, expect } from 'vitest'
import { CategorySpecService } from './CategorySpecService.js'
import { FakeCatalogRepo, FakeSpecRepo, FakeSpecVersionRepo } from './CatalogService.test.helpers.js'

describe('CategorySpecService', () => {
    it('publishes version and retires previous active', async () => {
        const catalogs = new FakeCatalogRepo()
        catalogs.seedCategory({ id: 'cat-1', name: 'RAM' })
        catalogs.seedModel({
            id: 'model-1',
            categoryId: 'cat-1',
            vendorId: null,
            brand: null,
            model: 'DDR4 16GB',
            spec: {},
            createdAt: new Date()
        })
        const versions = new FakeSpecVersionRepo()
        versions.versions.push({
            id: 'ver-1',
            categoryId: 'cat-1',
            version: 1,
            status: 'active',
            createdAt: new Date()
        })
        versions.versions.push({
            id: 'ver-2',
            categoryId: 'cat-1',
            version: 2,
            status: 'draft',
            createdAt: new Date()
        })
        const specs = new FakeSpecRepo(catalogs, versions)
        specs.defs.push({
            id: 'spec-1',
            versionId: 'ver-2',
            key: 'memorySizeGb',
            label: 'Memory Size',
            fieldType: 'number',
            unit: 'GB',
            required: true,
            enumValues: null,
            pattern: null,
            minLen: null,
            maxLen: null,
            minValue: 1,
            maxValue: 512,
            stepValue: 1,
            precision: null,
            scale: null,
            normalize: null,
            defaultValue: null,
            helpText: null,
            sortOrder: 0,
            isActive: true,
            isReadonly: false,
            computedExpr: null,
            isSearchable: false,
            isFilterable: false,
            createdAt: new Date(),
            updatedAt: new Date()
        })
        const service = new CategorySpecService(catalogs, specs, versions)

        const result = await service.publishSpecVersion('ver-2', { userId: 'u1', correlationId: 'c1' })
        expect(result.version.status).toBe('active')
        expect(versions.versions.find(version => version.id === 'ver-1')?.status).toBe('retired')
        expect(result.warnings.length).toBe(1)
        expect(result.warnings[0]?.missingKeys).toContain('memorySizeGb')
    })
})
