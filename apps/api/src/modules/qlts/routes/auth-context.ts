import { UnauthorizedError } from '../../../shared/errors/http-errors.js'

export function requireAuthenticatedUserId(request: { user?: { id?: string } }): string {
    const userId = request.user?.id?.trim()
    if (!userId) {
        throw new UnauthorizedError('Missing authenticated user context')
    }
    return userId
}