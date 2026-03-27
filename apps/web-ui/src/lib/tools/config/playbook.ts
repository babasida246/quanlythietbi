import type { RenderResult, Vendor } from '$lib/tools/config/types';

export type PlaybookType = 'bootstrap' | 'change' | 'rollback';

export function buildPlaybook(result: RenderResult, vendor: Vendor, type: PlaybookType): Array<{ title: string; commands: string[] }> {
    if (type === 'rollback') {
        return [{ title: 'Rollback', commands: result.rollbackCommands }];
    }
    if (type === 'change') {
        return [
            { title: 'Apply', commands: result.commands },
            { title: 'Verify', commands: result.verifyCommands }
        ];
    }

    const intro = vendor === 'mikrotik' ? ['# MikroTik bootstrap flow'] : ['# Cisco bootstrap flow'];
    return [
        { title: 'Bootstrap', commands: [...intro, ...result.commands] },
        { title: 'Verification', commands: result.verifyCommands }
    ];
}
