import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

// Load test environment variables
const envFile = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envFile)) {
    config({ path: envFile, override: true });
}

/**
 * Test environment configuration
 */
export const testEnv = {
    // Base URLs
    webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:3001',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

    // Test credentials
    testUser: {
        email: process.env.TEST_USER_EMAIL || 'admin@test.com',
        password: process.env.TEST_USER_PASSWORD || 'admin123',
    },

    // API configuration
    apiPathPrefix: process.env.API_PATH_PREFIX || 'auto',

    // Test behavior
    mockAuth: process.env.E2E_MOCK_AUTH === 'true',
    isCI: process.env.CI === 'true',

    // Timeouts
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '15000'),

    // Health checks
    healthCheckRetries: parseInt(process.env.HEALTH_CHECK_RETRIES || '10'),
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),

    // Database
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
} as const;

/**
 * Auto-detect API path prefix by trying common patterns
 */
export async function detectApiPrefix(baseUrl: string): Promise<string> {
    if (testEnv.apiPathPrefix !== 'auto') {
        return testEnv.apiPathPrefix;
    }

    const prefixes = ['/api/v1', '/v1', '/api', ''];

    for (const prefix of prefixes) {
        try {
            const response = await fetch(`${baseUrl}${prefix}/health`);
            if (response.ok) {
                console.log(`✓ Auto-detected API prefix: ${prefix || '(root)'}`);
                return prefix;
            }
        } catch (error) {
            // Continue trying
        }
    }

    console.log('⚠ Could not auto-detect API prefix, using empty prefix');
    return '';
}

/**
 * Check if environment is properly configured
 */
export function validateTestEnv() {
    const errors: string[] = [];

    if (!testEnv.webBaseUrl) {
        errors.push('WEB_BASE_URL is required');
    }

    if (!testEnv.apiBaseUrl) {
        errors.push('API_BASE_URL is required');
    }

    if (errors.length > 0) {
        throw new Error(`Test environment validation failed:\n${errors.join('\n')}`);
    }
}

/**
 * Wait for service to be ready
 */
export async function waitForService(
    url: string,
    retries = testEnv.healthCheckRetries,
    timeout = testEnv.healthCheckTimeout
): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeout)
            });

            if (response.ok) {
                console.log(`✓ Service ready: ${url}`);
                return true;
            }

            console.log(`⏳ Service not ready (${response.status}): ${url} - retry ${i + 1}/${retries}`);
        } catch (error) {
            console.log(`⏳ Service check failed: ${url} - retry ${i + 1}/${retries} - ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`❌ Service not ready after ${retries} retries: ${url}`);
    return false;
}