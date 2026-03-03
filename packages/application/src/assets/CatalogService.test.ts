import { describe, it, expect } from 'vitest'
import { CatalogService } from './CatalogService.js'
import {
    FakeCatalogRepo,
    FakeCache,
    FakeSpecRepo,
    FakeSpecVersionRepo,
    emptyCatalogs
} from './CatalogService.test.helpers.js'

describe('CatalogService', () => {
    it('returns cached catalogs when available', async () => {
        const cache = new FakeCache()
        await cache.set('assets:catalogs', emptyCatalogs, 60)
        const catalogs = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const service = new CatalogService(catalogs, new FakeSpecRepo(catalogs, versions), versions, cache)

        const result = await service.listCatalogs()
        expect(result).toEqual(emptyCatalogs)
    })

    it('builds a location path with parent', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const service = new CatalogService(repo, new FakeSpecRepo(repo, versions), versions)

        const created = await service.createLocation({ name: 'Room A', parentId: 'l1' })
        expect(created.path).toBe(`/l1/${created.id}`)
    })

    it('rejects self-parent updates', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const service = new CatalogService(repo, new FakeSpecRepo(repo, versions), versions)

        await expect(service.updateLocation('l1', { parentId: 'l1' })).rejects.toThrow('Location cannot be its own parent')
    })

    it('auto-applies templates on category create', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const specRepo = new FakeSpecRepo(repo, versions)
        const service = new CatalogService(repo, specRepo, versions)

        const result = await service.createCategory({ name: 'RAM' })
        expect(result.category.name).toBe('RAM')
        expect(result.specDefs?.some(def => def.key === 'memorySizeGb')).toBe(true)
    })

    it('rejects invalid model spec', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const specRepo = new FakeSpecRepo(repo, versions)
        versions.versions.push({
            id: 'ver-1',
            categoryId: 'cat-1',
            version: 1,
            status: 'active',
            createdAt: new Date()
        })
        specRepo.defs.push({
            id: 'spec-1',
            versionId: 'ver-1',
            key: 'capacityGb',
            label: 'Capacity',
            fieldType: 'number',
            unit: 'GB',
            required: true,
            enumValues: null,
            pattern: null,
            minLen: null,
            maxLen: null,
            minValue: 1,
            maxValue: 100,
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
        const service = new CatalogService(repo, specRepo, versions)

        await expect(service.createModel({ model: 'Disk', categoryId: 'cat-1', spec: {} })).rejects.toThrow('Invalid model spec')
    })

    it('accepts valid model spec', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const specRepo = new FakeSpecRepo(repo, versions)
        versions.versions.push({
            id: 'ver-1',
            categoryId: 'cat-1',
            version: 1,
            status: 'active',
            createdAt: new Date()
        })
        specRepo.defs.push({
            id: 'spec-1',
            versionId: 'ver-1',
            key: 'capacityGb',
            label: 'Capacity',
            fieldType: 'number',
            unit: 'GB',
            required: true,
            enumValues: null,
            pattern: null,
            minLen: null,
            maxLen: null,
            minValue: 1,
            maxValue: 100,
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
        const service = new CatalogService(repo, specRepo, versions)

        const created = await service.createModel({ model: 'Disk', categoryId: 'cat-1', spec: { capacityGb: 10 } })
        expect(created.model).toBe('Disk')
    })

    it('uses provided spec version for validation', async () => {
        const repo = new FakeCatalogRepo()
        const versions = new FakeSpecVersionRepo()
        const specRepo = new FakeSpecRepo(repo, versions)
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
        specRepo.defs.push({
            id: 'spec-1',
            versionId: 'ver-2',
            key: 'speedMhz',
            label: 'Speed',
            fieldType: 'number',
            unit: 'MHz',
            required: true,
            enumValues: null,
            pattern: null,
            minLen: null,
            maxLen: null,
            minValue: 1,
            maxValue: 10000,
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
        const service = new CatalogService(repo, specRepo, versions)

        await expect(service.createModel({
            model: 'Switch',
            categoryId: 'cat-1',
            specVersionId: 'ver-2',
            spec: { speedMhz: 1000 }
        })).resolves.toBeDefined()
    })
})
