// ============================================================
// Organization (OU) DTOs & Interfaces
// ============================================================

export interface OrganizationDto {
    id: string
    name: string
    code: string | null
    description: string | null
    parentId: string | null
    parentName: string | null
    /** Full path, e.g. "Công ty ABC > Phòng CNTT" */
    path: string
    /** Count of direct children */
    childrenCount: number
    createdAt: string
    updatedAt: string
}

export interface CreateOrganizationDto {
    name: string
    code?: string | null
    description?: string | null
    parentId?: string | null
}

export interface UpdateOrganizationDto {
    name?: string
    code?: string | null
    description?: string | null
    parentId?: string | null
}

export interface OrganizationListQuery {
    search?: string
    parentId?: string | null
    /** If true, return flat list with paths; if false (default) return only top-level */
    flat?: boolean
    page?: number
    limit?: number
}

export interface IOrganizationRepository {
    findAll(query: OrganizationListQuery): Promise<{ items: OrganizationDto[]; total: number }>
    findById(id: string): Promise<OrganizationDto | null>
    findByCode(code: string): Promise<OrganizationDto | null>
    create(dto: CreateOrganizationDto): Promise<OrganizationDto>
    update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationDto | null>
    delete(id: string): Promise<boolean>
}
