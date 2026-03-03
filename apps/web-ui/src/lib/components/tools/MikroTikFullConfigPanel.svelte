<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Download, Play, Plus, RefreshCw, ShieldAlert } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { devicesApi } from '$lib/netops/api/netopsApi';
  import type { Device } from '$lib/netops/types';
  import PageHeader from '$lib/components/tools/PageHeader.svelte';
  import SummaryPanel from '$lib/components/tools/SummaryPanel.svelte';
  import CodePreview from '$lib/components/tools/CodePreview.svelte';
  import EmptyState from '$lib/components/tools/EmptyState.svelte';
  import WarningBadge from '$lib/components/tools/WarningBadge.svelte';
  import {
    diffMikrotikRunningConfig,
    generateMikrotikFullConfig,
    pushMikrotikConfigSsh,
    type MikroTikDiffOutput,
    type MikroTikEnvironment,
    type MikroTikFullConfigIntent,
    type MikroTikFullConfigOutput,
    type MikroTikIntentInterface,
    type MikroTikIntentStaticRoute,
    type MikroTikIntentVlan,
    type MikroTikRoleTemplate,
    type MikroTikSecurityPreset
  } from '$lib/tools/mikrotik/service';

  type WizardStep = 'device' | 'network' | 'routing' | 'preview';

  const steps: Array<{ id: WizardStep; labelKey: string }> = [
    { id: 'device', labelKey: 'netops.mikrotik.steps.device' },
    { id: 'network', labelKey: 'netops.mikrotik.steps.network' },
    { id: 'routing', labelKey: 'netops.mikrotik.steps.routing' },
    { id: 'preview', labelKey: 'netops.mikrotik.steps.preview' }
  ];

  let step = $state<WizardStep>('device');

  let userRole = $state('');

  let devices = $state<Device[]>([]);
  let deviceLoading = $state(false);
  let deviceError = $state('');

  let selectedDeviceId = $state('');
  const selectedDevice = $derived.by(() => devices.find((d) => d.id === selectedDeviceId) || null);

  let role = $state<MikroTikRoleTemplate>('edge-internet');
  let environment = $state<MikroTikEnvironment>('dev');
  let securityPreset = $state<MikroTikSecurityPreset>('hospital-secure');
  let labMode = $state(false);

  let hostname = $state('');
  let routerOsVersion = $state('7.0.0');
  let model = $state('MikroTik');

  // Management / day-0
  let mgmtSubnet = $state('');
  let allowedSubnetsText = $state('');
  let sshPort = $state(22);
  let sshAllowPassword = $state(false);
  let sshAuthorizedKeysText = $state('');
  let winboxEnabled = $state(true);
  let winboxPort = $state(8291);
  let dnsAllowRemoteRequests = $state(false);
  let timezone = $state('Asia/Ho_Chi_Minh');
  let ntpServersText = $state('');
  let syslogRemote = $state('');
  let snmpEnabled = $state(false);
  let snmpCommunity = $state('public');
  let snmpAllowedSubnet = $state('');

  // Interfaces / VLAN
  let interfaces = $state<MikroTikIntentInterface[]>([]);
  let vlans = $state<MikroTikIntentVlan[]>([]);

  // Modals
  let showInterfaceModal = $state(false);
  let showVlanModal = $state(false);
  let showRouteModal = $state(false);

  let interfaceDraft = $state<{
    name: string;
    purpose: MikroTikIntentInterface['purpose'];
    comment: string;
    accessVlanId: string;
    trunkVlanIds: string;
  }>({ name: '', purpose: 'wan', comment: '', accessVlanId: '', trunkVlanIds: '' });

  let vlanDraft = $state<{
    id: number;
    name: string;
    subnet: string;
    gateway: string;
    group: MikroTikIntentVlan['group'] | '';
    dhcpEnabled: boolean;
  }>({ id: 10, name: 'mgmt', subnet: '', gateway: '', group: 'MGMT', dhcpEnabled: false });

  // Routing
  let staticRoutes = $state<MikroTikIntentStaticRoute[]>([]);
  let routeDraft = $state<MikroTikIntentStaticRoute>({ dst: '', gateway: '' });

  let publicType = $state<'dhcp' | 'static' | 'pppoe'>('dhcp');
  let wanInterface = $state('');
  let wanAddress = $state('');
  let wanGateway = $state('');
  let pppoeUser = $state('');
  let pppoePassword = $state('');
  let dnsServersText = $state('');

  let ospfEnabled = $state(false);
  let ospfRouterId = $state('');
  let ospfArea = $state('0.0.0.0');
  let ospfNetworksText = $state('');
  let ospfPassiveText = $state('');

  // Output
  let generating = $state(false);
  let generateError = $state('');
  let output = $state<MikroTikFullConfigOutput | null>(null);

  // Optional diff
  let runningConfig = $state('');
  let diff = $state<MikroTikDiffOutput | null>(null);
  let diffError = $state('');

  const isPrivileged = $derived.by(() => userRole === 'admin' || userRole === 'super_admin');

  const interfaceNames = $derived.by(() => interfaces.map((i) => i.name).filter(Boolean));
  const canGenerate = $derived.by(() => hostname.trim().length > 0 && mgmtSubnet.trim().length > 0 && interfaces.length > 0);

  const summary = $derived.by(() => ({
    device: selectedDevice?.name || '',
    vendor: 'MikroTik',
    environment,
    role,
    vlans: vlans.length,
    interfaces: interfaces.length,
    routes: staticRoutes.length
  }));

  function parseRouterOsMajor(version: string): number {
    const match = version.trim().match(/^(\\d+)/);
    const major = match ? Number(match[1]) : 7;
    return major >= 7 ? 7 : 6;
  }

  function parseLines(value: string): string[] {
    return value
      .split(/\\r?\\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseCommaNumbers(value: string): number[] | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numbers = trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
    return numbers.length ? numbers : undefined;
  }

  function buildIntent(): MikroTikFullConfigIntent {
    const deviceModel = model.trim() || selectedDevice?.model || 'MikroTik';
    const version = routerOsVersion.trim() || selectedDevice?.os_version || '7.0.0';

    const sshKeys = parseLines(sshAuthorizedKeysText);
    const allowed = parseLines(allowedSubnetsText);
    const dnsServers = parseLines(dnsServersText);
    const ntpServers = parseLines(ntpServersText);

    const intent: MikroTikFullConfigIntent = {
      device: {
        model: deviceModel,
        routerOsMajor: parseRouterOsMajor(version),
        routerOsVersion: version
      },
      role,
      hostname: hostname.trim(),
      environment,
      labMode,
      interfaces,
      vlans: vlans.length ? vlans : undefined,
      routing: {
        staticRoutes: staticRoutes.length ? staticRoutes : undefined,
        ospf: ospfEnabled
          ? {
              enabled: true,
              routerId: ospfRouterId.trim() || undefined,
              area: ospfArea.trim() || undefined,
              networks: parseLines(ospfNetworksText),
              passiveInterfaces: parseLines(ospfPassiveText)
            }
          : undefined
      },
      securityProfile: { preset: securityPreset },
      management: {
        mgmtSubnet: mgmtSubnet.trim(),
        allowedSubnets: allowed.length ? allowed : undefined,
        ssh: {
          port: sshPort,
          allowPassword: sshAllowPassword,
          authorizedKeys: sshKeys.length ? sshKeys : undefined
        },
        winbox: {
          enabled: winboxEnabled,
          port: winboxPort
        },
        dnsAllowRemoteRequests,
        timezone: timezone.trim() || undefined,
        ntpServers: ntpServers.length ? ntpServers : undefined,
        syslog: syslogRemote.trim()
          ? {
              remote: syslogRemote.trim()
            }
          : undefined,
        snmp: snmpEnabled
          ? {
              enabled: true,
              community: snmpCommunity.trim() || undefined,
              allowedSubnet: snmpAllowedSubnet.trim() || undefined
            }
          : undefined
      },
      notes: selectedDevice?.id ? `deviceId=${selectedDevice.id}` : undefined
    };

    if (wanInterface.trim()) {
      if (publicType === 'dhcp') {
        intent.internet = {
          wanInterface: wanInterface.trim(),
          publicType: 'dhcp',
          dnsServers: dnsServers.length ? dnsServers : undefined
        };
      } else if (publicType === 'static') {
        intent.internet = {
          wanInterface: wanInterface.trim(),
          publicType: 'static',
          address: wanAddress.trim(),
          gateway: wanGateway.trim(),
          dnsServers: dnsServers.length ? dnsServers : undefined
        };
      } else {
        intent.internet = {
          wanInterface: wanInterface.trim(),
          publicType: 'pppoe',
          username: pppoeUser.trim(),
          password: pppoePassword,
          dnsServers: dnsServers.length ? dnsServers : undefined
        };
      }
    }

    return intent;
  }

  async function loadDevices() {
    deviceLoading = true;
    deviceError = '';
    try {
      devices = await devicesApi.list({ vendor: 'mikrotik' });
    } catch (error) {
      deviceError = error instanceof Error ? error.message : String(error);
    } finally {
      deviceLoading = false;
    }
  }

  function applyDeviceDefaults(device: Device) {
    hostname = hostname || device.name;
    routerOsVersion = routerOsVersion || device.os_version || '7.0.0';
    model = device.model || model;
  }

  function resetOutput() {
    generateError = '';
    output = null;
    diff = null;
    diffError = '';
  }

  function addInterfaceFromDraft() {
    const name = interfaceDraft.name.trim();
    if (!name) return;
    const newInterface: MikroTikIntentInterface = {
      name,
      purpose: interfaceDraft.purpose,
      comment: interfaceDraft.comment.trim() || undefined,
      accessVlanId: interfaceDraft.accessVlanId.trim() ? Number(interfaceDraft.accessVlanId) : undefined,
      trunkVlanIds: parseCommaNumbers(interfaceDraft.trunkVlanIds)
    };
    interfaces = [...interfaces, newInterface];
    interfaceDraft = { name: '', purpose: 'wan', comment: '', accessVlanId: '', trunkVlanIds: '' };
    showInterfaceModal = false;
  }

  function removeInterface(name: string) {
    interfaces = interfaces.filter((i) => i.name !== name);
    if (wanInterface === name) wanInterface = '';
  }

  function addVlanFromDraft() {
    const name = vlanDraft.name.trim();
    if (!name || !vlanDraft.subnet.trim() || !vlanDraft.gateway.trim()) return;
    const newVlan: MikroTikIntentVlan = {
      id: vlanDraft.id,
      name,
      subnet: vlanDraft.subnet.trim(),
      gateway: vlanDraft.gateway.trim(),
      group: vlanDraft.group || undefined,
      dhcp: vlanDraft.dhcpEnabled ? { enabled: true } : undefined
    };
    vlans = [...vlans, newVlan];
    vlanDraft = { id: vlanDraft.id + 10, name: '', subnet: '', gateway: '', group: '', dhcpEnabled: false };
    showVlanModal = false;
  }

  function removeVlan(id: number) {
    vlans = vlans.filter((v) => v.id !== id);
  }

  function addRouteFromDraft() {
    const dst = routeDraft.dst.trim();
    const gateway = routeDraft.gateway.trim();
    if (!dst || !gateway) return;
    staticRoutes = [...staticRoutes, { ...routeDraft, dst, gateway }];
    routeDraft = { dst: '', gateway: '' };
    showRouteModal = false;
  }

  function removeRoute(dst: string) {
    staticRoutes = staticRoutes.filter((r) => r.dst !== dst);
  }

  async function runGenerate() {
    if (!canGenerate) return;
    generating = true;
    resetOutput();
    try {
      const intent = buildIntent();
      output = await generateMikrotikFullConfig(intent);
      step = 'preview';
    } catch (error) {
      generateError = error instanceof Error ? error.message : String(error);
    } finally {
      generating = false;
    }
  }

  async function runDiff() {
    if (!output?.config || !runningConfig.trim()) return;
    diffError = '';
    diff = null;
    try {
      diff = await diffMikrotikRunningConfig({ runningConfig, desiredConfig: output.config });
    } catch (error) {
      diffError = error instanceof Error ? error.message : String(error);
    }
  }

  function downloadScript(kind: 'apply' | 'rollback') {
    const text = kind === 'apply' ? output?.config : output?.rollback;
    if (!text) return;
    const filename = `${hostname || 'mikrotik'}-${kind}.rsc`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pushDryRun() {
    if (!output?.config || !isPrivileged) return;
    try {
      const result = await pushMikrotikConfigSsh({
        target: {
          host: selectedDevice?.mgmt_ip || '127.0.0.1',
          user: 'admin'
        },
        auth: { type: 'key' },
        config: output.config,
        dryRun: true,
        environment
      });
      generateError = JSON.stringify(result, null, 2);
    } catch (error) {
      generateError = error instanceof Error ? error.message : String(error);
    }
  }

  onMount(async () => {
    userRole = localStorage.getItem('userRole') || '';
    await loadDevices();
  });
</script>

<div class="space-y-4">
  <PageHeader title={$_('netops.mikrotik.title')} subtitle={$_('netops.mikrotik.subtitle')} sticky>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-700 pb-2">
      {#each steps as item}
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent {step === item.id ? 'bg-blue-900/50 text-blue-100 border-blue-900' : 'text-slate-300 hover:bg-slate-800'}"
          onclick={() => (step = item.id)}
        >
          {$isLoading ? item.id : $_(item.labelKey)}
        </button>
      {/each}
      <div class="flex-1"></div>
      <Button size="sm" variant="secondary" onclick={loadDevices} disabled={deviceLoading}>
        {#snippet leftIcon()}<RefreshCw class="w-4 h-4" />{/snippet}
        {$_('common.refresh')}
      </Button>
      <Button size="sm" variant="primary" onclick={runGenerate} disabled={!canGenerate || generating}>
        {#snippet leftIcon()}<Play class="w-4 h-4" />{/snippet}
        {generating ? $_('common.loading') : $_('netops.mikrotik.actions.generate')}
      </Button>
    </div>
    {#if !canGenerate}
      <p class="text-xs text-amber-600">{$_('netops.mikrotik.requirements')}</p>
    {/if}
  </PageHeader>

  {#if deviceError}
    <div class="alert alert-error">{deviceError}</div>
  {/if}

  {#if generateError}
    <div class="alert alert-error">
      <pre class="text-xs whitespace-pre-wrap">{generateError}</pre>
    </div>
  {/if}

  <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div class="space-y-4 min-w-0">
      {#if step === 'device'}
        <div class="card space-y-4 w-full min-w-0">
          <div class="grid gap-3 lg:grid-cols-3 items-end">
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.device')}</label>
              <select
                class="select-base"
                bind:value={selectedDeviceId}
                disabled={deviceLoading}
                onchange={(e) => {
                  const id = (e.target as HTMLSelectElement).value;
                  const device = devices.find((d) => d.id === id);
                  if (device) applyDeviceDefaults(device);
                }}
              >
                <option value="">{$_('common.chooseOption')}</option>
                {#each devices as d}
                  <option value={d.id}>{d.name} · {d.mgmt_ip}</option>
                {/each}
              </select>
              <p class="text-xs text-slate-400">{$_('netops.mikrotik.deviceHelp')}</p>
            </div>
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.role')}</label>
              <select class="select-base" bind:value={role}>
                <option value="edge-internet">edge-internet</option>
                <option value="core-router">core-router</option>
                <option value="distribution-l3">distribution-l3</option>
                <option value="access-switch-crs">access-switch-crs</option>
                <option value="mgmt-only">mgmt-only</option>
              </select>
              <p class="text-xs text-slate-400">{$_('netops.mikrotik.roleHelp')}</p>
            </div>
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.environment')}</label>
              <select class="select-base" bind:value={environment}>
                <option value="dev">Dev</option>
                <option value="staging">Staging</option>
                <option value="prod">Prod</option>
              </select>
              <p class="text-xs text-slate-400">{$_('netops.mikrotik.environmentHelp')}</p>
            </div>
          </div>

          <div class="grid gap-3 lg:grid-cols-3">
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.hostname')}</label>
              <input class="input-base" bind:value={hostname} placeholder="CORE-EDGE-01" />
            </div>
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.routerOsVersion')}</label>
              <input class="input-base" bind:value={routerOsVersion} placeholder="7.12.1" />
            </div>
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.securityPreset')}</label>
              <select class="select-base" bind:value={securityPreset}>
                <option value="hospital-secure">hospital-secure</option>
                <option value="standard-secure">standard-secure</option>
                <option value="lab">lab</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={labMode} />
            <span class="text-sm text-slate-200">{$_('netops.mikrotik.labMode')}</span>
            {#if labMode}
              <WarningBadge label={$_('netops.mikrotik.labModeWarn')} tone="warning" />
            {/if}
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.mgmtSubnet')}</label>
              <input class="input-base" bind:value={mgmtSubnet} placeholder="10.10.0.0/24" />
              <p class="text-xs text-slate-400">{$_('netops.mikrotik.mgmtHelp')}</p>
            </div>
            <div class="space-y-1">
              <label class="label-base">{$_('netops.mikrotik.allowedSubnets')}</label>
              <textarea class="textarea-base" rows={2} bind:value={allowedSubnetsText} placeholder="10.10.0.0/24&#10;10.20.0.0/24"></textarea>
              <p class="text-xs text-slate-400">{$_('netops.mikrotik.allowedHelp')}</p>
            </div>
          </div>
        </div>
      {:else if step === 'network'}
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="card space-y-3 w-full min-w-0">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.interfaces')}</div>
              <Button size="sm" variant="secondary" onclick={() => (showInterfaceModal = true)}>
                {#snippet leftIcon()}<Plus class="w-4 h-4" />{/snippet}
                {$_('common.add')}
              </Button>
            </div>

            {#if interfaces.length === 0}
              <EmptyState
                title={$_('netops.mikrotik.interfacesEmpty')}
                description={$_('netops.mikrotik.interfacesEmptyHelp')}
              />
            {:else}
              <div class="space-y-2">
                {#each interfaces as iface}
                  <div class="flex items-center justify-between gap-3 border border-slate-700 rounded-lg px-3 py-2">
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-slate-200 truncate">{iface.name}</div>
                      <div class="text-xs text-slate-500">{iface.purpose}{iface.accessVlanId ? ` · access VLAN ${iface.accessVlanId}` : ''}</div>
                    </div>
                    <Button size="sm" variant="secondary" onclick={() => removeInterface(iface.name)}>{$_('common.remove')}</Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="card space-y-3 w-full min-w-0">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.vlans')}</div>
              <Button size="sm" variant="secondary" onclick={() => (showVlanModal = true)}>
                {#snippet leftIcon()}<Plus class="w-4 h-4" />{/snippet}
                {$_('common.add')}
              </Button>
            </div>

            {#if vlans.length === 0}
              <EmptyState title={$_('netops.mikrotik.vlansEmpty')} description={$_('netops.mikrotik.vlansEmptyHelp')} />
            {:else}
              <div class="space-y-2">
                {#each vlans as vlan}
                  <div class="flex items-center justify-between gap-3 border border-slate-700 rounded-lg px-3 py-2">
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-slate-200 truncate">VLAN {vlan.id} · {vlan.name}</div>
                      <div class="text-xs text-slate-500 truncate">{vlan.subnet} → {vlan.gateway}{vlan.dhcp?.enabled ? ' · DHCP' : ''}</div>
                    </div>
                    <Button size="sm" variant="secondary" onclick={() => removeVlan(vlan.id)}>{$_('common.remove')}</Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else if step === 'routing'}
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="card space-y-3 w-full min-w-0">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.internet')}</div>
              <span class="badge-primary">{role}</span>
            </div>
            <div class="grid gap-3 lg:grid-cols-3 items-end">
              <div class="space-y-1">
                <label class="label-base">{$_('netops.mikrotik.wanInterface')}</label>
                <select class="select-base" bind:value={wanInterface}>
                  <option value="">{$_('common.chooseOption')}</option>
                  {#each interfaceNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </div>
              <div class="space-y-1">
                <label class="label-base">{$_('netops.mikrotik.publicType')}</label>
                <select class="select-base" bind:value={publicType}>
                  <option value="dhcp">DHCP</option>
                  <option value="static">Static</option>
                  <option value="pppoe">PPPoE</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="label-base">{$_('netops.mikrotik.dnsServers')}</label>
                <textarea class="textarea-base" rows={2} bind:value={dnsServersText} placeholder="1.1.1.1&#10;8.8.8.8"></textarea>
              </div>
            </div>

            {#if publicType === 'static'}
              <div class="grid gap-3 lg:grid-cols-2">
                <div class="space-y-1">
                  <label class="label-base">{$_('netops.mikrotik.wanAddress')}</label>
                  <input class="input-base" bind:value={wanAddress} placeholder="203.0.113.2/30" />
                </div>
                <div class="space-y-1">
                  <label class="label-base">{$_('netops.mikrotik.wanGateway')}</label>
                  <input class="input-base" bind:value={wanGateway} placeholder="203.0.113.1" />
                </div>
              </div>
            {:else if publicType === 'pppoe'}
              <div class="grid gap-3 lg:grid-cols-2">
                <div class="space-y-1">
                  <label class="label-base">{$_('netops.mikrotik.pppoeUser')}</label>
                  <input class="input-base" bind:value={pppoeUser} />
                </div>
                <div class="space-y-1">
                  <label class="label-base">{$_('netops.mikrotik.pppoePassword')}</label>
                  <input class="input-base" bind:value={pppoePassword} type="password" />
                </div>
              </div>
            {/if}
          </div>

          <div class="card space-y-3 w-full min-w-0">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.staticRoutes')}</div>
              <Button size="sm" variant="secondary" onclick={() => (showRouteModal = true)}>
                {#snippet leftIcon()}<Plus class="w-4 h-4" />{/snippet}
                {$_('common.add')}
              </Button>
            </div>

            {#if staticRoutes.length === 0}
              <EmptyState title={$_('netops.mikrotik.routesEmpty')} description={$_('netops.mikrotik.routesEmptyHelp')} />
            {:else}
              <div class="space-y-2">
                {#each staticRoutes as route}
                  <div class="flex items-center justify-between gap-3 border border-slate-700 rounded-lg px-3 py-2">
                    <div class="min-w-0">
                      <div class="text-sm font-semibold truncate">{route.dst}</div>
                      <div class="text-xs text-slate-500 truncate">via {route.gateway}{route.distance ? ` · distance ${route.distance}` : ''}</div>
                    </div>
                    <Button size="sm" variant="secondary" onclick={() => removeRoute(route.dst)}>{$_('common.remove')}</Button>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="pt-2 border-t border-slate-700 space-y-2">
              <div class="flex items-center gap-2">
                <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={ospfEnabled} />
                <span class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.ospf')}</span>
              </div>
              {#if ospfEnabled}
                <div class="grid gap-3 lg:grid-cols-2">
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.mikrotik.ospfRouterId')}</label>
                    <input class="input-base" bind:value={ospfRouterId} placeholder="10.10.0.1" />
                  </div>
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.mikrotik.ospfArea')}</label>
                    <input class="input-base" bind:value={ospfArea} placeholder="0.0.0.0" />
                  </div>
                </div>
                <div class="grid gap-3 lg:grid-cols-2">
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.mikrotik.ospfNetworks')}</label>
                    <textarea class="textarea-base" rows={3} bind:value={ospfNetworksText} placeholder="10.10.0.0/24&#10;10.20.0.0/24"></textarea>
                  </div>
                  <div class="space-y-1">
                    <label class="label-base">{$_('netops.mikrotik.ospfPassive')}</label>
                    <textarea class="textarea-base" rows={3} bind:value={ospfPassiveText} placeholder="br-core&#10;vlan10-mgmt"></textarea>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          {#if output}
            <div class="flex flex-wrap items-center gap-2">
              <span class={output.risk.level === 'high' ? 'badge-error' : output.risk.level === 'medium' ? 'badge-warning' : 'badge-success'}>
                {$_('netops.mikrotik.risk')}: {output.risk.level.toUpperCase()}
              </span>
              {#if output.validation.errors.length > 0}
                <span class="badge-error">{output.validation.errors.length} {$_('netops.mikrotik.errors')}</span>
              {/if}
              {#if output.validation.warnings.length > 0}
                <span class="badge-warning">{output.validation.warnings.length} {$_('netops.mikrotik.warnings')}</span>
              {/if}
            </div>

            {#if output.validation.errors.length > 0}
              <div class="alert alert-error">
                <div class="text-sm font-semibold">{$_('netops.mikrotik.validationErrors')}</div>
                <ul class="mt-2 list-disc list-inside text-sm">
                  {#each output.validation.errors as err}
                    <li>{err.message}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if output.validation.warnings.length > 0}
              <div class="alert alert-warning">
                <div class="text-sm font-semibold">{$_('netops.mikrotik.validationWarnings')}</div>
                <ul class="mt-2 list-disc list-inside text-sm">
                  {#each output.validation.warnings as warn}
                    <li>{warn.message}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="card space-y-3 w-full">
                <CodePreview title={$_('netops.mikrotik.preview.apply')} code={output.config} copyLabel={$_('common.copy')} />
                <div class="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onclick={() => downloadScript('apply')}>
                    {#snippet leftIcon()}<Download class="w-4 h-4" />{/snippet}
                    {$_('netops.mikrotik.actions.downloadApply')}
                  </Button>
                  {#if isPrivileged}
                    <Button size="sm" variant="secondary" onclick={pushDryRun}>
                      {#snippet leftIcon()}<ShieldAlert class="w-4 h-4" />{/snippet}
                      {$_('netops.mikrotik.actions.pushDryRun')}
                    </Button>
                  {/if}
                </div>
              </div>
              <div class="card space-y-3 w-full">
                <CodePreview title={$_('netops.mikrotik.preview.rollback')} code={output.rollback} copyLabel={$_('common.copy')} />
                <Button size="sm" variant="secondary" onclick={() => downloadScript('rollback')}>
                  {#snippet leftIcon()}<Download class="w-4 h-4" />{/snippet}
                  {$_('netops.mikrotik.actions.downloadRollback')}
                </Button>
              </div>
            </div>

            <div class="card space-y-3 w-full">
              <div class="text-sm font-semibold text-slate-200">{$_('netops.mikrotik.diff.title')}</div>
              <textarea class="textarea-base font-mono text-xs" rows={5} bind:value={runningConfig} placeholder={$_('netops.mikrotik.diff.placeholder')}></textarea>
              <div class="flex gap-2">
                <Button size="sm" variant="secondary" onclick={runDiff} disabled={!runningConfig.trim()}>{$_('netops.mikrotik.diff.run')}</Button>
              </div>
              {#if diffError}
                <div class="alert alert-error">{diffError}</div>
              {/if}
              {#if diff}
                <div class="text-xs text-slate-500">{$_('netops.mikrotik.diff.summary')} +{diff.summary.added} / -{diff.summary.removed}</div>
                <pre class="text-xs bg-slate-900 text-slate-100 rounded-md p-3 whitespace-pre-wrap max-h-72 overflow-y-auto">{#each diff.lines as line}{line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '} {line.line}\n{/each}</pre>
              {/if}
            </div>
          {:else}
            <EmptyState
              title={$_('netops.mikrotik.empty.title')}
              description={$_('netops.mikrotik.empty.subtitle')}
            />
          {/if}
        </div>
      {/if}
    </div>

    <SummaryPanel title={$_('netops.mikrotik.summary.title')} subtitle={$_('netops.mikrotik.summary.subtitle')}>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.device')}</span>
          <span class="font-semibold text-slate-200 truncate">{summary.device || '—'}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.role')}</span>
          <span class="font-semibold text-slate-200">{summary.role}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.environment')}</span>
          <span class="font-semibold text-slate-200">{summary.environment}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.vlans')}</span>
          <span class="font-semibold text-slate-200">{summary.vlans}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.interfaces')}</span>
          <span class="font-semibold text-slate-200">{summary.interfaces}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-slate-500">{$_('netops.mikrotik.summary.routes')}</span>
          <span class="font-semibold text-slate-200">{summary.routes}</span>
        </div>
      </div>
    </SummaryPanel>
  </div>

  <Modal bind:open={showInterfaceModal} size="md" title={$_('netops.mikrotik.modals.interfaceTitle')}>
    <div class="space-y-3">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.interfaceName')}</label>
          <input class="input-base" bind:value={interfaceDraft.name} placeholder="ether1" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.interfacePurpose')}</label>
          <select class="select-base" bind:value={interfaceDraft.purpose}>
            <option value="wan">{$_('netops.mikrotik.modals.purpose.wan')}</option>
            <option value="trunk">{$_('netops.mikrotik.modals.purpose.trunk')}</option>
            <option value="access">{$_('netops.mikrotik.modals.purpose.access')}</option>
            <option value="mgmt">{$_('netops.mikrotik.modals.purpose.mgmt')}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.interfaceAccessVlan')}</label>
          <input class="input-base"
            type="number"
            bind:value={interfaceDraft.accessVlanId}
            placeholder="10"
          />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.interfaceTrunkVlans')}</label>
          <input class="input-base" bind:value={interfaceDraft.trunkVlanIds} placeholder="10,20,30" />
        </div>
        <div class="space-y-1 md:col-span-2">
          <label class="label-base">{$_('netops.mikrotik.modals.interfaceComment')}</label>
          <input class="input-base" bind:value={interfaceDraft.comment} placeholder={$_('netops.mikrotik.modals.optional')} />
        </div>
      </div>
    </div>
    {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => (showInterfaceModal = false)}>{$_('common.cancel')}</Button>
        <Button variant="primary" onclick={addInterfaceFromDraft} disabled={!interfaceDraft.name.trim()}>{$_('common.add')}</Button>
      </div>
    {/snippet}
  </Modal>

  <Modal bind:open={showVlanModal} size="md" title={$_('netops.mikrotik.modals.vlanTitle')}>
    <div class="space-y-3">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.vlanId')}</label>
          <input class="input-base" type="number" bind:value={vlanDraft.id} placeholder="10" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.vlanName')}</label>
          <input class="input-base" bind:value={vlanDraft.name} placeholder="mgmt" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.vlanSubnet')}</label>
          <input class="input-base" bind:value={vlanDraft.subnet} placeholder="10.10.0.0/24" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.vlanGateway')}</label>
          <input class="input-base" bind:value={vlanDraft.gateway} placeholder="10.10.0.1" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.vlanGroup')}</label>
          <select class="select-base" bind:value={vlanDraft.group}>
            <option value="">{$_('netops.mikrotik.modals.optional')}</option>
            <option value="MGMT">MGMT</option>
            <option value="STAFF">STAFF</option>
            <option value="GUEST">GUEST</option>
            <option value="SERVER">SERVER</option>
            <option value="IOT">IOT</option>
          </select>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={vlanDraft.dhcpEnabled} />
          <span>{$_('netops.mikrotik.modals.vlanDhcp')}</span>
        </div>
      </div>
    </div>
    {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => (showVlanModal = false)}>{$_('common.cancel')}</Button>
        <Button
          variant="primary"
          onclick={addVlanFromDraft}
          disabled={!vlanDraft.name.trim() || !vlanDraft.subnet.trim() || !vlanDraft.gateway.trim()}
        >
          {$_('common.add')}
        </Button>
      </div>
    {/snippet}
  </Modal>

  <Modal bind:open={showRouteModal} size="md" title={$_('netops.mikrotik.modals.routeTitle')}>
    <div class="space-y-3">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-1 md:col-span-2">
          <label class="label-base">{$_('netops.mikrotik.modals.routeDst')}</label>
          <input class="input-base" bind:value={routeDraft.dst} placeholder="0.0.0.0/0" />
        </div>
        <div class="space-y-1 md:col-span-2">
          <label class="label-base">{$_('netops.mikrotik.modals.routeGateway')}</label>
          <input class="input-base" bind:value={routeDraft.gateway} placeholder="192.0.2.1" />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.routeDistance')}</label>
          <input class="input-base" type="number" bind:value={routeDraft.distance} placeholder={$_('netops.mikrotik.modals.optional')} />
        </div>
        <div class="space-y-1">
          <label class="label-base">{$_('netops.mikrotik.modals.routeComment')}</label>
          <input class="input-base" bind:value={routeDraft.comment} placeholder={$_('netops.mikrotik.modals.optional')} />
        </div>
      </div>
    </div>
    {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => (showRouteModal = false)}>{$_('common.cancel')}</Button>
        <Button variant="primary" onclick={addRouteFromDraft} disabled={!routeDraft.dst.trim() || !routeDraft.gateway.trim()}>{$_('common.add')}</Button>
      </div>
    {/snippet}
  </Modal>
</div>
