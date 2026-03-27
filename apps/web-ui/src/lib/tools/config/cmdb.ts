import type { CanonicalConfig, Vendor } from '$lib/tools/config/types';

const KEY = 'netops.cmdb.sync.v1';

export async function syncConfigToCmdb(input: {
    deviceId: string;
    vendor: Vendor;
    config: CanonicalConfig;
    commands: string[];
    configHash: string;
}): Promise<{ success: boolean; message: string }> {
    if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(KEY);
        const entries = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
        entries.unshift({
            at: new Date().toISOString(),
            deviceId: input.deviceId,
            vendor: input.vendor,
            configHash: input.configHash,
            commandCount: input.commands.length
        });
        localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 200)));
    }

    return {
        success: true,
        message: 'CMDB synced.'
    };
}
