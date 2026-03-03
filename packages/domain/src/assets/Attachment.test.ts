import { describe, it, expect } from 'vitest'
import { AttachmentMeta } from './Attachment.js'
import { DomainError } from '../core/errors/index.js'

describe('AttachmentMeta', () => {
    it('requires file name and storage key', () => {
        expect(() => new AttachmentMeta({
            id: 'a1',
            assetId: 'asset-1',
            fileName: '',
            storageKey: 'key',
            version: 1
        })).toThrow(DomainError)

        expect(() => new AttachmentMeta({
            id: 'a1',
            assetId: 'asset-1',
            fileName: 'doc.pdf',
            storageKey: '',
            version: 1
        })).toThrow(DomainError)
    })
})
