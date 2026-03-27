import { API_BASE, apiJsonData } from '$lib/api/httpClient';
import type { Device, DeviceListFilter } from '$lib/netops/types';

const STORAGE_KEY = 'netops.devices.v1';

const DEFAULT_DEVICES: Device[] = [
    {
        id: 'dev-core-01',
        name: 'CORE-SW-01',
        vendor: 'cisco',
        mgmt_ip: '10.10.0.11',
        model: 'Catalyst 9300',
        os_version: '17.9.4',
        role: 'core-switch',
        environment: 'prod',
        status: 'online'
    },
    {
        id: 'dev-edge-01',
        name: 'EDGE-RTR-01',
        vendor: 'mikrotik',
        mgmt_ip: '10.10.1.1',
        model: 'CCR2004',
        os_version: '7.15',
        role: 'edge-router',
        environment: 'staging',
        status: 'online'
    },
    {
        id: 'dev-access-01',
        name: 'ACCESS-SW-01',
        vendor: 'cisco',
        mgmt_ip: '10.10.2.21',
        model: 'Catalyst 2960X',
        os_version: '15.2',
        role: 'access-switch',
        environment: 'dev',
        status: 'unknown'
    }
];

function getStoredDevices(): Device[] {
    if (typeof window === 'undefined') return DEFAULT_DEVICES;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DEVICES));
        return DEFAULT_DEVICES;
    }
    try {
        const parsed = JSON.parse(raw) as Device[];
        return parsed.length ? parsed : DEFAULT_DEVICES;
    } catch {
        return DEFAULT_DEVICES;
    }
}

function filterDevices(devices: Device[], filter?: DeviceListFilter): Device[] {
    if (!filter?.vendor) return devices;
    return devices.filter((item) => item.vendor === filter.vendor);
}

async function fetchDevicesFromApi(filter?: DeviceListFilter): Promise<Device[]> {
    const query = filter?.vendor ? `?vendor=${encodeURIComponent(filter.vendor)}` : '';
    type ApiDevice = {
        id: string;
        name?: string;
        assetName?: string;
        hostname?: string;
        vendor?: string;
        managementIp?: string;
        mgmt_ip?: string;
        model?: string;
        osVersion?: string;
        os_version?: string;
        role?: string;
        lastConfigSnapshot?: string;
        last_config_snapshot?: string;
    };

    const payload = await apiJsonData<ApiDevice[]>(`${API_BASE}/v1/netops/devices${query}`);
    return payload.map((item) => ({
        id: item.id,
        name: item.name || item.hostname || item.assetName || item.id,
        vendor: ((item.vendor || 'cisco').toLowerCase() as Device['vendor']) || 'cisco',
        mgmt_ip: item.mgmt_ip || item.managementIp || '127.0.0.1',
        model: item.model,
        os_version: item.os_version || item.osVersion,
        role: item.role,
        last_config_snapshot: item.last_config_snapshot || item.lastConfigSnapshot,
        status: 'unknown'
    }));
}

export const devicesApi = {
    async list(filter?: DeviceListFilter): Promise<Device[]> {
        try {
            const apiDevices = await fetchDevicesFromApi(filter);
            if (apiDevices.length) return apiDevices;
        } catch {
            // Fall back to local cache when netops API is unavailable.
        }
        return filterDevices(getStoredDevices(), filter);
    }
};
