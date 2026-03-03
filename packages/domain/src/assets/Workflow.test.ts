import { describe, it, expect } from 'vitest'
import { WorkflowRequest } from './Workflow.js'
import { DomainError } from '../core/errors/index.js'

describe('WorkflowRequest', () => {
    it('requires request type and status', () => {
        expect(() => new WorkflowRequest({
            id: 'w1',
            requestType: undefined as unknown as 'assign',
            status: 'submitted'
        })).toThrow(DomainError)

        expect(() => new WorkflowRequest({
            id: 'w1',
            requestType: 'assign',
            status: undefined as unknown as 'submitted'
        })).toThrow(DomainError)
    })
})
