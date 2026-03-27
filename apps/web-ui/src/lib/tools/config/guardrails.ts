import type { Vendor } from '$lib/tools/config/types';

export function evaluateGuardrails(
    commands: string[],
    _vendor: Vendor,
    environment: 'dev' | 'staging' | 'prod',
    role: string
): { blocked: boolean; issues: string[] } {
    const issues: string[] = [];
    const isPrivileged = role === 'admin' || role === 'super_admin';
    const dangerous = ['reload', 'erase', 'format', 'reset-configuration', 'write erase'];

    for (const command of commands) {
        if (dangerous.some((item) => command.toLowerCase().includes(item))) {
            issues.push(`Dangerous command detected: ${command}`);
        }
    }

    if (environment === 'prod' && issues.length > 0 && !isPrivileged) {
        return { blocked: true, issues };
    }

    return { blocked: false, issues };
}
