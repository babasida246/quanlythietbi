import type { CanonicalConfig } from '$lib/tools/config/types';

export function evaluateRisk(config: CanonicalConfig, environment: 'dev' | 'staging' | 'prod'): {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;
    reasons: string[];
} {
    const reasons: string[] = [];
    let score = 0;

    if (environment === 'prod') {
        score += 40;
        reasons.push('Production environment.');
    }
    if (config.firewall.allowMgmtFrom === '0.0.0.0/0' || config.firewall.allowMgmtFrom === '::/0') {
        score += 30;
        reasons.push('Management access is globally open.');
    }
    if (config.services.ssh.allowPassword) {
        score += 20;
        reasons.push('SSH password login is enabled.');
    }
    if (!config.services.ntpServers.length) {
        score += 10;
        reasons.push('No NTP servers configured.');
    }

    const level: 'LOW' | 'MEDIUM' | 'HIGH' = score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
    return { level, score, reasons };
}
