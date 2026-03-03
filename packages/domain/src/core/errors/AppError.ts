export default class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>,
        public correlationId?: string,
        public readonly httpStatus: number = 500
    ) {
        super(message)
        this.name = 'AppError'
    }

    static badRequest(message: string, details?: Record<string, unknown>): AppError {
        return new AppError('BAD_REQUEST', message, details, undefined, 400)
    }

    static unauthorized(message: string): AppError {
        return new AppError('UNAUTHORIZED', message, undefined, undefined, 401)
    }

    static forbidden(message: string): AppError {
        return new AppError('FORBIDDEN', message, undefined, undefined, 403)
    }

    static notFound(message: string): AppError {
        return new AppError('NOT_FOUND', message, undefined, undefined, 404)
    }

    static conflict(message: string, details?: Record<string, unknown>): AppError {
        return new AppError('CONFLICT', message, details, undefined, 409)
    }

    static internal(message: string, details?: Record<string, unknown>): AppError {
        return new AppError('INTERNAL_ERROR', message, details, undefined, 500)
    }

    toJSON(): Record<string, unknown> {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            correlationId: this.correlationId
        }
    }
}
