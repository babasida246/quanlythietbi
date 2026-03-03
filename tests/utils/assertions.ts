import { expect } from '@playwright/test';

/**
 * Enhanced assertion helpers for API testing
 */

/**
 * Assert object has required keys
 */
export function expectHasKeys(obj: any, keys: string[], message?: string) {
    const actualKeys = Object.keys(obj);
    const missingKeys = keys.filter(key => !actualKeys.includes(key));

    if (missingKeys.length > 0) {
        throw new Error(
            `${message || 'Object missing required keys'}: ${missingKeys.join(', ')}\\n` +
            `Expected: ${keys.join(', ')}\\n` +
            `Actual: ${actualKeys.join(', ')}`
        );
    }
}

/**
 * Assert value is valid ISO date string
 */
export function expectIsISODate(value: any, message?: string) {
    if (typeof value !== 'string') {
        throw new Error(`${message || 'Expected ISO date string'}, got ${typeof value}`);
    }

    const date = new Date(value);
    if (isNaN(date.getTime()) || !value.match(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/)) {
        throw new Error(`${message || 'Invalid ISO date string'}: ${value}`);
    }
}

/**
 * Assert number is within range
 */
export function expectNumberRange(value: any, min: number, max: number, message?: string) {
    if (typeof value !== 'number') {
        throw new Error(`${message || 'Expected number'}, got ${typeof value}: ${value}`);
    }

    if (value < min || value > max) {
        throw new Error(`${message || 'Number out of range'}: ${value} not in [${min}, ${max}]`);
    }
}

/**
 * Assert string is non-empty
 */
export function expectNonEmptyString(value: any, message?: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${message || 'Expected non-empty string'}, got: ${JSON.stringify(value)}`);
    }
}

/**
 * Assert array has minimum length
 */
export function expectMinArrayLength(value: any, minLength: number, message?: string) {
    if (!Array.isArray(value)) {
        throw new Error(`${message || 'Expected array'}, got ${typeof value}`);
    }

    if (value.length < minLength) {
        throw new Error(`${message || 'Array too short'}: length ${value.length} < ${minLength}`);
    }
}

/**
 * Assert HTTP status is in success range
 */
export function expectSuccessStatus(status: number, message?: string) {
    if (status < 200 || status >= 300) {
        throw new Error(`${message || 'Expected success status'}: got ${status}`);
    }
}

/**
 * Assert HTTP status is specific value
 */
export function expectStatus(actual: number, expected: number, message?: string) {
    if (actual !== expected) {
        throw new Error(`${message || 'Status mismatch'}: expected ${expected}, got ${actual}`);
    }
}

/**
 * Assert chat completion response shape
 */
export function expectChatCompletionResponse(response: any) {
    expectHasKeys(response, ['id', 'content'], 'Chat completion response');
    expectNonEmptyString(response.id, 'Chat completion ID');
    expectNonEmptyString(response.content, 'Chat completion content');

    if (response.finish_reason) {
        expect(['stop', 'length', 'tool_calls', 'content_filter']).toContain(response.finish_reason);
    }

    if (response.usage) {
        expectHasKeys(response.usage, ['total_tokens'], 'Usage object');
        expectNumberRange(response.usage.total_tokens, 1, 100000, 'Total tokens');
    }
}

/**
 * Assert logs response shape
 */
export function expectLogsResponse(response: any) {
    expectHasKeys(response, ['source', 'count', 'logs'], 'Logs response');
    expectNonEmptyString(response.source, 'Logs source');
    expectNumberRange(response.count, 0, 100000, 'Logs count');
    expectMinArrayLength(response.logs, 0, 'Logs array');

    // Check individual log entries if present
    if (response.logs.length > 0) {
        const firstLog = response.logs[0];
        expectHasKeys(firstLog, ['timestamp', 'message'], 'Log entry');
    }
}

/**
 * Assert health response shape
 */
export function expectHealthResponse(response: any) {
    expectHasKeys(response, ['status'], 'Health response');
    expect(['ok', 'healthy', 'up']).toContain(response.status.toLowerCase());

    if (response.uptime) {
        expectNumberRange(response.uptime, 0, Number.MAX_SAFE_INTEGER, 'Uptime');
    }

    if (response.version) {
        expectNonEmptyString(response.version, 'Version');
    }
}