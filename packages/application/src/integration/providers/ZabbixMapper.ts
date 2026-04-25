/**
 * Maps Zabbix API host objects to QLTB asset inputs.
 *
 * asset_code convention: "ZBX-{hostid}" — stable, unique, never reused by Zabbix.
 * Technical fields owned by Zabbix: serial_no, mac_address, mgmt_ip, hostname.
 * Financial/location fields are set only on first creation; updates leave them untouched.
 */

export interface ZabbixInterface {
    interfaceid: string
    type: string      // '1'=agent, '2'=SNMP, '3'=IPMI, '4'=JMX
    ip: string
    dns: string
    port: string
    main: string      // '1' = primary
}

export interface ZabbixInventory {
    serialno_a?: string
    serialno_b?: string
    macaddress_a?: string
    macaddress_b?: string
    model?: string
    os?: string
    os_full?: string
    type?: string
    vendor?: string
    tag?: string
    asset_tag?: string
}

export interface ZabbixHost {
    hostid: string
    host: string          // technical hostname
    name: string          // visible name
    available: string     // '0'=unknown, '1'=available, '2'=unavailable
    status: string        // '0'=monitored, '1'=unmonitored
    interfaces: ZabbixInterface[]
    inventory: ZabbixInventory | null
}

export interface ZabbixAssetInput {
    assetCode: string
    modelId: string
    serialNo: string | null
    macAddress: string | null
    mgmtIp: string | null
    hostname: string | null
    notes: string | null
    /** 'in_stock' always for Zabbix-discovered assets (no warehouse context) */
    status: 'in_stock'
}

export interface ZabbixHostStatus {
    assetCode: string
    hostname: string
    /** Zabbix available: '1'=up, '2'=down, '0'=unknown */
    available: '0' | '1' | '2'
}

function pickPrimaryIp(interfaces: ZabbixInterface[]): string | null {
    const primary = interfaces.find(i => i.main === '1' && i.ip && i.ip !== '0.0.0.0')
    if (primary) return primary.ip
    const any = interfaces.find(i => i.ip && i.ip !== '0.0.0.0')
    return any?.ip ?? null
}

function pickMac(inventory: ZabbixInventory | null): string | null {
    const raw = inventory?.macaddress_a ?? inventory?.macaddress_b ?? null
    if (!raw || raw.trim() === '') return null
    return raw.trim().toLowerCase()
}

function pickSerial(inventory: ZabbixInventory | null): string | null {
    const raw = inventory?.serialno_a ?? inventory?.serialno_b ?? null
    if (!raw || raw.trim() === '') return null
    return raw.trim()
}

export function mapHostToAssetInput(host: ZabbixHost, defaultModelId: string): ZabbixAssetInput {
    const ip = pickPrimaryIp(host.interfaces)
    const inv = host.inventory ?? null

    return {
        assetCode: `ZBX-${host.hostid}`,
        modelId: defaultModelId,
        serialNo: pickSerial(inv),
        macAddress: pickMac(inv),
        mgmtIp: ip,
        hostname: host.host || host.name || null,
        notes: `Zabbix sync — visible name: ${host.name}`,
        status: 'in_stock',
    }
}

export function mapHostToStatus(host: ZabbixHost): ZabbixHostStatus {
    return {
        assetCode: `ZBX-${host.hostid}`,
        hostname: host.host || host.name,
        available: host.available as '0' | '1' | '2',
    }
}
