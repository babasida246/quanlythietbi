import bcrypt from 'bcryptjs'

export const PASSWORD_MIN_LENGTH = 12

const COMMON_PASSWORDS = new Set([
    '123456',
    '123456789',
    '12345678',
    'password',
    'qwerty',
    'abc123',
    '111111',
    '123123',
    'admin',
    'admin123',
    'password123',
    'letmein'
])

export type PasswordValidationResult = {
    valid: boolean
    issues: string[]
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
    const issues: string[] = []

    if (password.length < PASSWORD_MIN_LENGTH) {
        issues.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    }
    if (!/[A-Z]/.test(password)) {
        issues.push('Password must include at least one uppercase letter')
    }
    if (!/[a-z]/.test(password)) {
        issues.push('Password must include at least one lowercase letter')
    }
    if (!/[0-9]/.test(password)) {
        issues.push('Password must include at least one number')
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        issues.push('Password must include at least one special character')
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        issues.push('Password is too common')
    }

    return {
        valid: issues.length === 0,
        issues
    }
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    if (!passwordHash) return false

    if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$')) {
        try {
            return await bcrypt.compare(password, passwordHash)
        } catch {
            return false
        }
    }

    // Reject non-bcrypt values to avoid accidental plaintext password storage/use.
    return false
}
