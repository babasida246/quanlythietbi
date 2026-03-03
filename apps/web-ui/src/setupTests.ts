import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Ensure DOM is available
if (typeof window === 'undefined') {
    const { Window } = await import('happy-dom');
    const window = new Window();
    (globalThis as any).window = window;
    (globalThis as any).document = window.document as unknown as Document;
}

// Mock authentication tokens for tests
const mockTokenStorage = {
    'authToken': 'mock-access-token',
    'refreshToken': 'mock-refresh-token',
    'userEmail': 'test@example.com',
    'userRole': 'admin',
    'userName': 'Test User'
};

// Mock localStorage more thoroughly
const localStorageMock = {
    getItem: vi.fn((key: string) => mockTokenStorage[key as keyof typeof mockTokenStorage] || null),
    setItem: vi.fn((key: string, value: string) => {
        mockTokenStorage[key as keyof typeof mockTokenStorage] = value;
    }),
    removeItem: vi.fn((key: string) => {
        delete mockTokenStorage[key as keyof typeof mockTokenStorage];
    }),
    clear: vi.fn(() => {
        Object.keys(mockTokenStorage).forEach(key => {
            delete mockTokenStorage[key as keyof typeof mockTokenStorage];
        });
    }),
    key: vi.fn(),
    length: 0
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
    writable: true
});

// Mock fetch globally
global.fetch = vi.fn(async () => new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
})) as any;

// Set environment
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// Mock console.warn to suppress Svelte warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
    // Suppress common Svelte warnings during tests
    if (typeof args[0] === 'string' &&
        (args[0].includes('was created with unknown prop') ||
            args[0].includes('Unexpected slot'))) {
        return;
    }
    originalWarn.apply(console, args);
};
