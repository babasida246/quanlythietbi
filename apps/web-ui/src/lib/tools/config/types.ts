export type Vendor = 'cisco' | 'mikrotik' | 'fortigate';

export interface InterfaceConfig {
    id: string;
    name: string;
    role: 'access' | 'trunk' | 'uplink' | 'mgmt';
    ipAddress: string;
    subnetMask: string;
    vlanId?: number;
    description?: string;
    enabled: boolean;
}

export interface VlanConfig {
    id: number;
    name: string;
    subnet: string;
    gateway?: string;
}

export interface StaticRoute {
    destination: string;
    netmask: string;
    nextHop: string;
}

export interface OspfArea {
    id: string;
    area: string;
    networks: string[];
}

export interface BgpNeighbor {
    id: string;
    neighbor: string;
    remoteAs: number;
    description?: string;
}

export interface BgpNetwork {
    id: string;
    network: string;
}

export interface FirewallRule {
    id: string;
    chain: string;
    src?: string;
    dst?: string;
    protocol?: string;
    srcPort?: string;
    dstPort?: string;
    action: string;
    comment?: string;
}

export interface NatRule {
    id: string;
    type: string;
    src?: string;
    dst?: string;
    protocol?: string;
    srcPort?: string;
    dstPort?: string;
    toAddress?: string;
    toPort?: string;
    outInterface?: string;
    comment?: string;
}

export interface IpsecTunnel {
    id: string;
    name: string;
    localAddress: string;
    remoteAddress: string;
    localSubnet: string;
    remoteSubnet: string;
    preSharedKey: string;
    ikeVersion: 'v1' | 'v2';
}

export interface L2tpServer {
    id: string;
    name: string;
    localAddress: string;
    pool: string;
    preSharedKey: string;
}

export interface QosQueue {
    id: string;
    name: string;
    target: string;
    maxLimit: string;
    priority: number;
    comment?: string;
}

export interface SnmpV3User {
    id: string;
    username: string;
    authProtocol: 'sha' | 'md5';
    authPassword: string;
    privProtocol: 'aes' | 'des';
    privPassword: string;
}

export interface LintFinding {
    level: 'error' | 'warning' | 'info';
    message: string;
}

export interface RenderResult {
    commands: string[];
    verifyCommands: string[];
    rollbackCommands: string[];
    lintFindings: LintFinding[];
}

export interface CanonicalConfig {
    hostname: string;
    vlans: VlanConfig[];
    interfaces: InterfaceConfig[];
    routing: {
        staticRoutes: StaticRoute[];
        ospf: {
            enabled: boolean;
            areas: OspfArea[];
        };
        bgp: {
            enabled: boolean;
            asn: number;
            neighbors: BgpNeighbor[];
            networks: BgpNetwork[];
        };
        rip: {
            enabled: boolean;
            networks: string[];
        };
    };
    firewall: {
        enabled: boolean;
        allowMgmtFrom: string;
        rules: FirewallRule[];
    };
    nat: {
        rules: NatRule[];
    };
    vpn: {
        ipsecTunnels: IpsecTunnel[];
        wireguardTunnels: Array<Record<string, unknown>>;
        l2tpServers: L2tpServer[];
    };
    qos: {
        queues: QosQueue[];
    };
    services: {
        ssh: {
            enabled: boolean;
            version: 1 | 2;
            allowPassword: boolean;
        };
        ntpServers: string[];
        dnsServers: string[];
        syslogServers: string[];
        snmpCommunity: string;
        snmpV3Users: SnmpV3User[];
        netflow: {
            enabled: boolean;
            collector: string;
            port: number;
        };
        sflow: {
            enabled: boolean;
            collector: string;
            port: number;
        };
    };
    metadata: {
        deviceId?: string;
        environment: 'dev' | 'staging' | 'prod';
    };
}
