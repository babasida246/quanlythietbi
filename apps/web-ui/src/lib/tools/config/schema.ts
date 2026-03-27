import type { CanonicalConfig } from '$lib/tools/config/types';

export function defaultCanonicalConfig(): CanonicalConfig {
    return {
        hostname: '',
        vlans: [],
        interfaces: [],
        routing: {
            staticRoutes: [],
            ospf: {
                enabled: false,
                areas: []
            },
            bgp: {
                enabled: false,
                asn: 65000,
                neighbors: [],
                networks: []
            },
            rip: {
                enabled: false,
                networks: []
            }
        },
        firewall: {
            enabled: true,
            allowMgmtFrom: '',
            rules: []
        },
        nat: {
            rules: []
        },
        vpn: {
            ipsecTunnels: [],
            wireguardTunnels: [],
            l2tpServers: []
        },
        qos: {
            queues: []
        },
        services: {
            ssh: {
                enabled: true,
                version: 2,
                allowPassword: false
            },
            ntpServers: [],
            dnsServers: [],
            syslogServers: [],
            snmpCommunity: '',
            snmpV3Users: [],
            netflow: {
                enabled: false,
                collector: '',
                port: 2055
            },
            sflow: {
                enabled: false,
                collector: '',
                port: 6343
            }
        },
        metadata: {
            environment: 'dev'
        }
    };
}
