import { describe, it, expect } from 'vitest'
import {
    AssetEventTypeValues,
    WorkflowRequestStatusValues,
    assertModelId
} from './types.js'
import { DomainError } from '../core/errors/index.js'

describe('asset types', () => {
    it('includes extended event types', () => {
        expect(AssetEventTypeValues).toContain('IMPORTED')
        expect(AssetEventTypeValues).toContain('REQUEST_APPROVED')
    })

    it('validates model id', () => {
        expect(() => assertModelId('')).toThrow(DomainError)
        expect(() => assertModelId('model-1')).not.toThrow()
    })

    it('includes workflow statuses', () => {
        expect(WorkflowRequestStatusValues).toContain('submitted')
        expect(WorkflowRequestStatusValues).toContain('done')
    })
})
