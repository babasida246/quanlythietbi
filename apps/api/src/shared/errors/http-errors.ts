/**
 * HTTP Error Classes
 */
export class HttpError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public code: string = 'INTERNAL_ERROR',
        public details?: unknown
    ) {
        super(message)
        this.name = 'HttpError'
    }
}

export class BadRequestError extends HttpError {
    constructor(message = 'Bad Request', details?: unknown) {
        super(400, message, 'BAD_REQUEST', details)
        this.name = 'BadRequestError'
    }
}

export class UnauthorizedError extends HttpError {
    constructor(message = 'Unauthorized', details?: unknown) {
        super(401, message, 'UNAUTHORIZED', details)
        this.name = 'UnauthorizedError'
    }
}

export class ForbiddenError extends HttpError {
    constructor(message = 'Forbidden', details?: unknown) {
        super(403, message, 'FORBIDDEN', details)
        this.name = 'ForbiddenError'
    }
}

export class NotFoundError extends HttpError {
    constructor(message = 'Not Found', details?: unknown) {
        super(404, message, 'NOT_FOUND', details)
        this.name = 'NotFoundError'
    }
}

export class ConflictError extends HttpError {
    constructor(message = 'Conflict', details?: unknown) {
        super(409, message, 'CONFLICT', details)
        this.name = 'ConflictError'
    }
}

export class ValidationError extends HttpError {
    constructor(message = 'Validation Error', details?: unknown) {
        super(422, message, 'VALIDATION_ERROR', details)
        this.name = 'ValidationError'
    }
}

export class TooManyRequestsError extends HttpError {
    constructor(message = 'Too Many Requests', details?: unknown) {
        super(429, message, 'TOO_MANY_REQUESTS', details)
        this.name = 'TooManyRequestsError'
    }
}

export class InternalServerError extends HttpError {
    constructor(message = 'Internal Server Error', details?: unknown) {
        super(500, message, 'INTERNAL_ERROR', details)
        this.name = 'InternalServerError'
    }
}

export class ServiceUnavailableError extends HttpError {
    constructor(message = 'Service Unavailable', details?: unknown) {
        super(503, message, 'SERVICE_UNAVAILABLE', details)
        this.name = 'ServiceUnavailableError'
    }
}
