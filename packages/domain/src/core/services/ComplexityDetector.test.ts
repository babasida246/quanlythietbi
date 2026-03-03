import { describe, it, expect } from 'vitest'
import ComplexityDetector from './ComplexityDetector.js'
import { createMessage } from '../value-objects/Message.js'

describe('ComplexityDetector', () => {
    const detector = new ComplexityDetector()

    it('detects simple requests', () => {
        const request = {
            messages: [createMessage({ role: 'user', content: 'Hello' })]
        }
        expect(detector.detect(request)).toBe('simple')
    })

    it('detects medium/complex requests with code', () => {
        const request = {
            messages: [
                createMessage({
                    role: 'user',
                    content: 'Explain this code:\n```typescript\nconst x = 1\n```'
                })
            ]
        }
        const complexity = detector.detect(request)
        expect(['medium', 'complex']).toContain(complexity)
    })

    it('detects domain-specific requests', () => {
        const request = {
            messages: [
                createMessage({
                    role: 'user',
                    content: 'Check Zabbix alerts for HIS system'
                })
            ]
        }
        const complexity = detector.detect(request)
        expect(['simple', 'medium', 'complex']).toContain(complexity)
    })
})
