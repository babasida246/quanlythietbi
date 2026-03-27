import type { CanonicalConfig, Vendor } from '$lib/tools/config/types';

const PROFILES_KEY = 'netops.cli.profiles.v1';
const ACTIVE_KEY = 'netops.cli.profile.active';

export interface CliProfile {
    id: string;
    name: string;
    vendor: Vendor;
    environment: 'dev' | 'staging' | 'prod';
    config: CanonicalConfig;
    createdAt: string;
}

function uid(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadProfiles(): CliProfile[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as CliProfile[];
    } catch {
        return [];
    }
}

export function saveProfiles(profiles: CliProfile[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(ACTIVE_KEY) || '';
}

export function setActiveProfileId(profileId: string): void {
    if (typeof localStorage === 'undefined') return;
    if (!profileId) {
        localStorage.removeItem(ACTIVE_KEY);
        return;
    }
    localStorage.setItem(ACTIVE_KEY, profileId);
}

export function buildProfileFromConfig(
    config: CanonicalConfig,
    vendor: Vendor,
    environment: 'dev' | 'staging' | 'prod',
    profileName: string,
    includeHostname = false
): CliProfile {
    const profileConfig: CanonicalConfig = JSON.parse(JSON.stringify(config));
    if (!includeHostname) {
        profileConfig.hostname = '';
    }

    return {
        id: uid(),
        name: profileName,
        vendor,
        environment,
        config: profileConfig,
        createdAt: new Date().toISOString()
    };
}

export function applyProfileToConfig(current: CanonicalConfig, profile: CliProfile): CanonicalConfig {
    return {
        ...current,
        ...JSON.parse(JSON.stringify(profile.config)),
        metadata: {
            ...current.metadata,
            ...profile.config.metadata,
            environment: profile.environment
        }
    };
}
