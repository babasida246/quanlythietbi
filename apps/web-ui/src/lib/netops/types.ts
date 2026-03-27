export type NetopsVendor = 'cisco' | 'mikrotik' | 'fortigate' | 'juniper' | 'arista';

export interface Device {
    id: string;
    name: string;
    vendor: NetopsVendor;
    mgmt_ip: string;
    model?: string;
    os_version?: string;
    role?: string;
    site?: string;
    status?: 'online' | 'offline' | 'unknown';
    environment?: 'dev' | 'staging' | 'prod';
    last_config_snapshot?: string;
    metadata?: Record<string, unknown>;
}

export interface DeviceListFilter {
    vendor?: NetopsVendor | string;
}
