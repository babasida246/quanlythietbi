import AppError from './AppError.js'

export default class DomainError extends AppError {
    constructor(code: string, message: string, details?: Record<string, unknown>) {
        super(code, message, details, undefined, 400)
        this.name = 'DomainError'
    }

    static validation(message: string, field?: string): DomainError {
        return new DomainError('VALIDATION_ERROR', message, { field })
    }

    static businessRule(message: string, rule?: string): DomainError {
        return new DomainError('BUSINESS_RULE_VIOLATION', message, { rule })
    }

    static entityNotFound(entity: string, id: string): DomainError {
        return new DomainError('ENTITY_NOT_FOUND', `${entity} not found`, { entity, id })
    }
}
