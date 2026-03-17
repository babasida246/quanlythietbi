// ============================================================================
// Knowledge Base Documents — DTOs & shared types
// Used by documents module (SOPs, policies, how-tos, etc.)
// ============================================================================

export type KbDocType = 'sop' | 'howto' | 'policy' | 'template' | 'diagram' | 'report' | 'certificate' | 'other'
export type KbDocContentType = 'file' | 'markdown' | 'link'
export type KbDocVisibility = 'private' | 'team' | 'department' | 'org'
export type KbDocApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface KbDocFile {
    id: string
    storageKey: string
    filename: string
    sha256?: string | null
    size?: number | null
    mime?: string | null
    createdAt?: string
}

export interface KbDocScope {
    relatedAssets: string[]
    relatedModels: Array<{ vendor: string; model: string }>
    relatedSites: string[]
    relatedServices: string[]
}

export interface KbDocApproval {
    status: KbDocApprovalStatus
    requestedBy?: string | null
    approvedBy?: string | null
    approvedAt?: string | null
    reason?: string | null
}

export interface KbDocument {
    id: string
    parentId?: string | null
    type: KbDocType
    title: string
    summary?: string | null
    contentType: KbDocContentType
    markdown?: string | null
    externalUrl?: string | null
    files: KbDocFile[]
    scope: KbDocScope
    version: string
    visibility: KbDocVisibility
    approval: KbDocApproval
    tags: string[]
    createdBy?: string | null
    updatedBy?: string | null
    createdAt: string
    updatedAt: string
}

export interface KbDocCreateInput {
    parentId?: string
    type: KbDocType
    title: string
    summary?: string
    contentType: KbDocContentType
    markdown?: string
    externalUrl?: string
    version: string
    visibility: KbDocVisibility
    tags: string[]
    scope?: KbDocScope
}

export interface KbDocUpdateInput extends Partial<KbDocCreateInput> {}

export interface KbDocListQuery {
    type?: KbDocType
    tag?: string
    visibility?: KbDocVisibility
    status?: KbDocApprovalStatus
    q?: string
    relatedAssetId?: string
    relatedModel?: string
    page: number
    pageSize: number
    sort: 'updatedAt' | 'title' | 'type'
}

export interface KbDocApprovalActionInput {
    reason?: string
    note?: string
}

export interface KbDocBulkInput {
    action: 'tag/add' | 'tag/remove' | 'setVisibility' | 'submitApproval' | 'delete'
    ids: string[]
    tag?: string
    visibility?: KbDocVisibility
    reason?: string
}

export interface KbDocFileMeta {
    storageKey: string
    filename: string
    sha256: string | null
    sizeBytes: number
    mimeType: string | null
}
