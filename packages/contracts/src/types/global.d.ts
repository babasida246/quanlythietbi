declare module 'crypto' {
    export function randomUUID(): string;
}

declare global {
    interface File { }
    interface Buffer { }
}