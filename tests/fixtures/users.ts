/**
 * Test user fixtures for authentication testing
 */

export const testUsers = {
    admin: {
        email: 'admin@test.com',
        password: 'admin123',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'admin'],
    },

    user: {
        email: 'user@test.com',
        password: 'user123',
        role: 'user',
        permissions: ['read', 'write'],
    },

    viewer: {
        email: 'viewer@test.com',
        password: 'viewer123',
        role: 'viewer',
        permissions: ['read'],
    },

    invalid: {
        email: 'invalid@test.com',
        password: 'wrongpassword',
        role: null,
        permissions: [],
    },
} as const;

/**
 * Mock auth tokens for testing
 */
export const mockAuthTokens = {
    admin: 'mock-admin-token-12345',
    user: 'mock-user-token-67890',
    viewer: 'mock-viewer-token-abcde',
} as const;

/**
 * Test credentials based on environment
 */
export function getTestCredentials() {
    const envUser = process.env.TEST_USER_EMAIL;
    const envPassword = process.env.TEST_USER_PASSWORD;

    if (envUser && envPassword) {
        return {
            email: envUser,
            password: envPassword,
        };
    }

    return testUsers.admin;
}