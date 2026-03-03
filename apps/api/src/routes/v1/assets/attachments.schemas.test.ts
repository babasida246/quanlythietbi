import { describe, it, expect } from 'vitest'
import { attachmentDownloadParamsSchema } from './attachments.schemas.js'

describe('attachment schemas', () => {
    it('parses attachment download params', () => {
        const result = attachmentDownloadParamsSchema.parse({
            id: '123e4567-e89b-12d3-a456-426614174000',
            attachmentId: '123e4567-e89b-12d3-a456-426614174111'
        })
        expect(result.attachmentId).toBeDefined()
    })
})
