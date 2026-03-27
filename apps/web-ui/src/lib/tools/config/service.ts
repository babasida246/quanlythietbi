import type { CanonicalConfig, LintFinding, RenderResult, Vendor } from '$lib/tools/config/types';

function vendorPrefix(vendor: Vendor): string {
    return vendor === 'mikrotik' ? '/system' : 'configure terminal';
}

function buildCommands(config: CanonicalConfig, vendor: Vendor): string[] {
    const commands: string[] = [];
    commands.push(vendorPrefix(vendor));
    if (config.hostname.trim()) {
        commands.push(vendor === 'mikrotik' ? `/system identity set name=${config.hostname}` : `hostname ${config.hostname}`);
    }

    for (const vlan of config.vlans) {
        commands.push(vendor === 'mikrotik' ? `/interface vlan add name=${vlan.name} vlan-id=${vlan.id}` : `vlan ${vlan.id}`);
    }

    for (const route of config.routing.staticRoutes) {
        commands.push(vendor === 'mikrotik'
            ? `/ip route add dst-address=${route.destination}/${route.netmask} gateway=${route.nextHop}`
            : `ip route ${route.destination} ${route.netmask} ${route.nextHop}`);
    }

    return commands;
}

export async function lintConfig(config: CanonicalConfig, _vendor: Vendor): Promise<LintFinding[]> {
    const findings: LintFinding[] = [];
    if (!config.hostname.trim()) {
        findings.push({ level: 'error', message: 'Hostname is required.' });
    }
    if (config.services.ssh.allowPassword) {
        findings.push({ level: 'warning', message: 'SSH password authentication is enabled.' });
    }
    if (!config.services.ntpServers.length) {
        findings.push({ level: 'info', message: 'No NTP server configured.' });
    }
    return findings;
}

export async function generateConfigPipeline(config: CanonicalConfig, vendor: Vendor): Promise<RenderResult> {
    const commands = buildCommands(config, vendor);
    const lintFindings = await lintConfig(config, vendor);

    return {
        commands,
        verifyCommands: vendor === 'mikrotik' ? ['/interface print terse', '/ip route print'] : ['show ip interface brief', 'show ip route'],
        rollbackCommands: vendor === 'mikrotik' ? ['/system backup load name=last-good'] : ['configure replace nvram:startup-config force'],
        lintFindings
    };
}

export async function pushConfig(input: {
    deviceId: string;
    sessionId?: string;
    vendor: Vendor;
    config: CanonicalConfig;
    commands: string[];
    verifyCommands: string[];
    rollbackCommands: string[];
}): Promise<{ status: 'success' | 'failed'; details: string[] }> {
    const blocked = input.commands.some((command) => /format|erase|reload/i.test(command));
    if (blocked) {
        return {
            status: 'failed',
            details: ['Blocked dangerous command in batch.']
        };
    }
    return {
        status: 'success',
        details: [
            `Applied ${input.commands.length} commands on ${input.deviceId}.`,
            `Verification batch: ${input.verifyCommands.length} commands.`
        ]
    };
}
