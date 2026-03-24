/**
 * Organization Service
 * Business logic for managing organizational units (OU)
 */

import type {
    OrganizationDto,
    CreateOrganizationDto,
    UpdateOrganizationDto,
    OrganizationListQuery,
    IOrganizationRepository
} from '@qltb/contracts'

export class OrganizationService {
    constructor(private repo: IOrganizationRepository) {}

    async list(query: OrganizationListQuery = {}): Promise<{ items: OrganizationDto[]; total: number }> {
        return this.repo.findAll(query)
    }

    async getById(id: string): Promise<OrganizationDto> {
        const org = await this.repo.findById(id)
        if (!org) throw new Error(`Organization not found: ${id}`)
        return org
    }

    async create(dto: CreateOrganizationDto): Promise<OrganizationDto> {
        if (!dto.name?.trim()) throw new Error('Organization name is required')

        if (dto.code) {
            const existing = await this.repo.findByCode(dto.code)
            if (existing) throw new Error(`Organization code "${dto.code}" already exists`)
        }

        if (dto.parentId) {
            const parent = await this.repo.findById(dto.parentId)
            if (!parent) throw new Error(`Parent organization not found: ${dto.parentId}`)
        }

        return this.repo.create({ ...dto, name: dto.name.trim() })
    }

    async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
        const existing = await this.repo.findById(id)
        if (!existing) throw new Error(`Organization not found: ${id}`)

        if (dto.code && dto.code !== existing.code) {
            const conflict = await this.repo.findByCode(dto.code)
            if (conflict && conflict.id !== id) {
                throw new Error(`Organization code "${dto.code}" already exists`)
            }
        }

        if (dto.parentId && dto.parentId === id) {
            throw new Error('Organization cannot be its own parent')
        }

        if (dto.parentId) {
            const parent = await this.repo.findById(dto.parentId)
            if (!parent) throw new Error(`Parent organization not found: ${dto.parentId}`)
        }

        const updated = await this.repo.update(id, dto)
        if (!updated) throw new Error(`Organization not found: ${id}`)
        return updated
    }

    async delete(id: string): Promise<void> {
        const existing = await this.repo.findById(id)
        if (!existing) throw new Error(`Organization not found: ${id}`)
        await this.repo.delete(id)
    }
}
