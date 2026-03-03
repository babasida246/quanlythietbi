<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import {
    Link2,
    Network,
    Play,
    RefreshCw,
    Terminal,
    ShieldAlert,
    Settings,
    ShieldCheck
  } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { devicesApi } from '$lib/netops/api/netopsApi';
  import type { Device } from '$lib/netops/types';
  import FieldKitPanel from '$lib/components/tools/FieldKitPanel.svelte';
  import MikroTikFullConfigPanel from '$lib/components/tools/MikroTikFullConfigPanel.svelte';
  import PageHeader from '$lib/components/tools/PageHeader.svelte';
  import ConfigStep from '$lib/components/tools/ConfigStep.svelte';
  import SummaryPanel from '$lib/components/tools/SummaryPanel.svelte';
  import CodePreview from '$lib/components/tools/CodePreview.svelte';
  import WarningBadge from '$lib/components/tools/WarningBadge.svelte';
  import EmptyState from '$lib/components/tools/EmptyState.svelte';
  import { defaultCanonicalConfig } from '$lib/tools/config/schema';
  import { diffCommandsDetailed, type DiffLine } from '$lib/tools/config/diff';
  import { evaluateRisk } from '$lib/tools/config/risk';
  import { buildPlaybook, type PlaybookType } from '$lib/tools/config/playbook';
  import { evaluateGuardrails } from '$lib/tools/config/guardrails';
  import { validateConfig, type ValidationFinding } from '$lib/tools/config/validation';
  import { createApprovalRequest, decideApproval, loadApprovals, hashConfig, type ApprovalRecord } from '$lib/tools/config/approval';
  import { syncConfigToCmdb } from '$lib/tools/config/cmdb';
  import { buildProfileFromConfig, applyProfileToConfig, loadProfiles, saveProfiles, getActiveProfileId, setActiveProfileId, type CliProfile } from '$lib/tools/config/profiles';
  import { generateConfigPipeline, lintConfig, pushConfig } from '$lib/tools/config/service';
  import type {
    CanonicalConfig,
    FirewallRule,
    IpsecTunnel,
    L2tpServer,
    LintFinding,
    NatRule,
    QosQueue,
    RenderResult,
    SnmpV3User,
    Vendor
  } from '$lib/tools/config/types';
  import type { SshCommandPolicy, SshLogEvent, SshSession } from '$lib/tools/ssh/types';
  import {
    listSessions,
    openSession,
    sendCommand,
    closeSession,
    getSessionLog,
    exportSessionText,
    purgeIdleSessions
  } from '$lib/tools/ssh/service';

  type ToolSection = 'config-generator' | 'mikrotik-full-config' | 'ssh-terminal' | 'mermaid' | 'field-kit';
  type ConfigTab = 'generate' | 'lint' | 'validate' | 'diff' | 'dry-run' | 'push';

  type WireguardDraft = {
    id: string;
    name: string;
    interfaceAddress: string;
    listenPort: number;
    privateKey: string;
    peerPublicKey: string;
    peerAllowedIps: string;
    peerEndpoint: string;
  };

  let activeSection = $state<ToolSection>('config-generator');
  let activeTab = $state<ConfigTab>('generate');

  const sections: Array<{ id: ToolSection; labelKey: string }> = [
    { id: 'config-generator', labelKey: 'tools.configGenerator' },
    { id: 'mikrotik-full-config', labelKey: 'tools.mikrotikFullConfig' },
    { id: 'ssh-terminal', labelKey: 'tools.sshTerminal' },
    { id: 'mermaid', labelKey: 'tools.mermaid' },
    { id: 'field-kit', labelKey: 'tools.fieldKit' }
  ];

  const tabs: Array<{ id: ConfigTab; labelKey: string }> = [
    { id: 'generate', labelKey: 'netops.generator.tabs.preview' },
    { id: 'lint', labelKey: 'netops.generator.tabs.lint' },
    { id: 'validate', labelKey: 'netops.generator.tabs.validate' },
    { id: 'diff', labelKey: 'netops.generator.tabs.diff' },
    { id: 'dry-run', labelKey: 'netops.generator.tabs.dryRun' },
    { id: 'push', labelKey: 'netops.generator.tabs.push' }
  ];

  let devices = $state<Device[]>([]);
  let deviceLoading = $state(false);
  let deviceError = $state('');
  let selectedDeviceId = $state('');

  const selectedDevice = $derived.by(() => devices.find((device) => device.id === selectedDeviceId) || null);
  const activeProfile = $derived.by(() => profiles.find((profile) => profile.id === activeProfileId) || null);

  let vendor = $state<Vendor>('mikrotik');
  let config = $state<CanonicalConfig>(defaultCanonicalConfig());
  let generateResult = $state<RenderResult | null>(null);
  let lintFindings = $state<LintFinding[]>([]);
  let diffLines = $state<DiffLine[]>([]);
  let lastCommands = $state<string[]>([]);
  let pipelineStatus = $state('');
  let pushStatus = $state('');
  let showPreview = $state(false);
  let playbookMode = $state(false);
  let playbookType = $state<PlaybookType>('bootstrap');
  let validationFindings = $state<ValidationFinding[]>([]);
  let guardrailOverride = $state(false);
  let guardrailReason = $state('');
  let showGuardrailModal = $state(false);
  let profiles = $state<CliProfile[]>([]);
  let activeProfileId = $state('');
  let showProfileModal = $state(false);
  let profileName = $state('');
  let includeHostnameInProfile = $state(false);

  let baseOpen = $state(false);
  let servicesOpen = $state(false);
  let networkOpen = $state(false);
  let routingOpen = $state(false);
  let securityOpen = $state(false);
  let vpnOpen = $state(false);
  let qosOpen = $state(false);
  let monitoringOpen = $state(false);

  let routingTab = $state<'static' | 'ospf' | 'bgp' | 'rip'>('static');
  let securityTab = $state<'firewall' | 'nat'>('firewall');
  let vpnTab = $state<'ipsec' | 'wireguard' | 'l2tp'>('ipsec');

  let showVlanModal = $state(false);
  let showInterfaceModal = $state(false);
  let showRouteModal = $state(false);
  let showOspfModal = $state(false);
  let showBgpNeighborModal = $state(false);
  let showBgpNetworkModal = $state(false);
  let showFirewallModal = $state(false);
  let showNatModal = $state(false);
  let showIpsecModal = $state(false);
  let showWireguardModal = $state(false);
  let showL2tpModal = $state(false);
  let showQosModal = $state(false);
  let showSnmpUserModal = $state(false);

  let vlanDraft = $state({ id: 1, name: '', subnet: '', gateway: '' });
  let interfaceDraft = $state({
    id: 'if-new',
    name: '',
    role: 'access' as const,
    ipAddress: '',
    subnetMask: '',
    vlanId: undefined as number | undefined,
    description: '',
    enabled: true
  });
  let routeDraft = $state({ destination: '', netmask: '', nextHop: '' });
  let ospfAreaDraft = $state({ id: '', area: '', networks: '' });
  let bgpNeighborDraft = $state({ id: '', neighbor: '', remoteAs: 65000, description: '' });
  let bgpNetworkDraft = $state({ id: '', network: '' });
  let firewallRuleDraft = $state<FirewallRule>({
    id: '',
    chain: 'input',
    src: '',
    dst: '',
    protocol: 'tcp',
    srcPort: '',
    dstPort: '',
    action: 'accept',
    comment: ''
  });
  let natRuleDraft = $state<NatRule>({
    id: '',
    type: 'snat',
    src: '',
    dst: '',
    protocol: 'tcp',
    srcPort: '',
    dstPort: '',
    toAddress: '',
    toPort: '',
    outInterface: '',
    comment: ''
  });
  let ipsecDraft = $state<IpsecTunnel>({
    id: '',
    name: '',
    localAddress: '',
    remoteAddress: '',
    localSubnet: '',
    remoteSubnet: '',
    preSharedKey: '',
    ikeVersion: 'v2'
  });
  let wireguardDraft = $state<WireguardDraft>({
    id: '',
    name: '',
    interfaceAddress: '',
    listenPort: 51820,
    privateKey: '',
    peerPublicKey: '',
    peerAllowedIps: '',
    peerEndpoint: ''
  });
  let l2tpDraft = $state<L2tpServer>({
    id: '',
    name: '',
    localAddress: '',
    pool: '',
    preSharedKey: ''
  });
  let qosDraft = $state<QosQueue>({
    id: '',
    name: '',
    target: '',
    maxLimit: '',
    priority: 8,
    comment: ''
  });
  let snmpUserDraft = $state<SnmpV3User>({
    id: '',
    username: '',
    authProtocol: 'sha',
    authPassword: '',
    privProtocol: 'aes',
    privPassword: ''
  });

  let sshSessions = $state<SshSession[]>([]);
  let activeSessionId = $state<string>('');
  let sshLog = $state<SshLogEvent[]>([]);
  let sshCommand = $state('');
  let sshError = $state('');
  let sshBusy = $state(false);
  let sshSearch = $state('');
  let currentRole = $state('');
  let currentUserEmail = $state('');
  let approvals = $state<ApprovalRecord[]>([]);
  let approvalReason = $state('');

  const commandHistory = $derived.by(() =>
    sshLog.filter((line) => line.type === 'input').slice(-12).reverse()
  );

  let sshPolicy = $state<SshCommandPolicy>({
    environment: 'dev',
    allowList: [],
    denyList: ['reload', 'format', 'erase', 'reset-configuration', 'delete'],
    dangerousList: ['reload', 'erase', 'reset-configuration', 'write erase']
  });

  let mermaidInput = $state(`flowchart TD
    A[Client] -->|HTTP| B(Load Balancer)
    B --> C[Gateway API]
    C -->|Redis cache| D[(Redis)]
    C -->|Queries| E[(Postgres)]
    C -->|LLM| F[(OpenRouter)]
    F --> G[Model]
  `);
  let mermaidSvg = $state('');
  let mermaidError = $state('');
  let rendering = $state(false);
  let ntpInput = $state('');
  let dnsInput = $state('');
  let syslogInput = $state('');
  let ripNetworkInput = $state('');
  let intentText = $state('');
  let intentStatus = $state('');
  let selectedExplainCommand = $state('');

  const summaryDevice = $derived.by(() => selectedDevice?.name || '');
  const summaryVendor = $derived.by(() => (vendor === 'cisco' ? 'Cisco IOS' : 'MikroTik'));
  const summaryEnvironment = $derived.by(() => sshPolicy.environment.toUpperCase());

  const vlanCount = $derived.by(() => config.vlans.length);
  const interfaceCount = $derived.by(() => config.interfaces.length);
  const routeCount = $derived.by(() => config.routing.staticRoutes.length);
  const ospfCount = $derived.by(() => config.routing.ospf.areas.length);
  const bgpNeighborCount = $derived.by(() => config.routing.bgp.neighbors.length);
  const firewallRuleCount = $derived.by(() => config.firewall.rules.length);
  const natRuleCount = $derived.by(() => config.nat.rules.length);
  const vpnCount = $derived.by(() =>
    config.vpn.ipsecTunnels.length + config.vpn.wireguardTunnels.length + config.vpn.l2tpServers.length
  );
  const qosCount = $derived.by(() => config.qos.queues.length);

  const baseConfigured = $derived.by(() => {
    const mgmt = (config.firewall.allowMgmtFrom ?? '').trim();
    return Boolean(config.hostname.trim() || mgmt || config.firewall.enabled);
  });

  const servicesConfigured = $derived.by(() => {
    return Boolean(
      config.services.ssh.enabled ||
        config.services.ntpServers.length > 0 ||
        config.services.dnsServers.length > 0
    );
  });

  const networkConfigured = $derived.by(() => {
    return vlanCount > 0 || interfaceCount > 0;
  });

  const routingConfigured = $derived.by(() => {
    return (
      routeCount > 0 ||
      config.routing.ospf.enabled ||
      config.routing.bgp.enabled ||
      config.routing.rip.enabled
    );
  });

  const securityConfigured = $derived.by(() => {
    return firewallRuleCount > 0 || natRuleCount > 0;
  });

  const vpnConfigured = $derived.by(() => vpnCount > 0);

  const qosConfigured = $derived.by(() => qosCount > 0);

  const monitoringConfigured = $derived.by(() => {
    return (
      config.services.syslogServers.length > 0 ||
      Boolean(config.services.snmpCommunity) ||
      Boolean(config.services.netflow.enabled) ||
      Boolean(config.services.sflow.enabled)
    );
  });

  const isConfigValid = $derived.by(() => Boolean(selectedDeviceId && config.hostname.trim()));
  const hasValidationErrors = $derived.by(() => validationFindings.some((finding) => finding.severity === 'error'));
  const canGenerate = $derived.by(() => isConfigValid && !hasValidationErrors);

  const guardrailResult = $derived.by(() =>
    generateResult
      ? evaluateGuardrails(generateResult.commands, vendor, sshPolicy.environment, currentRole)
      : { blocked: false, issues: [] }
  );
  const guardrailBlocked = $derived.by(() => guardrailResult.blocked && !guardrailOverride);

  const playbookBlocks = $derived.by(() =>
    generateResult ? buildPlaybook(generateResult, vendor, playbookType) : []
  );

  const previewOutput = $derived.by(() => {
    if (!generateResult) return '';
    if (!playbookMode) return generateResult.commands.join('\\n');
    return playbookBlocks.map((block) => block.commands.join('\\n')).join('\\n\\n');
  });

  const configHash = $derived.by(() => hashConfig(config, vendor));
  const currentApproval = $derived.by(() =>
    approvals.find(
      (record) =>
        record.deviceId === (selectedDeviceId || '') && record.configHash === configHash
    ) || null
  );
  const approvalStatus = $derived.by(() => currentApproval?.status ?? 'none');
  const approvalRequired = $derived.by(() => sshPolicy.environment === 'prod');
  const approvalBlocked = $derived.by(() => approvalRequired && approvalStatus !== 'approved');

  const riskSummary = $derived.by(() => evaluateRisk(config, sshPolicy.environment));

  const okItems = $derived.by(() => {
    const checks: string[] = [];
    const mgmt = (config.firewall.allowMgmtFrom ?? '').trim();
    if (mgmt && mgmt !== '0.0.0.0/0' && mgmt !== '::/0') {
      checks.push('netops.generator.checks.mgmtLimited');
    }
    if (config.services.ntpServers.length) {
      checks.push('netops.generator.checks.ntpConfigured');
    }
    if (!config.services.ssh.allowPassword) {
      checks.push('netops.generator.checks.passwordDisabled');
    }
    return checks;
  });

  const riskTone = (level: 'LOW' | 'MEDIUM' | 'HIGH') =>
    level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warning' : 'success';


  async function loadDevices() {
    deviceLoading = true;
    deviceError = '';
    try {
      devices = await devicesApi.list();
      if (!selectedDeviceId && devices.length > 0) {
        selectedDeviceId = devices[0].id;
      }
    } catch (error: any) {
      deviceError = error?.message || 'Failed to load devices';
    } finally {
      deviceLoading = false;
    }
  }

  function applyDeviceDefaults(device: Device | null) {
    if (!device) return;
    vendor = (device.vendor === 'fortigate' ? 'cisco' : device.vendor) as Vendor;
    config = {
      ...config,
      hostname: device.name,
      metadata: {
        ...config.metadata,
        deviceId: device.id
      }
    };
    lastCommands = loadLastCommands(device.id);
  }

  function openVlanModal() {
    vlanDraft = { id: config.vlans.length + 1, name: '', subnet: '', gateway: '' };
    showVlanModal = true;
  }

  function confirmAddVlan() {
    config = { ...config, vlans: [...config.vlans, { ...vlanDraft }] };
    showVlanModal = false;
  }

  function removeVlan(index: number) {
    config = {
      ...config,
      vlans: config.vlans.filter((_, i) => i !== index)
    };
  }

  function openInterfaceModal() {
    interfaceDraft = {
      id: `if-${Date.now()}`,
      name: '',
      role: 'access',
      ipAddress: '',
      subnetMask: '',
      vlanId: undefined,
      description: '',
      enabled: true
    };
    showInterfaceModal = true;
  }

  function confirmAddInterface() {
    config = { ...config, interfaces: [...config.interfaces, { ...interfaceDraft }] };
    showInterfaceModal = false;
  }

  function removeInterface(index: number) {
    config = {
      ...config,
      interfaces: config.interfaces.filter((_, i) => i !== index)
    };
  }

  function openRouteModal() {
    routeDraft = { destination: '', netmask: '', nextHop: '' };
    showRouteModal = true;
  }

  function confirmAddRoute() {
    config = {
      ...config,
      routing: {
        ...config.routing,
        staticRoutes: [...config.routing.staticRoutes, { ...routeDraft }]
      }
    };
    showRouteModal = false;
  }

  function removeRoute(index: number) {
    config = {
      ...config,
      routing: {
        ...config.routing,
        staticRoutes: config.routing.staticRoutes.filter((_, i) => i !== index)
      }
    };
  }

  const parseList = (value: string) =>
    value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  function openOspfModal() {
    ospfAreaDraft = { id: `area-${Date.now()}`, area: '', networks: '' };
    showOspfModal = true;
  }

  function confirmAddOspfArea() {
    const networks = parseList(ospfAreaDraft.networks);
    config = {
      ...config,
      routing: {
        ...config.routing,
        ospf: {
          ...config.routing.ospf,
          areas: [
            ...config.routing.ospf.areas,
            {
              id: ospfAreaDraft.id,
              area: ospfAreaDraft.area,
              networks,
              passiveInterfaces: []
            }
          ]
        }
      }
    };
    showOspfModal = false;
  }

  function removeOspfArea(index: number) {
    config = {
      ...config,
      routing: {
        ...config.routing,
        ospf: {
          ...config.routing.ospf,
          areas: config.routing.ospf.areas.filter((_, i) => i !== index)
        }
      }
    };
  }

  function openBgpNeighborModal() {
    bgpNeighborDraft = { id: `bgp-${Date.now()}`, neighbor: '', remoteAs: 65000, description: '' };
    showBgpNeighborModal = true;
  }

  function confirmAddBgpNeighbor() {
    config = {
      ...config,
      routing: {
        ...config.routing,
        bgp: {
          ...config.routing.bgp,
          neighbors: [...config.routing.bgp.neighbors, { ...bgpNeighborDraft }]
        }
      }
    };
    showBgpNeighborModal = false;
  }

  function removeBgpNeighbor(index: number) {
    config = {
      ...config,
      routing: {
        ...config.routing,
        bgp: {
          ...config.routing.bgp,
          neighbors: config.routing.bgp.neighbors.filter((_, i) => i !== index)
        }
      }
    };
  }

  function openBgpNetworkModal() {
    bgpNetworkDraft = { id: `bgp-net-${Date.now()}`, network: '' };
    showBgpNetworkModal = true;
  }

  function confirmAddBgpNetwork() {
    config = {
      ...config,
      routing: {
        ...config.routing,
        bgp: {
          ...config.routing.bgp,
          networks: [...config.routing.bgp.networks, { ...bgpNetworkDraft }]
        }
      }
    };
    showBgpNetworkModal = false;
  }

  function removeBgpNetwork(index: number) {
    config = {
      ...config,
      routing: {
        ...config.routing,
        bgp: {
          ...config.routing.bgp,
          networks: config.routing.bgp.networks.filter((_, i) => i !== index)
        }
      }
    };
  }

  function addRipNetwork() {
    const trimmed = ripNetworkInput.trim();
    if (!trimmed) return;
    config = {
      ...config,
      routing: {
        ...config.routing,
        rip: {
          ...config.routing.rip,
          networks: [...config.routing.rip.networks, trimmed]
        }
      }
    };
    ripNetworkInput = '';
  }

  function removeRipNetwork(index: number) {
    config = {
      ...config,
      routing: {
        ...config.routing,
        rip: {
          ...config.routing.rip,
          networks: config.routing.rip.networks.filter((_, i) => i !== index)
        }
      }
    };
  }

  function openFirewallModal() {
    firewallRuleDraft = {
      id: `fw-${Date.now()}`,
      chain: 'input',
      src: '',
      dst: '',
      protocol: 'tcp',
      srcPort: '',
      dstPort: '',
      action: 'accept',
      comment: ''
    };
    showFirewallModal = true;
  }

  function confirmAddFirewallRule() {
    config = {
      ...config,
      firewall: {
        ...config.firewall,
        rules: [...config.firewall.rules, { ...firewallRuleDraft }]
      }
    };
    showFirewallModal = false;
  }

  function removeFirewallRule(index: number) {
    config = {
      ...config,
      firewall: {
        ...config.firewall,
        rules: config.firewall.rules.filter((_, i) => i !== index)
      }
    };
  }

  function openNatModal() {
    natRuleDraft = {
      id: `nat-${Date.now()}`,
      type: 'snat',
      src: '',
      dst: '',
      protocol: 'tcp',
      srcPort: '',
      dstPort: '',
      toAddress: '',
      toPort: '',
      outInterface: '',
      comment: ''
    };
    showNatModal = true;
  }

  function confirmAddNatRule() {
    config = {
      ...config,
      nat: {
        rules: [...config.nat.rules, { ...natRuleDraft }]
      }
    };
    showNatModal = false;
  }

  function removeNatRule(index: number) {
    config = {
      ...config,
      nat: {
        rules: config.nat.rules.filter((_, i) => i !== index)
      }
    };
  }

  function openIpsecModal() {
    ipsecDraft = {
      id: `ipsec-${Date.now()}`,
      name: '',
      localAddress: '',
      remoteAddress: '',
      localSubnet: '',
      remoteSubnet: '',
      preSharedKey: '',
      ikeVersion: 'v2'
    };
    showIpsecModal = true;
  }

  function confirmAddIpsec() {
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        ipsecTunnels: [...config.vpn.ipsecTunnels, { ...ipsecDraft }]
      }
    };
    showIpsecModal = false;
  }

  function removeIpsec(index: number) {
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        ipsecTunnels: config.vpn.ipsecTunnels.filter((_, i) => i !== index)
      }
    };
  }

  function openWireguardModal() {
    wireguardDraft = {
      id: `wg-${Date.now()}`,
      name: '',
      interfaceAddress: '',
      listenPort: 51820,
      privateKey: '',
      peerPublicKey: '',
      peerAllowedIps: '',
      peerEndpoint: ''
    };
    showWireguardModal = true;
  }

  function confirmAddWireguard() {
    const peer = wireguardDraft.peerPublicKey
      ? {
          id: `peer-${Date.now()}`,
          publicKey: wireguardDraft.peerPublicKey,
          allowedIps: wireguardDraft.peerAllowedIps,
          endpoint: wireguardDraft.peerEndpoint
        }
      : null;
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        wireguardTunnels: [
          ...config.vpn.wireguardTunnels,
          {
            id: wireguardDraft.id,
            name: wireguardDraft.name,
            interfaceAddress: wireguardDraft.interfaceAddress,
            listenPort: wireguardDraft.listenPort,
            privateKey: wireguardDraft.privateKey,
            peers: peer ? [peer] : []
          }
        ]
      }
    };
    showWireguardModal = false;
  }

  function removeWireguard(index: number) {
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        wireguardTunnels: config.vpn.wireguardTunnels.filter((_, i) => i !== index)
      }
    };
  }

  function openL2tpModal() {
    l2tpDraft = {
      id: `l2tp-${Date.now()}`,
      name: '',
      localAddress: '',
      pool: '',
      preSharedKey: ''
    };
    showL2tpModal = true;
  }

  function confirmAddL2tp() {
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        l2tpServers: [...config.vpn.l2tpServers, { ...l2tpDraft }]
      }
    };
    showL2tpModal = false;
  }

  function removeL2tp(index: number) {
    config = {
      ...config,
      vpn: {
        ...config.vpn,
        l2tpServers: config.vpn.l2tpServers.filter((_, i) => i !== index)
      }
    };
  }

  function openQosModal() {
    qosDraft = {
      id: `qos-${Date.now()}`,
      name: '',
      target: '',
      maxLimit: '',
      priority: 8,
      comment: ''
    };
    showQosModal = true;
  }

  function confirmAddQos() {
    config = {
      ...config,
      qos: {
        queues: [...config.qos.queues, { ...qosDraft }]
      }
    };
    showQosModal = false;
  }

  function removeQos(index: number) {
    config = {
      ...config,
      qos: {
        queues: config.qos.queues.filter((_, i) => i !== index)
      }
    };
  }

  function addSyslog() {
    const trimmed = syslogInput.trim();
    if (!trimmed) return;
    config = {
      ...config,
      services: {
        ...config.services,
        syslogServers: [...config.services.syslogServers, trimmed]
      }
    };
    syslogInput = '';
  }

  function removeSyslog(index: number) {
    config = {
      ...config,
      services: {
        ...config.services,
        syslogServers: config.services.syslogServers.filter((_, i) => i !== index)
      }
    };
  }

  function openSnmpUserModal() {
    snmpUserDraft = {
      id: `snmp-${Date.now()}`,
      username: '',
      authProtocol: 'sha',
      authPassword: '',
      privProtocol: 'aes',
      privPassword: ''
    };
    showSnmpUserModal = true;
  }

  function confirmAddSnmpUser() {
    config = {
      ...config,
      services: {
        ...config.services,
        snmpV3Users: [...(config.services.snmpV3Users ?? []), { ...snmpUserDraft }]
      }
    };
    showSnmpUserModal = false;
  }

  function removeSnmpUser(index: number) {
    config = {
      ...config,
      services: {
        ...config.services,
        snmpV3Users: (config.services.snmpV3Users ?? []).filter((_, i) => i !== index)
      }
    };
  }

  function addService(listKey: 'ntpServers' | 'dnsServers', value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    config = {
      ...config,
      services: {
        ...config.services,
        [listKey]: [...config.services[listKey], trimmed]
      }
    };
  }

  function handleAddNtp() {
    addService('ntpServers', ntpInput);
    ntpInput = '';
  }

  function handleAddDns() {
    addService('dnsServers', dnsInput);
    dnsInput = '';
  }

  function removeService(listKey: 'ntpServers' | 'dnsServers', index: number) {
    config = {
      ...config,
      services: {
        ...config.services,
        [listKey]: config.services[listKey].filter((_, i) => i !== index)
      }
    };
  }

  function applyIntent() {
    const text = intentText.toLowerCase();
    if (!text.trim()) {
      intentStatus = '';
      return;
    }
    const vlanMatch = text.match(/vlan\s*(\d+)/);
    const cidrMatch = text.match(/(\d+\.\d+\.\d+\.\d+\/\d+)/);
    const gatewayMatch = text.match(/gateway\s*(\d+\.\d+\.\d+\.\d+)/);
    if (vlanMatch) {
      const id = Number(vlanMatch[1]);
      const subnet = cidrMatch?.[1] ?? '';
      const gateway = gatewayMatch?.[1] ?? '';
      const exists = config.vlans.some((vlan) => vlan.id === id);
      if (!exists) {
        config = {
          ...config,
          vlans: [...config.vlans, { id, name: `VLAN${id}`, subnet, gateway }]
        };
      }
    }
    if (text.includes('ospf')) {
      config = {
        ...config,
        routing: {
          ...config.routing,
          ospf: { ...config.routing.ospf, enabled: true }
        }
      };
    }
    if (text.includes('bgp')) {
      config = {
        ...config,
        routing: {
          ...config.routing,
          bgp: { ...config.routing.bgp, enabled: true }
        }
      };
    }
    if (text.includes('ntp') && config.services.ntpServers.length === 0) {
      const ntpMatch = text.match(/ntp\s*(\d+\.\d+\.\d+\.\d+)/);
      if (ntpMatch) {
        config = {
          ...config,
          services: {
            ...config.services,
            ntpServers: [...config.services.ntpServers, ntpMatch[1]]
          }
        };
      }
    }
    intentStatus = $_('netops.generator.intent.applied');
  }

  const explainCommand = (command: string) => {
    const lower = command.toLowerCase();
    if (lower.startsWith('/ip route') || lower.startsWith('ip route')) {
      return $_('netops.generator.explain.route');
    }
    if (lower.includes('ospf')) {
      return $_('netops.generator.explain.ospf');
    }
    if (lower.includes('bgp')) {
      return $_('netops.generator.explain.bgp');
    }
    if (lower.includes('firewall')) {
      return $_('netops.generator.explain.firewall');
    }
    if (lower.includes('nat')) {
      return $_('netops.generator.explain.nat');
    }
    if (lower.includes('wireguard') || lower.includes('ipsec')) {
      return $_('netops.generator.explain.vpn');
    }
    if (lower.includes('snmp') || lower.includes('syslog') || lower.includes('logging')) {
      return $_('netops.generator.explain.monitoring');
    }
    return $_('netops.generator.explain.generic');
  };

  function runValidation() {
    validationFindings = validateConfig(config);
  }

  function recordAudit(entry: { action: string; detail: string }) {
    if (typeof localStorage === 'undefined') return;
    const key = 'netops.cli.audit.v1';
    const raw = localStorage.getItem(key);
    const existing = raw ? (JSON.parse(raw) as any[]) : [];
    existing.unshift({
      ...entry,
      timestamp: new Date().toISOString(),
      deviceId: selectedDeviceId || null,
      vendor,
      environment: sshPolicy.environment
    });
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 200)));
  }

  function confirmGuardrailOverride() {
    guardrailOverride = true;
    recordAudit({
      action: 'guardrail.override',
      detail: guardrailReason || 'Override without reason'
    });
    showGuardrailModal = false;
    guardrailReason = '';
  }

  function loadApprovalsFromStorage() {
    approvals = loadApprovals();
  }

  function requestApproval() {
    if (!selectedDeviceId) return;
    const record = createApprovalRequest({
      deviceId: selectedDeviceId,
      vendor,
      environment: sshPolicy.environment,
      configHash,
      requestedBy: currentUserEmail || undefined,
      reason: approvalReason || undefined
    });
    approvals = [record, ...approvals];
    approvalReason = '';
    recordAudit({ action: 'approval.requested', detail: record.id });
  }

  function handleApprovalDecision(status: 'approved' | 'rejected') {
    if (!currentApproval) return;
    const updated = decideApproval(currentApproval.id, status, currentUserEmail || undefined, approvalReason || undefined);
    approvals = loadApprovals();
    approvalReason = '';
    if (updated) {
      recordAudit({ action: `approval.${status}`, detail: updated.id });
    }
  }

  async function runGenerate() {
    validationFindings = validateConfig(config);
    if (!isConfigValid) {
      pipelineStatus = 'Select a device and hostname before generating.';
      return;
    }
    if (validationFindings.some((finding) => finding.severity === 'error')) {
      pipelineStatus = 'Fix validation errors before generating.';
      return;
    }
    pipelineStatus = '';
    const result = await generateConfigPipeline(config, vendor);
    generateResult = result;
    guardrailOverride = false;
    guardrailReason = '';
    lintFindings = result.lintFindings;
    const previous = selectedDevice?.last_config_snapshot
      ? selectedDevice.last_config_snapshot.split('\n').filter(Boolean)
      : lastCommands;
    diffLines = diffCommandsDetailed(previous, result.commands);
    lastCommands = result.commands;
    selectedExplainCommand = '';
    if (selectedDeviceId) {
      saveLastCommands(selectedDeviceId, result.commands);
    }
    pipelineStatus = 'Generated successfully.';
  }

  async function runLint() {
    lintFindings = await lintConfig(config, vendor);
  }

  async function runDiff() {
    if (!generateResult) {
      diffLines = [];
      return;
    }
    const previous = selectedDevice?.last_config_snapshot
      ? selectedDevice.last_config_snapshot.split('\n').filter(Boolean)
      : lastCommands;
    diffLines = diffCommandsDetailed(previous, generateResult.commands);
  }

  async function refreshSessions() {
    sshSessions = await listSessions();
    if (!activeSessionId && sshSessions.length > 0) {
      activeSessionId = sshSessions[0].id;
    }
  }

  async function openSelectedDeviceSession() {
    if (!selectedDevice) return;
    const session = await openSession({
      deviceId: selectedDevice.id,
      deviceName: selectedDevice.name,
      host: selectedDevice.mgmt_ip,
      port: 22,
      user: 'admin',
      authType: 'password'
    });
    activeSessionId = session.id;
    await refreshSessions();
    sshLog = await getSessionLog(session.id);
  }

  async function handleSendCommand() {
    if (!activeSessionId || !sshCommand.trim()) return;
    sshBusy = true;
    sshError = '';
    try {
      const result = await sendCommand(activeSessionId, sshCommand.trim(), sshPolicy, { deviceId: selectedDevice?.id });
      if (result.warning && sshPolicy.environment === 'prod') {
        sshError = result.warning;
      }
      sshLog = await getSessionLog(activeSessionId);
      sshCommand = '';
    } catch (error: any) {
      sshError = error?.message || 'Command failed';
    } finally {
      sshBusy = false;
    }
  }

  async function handleCloseSession() {
    if (!activeSessionId) return;
    await closeSession(activeSessionId);
    await refreshSessions();
  }

  async function downloadLog(type: 'text' | 'json') {
    if (!activeSessionId) return;
    if (type === 'text') {
      const text = await exportSessionText(activeSessionId);
      downloadFile(`ssh-${activeSessionId}.log`, text);
    } else {
      const data = await getSessionLog(activeSessionId);
      downloadFile(`ssh-${activeSessionId}.json`, JSON.stringify(data, null, 2));
    }
  }

  function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function pushViaSsh() {
    if (!generateResult || !selectedDevice) return;
    if (guardrailBlocked) {
      pushStatus = 'Blocked by command guardrails.';
      return;
    }
    if (approvalBlocked) {
      pushStatus = 'Approval required before pushing.';
      return;
    }
    if (validationFindings.some((finding) => finding.severity === 'error')) {
      pushStatus = 'Fix validation errors before pushing.';
      return;
    }
    if (!activeSessionId) {
      pushStatus = 'Open an SSH session before pushing.';
      return;
    }

    if (sshPolicy.environment === 'prod') {
      const danger = generateResult.commands.find((cmd) =>
        sshPolicy.dangerousList.some((rule) => cmd.toLowerCase().includes(rule.toLowerCase()))
      );
      if (danger) {
        const confirmed = confirm(`Dangerous command detected: ${danger}. Confirm push?`);
        if (!confirmed) {
          pushStatus = 'Push cancelled by user.';
          return;
        }
      }
    }

    pushStatus = 'Pushing commands via SSH...';
    for (const command of generateResult.commands) {
      await sendCommand(activeSessionId, command, sshPolicy, { deviceId: selectedDevice?.id });
    }
    if (generateResult.verifyCommands.length > 0) {
      for (const command of generateResult.verifyCommands) {
        await sendCommand(activeSessionId, command, sshPolicy, { deviceId: selectedDevice?.id });
      }
    }
    sshLog = await getSessionLog(activeSessionId);
    pushStatus = 'Push completed.';
    recordAudit({ action: 'push.ssh', detail: `commands=${generateResult.commands.length}` });
    const syncResult = await syncConfigToCmdb({
      deviceId: selectedDevice.id,
      vendor,
      config,
      commands: generateResult.commands,
      configHash
    });
    pushStatus = `${pushStatus} ${syncResult.message}`;
  }

  async function pushViaBackend() {
    if (!selectedDevice || !generateResult) return;
    if (guardrailBlocked) {
      pushStatus = 'Blocked by command guardrails.';
      return;
    }
    if (approvalBlocked) {
      pushStatus = 'Approval required before pushing.';
      return;
    }
    if (validationFindings.some((finding) => finding.severity === 'error')) {
      pushStatus = 'Fix validation errors before pushing.';
      return;
    }
    const result = await pushConfig({
      deviceId: selectedDevice.id,
      sessionId: activeSessionId || undefined,
      vendor,
      config,
      commands: generateResult.commands,
      verifyCommands: generateResult.verifyCommands,
      rollbackCommands: generateResult.rollbackCommands
    });
    pushStatus = `${result.status.toUpperCase()}: ${result.details.join(' ')}`;
    recordAudit({ action: 'push.backend', detail: result.status });
    if (result.status === 'success') {
      const syncResult = await syncConfigToCmdb({
        deviceId: selectedDevice.id,
        vendor,
        config,
        commands: generateResult.commands,
        configHash
      });
      pushStatus = `${pushStatus} ${syncResult.message}`;
    }
  }

  async function ensureMermaid() {
    if (typeof window === 'undefined') return null;
    if (!(window as any).mermaidLoader) {
      (window as any).mermaidLoader = new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load mermaid from CDN'));
        document.head.appendChild(s);
      });
    }
    await (window as any).mermaidLoader;
    const mermaid = (window as any).mermaid;
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    return mermaid;
  }

  async function renderDiagram() {
    rendering = true;
    mermaidError = '';
    try {
      const mermaid = await ensureMermaid();
      if (!mermaid) return;
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, mermaidInput);
      mermaidSvg = svg;
    } catch (error: any) {
      mermaidError = error?.message || 'Failed to render diagram';
      mermaidSvg = '';
    } finally {
      rendering = false;
    }
  }

  function loadProfilesFromStorage() {
    profiles = loadProfiles();
    const storedActive = getActiveProfileId();
    if (storedActive) {
      activeProfileId = storedActive;
      const profile = profiles.find((item) => item.id === storedActive);
      if (profile) {
        applyProfile(profile);
      }
    }
  }

  function applyProfile(profile: CliProfile) {
    config = applyProfileToConfig(config, profile);
    vendor = profile.vendor;
    sshPolicy = { ...sshPolicy, environment: profile.environment };
    activeProfileId = profile.id;
    setActiveProfileId(profile.id);
  }

  function clearProfile() {
    activeProfileId = '';
    setActiveProfileId('');
  }

  function saveProfile() {
    const trimmedName = profileName.trim();
    if (!trimmedName) return;
    const profile = buildProfileFromConfig(
      config,
      vendor,
      sshPolicy.environment,
      trimmedName,
      includeHostnameInProfile
    );
    const next = [profile, ...profiles.filter((item) => item.name !== profile.name)];
    profiles = next;
    saveProfiles(next);
    activeProfileId = profile.id;
    setActiveProfileId(profile.id);
    showProfileModal = false;
    profileName = '';
    includeHostnameInProfile = false;
  }

  function loadLastCommands(deviceId: string): string[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(`netops.cli.last.${deviceId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  function saveLastCommands(deviceId: string, commands: string[]) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`netops.cli.last.${deviceId}`, JSON.stringify(commands));
  }

  async function selectSshSession(session: SshSession) {
    activeSessionId = session.id;
    sshLog = await getSessionLog(session.id);
  }

  function copy(text: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }

  $effect(() => {
    void renderDiagram();
  });

  $effect(() => {
    applyDeviceDefaults(selectedDevice);
  });

  $effect(() => {
    validationFindings = validateConfig(config);
  });

  $effect(() => {
    if (config.metadata.environment !== sshPolicy.environment) {
      config = { ...config, metadata: { ...config.metadata, environment: sshPolicy.environment } };
    }
  });

  onMount(() => {
    void loadDevices();
    loadProfilesFromStorage();
    loadApprovalsFromStorage();
    void refreshSessions();
    if (typeof localStorage !== 'undefined') {
      currentRole = localStorage.getItem('userRole') || '';
      currentUserEmail = localStorage.getItem('userEmail') || '';
    }
    const interval = setInterval(() => {
      purgeIdleSessions();
      void refreshSessions();
    }, 30000);
    return () => clearInterval(interval);
  });
</script>

<div class="page-shell page-content py-6 lg:py-8">
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-200">{$isLoading ? 'Tools & Utils' : $_('tools.title')}</h1>
      <p class="text-sm text-slate-300">
        {$isLoading ? 'Quick helpers for diagrams, network troubleshooting, and SSH access' : $_('tools.subtitle')}
      </p>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
      {#each sections as sec}
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent {activeSection === sec.id ? 'bg-blue-900/50 text-blue-100 border-blue-900' : 'text-slate-300 hover:bg-slate-800'}"
          onclick={() => (activeSection = sec.id)}
        >
          {$isLoading ? sec.id : $_(sec.labelKey)}
        </button>
      {/each}
    </div>

      {#if activeSection === 'config-generator'}
        <div class="space-y-4">
          <PageHeader
            title={$_('netops.generator.title')}
            subtitle={$_('netops.generator.subtitle')}
            sticky
          >
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-end">
              <div class="space-y-1">
                <label class="label-base">{$_('netops.generator.profile.label')}</label>
                <select
                  class="select-base"
                  bind:value={activeProfileId}
                  onchange={(e) => {
                    const id = (e.target as HTMLSelectElement).value;
                    if (!id) {
                      clearProfile();
                      return;
                    }
                    const profile = profiles.find((item) => item.id === id);
                    if (profile) applyProfile(profile);
                  }}
                >
                  <option value="">{$_('netops.generator.profile.apply')}</option>
                  {#each profiles as profile}
                    <option value={profile.id}>{profile.name}</option>
                  {/each}
                </select>
                <p class="text-xs text-slate-400">{$_('netops.generator.profile.help')}</p>
              </div>
              <div class="flex flex-wrap gap-2 items-center justify-start lg:justify-end">
                <Button size="sm" variant="secondary" onclick={() => (showProfileModal = true)}>
                  {$_('netops.generator.profile.save')}
                </Button>
                {#if activeProfile}
                  <span class="badge-primary">{$_('netops.generator.profile.active')}: {activeProfile.name}</span>
                  <Button size="sm" variant="secondary" onclick={clearProfile}>{$_('common.clear')}</Button>
                {/if}
              </div>
            </div>

            <div class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.deviceContext')}</div>
            <div class="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_auto] items-end">
              <div class="space-y-1">
                <label class="label-base">{$_('netops.generator.device')}</label>
                <select class="select-base" bind:value={selectedDeviceId} disabled={deviceLoading}>
                  {#if devices.length === 0}
                    <option value="">{$_('netops.generator.deviceEmpty')}</option>
                  {:else}
                    {#each devices as device}
                      <option value={device.id}>{device.name} · {device.mgmt_ip}</option>
                    {/each}
                  {/if}
                </select>
                <p class="text-xs text-slate-400">{$_('netops.generator.deviceHelp')}</p>
              </div>
              <div class="space-y-1">
                <label class="label-base">{$_('netops.generator.vendor')}</label>
                <select class="select-base" bind:value={vendor}>
                  <option value="mikrotik">MikroTik</option>
                  <option value="cisco">Cisco IOS</option>
                </select>
                <p class="text-xs text-slate-400">{$_('netops.generator.vendorHelp')}</p>
              </div>
              <div class="space-y-1">
                <label class="label-base" title={$_('netops.generator.environmentHelp')}>{$_('netops.generator.environment')}</label>
                <select class="select-base" bind:value={sshPolicy.environment}>
                  <option value="dev">Dev</option>
                  <option value="staging">Staging</option>
                  <option value="prod">Prod</option>
                </select>
                <p class="text-xs text-slate-400">{$_('netops.generator.environmentHelp')}</p>
              </div>
              <div class="flex flex-wrap gap-2 justify-start lg:justify-end">
                <Button variant="secondary" size="sm" onclick={() => (activeSection = 'ssh-terminal')}>{$_('netops.generator.actions.openSsh')}</Button>
                <Button size="sm" onclick={runGenerate} disabled={!canGenerate}>{$_('netops.generator.actions.generate')}</Button>
              </div>
            </div>
            {#if !isConfigValid}
              <p class="text-xs text-amber-600">{$_('netops.generator.requireDevice')}</p>
            {:else if hasValidationErrors}
              <p class="text-xs text-rose-600">{$_('netops.generator.validation.blocked')}</p>
            {/if}
          </PageHeader>

          {#if deviceError}
            <div class="alert alert-error">{deviceError}</div>
          {/if}

          <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div class="space-y-3">
              <div class="card space-y-2">
                <div class="flex items-center justify-between">
                  <div class="text-sm font-semibold text-slate-200">{$_('netops.generator.intent.title')}</div>
                  <span class="badge-primary">{$_('netops.generator.intent.badge')}</span>
                </div>
                <textarea class="textarea-base" rows={3} bind:value={intentText} placeholder={$_('netops.generator.intent.placeholder')}></textarea>
                <div class="flex flex-wrap items-center gap-2">
                  <Button size="sm" onclick={applyIntent}>{$_('netops.generator.intent.apply')}</Button>
                  {#if intentStatus}
                    <span class="text-xs text-slate-500">{intentStatus}</span>
                  {/if}
                </div>
              </div>

              <ConfigStep
                title={$_('netops.generator.base.title')}
                description={$_('netops.generator.base.description')}
                icon={Settings}
                badge={baseConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={baseConfigured ? 'success' : 'neutral'}
                open={baseOpen}
                onToggle={() => (baseOpen = !baseOpen)}
              >
                <div class="grid md:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.generator.base.hostname')}</label>
                    <input class="input-base" bind:value={config.hostname} placeholder="CORE-EDGE-01" />
                    <p class="text-xs text-slate-400">{$_('netops.generator.base.hostnameHelp')}</p>
                  </div>
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.generator.base.mgmtCidr')}</label>
                    <input class="input-base" bind:value={config.firewall.allowMgmtFrom} placeholder="10.0.0.0/24" />
                    <p class="text-xs text-slate-400">{$_('netops.generator.base.mgmtHelp')}</p>
                  </div>
                  <div class="flex items-center gap-2 text-sm">
                    <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.firewall.enabled} />
                    <span>{$_('netops.generator.base.firewall')}</span>
                  </div>
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.monitoring.title')}
                description={$_('netops.generator.monitoring.description')}
                icon={ShieldCheck}
                badge={monitoringConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={monitoringConfigured ? 'success' : 'neutral'}
                open={monitoringOpen}
                onToggle={() => (monitoringOpen = !monitoringOpen)}
              >
                <div class="space-y-3">
                  <div class="grid md:grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="label-base">{$_('netops.generator.monitoring.snmpVersion')}</label>
                      <select class="select-base" bind:value={config.services.snmpVersion}>
                        <option value="v2c">v2c</option>
                        <option value="v3">v3</option>
                      </select>
                    </div>
                    <div class="space-y-1">
                      <label class="label-base">{$_('netops.generator.monitoring.snmpCommunity')}</label>
                      <input class="input-base" bind:value={config.services.snmpCommunity} placeholder="public" />
                    </div>
                  </div>

                  {#if config.services.snmpVersion === 'v3'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.monitoring.snmpUsers')}</div>
                        <Button size="sm" onclick={openSnmpUserModal}>{$_('netops.generator.monitoring.addSnmpUser')}</Button>
                      </div>
                      {#if (config.services.snmpV3Users ?? []).length === 0}
                        <EmptyState
                          title={$_('netops.generator.monitoring.emptySnmpUsersTitle')}
                          description={$_('netops.generator.monitoring.emptySnmpUsersDescription')}
                          actionLabel={$_('netops.generator.monitoring.addSnmpUser')}
                          onAction={openSnmpUserModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.monitoring.snmpUser')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.monitoring.snmpAuth')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.services.snmpV3Users ?? [] as user, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{user.username}</td>
                                  <td class="py-2 pr-2">{user.authProtocol?.toUpperCase()}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeSnmpUser(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <div>
                    <label class="label-base">{$_('netops.generator.monitoring.syslog')}</label>
                    <div class="flex gap-2">
                      <input class="input-base" bind:value={syslogInput} placeholder="10.0.0.10" />
                      <Button size="sm" onclick={addSyslog}>{$_('common.add')}</Button>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      {#each config.services.syslogServers as server, index}
                        <span class="badge-primary cursor-pointer" onclick={() => removeSyslog(index)}>{server}</span>
                      {/each}
                    </div>
                  </div>

                  <div class="grid md:grid-cols-2 gap-3">
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.services.netflow.enabled} />
                        <span>{$_('netops.generator.monitoring.netflow')}</span>
                      </div>
                      <div class="space-y-1">
                        <label class="label-base">{$_('netops.generator.monitoring.collector')}</label>
                        <input class="input-base" bind:value={config.services.netflow.collector} placeholder="10.0.0.50" />
                      </div>
                      <div class="space-y-1">
                        <label class="label-base">{$_('netops.generator.monitoring.port')}</label>
                        <input class="input-base" type="number" bind:value={config.services.netflow.port} />
                      </div>
                    </div>
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.services.sflow.enabled} />
                        <span>{$_('netops.generator.monitoring.sflow')}</span>
                      </div>
                      <div class="space-y-1">
                        <label class="label-base">{$_('netops.generator.monitoring.collector')}</label>
                        <input class="input-base" bind:value={config.services.sflow.collector} placeholder="10.0.0.60" />
                      </div>
                      <div class="space-y-1">
                        <label class="label-base">{$_('netops.generator.monitoring.port')}</label>
                        <input class="input-base" type="number" bind:value={config.services.sflow.port} />
                      </div>
                    </div>
                  </div>
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.qos.title')}
                description={$_('netops.generator.qos.description')}
                icon={Settings}
                badge={qosConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={qosConfigured ? 'success' : 'neutral'}
                open={qosOpen}
                onToggle={() => (qosOpen = !qosOpen)}
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold">{$_('netops.generator.qos.queues')}</div>
                    <Button size="sm" onclick={openQosModal}>{$_('netops.generator.qos.addQueue')}</Button>
                  </div>
                  {#if config.qos.queues.length === 0}
                    <EmptyState
                      title={$_('netops.generator.qos.emptyTitle')}
                      description={$_('netops.generator.qos.emptyDescription')}
                      actionLabel={$_('netops.generator.qos.addQueue')}
                      onAction={openQosModal}
                    />
                  {:else}
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-xs">
                        <thead class="text-slate-500 uppercase text-[10px]">
                          <tr>
                            <th class="py-2 pr-2 text-left">{$_('netops.generator.qos.name')}</th>
                            <th class="py-2 pr-2 text-left">{$_('netops.generator.qos.target')}</th>
                            <th class="py-2 pr-2 text-left">{$_('netops.generator.qos.limit')}</th>
                            <th class="py-2 text-right">{$_('common.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each config.qos.queues as queue, index}
                            <tr class="border-t border-slate-700">
                              <td class="py-2 pr-2">{queue.name}</td>
                              <td class="py-2 pr-2">{queue.target}</td>
                              <td class="py-2 pr-2">{queue.maxLimit}</td>
                              <td class="py-2 text-right">
                                <Button size="sm" variant="secondary" onclick={() => removeQos(index)}>{$_('common.remove')}</Button>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.vpn.title')}
                description={$_('netops.generator.vpn.description')}
                icon={ShieldCheck}
                badge={vpnConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={vpnConfigured ? 'success' : 'neutral'}
                open={vpnOpen}
                onToggle={() => (vpnOpen = !vpnOpen)}
              >
                <div class="space-y-4">
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {vpnTab === 'ipsec' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (vpnTab = 'ipsec')}
                    >
                      IPsec
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {vpnTab === 'wireguard' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (vpnTab = 'wireguard')}
                    >
                      WireGuard
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {vpnTab === 'l2tp' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (vpnTab = 'l2tp')}
                    >
                      L2TP
                    </button>
                  </div>

                  {#if vpnTab === 'ipsec'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.vpn.ipsecTunnels')}</div>
                        <Button size="sm" onclick={openIpsecModal}>{$_('netops.generator.vpn.addIpsec')}</Button>
                      </div>
                      {#if config.vpn.ipsecTunnels.length === 0}
                        <EmptyState
                          title={$_('netops.generator.vpn.emptyIpsecTitle')}
                          description={$_('netops.generator.vpn.emptyIpsecDescription')}
                          actionLabel={$_('netops.generator.vpn.addIpsec')}
                          onAction={openIpsecModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.tunnelName')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.local')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.remote')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.vpn.ipsecTunnels as tunnel, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{tunnel.name}</td>
                                  <td class="py-2 pr-2">{tunnel.localAddress}</td>
                                  <td class="py-2 pr-2">{tunnel.remoteAddress}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeIpsec(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else if vpnTab === 'wireguard'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.vpn.wireguardTunnels')}</div>
                        <Button size="sm" onclick={openWireguardModal}>{$_('netops.generator.vpn.addWireguard')}</Button>
                      </div>
                      {#if config.vpn.wireguardTunnels.length === 0}
                        <EmptyState
                          title={$_('netops.generator.vpn.emptyWireguardTitle')}
                          description={$_('netops.generator.vpn.emptyWireguardDescription')}
                          actionLabel={$_('netops.generator.vpn.addWireguard')}
                          onAction={openWireguardModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.tunnelName')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.interfaceAddress')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.peerCount')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.vpn.wireguardTunnels as tunnel, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{tunnel.name}</td>
                                  <td class="py-2 pr-2">{tunnel.interfaceAddress}</td>
                                  <td class="py-2 pr-2">{tunnel.peers.length}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeWireguard(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.vpn.l2tpServers')}</div>
                        <Button size="sm" onclick={openL2tpModal}>{$_('netops.generator.vpn.addL2tp')}</Button>
                      </div>
                      {#if config.vpn.l2tpServers.length === 0}
                        <EmptyState
                          title={$_('netops.generator.vpn.emptyL2tpTitle')}
                          description={$_('netops.generator.vpn.emptyL2tpDescription')}
                          actionLabel={$_('netops.generator.vpn.addL2tp')}
                          onAction={openL2tpModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.tunnelName')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.vpn.local')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.vpn.l2tpServers as server, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{server.name}</td>
                                  <td class="py-2 pr-2">{server.localAddress}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeL2tp(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.routing.title')}
                description={$_('netops.generator.routing.description')}
                icon={Network}
                badge={routingConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={routingConfigured ? 'success' : 'neutral'}
                open={routingOpen}
                onToggle={() => (routingOpen = !routingOpen)}
              >
                <div class="space-y-4">
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {routingTab === 'static' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (routingTab = 'static')}
                    >
                      {$_('netops.generator.routing.static')}
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {routingTab === 'ospf' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (routingTab = 'ospf')}
                    >
                      OSPF
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {routingTab === 'bgp' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (routingTab = 'bgp')}
                    >
                      BGP
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {routingTab === 'rip' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (routingTab = 'rip')}
                    >
                      RIP
                    </button>
                  </div>

                  {#if routingTab === 'static'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.routing.static')}</div>
                        <Button size="sm" onclick={openRouteModal}>{$_('netops.generator.network.addRoute')}</Button>
                      </div>
                      {#if config.routing.staticRoutes.length === 0}
                        <EmptyState
                          title={$_('netops.generator.network.emptyRoutesTitle')}
                          description={$_('netops.generator.network.emptyRoutesDescription')}
                          actionLabel={$_('netops.generator.network.addRoute')}
                          onAction={openRouteModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.network.routeDestination')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.network.routeNetmask')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.network.routeNextHop')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.routing.staticRoutes as route, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={route.destination} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={route.netmask} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={route.nextHop} /></td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeRoute(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else if routingTab === 'ospf'}
                    <div class="space-y-3">
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.routing.ospf.enabled} />
                        <span>{$_('netops.generator.routing.ospfEnabled')}</span>
                      </div>
                      <div class="grid md:grid-cols-[1fr_auto] gap-2 items-end">
                        <div class="space-y-1">
                          <label class="label-base">{$_('netops.generator.routing.ospfRouterId')}</label>
                          <input class="input-base" bind:value={config.routing.ospf.routerId} placeholder="1.1.1.1" />
                        </div>
                        <Button size="sm" onclick={openOspfModal}>{$_('netops.generator.routing.addOspfArea')}</Button>
                      </div>
                      {#if config.routing.ospf.areas.length === 0}
                        <EmptyState
                          title={$_('netops.generator.routing.emptyOspfTitle')}
                          description={$_('netops.generator.routing.emptyOspfDescription')}
                          actionLabel={$_('netops.generator.routing.addOspfArea')}
                          onAction={openOspfModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.routing.ospfArea')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.routing.ospfNetworks')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.routing.ospf.areas as area, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{area.area}</td>
                                  <td class="py-2 pr-2">{area.networks.join(', ')}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeOspfArea(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else if routingTab === 'bgp'}
                    <div class="space-y-3">
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.routing.bgp.enabled} />
                        <span>{$_('netops.generator.routing.bgpEnabled')}</span>
                      </div>
                      <div class="grid md:grid-cols-[1fr_auto] gap-2 items-end">
                        <div class="space-y-1">
                          <label class="label-base">{$_('netops.generator.routing.bgpLocalAs')}</label>
                          <input
                            class="input-base"
                            type="number"
                            value={config.routing.bgp.localAs ?? ''}
                            oninput={(e) => {
                              const value = Number((e.target as HTMLInputElement).value);
                              config = {
                                ...config,
                                routing: { ...config.routing, bgp: { ...config.routing.bgp, localAs: value || undefined } }
                              };
                            }}
                          />
                        </div>
                        <Button size="sm" onclick={openBgpNeighborModal}>{$_('netops.generator.routing.addBgpNeighbor')}</Button>
                      </div>
                      {#if config.routing.bgp.neighbors.length === 0}
                        <EmptyState
                          title={$_('netops.generator.routing.emptyBgpNeighborsTitle')}
                          description={$_('netops.generator.routing.emptyBgpNeighborsDescription')}
                          actionLabel={$_('netops.generator.routing.addBgpNeighbor')}
                          onAction={openBgpNeighborModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.routing.bgpNeighbor')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.routing.bgpRemoteAs')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.routing.bgp.neighbors as neighbor, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{neighbor.neighbor}</td>
                                  <td class="py-2 pr-2">{neighbor.remoteAs}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeBgpNeighbor(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}

                      <div class="flex items-center justify-between mt-2">
                        <div class="text-sm font-semibold">{$_('netops.generator.routing.bgpNetworks')}</div>
                        <Button size="sm" onclick={openBgpNetworkModal}>{$_('netops.generator.routing.addBgpNetwork')}</Button>
                      </div>
                      {#if config.routing.bgp.networks.length === 0}
                        <EmptyState
                          title={$_('netops.generator.routing.emptyBgpNetworksTitle')}
                          description={$_('netops.generator.routing.emptyBgpNetworksDescription')}
                          actionLabel={$_('netops.generator.routing.addBgpNetwork')}
                          onAction={openBgpNetworkModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.routing.bgpNetwork')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.routing.bgp.networks as network, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">{network.network}</td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeBgpNetwork(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else if routingTab === 'rip'}
                    <div class="space-y-3">
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.routing.rip.enabled} />
                        <span>{$_('netops.generator.routing.ripEnabled')}</span>
                      </div>
                      <div class="grid md:grid-cols-2 gap-2 items-end">
                        <div class="space-y-1">
                          <label class="label-base">{$_('netops.generator.routing.ripVersion')}</label>
                          <select class="select-base" bind:value={config.routing.rip.version}>
                            <option value={1}>v1</option>
                            <option value={2}>v2</option>
                          </select>
                        </div>
                        <div class="space-y-1">
                          <label class="label-base">{$_('netops.generator.routing.ripNetwork')}</label>
                          <div class="flex gap-2">
                            <input class="input-base" bind:value={ripNetworkInput} placeholder="10.0.0.0/24" />
                            <Button size="sm" onclick={addRipNetwork}>{$_('common.add')}</Button>
                          </div>
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        {#each config.routing.rip.networks as network, index}
                          <span class="badge-primary cursor-pointer" onclick={() => removeRipNetwork(index)}>{network}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.security.title')}
                description={$_('netops.generator.security.description')}
                icon={ShieldAlert}
                badge={securityConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={securityConfigured ? 'success' : 'neutral'}
                open={securityOpen}
                onToggle={() => (securityOpen = !securityOpen)}
              >
                <div class="space-y-4">
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {securityTab === 'firewall' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (securityTab = 'firewall')}
                    >
                      {$_('netops.generator.security.firewallRules')}
                    </button>
                    <button
                      class="px-2 py-1 rounded-lg text-xs font-semibold {securityTab === 'nat' ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                      onclick={() => (securityTab = 'nat')}
                    >
                      {$_('netops.generator.security.natRules')}
                    </button>
                  </div>

                  {#if securityTab === 'firewall'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.security.firewallRules')}</div>
                        <Button size="sm" onclick={openFirewallModal}>{$_('netops.generator.security.addFirewallRule')}</Button>
                      </div>
                      {#if config.firewall.rules.length === 0}
                        <EmptyState
                          title={$_('netops.generator.security.emptyFirewallTitle')}
                          description={$_('netops.generator.security.emptyFirewallDescription')}
                          actionLabel={$_('netops.generator.security.addFirewallRule')}
                          onAction={openFirewallModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.chain')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.protocol')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.source')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.destination')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.port')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.action')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.firewall.rules as rule, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">
                                    <select class="select-base" bind:value={rule.chain}>
                                      <option value="input">input</option>
                                      <option value="forward">forward</option>
                                      <option value="output">output</option>
                                    </select>
                                  </td>
                                  <td class="py-2 pr-2">
                                    <select class="select-base" bind:value={rule.protocol}>
                                      <option value="tcp">tcp</option>
                                      <option value="udp">udp</option>
                                      <option value="icmp">icmp</option>
                                      <option value="any">any</option>
                                    </select>
                                  </td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.src} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.dst} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.dstPort} /></td>
                                  <td class="py-2 pr-2">
                                    <select class="select-base" bind:value={rule.action}>
                                      <option value="accept">accept</option>
                                      <option value="drop">drop</option>
                                      <option value="reject">reject</option>
                                      <option value="log">log</option>
                                    </select>
                                  </td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeFirewallRule(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.security.natRules')}</div>
                        <Button size="sm" onclick={openNatModal}>{$_('netops.generator.security.addNatRule')}</Button>
                      </div>
                      {#if config.nat.rules.length === 0}
                        <EmptyState
                          title={$_('netops.generator.security.emptyNatTitle')}
                          description={$_('netops.generator.security.emptyNatDescription')}
                          actionLabel={$_('netops.generator.security.addNatRule')}
                          onAction={openNatModal}
                        />
                      {:else}
                        <div class="overflow-x-auto">
                          <table class="min-w-full text-xs">
                            <thead class="text-slate-500 uppercase text-[10px]">
                              <tr>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.natType')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.source')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.destination')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.translate')}</th>
                                <th class="py-2 pr-2 text-left">{$_('netops.generator.security.interface')}</th>
                                <th class="py-2 text-right">{$_('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each config.nat.rules as rule, index}
                                <tr class="border-t border-slate-700">
                                  <td class="py-2 pr-2">
                                    <select class="select-base" bind:value={rule.type}>
                                      <option value="snat">SNAT</option>
                                      <option value="dnat">DNAT</option>
                                      <option value="masquerade">Masquerade</option>
                                    </select>
                                  </td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.src} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.dst} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.toAddress} /></td>
                                  <td class="py-2 pr-2"><input class="input-base w-full" bind:value={rule.outInterface} /></td>
                                  <td class="py-2 text-right">
                                    <Button size="sm" variant="secondary" onclick={() => removeNatRule(index)}>{$_('common.remove')}</Button>
                                  </td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.services.title')}
                description={$_('netops.generator.services.description')}
                icon={ShieldCheck}
                badge={servicesConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={servicesConfigured ? 'success' : 'neutral'}
                open={servicesOpen}
                onToggle={() => (servicesOpen = !servicesOpen)}
              >
                <div class="grid md:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.services.ssh.enabled} />
                      <span class="text-sm font-semibold">{$_('netops.generator.services.sshEnabled')}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 items-center">
                      <div class="space-y-1">
                        <label class="label-base">{$_('netops.generator.services.sshVersion')}</label>
                        <select
                          class="select-base"
                          value={config.services.ssh.version}
                          onchange={(e) => {
                            const version = Number((e.target as HTMLSelectElement).value) as 1 | 2;
                            config = { ...config, services: { ...config.services, ssh: { ...config.services.ssh, version } } };
                          }}
                        >
                          <option value={1}>v1</option>
                          <option value={2}>v2</option>
                        </select>
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={config.services.ssh.allowPassword} />
                        <span>{$_('netops.generator.services.allowPassword')}</span>
                      </div>
                    </div>
                    {#if config.services.ssh.allowPassword}
                      <WarningBadge label={$_('netops.generator.services.passwordWarning')} tone="warning" />
                    {/if}
                  </div>
                  <div class="space-y-3">
                    <div>
                      <label class="label-base">{$_('netops.generator.services.ntpServers')}</label>
                      <div class="flex gap-2">
                        <input class="input-base" bind:value={ntpInput} placeholder="1.pool.ntp.org" />
                        <Button size="sm" onclick={handleAddNtp}>{$_('common.add')}</Button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        {#each config.services.ntpServers as server, index}
                          <span class="badge-primary cursor-pointer" onclick={() => removeService('ntpServers', index)}>{server}</span>
                        {/each}
                      </div>
                    </div>
                    <div>
                      <label class="label-base">{$_('netops.generator.services.dnsServers')}</label>
                      <div class="flex gap-2">
                        <input class="input-base" bind:value={dnsInput} placeholder="8.8.8.8" />
                        <Button size="sm" onclick={handleAddDns}>{$_('common.add')}</Button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        {#each config.services.dnsServers as server, index}
                          <span class="badge-primary cursor-pointer" onclick={() => removeService('dnsServers', index)}>{server}</span>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              </ConfigStep>

              <ConfigStep
                title={$_('netops.generator.network.title')}
                description={$_('netops.generator.network.description')}
                icon={Network}
                badge={networkConfigured ? $_('netops.generator.step.configured') : $_('netops.generator.step.empty')}
                badgeTone={networkConfigured ? 'success' : 'neutral'}
                open={networkOpen}
                onToggle={() => (networkOpen = !networkOpen)}
              >
                <div class="space-y-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-semibold">{$_('netops.generator.network.vlans')}</div>
                      <Button size="sm" onclick={openVlanModal}>{$_('netops.generator.network.addVlan')}</Button>
                    </div>
                    {#if config.vlans.length === 0}
                      <EmptyState
                        title={$_('netops.generator.network.emptyVlansTitle')}
                        description={$_('netops.generator.network.emptyVlansDescription')}
                        actionLabel={$_('netops.generator.network.addVlan')}
                        onAction={openVlanModal}
                      />
                    {:else}
                      <div class="overflow-x-auto">
                        <table class="min-w-full text-xs">
                          <thead class="text-slate-500 uppercase text-[10px]">
                            <tr>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.vlanId')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.vlanName')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.vlanSubnet')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.vlanGateway')}</th>
                              <th class="py-2 text-right">{$_('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each config.vlans as vlan, index}
                              <tr class="border-t border-slate-700">
                                <td class="py-2 pr-2"><input class="input-base w-full" type="number" bind:value={vlan.id} /></td>
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={vlan.name} /></td>
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={vlan.subnet} /></td>
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={vlan.gateway} /></td>
                                <td class="py-2 text-right">
                                  <Button size="sm" variant="secondary" onclick={() => removeVlan(index)}>{$_('common.remove')}</Button>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {/if}
                  </div>

                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-semibold">{$_('netops.generator.network.interfaces')}</div>
                      <Button size="sm" onclick={openInterfaceModal}>{$_('netops.generator.network.addInterface')}</Button>
                    </div>
                    {#if config.interfaces.length === 0}
                      <EmptyState
                        title={$_('netops.generator.network.emptyInterfacesTitle')}
                        description={$_('netops.generator.network.emptyInterfacesDescription')}
                        actionLabel={$_('netops.generator.network.addInterface')}
                        onAction={openInterfaceModal}
                      />
                    {:else}
                      <div class="overflow-x-auto">
                        <table class="min-w-full text-xs">
                          <thead class="text-slate-500 uppercase text-[10px]">
                            <tr>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.interfaceName')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.interfaceRole')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.interfaceIp')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.interfaceMask')}</th>
                              <th class="py-2 pr-2 text-left">{$_('netops.generator.network.interfaceVlan')}</th>
                              <th class="py-2 text-right">{$_('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each config.interfaces as iface, index}
                              <tr class="border-t border-slate-700">
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={iface.name} /></td>
                                <td class="py-2 pr-2">
                                  <select class="select-base" bind:value={iface.role}>
                                    <option value="uplink">{$_('netops.generator.network.roleUplink')}</option>
                                    <option value="access">{$_('netops.generator.network.roleAccess')}</option>
                                  </select>
                                </td>
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={iface.ipAddress} /></td>
                                <td class="py-2 pr-2"><input class="input-base w-full" bind:value={iface.subnetMask} /></td>
                                <td class="py-2 pr-2"><input class="input-base w-full" type="number" bind:value={iface.vlanId} /></td>
                                <td class="py-2 text-right">
                                  <Button size="sm" variant="secondary" onclick={() => removeInterface(index)}>{$_('common.remove')}</Button>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {/if}
                  </div>

                </div>
              </ConfigStep>
            </div>

            <SummaryPanel title={$_('netops.generator.summary.title')} subtitle={$_('netops.generator.summary.subtitle')}>
              <div class="space-y-3">
                <div>
                  <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.summary.config')}</p>
                  <div class="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div class="text-slate-500">{$_('netops.generator.summary.device')}</div>
                    <div class="font-semibold text-slate-200">{summaryDevice || $_('netops.generator.summary.unselected')}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.vendor')}</div>
                    <div class="font-semibold text-slate-200">{summaryVendor}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.environment')}</div>
                    <div class="font-semibold text-slate-200">{summaryEnvironment}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.vlans')}</div>
                    <div class="font-semibold text-slate-200">{vlanCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.interfaces')}</div>
                    <div class="font-semibold text-slate-200">{interfaceCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.routes')}</div>
                    <div class="font-semibold text-slate-200">{routeCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.ospf')}</div>
                    <div class="font-semibold text-slate-200">{ospfCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.bgp')}</div>
                    <div class="font-semibold text-slate-200">{bgpNeighborCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.firewallRules')}</div>
                    <div class="font-semibold text-slate-200">{firewallRuleCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.natRules')}</div>
                    <div class="font-semibold text-slate-200">{natRuleCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.vpn')}</div>
                    <div class="font-semibold text-slate-200">{vpnCount}</div>
                    <div class="text-slate-500">{$_('netops.generator.summary.qos')}</div>
                    <div class="font-semibold text-slate-200">{qosCount}</div>
                  </div>
                </div>

                <div class="space-y-2">
                  <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.summary.safety')}</p>
                  <div class="flex items-center gap-2">
                    <span class={riskSummary.level === 'HIGH' ? 'badge-error' : riskSummary.level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}>
                      {$_('netops.generator.risk.level')} {riskSummary.level}
                    </span>
                    <span class="text-xs text-slate-500">{$_('netops.generator.risk.subtitle')}</span>
                  </div>
                  {#if riskSummary.items.length === 0}
                    <WarningBadge label={$_('netops.generator.risk.none')} tone="success" />
                  {:else}
                    <div class="flex flex-wrap gap-2">
                      {#each riskSummary.items as item}
                        <WarningBadge label={$_(item.labelKey)} tone={riskTone(item.level)} />
                      {/each}
                    </div>
                  {/if}
                  {#if okItems.length > 0}
                    <div class="flex flex-wrap gap-2">
                      {#each okItems as item}
                        <WarningBadge label={$_(item)} tone="success" />
                      {/each}
                    </div>
                  {/if}
                </div>

                {#if guardrailResult.issues.length > 0}
                  <div class="space-y-2">
                    <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.guardrails.title')}</p>
                    <div class="space-y-2">
                      {#each guardrailResult.issues as issue}
                        <div class={issue.level === 'block' ? 'alert alert-error' : 'alert alert-warning'}>
                          {$_('netops.generator.guardrails.detected')} {issue.pattern} • {issue.command}
                        </div>
                      {/each}
                    </div>
                    {#if guardrailBlocked}
                      <Button size="sm" variant="secondary" onclick={() => (showGuardrailModal = true)}>
                        {$_('netops.generator.guardrails.override')}
                      </Button>
                    {:else if guardrailOverride}
                      <WarningBadge label={$_('netops.generator.guardrails.overridden')} tone="warning" />
                    {/if}
                  </div>
                {/if}

                {#if approvalRequired}
                  <div class="space-y-2">
                    <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.approval.title')}</p>
                    <div class="flex items-center gap-2">
                      <span class={approvalStatus === 'approved' ? 'badge-success' : approvalStatus === 'rejected' ? 'badge-error' : approvalStatus === 'pending' ? 'badge-warning' : 'badge-info'}>
                        {$_(`netops.generator.approval.status.${approvalStatus}`)}
                      </span>
                      <span class="text-xs text-slate-500">{$_('netops.generator.approval.help')}</span>
                    </div>
                    {#if approvalStatus === 'none'}
                      <div class="space-y-2">
                        <textarea class="textarea-base" rows={2} bind:value={approvalReason} placeholder={$_('netops.generator.approval.reasonPlaceholder')}></textarea>
                        <Button size="sm" onclick={requestApproval}>{$_('netops.generator.approval.request')}</Button>
                      </div>
                    {:else if approvalStatus === 'pending'}
                      <div class="flex flex-wrap gap-2">
                        <Button size="sm" onclick={() => handleApprovalDecision('approved')}>{$_('netops.generator.approval.approve')}</Button>
                        <Button size="sm" variant="secondary" onclick={() => handleApprovalDecision('rejected')}>{$_('netops.generator.approval.reject')}</Button>
                      </div>
                    {/if}
                    {#if currentApproval}
                      <div class="text-xs text-slate-500">
                        {$_('netops.generator.approval.requestedBy')} {currentApproval.requestedBy || $_('common.system')} • {new Date(currentApproval.requestedAt).toLocaleString()}
                      </div>
                      {#if currentApproval.decidedAt}
                        <div class="text-xs text-slate-500">
                          {$_('netops.generator.approval.decidedBy')} {currentApproval.approvedBy || $_('common.system')} • {new Date(currentApproval.decidedAt).toLocaleString()}
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/if}

                <div class="space-y-2">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.generator.summary.output')}</p>
                    <div class="flex flex-wrap gap-2">
                      {#each tabs as tab}
                        <button
                          class="px-2 py-1 rounded-lg text-xs font-semibold {activeTab === tab.id ? 'bg-blue-900/50 text-blue-100' : 'text-slate-300 hover:bg-slate-800'}"
                          onclick={() => (activeTab = tab.id)}
                        >
                          {$_(tab.labelKey)}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <div class="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={playbookMode} />
                      <span>{$_('netops.generator.playbook.toggle')}</span>
                    </div>
                    {#if playbookMode}
                      <select class="select-base" bind:value={playbookType}>
                        <option value="bootstrap">{$_('netops.generator.playbook.bootstrap')}</option>
                        <option value="hardening">{$_('netops.generator.playbook.hardening')}</option>
                        <option value="maintenance">{$_('netops.generator.playbook.maintenance')}</option>
                        <option value="rollback">{$_('netops.generator.playbook.rollback')}</option>
                      </select>
                    {/if}
                  </div>

                  {#if pipelineStatus}
                    <div class="alert alert-info">{pipelineStatus}</div>
                  {/if}

                  {#if activeTab === 'generate'}
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-semibold text-slate-200">{$_('netops.generator.preview.title')}</div>
                      <Button size="sm" variant="secondary" onclick={() => (showPreview = !showPreview)}>
                        {showPreview ? $_('common.hide') : $_('common.show')}
                      </Button>
                    </div>
                    {#if showPreview}
                      <CodePreview
                        title={$_('netops.generator.preview.title')}
                        copyLabel={$_('common.copy')}
                        code={previewOutput}
                        emptyMessage={$_('netops.generator.preview.empty')}
                      />
                    {:else}
                      <EmptyState
                        title={$_('netops.generator.preview.hiddenTitle')}
                        description={$_('netops.generator.preview.hiddenDescription')}
                        actionLabel={$_('common.show')}
                        onAction={() => (showPreview = true)}
                      />
                    {/if}
                    {#if generateResult && generateResult.commands.length > 0}
                      <div class="space-y-2">
                        <label class="label-base">{$_('netops.generator.explain.title')}</label>
                        <select class="select-base" bind:value={selectedExplainCommand}>
                          <option value="">{$_('netops.generator.explain.placeholder')}</option>
                          {#each generateResult.commands as command}
                            <option value={command}>{command}</option>
                          {/each}
                        </select>
                        {#if selectedExplainCommand}
                          <div class="alert alert-info">{explainCommand(selectedExplainCommand)}</div>
                        {/if}
                      </div>
                    {/if}
                  {:else if activeTab === 'lint'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.lint.title')}</div>
                        <Button variant="secondary" size="sm" onclick={runLint}>{$_('netops.generator.lint.run')}</Button>
                      </div>
                      {#if lintFindings.length === 0}
                        <EmptyState
                          title={$_('netops.generator.lint.emptyTitle')}
                          description={$_('netops.generator.lint.emptyDescription')}
                          actionLabel={$_('netops.generator.lint.run')}
                          onAction={runLint}
                        />
                      {:else}
                        {#each lintFindings as finding}
                          <div class="border border-slate-700 rounded-lg p-2 text-xs">
                            <div class="flex items-center gap-2">
                              <span class={finding.severity === 'error' ? 'badge-error' : finding.severity === 'warn' ? 'badge-warning' : 'badge-primary'}>{finding.severity}</span>
                              <span class="font-semibold">{finding.message}</span>
                            </div>
                            {#if finding.suggestion}
                              <div class="text-xs text-slate-500">{$_('netops.generator.lint.suggestion')} {finding.suggestion}</div>
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {:else if activeTab === 'validate'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.validation.title')}</div>
                        <Button variant="secondary" size="sm" onclick={runValidation}>{$_('netops.generator.validation.run')}</Button>
                      </div>
                      {#if validationFindings.length === 0}
                        <EmptyState
                          title={$_('netops.generator.validation.emptyTitle')}
                          description={$_('netops.generator.validation.emptyDescription')}
                          actionLabel={$_('netops.generator.validation.run')}
                          onAction={runValidation}
                        />
                      {:else}
                        {#each validationFindings as finding}
                          <div class="border border-slate-700 rounded-lg p-2 text-xs">
                            <div class="flex items-center gap-2">
                              <span class={finding.severity === 'error' ? 'badge-error' : finding.severity === 'warn' ? 'badge-warning' : 'badge-primary'}>
                                {finding.severity}
                              </span>
                              <span class="font-semibold">{finding.message}</span>
                            </div>
                            {#if finding.suggestion}
                              <div class="text-xs text-slate-500">{$_('netops.generator.validation.suggestion')} {finding.suggestion}</div>
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {:else if activeTab === 'diff'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold">{$_('netops.generator.diff.title')}</div>
                        <Button variant="secondary" size="sm" onclick={runDiff}>{$_('netops.generator.diff.refresh')}</Button>
                      </div>
                      {#if diffLines.length === 0}
                        <EmptyState
                          title={$_('netops.generator.diff.emptyTitle')}
                          description={$_('netops.generator.diff.empty')}
                          actionLabel={$_('netops.generator.diff.refresh')}
                          onAction={runDiff}
                        />
                      {:else}
                        <div class="text-xs bg-slate-900 text-slate-100 rounded-md p-3 whitespace-pre-wrap font-mono space-y-1">
                          {#each diffLines as line}
                            {#if line.type !== 'same'}
                              <div class={line.type === 'add' ? 'text-emerald-300' : line.type === 'remove' ? 'text-rose-300' : 'text-amber-300'}>
                                {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '~ '}
                                {line.text}
                              </div>
                            {/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else if activeTab === 'dry-run'}
                    <div class="space-y-2">
                      <div class="text-sm font-semibold">{$_('netops.generator.dryRun.title')}</div>
                      <CodePreview
                        title={$_('netops.generator.dryRun.verify')}
                        copyLabel={$_('common.copy')}
                        code={generateResult ? generateResult.verifyCommands.join('\\n') : ''}
                        emptyMessage={$_('netops.generator.dryRun.empty')}
                      />
                    </div>
                  {:else if activeTab === 'push'}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between flex-wrap gap-2">
                        <div class="text-sm font-semibold">{$_('netops.generator.push.title')}</div>
                        <div class="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onclick={openSelectedDeviceSession}>{$_('netops.generator.actions.openSsh')}</Button>
                          <Button size="sm" onclick={pushViaBackend} disabled={!generateResult || guardrailBlocked || approvalBlocked}>
                            {$_('netops.generator.push.backend')}
                          </Button>
                          <Button size="sm" variant="secondary" onclick={pushViaSsh} disabled={!generateResult || guardrailBlocked || approvalBlocked}>
                            {$_('netops.generator.push.ssh')}
                          </Button>
                        </div>
                      </div>
                      {#if pushStatus}
                        <div class="alert alert-info">{pushStatus}</div>
                      {/if}
                      {#if guardrailBlocked}
                        <div class="alert alert-error">{$_('netops.generator.guardrails.blocked')}</div>
                      {/if}
                      {#if approvalBlocked}
                        <div class="alert alert-warning">{$_('netops.generator.approval.blocked')}</div>
                      {/if}
                      <p class="text-xs text-slate-500">{$_('netops.generator.push.help')}</p>
                    </div>
                  {/if}
                </div>
              </div>
            </SummaryPanel>
          </div>

          <Modal bind:open={showProfileModal} size="md" title={$_('netops.generator.profile.saveTitle')}>
            <div class="space-y-3">
              <div>
                <label class="label-base">{$_('netops.generator.profile.name')}</label>
                <input class="input-base" bind:value={profileName} placeholder="Baseline - Branch Router" />
              </div>
              <div class="flex items-center gap-2 text-sm">
                <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={includeHostnameInProfile} />
                <span>{$_('netops.generator.profile.includeHostname')}</span>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showProfileModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={saveProfile} disabled={!profileName.trim()}>{$_('common.save')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showGuardrailModal} size="md" title={$_('netops.generator.guardrails.overrideTitle')}>
            <div class="space-y-3">
              <p class="text-sm text-slate-300">{$_('netops.generator.guardrails.overrideHelp')}</p>
              <div>
                <label class="label-base">{$_('netops.generator.guardrails.reason')}</label>
                <textarea class="textarea-base" rows={3} bind:value={guardrailReason} placeholder={$_('netops.generator.guardrails.reasonPlaceholder')}></textarea>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showGuardrailModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmGuardrailOverride}>{$_('common.confirm')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showVlanModal} size="md" title={$_('netops.generator.modals.vlanTitle')}>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.network.vlanId')}</label>
                  <input class="input-base" type="number" bind:value={vlanDraft.id} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.vlanName')}</label>
                  <input class="input-base" bind:value={vlanDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.vlanSubnet')}</label>
                  <input class="input-base" bind:value={vlanDraft.subnet} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.vlanGateway')}</label>
                  <input class="input-base" bind:value={vlanDraft.gateway} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showVlanModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddVlan}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showInterfaceModal} size="lg" title={$_('netops.generator.modals.interfaceTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceName')}</label>
                  <input class="input-base" bind:value={interfaceDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceRole')}</label>
                  <select class="select-base" bind:value={interfaceDraft.role}>
                    <option value="uplink">{$_('netops.generator.network.roleUplink')}</option>
                    <option value="access">{$_('netops.generator.network.roleAccess')}</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceIp')}</label>
                  <input class="input-base" bind:value={interfaceDraft.ipAddress} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceMask')}</label>
                  <input class="input-base" bind:value={interfaceDraft.subnetMask} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceVlan')}</label>
                  <input class="input-base" type="number" bind:value={interfaceDraft.vlanId} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.interfaceDescription')}</label>
                  <input class="input-base" bind:value={interfaceDraft.description} />
                </div>
                <div class="flex items-center gap-2">
                  <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={interfaceDraft.enabled} />
                  <span class="text-sm">{$_('common.enabled')}</span>
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showInterfaceModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddInterface}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showRouteModal} size="md" title={$_('netops.generator.modals.routeTitle')}>
            <div class="space-y-3">
              <div class="space-y-2">
                <div>
                  <label class="label-base">{$_('netops.generator.network.routeDestination')}</label>
                  <input class="input-base" bind:value={routeDraft.destination} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.routeNetmask')}</label>
                  <input class="input-base" bind:value={routeDraft.netmask} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.network.routeNextHop')}</label>
                  <input class="input-base" bind:value={routeDraft.nextHop} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showRouteModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddRoute}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showOspfModal} size="md" title={$_('netops.generator.modals.ospfTitle')}>
            <div class="space-y-3">
              <div class="space-y-2">
                <div>
                  <label class="label-base">{$_('netops.generator.routing.ospfArea')}</label>
                  <input class="input-base" bind:value={ospfAreaDraft.area} placeholder="0.0.0.0" />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.routing.ospfNetworks')}</label>
                  <textarea class="textarea-base" rows={2} bind:value={ospfAreaDraft.networks} placeholder="10.0.0.0/24, 10.0.1.0/24"></textarea>
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showOspfModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddOspfArea}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showBgpNeighborModal} size="md" title={$_('netops.generator.modals.bgpNeighborTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.routing.bgpNeighbor')}</label>
                  <input class="input-base" bind:value={bgpNeighborDraft.neighbor} placeholder="203.0.113.1" />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.routing.bgpRemoteAs')}</label>
                  <input class="input-base" type="number" bind:value={bgpNeighborDraft.remoteAs} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showBgpNeighborModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddBgpNeighbor}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showBgpNetworkModal} size="md" title={$_('netops.generator.modals.bgpNetworkTitle')}>
            <div class="space-y-3">
              <div>
                <label class="label-base">{$_('netops.generator.routing.bgpNetwork')}</label>
                <input class="input-base" bind:value={bgpNetworkDraft.network} placeholder="10.0.0.0/24" />
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showBgpNetworkModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddBgpNetwork}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showFirewallModal} size="lg" title={$_('netops.generator.modals.firewallTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.security.chain')}</label>
                  <select class="select-base" bind:value={firewallRuleDraft.chain}>
                    <option value="input">input</option>
                    <option value="forward">forward</option>
                    <option value="output">output</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.protocol')}</label>
                  <select class="select-base" bind:value={firewallRuleDraft.protocol}>
                    <option value="tcp">tcp</option>
                    <option value="udp">udp</option>
                    <option value="icmp">icmp</option>
                    <option value="any">any</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.source')}</label>
                  <input class="input-base" bind:value={firewallRuleDraft.src} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.destination')}</label>
                  <input class="input-base" bind:value={firewallRuleDraft.dst} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.port')}</label>
                  <input class="input-base" bind:value={firewallRuleDraft.dstPort} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.action')}</label>
                  <select class="select-base" bind:value={firewallRuleDraft.action}>
                    <option value="accept">accept</option>
                    <option value="drop">drop</option>
                    <option value="reject">reject</option>
                    <option value="log">log</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.security.comment')}</label>
                  <input class="input-base" bind:value={firewallRuleDraft.comment} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showFirewallModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddFirewallRule}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showNatModal} size="lg" title={$_('netops.generator.modals.natTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.security.natType')}</label>
                  <select class="select-base" bind:value={natRuleDraft.type}>
                    <option value="snat">SNAT</option>
                    <option value="dnat">DNAT</option>
                    <option value="masquerade">Masquerade</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.protocol')}</label>
                  <select class="select-base" bind:value={natRuleDraft.protocol}>
                    <option value="tcp">tcp</option>
                    <option value="udp">udp</option>
                    <option value="icmp">icmp</option>
                    <option value="any">any</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.interface')}</label>
                  <input class="input-base" bind:value={natRuleDraft.outInterface} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.source')}</label>
                  <input class="input-base" bind:value={natRuleDraft.src} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.destination')}</label>
                  <input class="input-base" bind:value={natRuleDraft.dst} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.translate')}</label>
                  <input class="input-base" bind:value={natRuleDraft.toAddress} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.security.port')}</label>
                  <input class="input-base" bind:value={natRuleDraft.dstPort} />
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.security.comment')}</label>
                  <input class="input-base" bind:value={natRuleDraft.comment} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showNatModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddNatRule}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showIpsecModal} size="lg" title={$_('netops.generator.modals.ipsecTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.tunnelName')}</label>
                  <input class="input-base" bind:value={ipsecDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.ikeVersion')}</label>
                  <select class="select-base" bind:value={ipsecDraft.ikeVersion}>
                    <option value="v1">v1</option>
                    <option value="v2">v2</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.local')}</label>
                  <input class="input-base" bind:value={ipsecDraft.localAddress} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.remote')}</label>
                  <input class="input-base" bind:value={ipsecDraft.remoteAddress} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.localSubnet')}</label>
                  <input class="input-base" bind:value={ipsecDraft.localSubnet} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.remoteSubnet')}</label>
                  <input class="input-base" bind:value={ipsecDraft.remoteSubnet} />
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.vpn.psk')}</label>
                  <input class="input-base" bind:value={ipsecDraft.preSharedKey} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showIpsecModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddIpsec}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showWireguardModal} size="lg" title={$_('netops.generator.modals.wireguardTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.tunnelName')}</label>
                  <input class="input-base" bind:value={wireguardDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.interfaceAddress')}</label>
                  <input class="input-base" bind:value={wireguardDraft.interfaceAddress} placeholder="10.10.0.1/24" />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.listenPort')}</label>
                  <input class="input-base" type="number" bind:value={wireguardDraft.listenPort} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.privateKey')}</label>
                  <input class="input-base" bind:value={wireguardDraft.privateKey} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.peerPublicKey')}</label>
                  <input class="input-base" bind:value={wireguardDraft.peerPublicKey} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.peerAllowedIps')}</label>
                  <input class="input-base" bind:value={wireguardDraft.peerAllowedIps} placeholder="10.10.1.0/24" />
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.vpn.peerEndpoint')}</label>
                  <input class="input-base" bind:value={wireguardDraft.peerEndpoint} placeholder="198.51.100.10:51820" />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showWireguardModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddWireguard}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showL2tpModal} size="md" title={$_('netops.generator.modals.l2tpTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.tunnelName')}</label>
                  <input class="input-base" bind:value={l2tpDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.local')}</label>
                  <input class="input-base" bind:value={l2tpDraft.localAddress} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.pool')}</label>
                  <input class="input-base" bind:value={l2tpDraft.pool} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.vpn.psk')}</label>
                  <input class="input-base" bind:value={l2tpDraft.preSharedKey} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showL2tpModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddL2tp}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showQosModal} size="md" title={$_('netops.generator.modals.qosTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.qos.name')}</label>
                  <input class="input-base" bind:value={qosDraft.name} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.qos.target')}</label>
                  <input class="input-base" bind:value={qosDraft.target} placeholder="10.0.0.0/24" />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.qos.limit')}</label>
                  <input class="input-base" bind:value={qosDraft.maxLimit} placeholder="10M/10M" />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.qos.priority')}</label>
                  <input class="input-base" type="number" bind:value={qosDraft.priority} />
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.qos.comment')}</label>
                  <input class="input-base" bind:value={qosDraft.comment} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showQosModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddQos}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>

          <Modal bind:open={showSnmpUserModal} size="md" title={$_('netops.generator.modals.snmpUserTitle')}>
            <div class="space-y-3">
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="label-base">{$_('netops.generator.monitoring.snmpUser')}</label>
                  <input class="input-base" bind:value={snmpUserDraft.username} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.monitoring.snmpAuth')}</label>
                  <select class="select-base" bind:value={snmpUserDraft.authProtocol}>
                    <option value="sha">SHA</option>
                    <option value="md5">MD5</option>
                  </select>
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.monitoring.snmpAuthPass')}</label>
                  <input class="input-base" bind:value={snmpUserDraft.authPassword} />
                </div>
                <div>
                  <label class="label-base">{$_('netops.generator.monitoring.snmpPriv')}</label>
                  <select class="select-base" bind:value={snmpUserDraft.privProtocol}>
                    <option value="aes">AES</option>
                    <option value="des">DES</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="label-base">{$_('netops.generator.monitoring.snmpPrivPass')}</label>
                  <input class="input-base" bind:value={snmpUserDraft.privPassword} />
                </div>
              </div>
            </div>
            {#snippet footer()}
              <Button variant="secondary" onclick={() => (showSnmpUserModal = false)}>{$_('common.cancel')}</Button>
              <Button onclick={confirmAddSnmpUser}>{$_('common.add')}</Button>
            {/snippet}
          </Modal>
        </div>
      {:else if activeSection === 'mikrotik-full-config'}
        <MikroTikFullConfigPanel />
      {:else if activeSection === 'ssh-terminal'}
        <div class="card space-y-3 w-full min-w-0">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 class="text-lg font-semibold text-slate-200">{$_('netops.ssh.title')}</h2>
              <p class="text-sm text-slate-500">{$_('netops.ssh.subtitle')}</p>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="secondary" onclick={refreshSessions}><RefreshCw class="w-4 h-4" />{$_('common.refresh')}</Button>
              <Button size="sm" onclick={openSelectedDeviceSession}><Link2 class="w-4 h-4" />{$_('netops.ssh.openSession')}</Button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 w-full min-w-0">
            <div class="space-y-3 min-w-0">
              <div class="card space-y-2">
                <label class="label-base">{$_('netops.ssh.searchDevices')}</label>
                <input class="input-base" bind:value={sshSearch} placeholder={$_('common.search')} />
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  {#each devices.filter((d) => d.name.toLowerCase().includes(sshSearch.toLowerCase())) as device}
                    <button
                      class="w-full text-left px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                      onclick={() => { selectedDeviceId = device.id; openSelectedDeviceSession(); }}
                    >
                      <div class="text-sm font-semibold">{device.name}</div>
                      <div class="text-xs text-slate-500">{device.mgmt_ip}</div>
                    </button>
                  {/each}
                </div>
              </div>

              <div class="card space-y-2">
                <label class="label-base">{$_('netops.ssh.sessions')}</label>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  {#if sshSessions.length === 0}
                    <p class="text-sm text-slate-500">{$_('netops.ssh.noSessions')}</p>
                  {:else}
                    {#each sshSessions as session}
                      <button
                        class={`w-full text-left px-3 py-2 rounded-lg border border-slate-700 ${activeSessionId === session.id ? 'bg-blue-900/40' : ''}`}
                        onclick={() => void selectSshSession(session)}
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-sm font-semibold">{session.deviceName}</span>
                          <span class={session.status === 'connected' ? 'badge-success' : 'badge-error'}>{session.status}</span>
                        </div>
                        <div class="text-xs text-slate-500">{session.user}@{session.host}</div>
                      </button>
                    {/each}
                  {/if}
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onclick={handleCloseSession}>{$_('common.close')}</Button>
                  <Button size="sm" variant="secondary" onclick={() => downloadLog('text')}>{$_('netops.ssh.downloadLog')}</Button>
                  <Button size="sm" variant="secondary" onclick={() => downloadLog('json')}>{$_('netops.ssh.exportJson')}</Button>
                </div>
              </div>

              <div class="card space-y-2">
                <label class="label-base">{$_('netops.ssh.commandPolicy')}</label>
                <textarea
                  class="textarea-base"
                  rows={2}
                  value={sshPolicy.allowList.join('\\n')}
                  placeholder={$_('netops.ssh.policy.allowList')}
                  oninput={(e) => sshPolicy = { ...sshPolicy, allowList: (e.target as HTMLTextAreaElement).value.split('\\n').filter(Boolean) }}
                ></textarea>
                <textarea
                  class="textarea-base"
                  rows={2}
                  value={sshPolicy.denyList.join('\\n')}
                  placeholder={$_('netops.ssh.policy.denyList')}
                  oninput={(e) => sshPolicy = { ...sshPolicy, denyList: (e.target as HTMLTextAreaElement).value.split('\\n').filter(Boolean) }}
                ></textarea>
                <textarea
                  class="textarea-base"
                  rows={2}
                  value={sshPolicy.dangerousList.join('\\n')}
                  placeholder={$_('netops.ssh.policy.dangerList')}
                  oninput={(e) => sshPolicy = { ...sshPolicy, dangerousList: (e.target as HTMLTextAreaElement).value.split('\\n').filter(Boolean) }}
                ></textarea>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldAlert class="w-4 h-4" />
                  {$_('netops.ssh.policy.enforced')}
                </div>
              </div>
            </div>

            <div class="card space-y-3 w-full min-w-0">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div class="text-sm font-semibold text-slate-200">{$_('netops.ssh.liveTerminal')}</div>
                  <div class="text-xs text-slate-500">{$_('netops.ssh.sessionLabel')} {activeSessionId ? activeSessionId : $_('netops.ssh.notConnected')}</div>
                </div>
                {#if activeSessionId}
                  <span class="badge-success">{$_('netops.ssh.connected')}</span>
                {:else}
                  <span class="badge-warning">{$_('netops.ssh.idle')}</span>
                {/if}
              </div>

              {#if sshError}
                <div class="alert alert-error">{sshError}</div>
              {/if}

              <div class="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3 min-w-0">
                <div class="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 text-slate-100 flex flex-col min-h-[60vh]">
                  <div class="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
                    {#if sshLog.length === 0}
                      <p class="text-slate-400">{$_('netops.ssh.noOutput')}</p>
                    {:else}
                      {#each sshLog as line}
                        <div class={line.type === 'error' ? 'text-red-300' : line.type === 'system' ? 'text-blue-300' : ''}>
                          [{new Date(line.timestamp).toLocaleTimeString()}] {line.type.toUpperCase()}: {line.message}
                        </div>
                      {/each}
                    {/if}
                  </div>
                  <div class="border-t border-slate-800 bg-slate-900/80 p-2">
                    <div class="flex gap-2">
                      <input class="input-base flex-1" bind:value={sshCommand} placeholder={$_('netops.ssh.commandPlaceholder')} />
                      <Button size="sm" onclick={handleSendCommand} disabled={sshBusy}><Play class="w-4 h-4" />{$_('netops.ssh.send')}</Button>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="text-xs uppercase tracking-wide text-slate-400 font-semibold">{$_('netops.ssh.history')}</div>
                  <div class="space-y-2 max-h-[380px] overflow-y-auto">
                    {#if commandHistory.length === 0}
                      <p class="text-xs text-slate-500">{$_('netops.ssh.noCommands')}</p>
                    {:else}
                      {#each commandHistory as item}
                        <button
                          class="w-full text-left px-2 py-1 rounded-md border border-slate-700 text-xs hover:bg-slate-800"
                          onclick={() => (sshCommand = item.message)}
                        >
                          <div class="font-mono text-slate-200 truncate">{item.message}</div>
                          <div class="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
                        </button>
                      {/each}
                    {/if}
                  </div>
                  <div class="text-[11px] text-slate-500">{$_('netops.ssh.reuseHint')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if activeSection === 'mermaid'}
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="card space-y-3 w-full">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs uppercase tracking-wide text-blue-600 font-semibold">{$isLoading ? 'Diagram' : $_('tools.diagram')}</p>
                <h3 class="text-lg font-semibold text-slate-200">{$isLoading ? 'Mermaid playground' : $_('tools.mermaidPlayground')}</h3>
              </div>
              <div class="flex gap-2">
                <Button variant="secondary" size="sm" onclick={() => (mermaidInput = mermaidInput.trim())} aria-label="Reset whitespace">
                  <RefreshCw class="w-4 h-4" />
                </Button>
                <Button size="sm" onclick={renderDiagram} disabled={rendering}>
                  <Play class="w-4 h-4" />
                  {rendering ? ($isLoading ? 'Rendering...' : $_('tools.rendering')) : ($isLoading ? 'Render' : $_('tools.render'))}
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="label-base">{$isLoading ? 'Mermaid definition' : $_('tools.mermaidDefinition')}</label>
              <textarea class="textarea-base font-mono text-xs" rows={10} bind:value={mermaidInput}></textarea>
            </div>

            {#if mermaidError}
              <div class="alert alert-error">{mermaidError}</div>
            {/if}

            <div class="border rounded-lg bg-slate-900/60 p-3 min-h-[200px]">
              {#if mermaidSvg}
                <div class="mermaid">{@html mermaidSvg}</div>
              {:else}
                <p class="text-sm text-slate-500">{$isLoading ? 'Render to preview your diagram.' : $_('tools.renderPreview')}</p>
              {/if}
            </div>
          </div>

          <div class="card space-y-3 w-full">
            <div class="flex items-center gap-2">
              <Terminal class="w-4 h-4 text-blue-600" />
              <div>
                <p class="text-xs uppercase tracking-wide text-blue-600 font-semibold">{$isLoading ? 'Quick help' : $_('tools.quickHelp')}</p>
                <h3 class="text-lg font-semibold text-slate-200">{$isLoading ? 'Mermaid tips' : $_('tools.mermaidTips')}</h3>
                <p class="text-xs text-slate-400">{$isLoading ? 'Use subgraphs, links, and styles to keep diagrams readable.' : $_('tools.tipsDescription')}</p>
              </div>
            </div>
            <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>{$isLoading ? 'Group flows with subgraph blocks.' : $_('tools.mermaidTipsList.subgraph')}</li>
              <li>{$isLoading ? 'Align left-to-right with flowchart LR or top-down with TD.' : $_('tools.mermaidTipsList.flow')}</li>
              <li>{$isLoading ? 'Use style for emphasis and linkStyle for edges.' : $_('tools.mermaidTipsList.style')}</li>
            </ul>
          </div>
        </div>
      {:else if activeSection === 'field-kit'}
        <FieldKitPanel devices={devices} sshPolicy={sshPolicy} />
      {/if}
  </div>
</div>

<style>
  :global(.mermaid) {
    display: block;
  }
</style>
