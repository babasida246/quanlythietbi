/**
 * Documents Module - Service
 */
import { BadRequestError, NotFoundError } from '../../shared/errors/http-errors.js'
import type {
    ApprovalActionInput,
    BulkDocumentsInput,
    CreateDocumentInput,
    Document,
    DocumentListQueryInput,
    UpdateDocumentInput
} from './documents.schemas.js'
import { DocumentsRepository } from './documents.repository.js'

export class DocumentsService {
    constructor(private repo: DocumentsRepository) { }

    async list(query: DocumentListQueryInput): Promise<{ data: Document[]; total: number }> {
        return this.repo.list(query)
    }

    async get(id: string): Promise<Document> {
        const doc = await this.repo.getById(id)
        if (!doc) throw new NotFoundError('Document not found')
        return doc
    }

    async create(input: CreateDocumentInput, actorUserId: string): Promise<Document> {
        return this.repo.create(input, actorUserId)
    }

    async update(id: string, patch: UpdateDocumentInput, actorUserId: string): Promise<Document> {
        const current = await this.get(id)
        if (current.approval.status === 'approved') {
            throw new BadRequestError('Approved documents are immutable. Create a new version instead.')
        }
        const updated = await this.repo.update(id, patch, actorUserId)
        if (!updated) throw new NotFoundError('Document not found')
        return updated
    }

    async submitApproval(id: string, actorUserId: string): Promise<Document> {
        const current = await this.get(id)

        if (current.contentType === 'file' && current.files.length === 0) {
            throw new BadRequestError('Upload at least one file before submitting for approval')
        }
        if (current.contentType === 'markdown' && !current.markdown) {
            throw new BadRequestError('Markdown content is required before submitting for approval')
        }
        if (current.contentType === 'link' && !current.externalUrl) {
            throw new BadRequestError('External URL is required before submitting for approval')
        }

        const updated = await this.repo.submitApproval(id, actorUserId)
        if (!updated) throw new NotFoundError('Document not found')
        return updated
    }

    async approve(id: string, input: ApprovalActionInput, actorUserId: string): Promise<Document> {
        const current = await this.get(id)
        if (current.approval.status !== 'pending') {
            throw new BadRequestError('Only pending documents can be approved')
        }

        // Dangerous: org-wide visibility publish requires reason.
        if (current.visibility === 'org' && !input.reason) {
            throw new BadRequestError('Reason is required to publish org-wide documents')
        }

        const updated = await this.repo.approve(id, actorUserId, input.reason ?? null)
        if (!updated) throw new NotFoundError('Document not found')
        return updated
    }

    async reject(id: string, input: ApprovalActionInput, actorUserId: string): Promise<Document> {
        const current = await this.get(id)
        if (current.approval.status !== 'pending') {
            throw new BadRequestError('Only pending documents can be rejected')
        }
        if (!input.reason) {
            throw new BadRequestError('Reason is required to reject a document')
        }
        const updated = await this.repo.reject(id, actorUserId, input.reason)
        if (!updated) throw new NotFoundError('Document not found')
        return updated
    }

    async delete(id: string, reason: string | undefined, actorUserId: string): Promise<void> {
        void actorUserId
        const current = await this.get(id)
        if (current.approval.status === 'approved' && !reason) {
            throw new BadRequestError('Reason is required to delete an approved document')
        }
        const deleted = await this.repo.delete(id)
        if (!deleted) throw new NotFoundError('Document not found')
    }

    async bulk(input: BulkDocumentsInput, actorUserId: string): Promise<{ updated: number }> {
        let updated = 0
        for (const id of input.ids) {
            if (input.action === 'tag/add') {
                if (!input.tag) throw new BadRequestError('tag is required')
                const doc = await this.get(id)
                const tags = Array.from(new Set([...(doc.tags ?? []), input.tag]))
                await this.update(id, { tags }, actorUserId)
                updated++
                continue
            }

            if (input.action === 'tag/remove') {
                if (!input.tag) throw new BadRequestError('tag is required')
                const doc = await this.get(id)
                const tags = (doc.tags ?? []).filter((t) => t !== input.tag)
                await this.update(id, { tags }, actorUserId)
                updated++
                continue
            }

            if (input.action === 'setVisibility') {
                if (!input.visibility) throw new BadRequestError('visibility is required')
                if (input.visibility === 'org' && !input.reason) {
                    throw new BadRequestError('Reason is required to publish org-wide documents')
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
