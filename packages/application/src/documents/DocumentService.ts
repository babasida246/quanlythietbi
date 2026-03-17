/**
 * Knowledge Base Documents — Service
 * Migrated from apps/api/src/modules/documents/documents.service.ts
 */
import { AppError } from '@qltb/domain'
import type {
    KbDocument,
    KbDocCreateInput,
    KbDocUpdateInput,
    KbDocListQuery,
    KbDocApprovalActionInput,
    KbDocBulkInput,
} from '@qltb/contracts'
import type { DocumentRepo } from '@qltb/infra-postgres'

export class DocumentService {
    constructor(private repo: DocumentRepo) { }

    async list(query: KbDocListQuery): Promise<{ data: KbDocument[]; total: number }> {
        return this.repo.list(query)
    }

    async get(id: string): Promise<KbDocument> {
        const doc = await this.repo.getById(id)
        if (!doc) throw AppError.notFound('Document not found')
        return doc
    }

    async create(input: KbDocCreateInput, actorUserId: string): Promise<KbDocument> {
        return this.repo.create(input, actorUserId)
    }

    async update(id: string, patch: KbDocUpdateInput, actorUserId: string): Promise<KbDocument> {
        const current = await this.get(id)
        if (current.approval.status === 'approved') {
            throw AppError.badRequest('Approved documents are immutable. Create a new version instead.')
        }
        const updated = await this.repo.update(id, patch, actorUserId)
        if (!updated) throw AppError.notFound('Document not found')
        return updated
    }

    async submitApproval(id: string, actorUserId: string): Promise<KbDocument> {
        const current = await this.get(id)

        if (current.contentType === 'file' && current.files.length === 0) {
            throw AppError.badRequest('Upload at least one file before submitting for approval')
        }
        if (current.contentType === 'markdown' && !current.markdown) {
            throw AppError.badRequest('Markdown content is required before submitting for approval')
        }
        if (current.contentType === 'link' && !current.externalUrl) {
            throw AppError.badRequest('External URL is required before submitting for approval')
        }

        const updated = await this.repo.submitApproval(id, actorUserId)
        if (!updated) throw AppError.notFound('Document not found')
        return updated
    }

    async approve(id: string, input: KbDocApprovalActionInput, actorUserId: string): Promise<KbDocument> {
        const current = await this.get(id)
        if (current.approval.status !== 'pending') {
            throw AppError.badRequest('Only pending documents can be approved')
        }

        if (current.visibility === 'org' && !input.reason) {
            throw AppError.badRequest('Reason is required to publish org-wide documents')
        }

        const updated = await this.repo.approve(id, actorUserId, input.reason ?? null)
        if (!updated) throw AppError.notFound('Document not found')
        return updated
    }

    async reject(id: string, input: KbDocApprovalActionInput, actorUserId: string): Promise<KbDocument> {
        const current = await this.get(id)
        if (current.approval.status !== 'pending') {
            throw AppError.badRequest('Only pending documents can be rejected')
        }
        if (!input.reason) {
            throw AppError.badRequest('Reason is required to reject a document')
        }
        const updated = await this.repo.reject(id, actorUserId, input.reason)
        if (!updated) throw AppError.notFound('Document not found')
        return updated
    }

    async delete(id: string, reason: string | undefined, _actorUserId: string): Promise<void> {
        const current = await this.get(id)
        if (current.approval.status === 'approved' && !reason) {
            throw AppError.badRequest('Reason is required to delete an approved document')
        }
        const deleted = await this.repo.delete(id)
        if (!deleted) throw AppError.notFound('Document not found')
    }

    async bulk(input: KbDocBulkInput, actorUserId: string): Promise<{ updated: number }> {
        let updated = 0
        for (const id of input.ids) {
            if (input.action === 'tag/add') {
                if (!input.tag) throw AppError.badRequest('tag is required')
                const doc = await this.get(id)
                const tags = Array.from(new Set([...(doc.tags ?? []), input.tag]))
                await this.update(id, { tags }, actorUserId)
                updated++
                continue
            }

            if (input.action === 'tag/remove') {
                if (!input.tag) throw AppError.badRequest('tag is required')
                const doc = await this.get(id)
                const tags = (doc.tags ?? []).filter((t) => t !== input.tag)
                await this.update(id, { tags }, actorUserId)
                updated++
                continue
            }

            if (input.action === 'setVisibility') {
                if (!input.visibility) throw AppError.badRequest('visibility is required')
                if (input.visibility === 'org' && !input.reason) {
                    throw AppError.badRequest('Reason is required to publish org-wide documents')
                }
                await this.update(id, { visibility: input.visibility }, actorUserId)
                updated++
                continue
            }

            if (input.action === 'submitApproval') {
                await this.submitApproval(id, actorUserId)
                updated++
                continue
            }

            if (input.action === 'delete') {
                await this.delete(id, input.reason, actorUserId)
                updated++
                continue
            }
        }
        return { updated }
    }
}
