export type MikroTikRoleTemplate = 'edge-internet' | 'distribution' | 'campus-core';
export type MikroTikEnvironment = 'dev' | 'staging' | 'prod';
export type MikroTikSecurityPreset = 'hospital-secure' | 'balanced' | 'open-lab';

export type MikroTikIntentInterface = {
    name: string;
    purpose: 'wan' | 'trunk' | 'access' | 'mgmt';
    comment?: string;
    accessVlanId?: number;
    trunkVlanIds?: number[];
};

export type MikroTikIntentVlan = {
    id: number;
    name: string;
    subnet: string;
    gateway?: string;
    group?: 'MGMT' | 'USER' | 'VOICE' | 'SERVER';
    dhcpEnabled?: boolean;
};

export type MikroTikIntentStaticRoute = {
    dst: string;
    gateway: string;
    distance?: number;
    comment?: string;
};

export type MikroTikFullConfigIntent = {
    device: {
        model: string;
        routerOsMajor: 6 | 7;
        routerOsVersion: string;
    };
    role: MikroTikRoleTemplate;
    hostname: string;
    environment: MikroTikEnvironment;
    labMode: boolean;
    interfaces: MikroTikIntentInterface[];
    vlans?: MikroTikIntentVlan[];
    routing?: {
        staticRoutes?: MikroTikIntentStaticRoute[];
        ospf?: {
            enabled: boolean;
            routerId?: string;
            area?: string;
            networks?: string[];
            passiveInterfaces?: string[];
        };
    };
    securityProfile: {
        preset: MikroTikSecurityPreset;
    };
    management: {
        mgmtSubnet: string;
        allowedSubnets?: string[];
        ssh: {
            port: number;
            allowPassword: boolean;
            authorizedKeys?: string[];
        };
        winbox: {
            enabled: boolean;
            port: number;
        };
        dnsAllowRemoteRequests: boolean;
        timezone?: string;
        ntpServers?: string[];
        syslog?: {
            remote: string;
        };
        snmp?: {
            enabled: boolean;
            community?: string;
            allowedSubnet?: string;
        };
    };
    internet?: {
        wanInterface: string;
        publicType: 'dhcp' | 'static' | 'pppoe';
        address?: string;
        gateway?: string;
        username?: string;
        password?: string;
        dnsServers?: string[];
    };
    notes?: string;
};

export type MikroTikFullConfigOutput = {
    config: string;
    rollback: string;
    validation: {
        errors: string[];
        warnings: string[];
    };
    risk: {
        level: 'low' | 'medium' | 'high';
        score: number;
    };
};

export type MikroTikDiffOutput = {
    lines: Array<{ type: 'add' | 'remove' | 'same'; text: string }>;
    summary: {
        added: number;
        removed: number;
    };
};

function buildValidation(intent: MikroTikFullConfigIntent): MikroTikFullConfigOutput['validation'] {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!intent.hostname.trim()) errors.push('Hostname is required.');
    if (!intent.management.mgmtSubnet.trim()) errors.push('Management subnet is required.');
    if (intent.interfaces.length === 0) errors.push('At least one interface is required.');

    if (intent.environment === 'prod' && intent.management.ssh.allowPassword) {
        warnings.push('SSH password auth should be disabled in production.');
    }
    if (!intent.management.ntpServers || intent.management.ntpServers.length === 0) {
        warnings.push('No NTP servers configured.');
    }

    return { errors, warnings };
}

function buildRisk(intent: MikroTikFullConfigIntent): MikroTikFullConfigOutput['risk'] {
    let score = 10;
    if (intent.environment === 'prod') score += 40;
    if (intent.management.ssh.allowPassword) score += 20;
    if (intent.labMode) score -= 10;
    const level: 'low' | 'medium' | 'high' = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
    return { level, score };
}

function asConfigLines(intent: MikroTikFullConfigIntent): string[] {
    const lines: string[] = [];
    lines.push(`/system identity set name=${intent.hostname}`);
    lines.push(`/ip service set ssh port=${intent.management.ssh.port} disabled=no`);
    if (!intent.management.ssh.allowPassword) {
        lines.push('/user settings set minimum-password-length=12');
    }

    for (const iface of intent.interfaces) {
        lines.push(`/interface ethernet set [find default-name=${iface.name}] comment="${iface.comment || iface.purpose}"`);
    }

    for (const vlan of intent.vlans || []) {
        lines.push(`/interface vlan add interface=bridge name=vlan${vlan.id}-${vlan.name} vlan-id=${vlan.id}`);
    }

    for (const route of intent.routing?.staticRoutes || []) {
        lines.push(`/ip route add dst-address=${route.dst} gateway=${route.gateway}${route.distance ? ` distance=${route.distance}` : ''}`);
    }

    if (intent.routing?.ospf?.enabled) {
        lines.push('/routing ospf instance set [find default=yes] disabled=no');
        for (const network of intent.routing.ospf.networks || []) {
            lines.push(`/routing ospf network add area=${intent.routing.ospf.area || '0.0.0.0'} network=${network}`);
        }
    }

    return lines;
}

export async function generateMikrotikFullConfig(intent: MikroTikFullConfigIntent): Promise<MikroTikFullConfigOutput> {
    const validation = buildValidation(intent);
    const risk = buildRisk(intent);

    const configLines = asConfigLines(intent);
    const rollbackLines = [
        '# rollback script',
        '/system backup load name=last-good',
        '/import file-name=rollback.rsc'
    ];

    return {
        config: configLines.join('\n'),
        rollback: rollbackLines.join('\n'),
        validation,
        risk
    };
}

export async function diffMikrotikRunningConfig(input: {
    runningConfig: string;
    desiredConfig: string;
}): Promise<MikroTikDiffOutput> {
    const current = input.runningConfig.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const desired = input.desiredConfig.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    const currentSet = new Set(current);
    const desiredSet = new Set(desired);

    const lines: MikroTikDiffOutput['lines'] = [];
    let added = 0;
    let removed = 0;

    for (const line of current) {
        if (desiredSet.has(line)) {
            lines.push({ type: 'same', text: line });
        } else {
            lines.push({ type: 'remove', text: line });
            removed += 1;
        }
    }

    for (const line of desired) {
        if (!currentSet.has(line)) {
            lines.push({ type: 'add', text: line });
            added += 1;
        }
    }

    return {
        lines,
        summary: { added, removed }
    };
}

export async function pushMikrotikConfigSsh(input: {
    host: string;
    user: string;
    password?: string;
    privateKey?: string;
    config: string;
    dryRun?: boolean;
}): Promise<{ success: boolean; message: string; log: string[] }> {
    const commands = input.config.split(/\r?\n/).filter(Boolean);
    const dryRun = Boolean(input.dryRun);

    return {
        success: true,
        message: dryRun ? 'Dry run completed.' : 'Config push simulated successfully.',
        log: [
            `Host: ${input.host}`,
            `User: ${input.user}`,
            `Mode: ${dryRun ? 'dry-run' : 'apply'}`,
            `Commands: ${commands.length}`
        ]
    };
}
