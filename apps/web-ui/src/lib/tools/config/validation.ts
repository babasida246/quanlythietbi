import type { CanonicalConfig } from '$lib/tools/config/types';

export interface ValidationFinding {
    field: string;
    severity: 'error' | 'warning';
    message: string;
}

export function validateConfig(config: CanonicalConfig): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!config.hostname.trim()) {
        findings.push({ field: 'hostname', severity: 'error', message: 'Hostname is required.' });
    }

    if (!config.metadata.deviceId) {
        findings.push({ field: 'metadata.deviceId', severity: 'warning', message: 'No target device selected.' });
    }

    if (config.services.ssh.allowPassword) {
        findings.push({ field: 'services.ssh.allowPassword', severity: 'warning', message: 'Password login should be disabled for production.' });
    }

    if (!config.services.ntpServers.length) {
        findings.push({ field: 'services.ntpServers', severity: 'warning', message: 'NTP server is not configured.' });
    }

    return findings;
}
