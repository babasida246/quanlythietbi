import { describe, it, expect } from 'vitest'
import { reminderRunSchema } from './reminders.schemas.js'

describe('reminder schemas', () => {
    it('parses reminder run payloads', () => {
        const result = reminderRunSchema.parse({ days: [30, 60] })
        expect(result.days).toHaveLength(2)
    })
})
