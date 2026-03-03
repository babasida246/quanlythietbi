
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';
  import {
    AlertTriangle,
    CheckCircle2,
    Clipboard,
    CloudOff,
    FileText,
    RefreshCw,
    ShieldCheck,
    ShieldAlert
  } from 'lucide-svelte';
  import type { Device } from '$lib/netops/types';
  import type { Vendor } from '$lib/tools/config/types';
  import type { SshCommandPolicy } from '$lib/tools/ssh/types';
  import { defaultCanonicalConfig } from '$lib/tools/config/schema';
  import { generateConfigPipeline } from '$lib/tools/config/service';
  import { listSessions, openSession, sendCommand } from '$lib/tools/ssh/service';
  import {
    addNote,
    captureSnapshot,
    generateConnectivityPlan,
    generatePlaybook,
    getVisualizer,
    listApprovals,
    listNotes,
    listPlaybooks,
    listQuickChecks,
    listSnippets,
    listSnapshots,
    recordAudit,
    requestApproval,
    runQuickCheck
  } from '$lib/tools/field/service';
  import type {
    ApprovalRequest,
    ConnectivityPlan,
    FieldNote,
    FieldScenario,
    PlaybookRun,
    QuickCheckSnapshot,
    Snapshot,
    Snippet,
    VisualizerData
  } from '$lib/tools/field/types';

  const props = $props<{ devices?: Device[]; sshPolicy: SshCommandPolicy }>();

  const devices = $derived(props.devices ?? []);
  const sshPolicy = $derived(props.sshPolicy);

  type FieldSection =
    | 'quick-check'
    | 'playbook'
    | 'snippets'
    | 'config-template'
    | 'visualizer'
    | 'snapshot'
    | 'connectivity'
    | 'notes'
    | 'offline'
    | 'safety';

  const fieldSections: Array<{ id: FieldSection; label: string; phase: string }> = [
    { id: 'quick-check', label: 'Device Quick Check', phase: 'Phase 1' },
    { id: 'playbook', label: 'Troubleshooting Playbook', phase: 'Phase 2' },
    { id: 'snippets', label: 'Live Command Snippets', phase: 'Phase 2' },
    { id: 'config-template', label: 'On-site Config Template', phase: 'Phase 2' },
    { id: 'visualizer', label: 'Interface & VLAN Visualizer', phase: 'Phase 3' },
    { id: 'snapshot', label: 'Incident Snapshot', phase: 'Phase 1' },
    { id: 'connectivity', label: 'Connectivity Assistant', phase: 'Phase 3' },
    { id: 'notes', label: 'Field Notes & Handover', phase: 'Phase 1' },
    { id: 'offline', label: 'Offline Mode', phase: 'Phase 3' },
    { id: 'safety', label: 'Safety Guard & Approvals', phase: 'Phase 4' }
  ];

  let activeFieldSection = $state<FieldSection>('quick-check');
  let fieldDeviceId = $state('');
  let fieldTicket = $state('');
  let actor = $state('field-tech');
  let offlineMode = $state(false);
  let offlineReady = $state(false);

  const fieldDevice = $derived.by(() => devices.find((device: Device) => device.id === fieldDeviceId) || null);
  const fieldVendor = $derived.by(() => {
    if (!fieldDevice) return 'cisco' as Vendor;
    return (fieldDevice.vendor === 'fortigate' ? 'cisco' : fieldDevice.vendor) as Vendor;
  });

  let quickCheckResult = $state<QuickCheckSnapshot | null>(null);
  let quickCheckHistory = $state<QuickCheckSnapshot[]>([]);
  let quickCheckError = $state('');
  let quickCheckLoading = $state(false);

  let playbookScenario = $state<FieldScenario>('loss');
  let playbookRun = $state<PlaybookRun | null>(null);
  let playbookHistory = $state<PlaybookRun[]>([]);
  let playbookLoading = $state(false);
  let playbookError = $state('');

  let snippets = $state<Snippet[]>([]);
  let snippetSearch = $state('');
  let snippetVendor = $state<'all' | Vendor>('all');
  let snippetStatus = $state('');

  let templateHostname = $state('');
  let templateMgmtIp = $state('');
  let templateMask = $state('255.255.255.0');
  let templateGateway = $state('');
  let templateSyslog = $state('');
  let templateNtp = $state('');
  let templateDns = $state('');
  let templatePreview = $state<string[]>([]);
  let templateStatus = $state('');

  let visualizerData = $state<VisualizerData | null>(null);
  let visualizerLoading = $state(false);

  let snapshots = $state<Snapshot[]>([]);
  let snapshotNotes = $state('');
  let snapshotStatus = $state('');

  let connectivityPlan = $state<ConnectivityPlan | null>(null);
  let connectivityStatus = $state('');

  let notes = $state<FieldNote[]>([]);
  let noteMessage = $state('');
  let noteAttachment = $state('');
  let noteStatus = $state('');

  let approvals = $state<ApprovalRequest[]>([]);
  let approvalReason = $state('');
  let approvalStatus = $state('');

  function isCriticalDevice(): boolean {
    if (!fieldDevice?.role) return false;
    return fieldDevice.role.includes('core') || fieldDevice.role.includes('router');
  }

  function requiresApproval(): boolean {
    return sshPolicy.environment === 'prod' || isCriticalDevice();
  }

  async function ensureSession(): Promise<string | null> {
    if (!fieldDevice) return null;
    const sessions = await listSessions();
    const existing = sessions.find((session) => session.deviceId === fieldDevice.id && session.status === 'connected');
    if (existing) return existing.id;

    const session = await openSession({
      deviceId: fieldDevice.id,
      deviceName: fieldDevice.name,
      host: fieldDevice.mgmt_ip,
      port: 22,
      user: 'admin',
      authType: 'password'
    });
    return session.id;
  }

  function storeOfflinePreference(value: boolean) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('fieldKitOffline', value ? 'true' : 'false');
  }

  async function loadFieldData(deviceId: string) {
    quickCheckHistory = await listQuickChecks(deviceId);
    playbookHistory = await listPlaybooks(deviceId);
    snapshots = await listSnapshots(deviceId);
    notes = await listNotes(deviceId);
    approvals = await listApprovals(deviceId);
  }

  async function refreshSnippets() {
    snippets = await listSnippets();
  }
  async function handleQuickCheck() {
    if (!fieldDevice) return;
    quickCheckLoading = true;
    quickCheckError = '';
    try {
      const ticketId = fieldTicket.trim() || 'UNASSIGNED';
      const result = await runQuickCheck({ deviceId: fieldDevice.id, vendor: fieldVendor, ticketId });
      quickCheckResult = result;
      quickCheckHistory = await listQuickChecks(fieldDevice.id);
      await recordAudit({
        deviceId: fieldDevice.id,
        actor,
        type: 'FIELD_QUICK_CHECK_RUN',
        detail: `Quick check run (${result.overallStatus}).`,
        ticketId
      });
    } catch (error: any) {
      quickCheckError = error?.message || 'Quick check failed';
    } finally {
      quickCheckLoading = false;
    }
  }

  async function handleGeneratePlaybook() {
    if (!fieldDevice) return;
    playbookLoading = true;
    playbookError = '';
    try {
      playbookRun = await generatePlaybook({ scenario: playbookScenario, vendor: fieldVendor, deviceId: fieldDevice.id });
      playbookHistory = await listPlaybooks(fieldDevice.id);
    } catch (error: any) {
      playbookError = error?.message || 'Failed to generate playbook';
    } finally {
      playbookLoading = false;
    }
  }

  async function runPlaybookStep(stepIndex: number) {
    if (!playbookRun || !fieldDevice) return;
    const step = playbookRun.steps[stepIndex];
    if (step.status === 'done') return;

    if (step.requiresConfirm || step.commands.some((cmd) => cmd.risk === 'high')) {
      const confirmed = confirm(`Confirm running step: ${step.title}`);
      if (!confirmed) return;
    }

    if (offlineMode) {
      playbookError = 'Offline mode: execution disabled.';
      return;
    }

    if (requiresApproval() && step.commands.some((cmd) => cmd.risk === 'high')) {
      playbookError = 'Approval required for high-risk steps.';
      return;
    }

    playbookRun = {
      ...playbookRun,
      steps: playbookRun.steps.map((item, idx) => (idx === stepIndex ? { ...item, status: 'running' } : item))
    };

    const sessionId = await ensureSession();
    if (!sessionId) {
      playbookError = 'Unable to open SSH session.';
      return;
    }

    const outputs: string[] = [];
    for (const cmd of step.commands) {
      const ticketId = fieldTicket.trim() || 'UNASSIGNED';
      const result = await sendCommand(sessionId, cmd.command, sshPolicy, { ticketId, deviceId: fieldDevice.id });
      outputs.push(...result.output);
      await recordAudit({
        deviceId: fieldDevice.id,
        actor,
        type: 'FIELD_PLAYBOOK_STEP_RUN',
        detail: `Step ${step.title}: ${cmd.command}`,
        ticketId
      });
    }

    playbookRun = {
      ...playbookRun,
      steps: playbookRun.steps.map((item, idx) =>
        idx === stepIndex ? { ...item, status: 'done', output: outputs } : item
      )
    };
  }

  async function runPlaybookAll() {
    if (!playbookRun) return;
    for (let i = 0; i < playbookRun.steps.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await runPlaybookStep(i);
    }
  }

  function canRunPlaybookStep(stepIndex: number): boolean {
    if (!playbookRun) return false;
    if (stepIndex === 0) return true;
    return playbookRun.steps[stepIndex - 1].status === 'done';
  }

  async function handleSnippetExecute(snippet: Snippet) {
    if (!fieldDevice) return;
    snippetStatus = '';

    if (offlineMode) {
      snippetStatus = 'Offline mode: execution disabled.';
      return;
    }

    if (snippet.risk === 'high') {
      if (requiresApproval()) {
        snippetStatus = 'Approval required for high-risk command.';
        return;
      }
      const confirmed = confirm(`Confirm running command: ${snippet.title}`);
      if (!confirmed) return;
    }

    const sessionId = await ensureSession();
    if (!sessionId) {
      snippetStatus = 'Unable to open SSH session.';
      return;
    }

    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    await sendCommand(sessionId, snippet.command, sshPolicy, { ticketId, deviceId: fieldDevice.id });
    await recordAudit({
      deviceId: fieldDevice.id,
      actor,
      type: 'FIELD_SNIPPET_EXEC',
      detail: `Snippet executed: ${snippet.title}`,
      ticketId
    });
    snippetStatus = `Executed: ${snippet.title}`;
  }

  async function handleTemplateGenerate() {
    if (!fieldDevice) return;
    const base = defaultCanonicalConfig();
    const config = {
      ...base,
      hostname: templateHostname || fieldDevice.name,
      services: {
        ...base.services,
        ntpServers: templateNtp ? templateNtp.split(',').map((item) => item.trim()).filter(Boolean) : base.services.ntpServers,
        dnsServers: templateDns ? templateDns.split(',').map((item) => item.trim()).filter(Boolean) : base.services.dnsServers,
        syslogServers: templateSyslog
          ? templateSyslog.split(',').map((item) => item.trim()).filter(Boolean)
          : base.services.syslogServers ?? [],
        ssh: { ...base.services.ssh, enabled: true, version: 2 as const, allowPassword: false },
        snmpCommunity: base.services.snmpCommunity
      },
      interfaces: [
        {
          id: 'mgmt0',
          name: 'mgmt0',
          role: 'access' as const,
          ipAddress: templateMgmtIp,
          subnetMask: templateMask,
          vlanId: undefined,
          description: 'Management',
          enabled: true
        }
      ],
      routing: {
        ...base.routing,
        staticRoutes: templateGateway
          ? [{ destination: '0.0.0.0', netmask: '0.0.0.0', nextHop: templateGateway }]
          : []
      },
      metadata: {
        ...base.metadata,
        deviceId: fieldDevice.id,
        environment: sshPolicy.environment
      }
    };

    const result = await generateConfigPipeline(config, fieldVendor);
    templatePreview = result.commands;
    templateStatus = 'CLI generated. Review before pushing.';
  }

  async function handleTemplatePush() {
    if (offlineMode) {
      templateStatus = 'Offline mode: push disabled.';
      return;
    }
    if (!templatePreview.length) {
      templateStatus = 'Generate CLI before pushing.';
      return;
    }
    const sessionId = await ensureSession();
    if (!sessionId) {
      templateStatus = 'Unable to open SSH session.';
      return;
    }
    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    for (const command of templatePreview) {
      // eslint-disable-next-line no-await-in-loop
      await sendCommand(sessionId, command, sshPolicy, { ticketId, deviceId: fieldDevice?.id });
    }
    templateStatus = 'Push completed via SSH.';
    if (fieldDevice) {
      await recordAudit({
        deviceId: fieldDevice.id,
        actor,
        type: 'FIELD_CONFIG_PUSH',
        detail: 'On-site config template pushed.',
        ticketId
      });
    }
  }
  async function handleVisualizerRefresh() {
    if (!fieldDevice) return;
    visualizerLoading = true;
    visualizerData = await getVisualizer(fieldDevice.id);
    visualizerLoading = false;
  }

  async function handleCaptureSnapshot() {
    if (!fieldDevice) return;
    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    const snapshot = await captureSnapshot({
      deviceId: fieldDevice.id,
      quickCheckId: quickCheckResult?.id,
      notes: snapshotNotes,
      ticketId
    });
    snapshots = await listSnapshots(fieldDevice.id);
    snapshotStatus = `Snapshot captured: ${snapshot.id}`;
    await recordAudit({
      deviceId: fieldDevice.id,
      actor,
      type: 'FIELD_SNAPSHOT_CAPTURE',
      detail: snapshot.summary,
      ticketId
    });
  }

  async function handleConnectivityGenerate() {
    if (!fieldDevice) return;
    connectivityPlan = await generateConnectivityPlan({ deviceId: fieldDevice.id, vendor: fieldVendor });
  }

  async function runConnectivityHop(hopIndex: number) {
    if (!connectivityPlan || !fieldDevice) return;
    if (offlineMode) {
      connectivityStatus = 'Offline mode: execution disabled.';
      return;
    }

    const hop = connectivityPlan.hops[hopIndex];
    const sessionId = await ensureSession();
    if (!sessionId) {
      connectivityStatus = 'Unable to open SSH session.';
      return;
    }

    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    const outputs: string[] = [];
    for (const cmd of hop.commands) {
      const result = await sendCommand(sessionId, cmd.command, sshPolicy, { ticketId, deviceId: fieldDevice.id });
      outputs.push(...result.output);
    }

    await recordAudit({
      deviceId: fieldDevice.id,
      actor,
      type: 'FIELD_PLAYBOOK_STEP_RUN',
      detail: `Connectivity hop: ${hop.label}`,
      ticketId
    });

    connectivityPlan = {
      ...connectivityPlan,
      hops: connectivityPlan.hops.map((item, idx) =>
        idx === hopIndex ? { ...item, status: 'done', output: outputs } : item
      )
    };
  }

  async function handleAddNote() {
    if (!fieldDevice || !noteMessage.trim()) return;
    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    const note = await addNote({
      deviceId: fieldDevice.id,
      author: actor,
      message: noteMessage.trim(),
      attachments: noteAttachment ? noteAttachment.split(',').map((item) => item.trim()).filter(Boolean) : [],
      ticketId
    });
    notes = await listNotes(fieldDevice.id);
    noteMessage = '';
    noteAttachment = '';
    noteStatus = `Note saved at ${new Date(note.createdAt).toLocaleTimeString()}`;
    await recordAudit({
      deviceId: fieldDevice.id,
      actor,
      type: 'FIELD_NOTE_ADD',
      detail: 'Field note added.',
      ticketId
    });
  }

  async function handleApprovalRequest() {
    if (!fieldDevice || !approvalReason.trim()) return;
    const ticketId = fieldTicket.trim() || 'UNASSIGNED';
    const request = await requestApproval({
      deviceId: fieldDevice.id,
      requestedBy: actor,
      reason: approvalReason,
      ticketId
    });
    approvals = await listApprovals(fieldDevice.id);
    approvalStatus = `Approval requested: ${request.id}`;
    approvalReason = '';
    await recordAudit({
      deviceId: fieldDevice.id,
      actor,
      type: 'FIELD_APPROVAL_REQUEST',
      detail: request.reason,
      ticketId
    });
  }

  function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  let lastLoadedDeviceId = '';

  $effect(() => {
    if (!fieldDeviceId && devices.length > 0) {
      fieldDeviceId = devices[0].id;
    }
  });

  $effect(() => {
    if (!fieldDeviceId || fieldDeviceId === lastLoadedDeviceId) return;
    lastLoadedDeviceId = fieldDeviceId;
    void loadFieldData(fieldDeviceId);
  });

  onMount(() => {
    if (typeof window !== 'undefined') {
      actor = window.localStorage.getItem('userEmail') || window.localStorage.getItem('userName') || 'field-tech';
      offlineMode = window.localStorage.getItem('fieldKitOffline') === 'true';
    }
    void refreshSnippets();
    offlineReady = true;
  });

  $effect(() => {
    if (!offlineReady) return;
    storeOfflinePreference(offlineMode);
  });

  const filteredSnippets = $derived.by(() => {
    const search = snippetSearch.toLowerCase();
    return snippets.filter((snippet) => {
      const matchesVendor = snippetVendor === 'all' || snippet.vendor === 'any' || snippet.vendor === snippetVendor;
      const matchesSearch = snippet.title.toLowerCase().includes(search) || snippet.description.toLowerCase().includes(search);
      return matchesVendor && matchesSearch;
    });
  });
</script>

<div class="space-y-4">
  <div class="card space-y-3">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p class="text-xs uppercase tracking-wide text-blue-600 font-semibold">Field Kit</p>
        <h2 class="text-lg font-semibold text-slate-200">Field Operations Console</h2>
        <p class="text-sm text-slate-500">
          RBAC, policy, and audit enforced. No direct CLI bypass.
        </p>
      </div>
      <span class="badge-primary">Controlled</span>
    </div>

    <div class="grid lg:grid-cols-3 gap-3">
      <div>
        <label class="label-base">Device</label>
        <select class="select-base" bind:value={fieldDeviceId}>
          {#if devices.length === 0}
            <option value="">No devices available</option>
          {:else}
            {#each devices as device}
              <option value={device.id}>{device.name} · {device.mgmt_ip}</option>
            {/each}
          {/if}
        </select>
      </div>
      <div>
        <label class="label-base">Environment</label>
        <select class="select-base" value={sshPolicy.environment} disabled>
          <option value="dev">Dev</option>
          <option value="staging">Staging</option>
          <option value="prod">Prod</option>
        </select>
      </div>
      <div>
        <label class="label-base">Ticket (optional)</label>
        <input class="input-base" bind:value={fieldTicket} placeholder="INC-2026-001" />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <div class="flex items-center gap-2">
        <ShieldCheck class="w-4 h-4 text-emerald-500" />
        Policy enforced
      </div>
      <div class="flex items-center gap-2">
        <FileText class="w-4 h-4 text-indigo-500" />
        Audit always on
      </div>
      <div class="flex items-center gap-2">
        <CloudOff class="w-4 h-4 text-slate-500" />
        Offline mode disables execution
      </div>
    </div>
  </div>

  <div class="space-y-4">
    <div class="flex flex-wrap gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
      {#each fieldSections as section}
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition border border-transparent {activeFieldSection === section.id ? 'bg-blue-900/40 text-blue-100 border-blue-900' : 'text-slate-300 hover:bg-slate-800'}"
          onclick={() => (activeFieldSection = section.id)}
        >
          <span>{section.label}</span>
          <span class="ml-2 text-[10px] uppercase text-slate-400">{section.phase}</span>
        </button>
      {/each}
    </div>

    <div class="space-y-4">
      {#if activeFieldSection === 'quick-check'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Device Quick Check</h3>
              <p class="text-sm text-slate-500">Read-only checklist. Commands are locked.</p>
            </div>
            <Button size="sm" variant="primary" onclick={handleQuickCheck} disabled={quickCheckLoading || !fieldDevice}>
              {quickCheckLoading ? 'Running...' : 'Run Check'}
            </Button>
          </div>

          {#if quickCheckError}
            <div class="alert alert-error">{quickCheckError}</div>
          {/if}

          {#if quickCheckResult}
            <div class="flex items-center gap-2">
              <span class={quickCheckResult.overallStatus === 'pass' ? 'badge-success' : 'badge-error'}>
                {quickCheckResult.overallStatus.toUpperCase()}
              </span>
              <span class="text-xs text-slate-500">{new Date(quickCheckResult.createdAt).toLocaleString()}</span>
              {#if quickCheckResult.ticketId}
                <span class="badge-primary">{quickCheckResult.ticketId}</span>
              {/if}
            </div>
            <div class="grid gap-2">
              {#each quickCheckResult.items as item}
                <div class="border border-slate-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold text-slate-200">{item.title}</div>
                    <span class={item.status === 'pass' ? 'badge-success' : item.status === 'warn' ? 'badge-warning' : 'badge-error'}>{item.status}</span>
                  </div>
                  <div class="text-xs text-slate-500">{item.command}</div>
                  <div class="text-xs text-slate-400 mt-1">{item.output}</div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-slate-500">No quick check run yet.</p>
          {/if}
        </div>
      {:else if activeFieldSection === 'playbook'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Auto-generated Playbook</h3>
              <p class="text-sm text-slate-500">Guided troubleshooting with vendor-specific steps.</p>
            </div>
            <div class="flex gap-2">
              <select class="select-base" bind:value={playbookScenario}>
                <option value="loss">Loss of connectivity</option>
                <option value="loop">Loop detected</option>
                <option value="packet-loss">Packet loss</option>
                <option value="slow">Slow network</option>
              </select>
              <Button size="sm" variant="primary" onclick={handleGeneratePlaybook} disabled={playbookLoading || !fieldDevice}>
                {playbookLoading ? 'Generating...' : 'Generate'}
              </Button>
              {#if playbookRun}
                <Button size="sm" variant="secondary" onclick={runPlaybookAll}>Run all</Button>
              {/if}
            </div>
          </div>

          {#if playbookError}
            <div class="alert alert-error">{playbookError}</div>
          {/if}

          {#if playbookRun}
            <div class="space-y-2">
              {#each playbookRun.steps as step, index}
                <div class="border border-slate-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{step.title}</div>
                      <div class="text-xs text-slate-500">Commands: {step.commands.length}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if step.status === 'done'}
                        <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                      {:else if step.status === 'running'}
                        <RefreshCw class="w-4 h-4 animate-spin" />
                      {:else}
                        <AlertTriangle class="w-4 h-4 text-amber-500" />
                      {/if}
                      <Button
                        size="sm"
                        variant="primary"
                        onclick={() => runPlaybookStep(index)}
                        disabled={!canRunPlaybookStep(index) || step.status === 'done'}
                      >
                        Run step
                      </Button>
                    </div>
                  </div>
                  <pre class="mt-2 text-xs bg-slate-900 text-slate-100 rounded-md p-2 whitespace-pre-wrap">
{step.commands.map((cmd) => cmd.command).join('\n')}
                  </pre>
                  {#if step.output}
                    <div class="text-xs text-slate-500 mt-2">Output:</div>
                    <pre class="text-xs bg-slate-900/60 rounded-md p-2 whitespace-pre-wrap">{step.output.join('\n')}</pre>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-slate-500">Generate a playbook to start.</p>
          {/if}
        </div>
      {:else if activeFieldSection === 'snippets'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Live Command Snippets</h3>
              <p class="text-sm text-slate-500">Standardized snippets with policy enforcement.</p>
            </div>
            <div class="flex gap-2">
              <input class="input-base" bind:value={snippetSearch} placeholder="Search snippet" />
              <select class="select-base" bind:value={snippetVendor}>
                <option value="all">All vendors</option>
                <option value="cisco">Cisco IOS</option>
                <option value="mikrotik">MikroTik</option>
              </select>
            </div>
          </div>

          {#if snippetStatus}
            <div class="alert alert-info">{snippetStatus}</div>
          {/if}

          <div class="grid gap-2">
            {#each filteredSnippets as snippet}
              <div class="border border-slate-700 rounded-lg p-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold">{snippet.title}</div>
                    <div class="text-xs text-slate-500">{snippet.description}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class={snippet.risk === 'high' ? 'badge-error' : snippet.risk === 'medium' ? 'badge-warning' : 'badge-success'}>{snippet.risk}</span>
                    <Button size="sm" variant="secondary" onclick={() => navigator.clipboard?.writeText(snippet.command)}>
                      {#snippet leftIcon()}<Clipboard class="w-4 h-4" />{/snippet}
                      Copy
                    </Button>
                    <Button size="sm" variant="primary" onclick={() => handleSnippetExecute(snippet)} disabled={!fieldDevice}>
                      Execute
                    </Button>
                  </div>
                </div>
                <pre class="mt-2 text-xs bg-slate-900 text-slate-100 rounded-md p-2 whitespace-pre-wrap">{snippet.command}</pre>
              </div>
            {/each}
          </div>
        </div>
      {:else if activeFieldSection === 'config-template'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">On-site Config Template</h3>
              <p class="text-sm text-slate-500">Schema-driven deployment with baseline security.</p>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="primary" onclick={handleTemplateGenerate} disabled={!fieldDevice}>Generate CLI</Button>
              <Button size="sm" variant="secondary" onclick={handleTemplatePush} disabled={!templatePreview.length}>Push via SSH</Button>
            </div>
          </div>

          <div class="grid lg:grid-cols-2 gap-3">
            <div class="space-y-2">
              <label class="label-base">Hostname</label>
              <input class="input-base" bind:value={templateHostname} placeholder="FIELD-EDGE-01" />
              <label class="label-base">Management IP</label>
              <input class="input-base" bind:value={templateMgmtIp} placeholder="10.0.0.10" />
              <label class="label-base">Subnet Mask</label>
              <input class="input-base" bind:value={templateMask} />
              <label class="label-base">Default Gateway</label>
              <input class="input-base" bind:value={templateGateway} placeholder="10.0.0.1" />
            </div>
            <div class="space-y-2">
              <label class="label-base">NTP servers (comma separated)</label>
              <input class="input-base" bind:value={templateNtp} placeholder="1.pool.ntp.org,2.pool.ntp.org" />
              <label class="label-base">DNS servers (comma separated)</label>
              <input class="input-base" bind:value={templateDns} placeholder="8.8.8.8,1.1.1.1" />
              <label class="label-base">Syslog server</label>
              <input class="input-base" bind:value={templateSyslog} placeholder="10.0.0.50" />
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck class="w-4 h-4" />
                Baseline security enforced (SSH v2, no telnet).
              </div>
            </div>
          </div>

          {#if templateStatus}
            <div class="alert alert-info">{templateStatus}</div>
          {/if}

          <pre class="text-xs bg-slate-900 text-slate-100 rounded-md p-3 whitespace-pre-wrap">
{templatePreview.length ? templatePreview.join('\n') : 'Generate to preview CLI.'}
          </pre>
        </div>
      {:else if activeFieldSection === 'visualizer'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Interface & VLAN Visualizer</h3>
              <p class="text-sm text-slate-500">CMDB + live status overview.</p>
            </div>
            <Button size="sm" variant="secondary" onclick={handleVisualizerRefresh} disabled={!fieldDevice}>
              {visualizerLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {#if visualizerData}
            <div class="grid lg:grid-cols-2 gap-3">
              <div class="space-y-2">
                <p class="text-xs uppercase text-slate-500">Ports</p>
                {#each visualizerData.ports as port}
                  <div class="border border-slate-700 rounded-lg p-2 flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{port.name}</div>
                      <div class="text-xs text-slate-500">{port.mode.toUpperCase()} {port.vlan ? `VLAN ${port.vlan}` : ''}</div>
                    </div>
                    <span class={port.status === 'up' ? 'badge-success' : 'badge-error'}>{port.status}</span>
                  </div>
                {/each}
              </div>
              <div class="space-y-2">
                <p class="text-xs uppercase text-slate-500">VLANs</p>
                {#each visualizerData.vlans as vlan}
                  <div class="border border-slate-700 rounded-lg p-2 flex items-center justify-between">
                    <div class="text-sm font-semibold">VLAN {vlan.id}</div>
                    <div class="text-xs text-slate-500">{vlan.name}</div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <p class="text-sm text-slate-500">No visualizer data yet.</p>
          {/if}
        </div>
      {:else if activeFieldSection === 'snapshot'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Incident Snapshot</h3>
              <p class="text-sm text-slate-500">Capture config, diff, quick check, and logs.</p>
            </div>
            <Button size="sm" variant="primary" onclick={handleCaptureSnapshot} disabled={!fieldDevice}>Capture State</Button>
          </div>

          <textarea class="textarea-base" rows={3} bind:value={snapshotNotes} placeholder="Notes for this snapshot"></textarea>

          {#if snapshotStatus}
            <div class="alert alert-info">{snapshotStatus}</div>
          {/if}

          <div class="space-y-2">
            {#if snapshots.length === 0}
              <p class="text-sm text-slate-500">No snapshots yet.</p>
            {:else}
              {#each snapshots as snap}
                <div class="border border-slate-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{snap.summary}</div>
                      <div class="text-xs text-slate-500">{new Date(snap.createdAt).toLocaleString()}</div>
                    </div>
                    <Button size="sm" variant="secondary" onclick={() => downloadJson(`snapshot-${snap.id}.json`, snap)}>Export</Button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {:else if activeFieldSection === 'connectivity'}
        <div class="card space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Connectivity Assistant</h3>
              <p class="text-sm text-slate-500">End-to-end hop checks with timestamps.</p>
            </div>
            <Button size="sm" variant="primary" onclick={handleConnectivityGenerate} disabled={!fieldDevice}>Generate Plan</Button>
          </div>

          {#if connectivityStatus}
            <div class="alert alert-info">{connectivityStatus}</div>
          {/if}

          {#if connectivityPlan}
            <div class="space-y-2">
              {#each connectivityPlan.hops as hop, index}
                <div class="border border-slate-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{hop.label}</div>
                      <div class="text-xs text-slate-500">Commands: {hop.commands.length}</div>
                    </div>
                    <Button size="sm" variant="primary" onclick={() => runConnectivityHop(index)} disabled={hop.status === 'done'}>
                      Run
                    </Button>
                  </div>
                  <pre class="mt-2 text-xs bg-slate-900 text-slate-100 rounded-md p-2 whitespace-pre-wrap">
{hop.commands.map((cmd) => cmd.command).join('\n')}
                  </pre>
                  {#if hop.output}
                    <pre class="mt-2 text-xs bg-slate-900/60 rounded-md p-2 whitespace-pre-wrap">{hop.output.join('\n')}</pre>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-slate-500">Generate a plan to start checks.</p>
          {/if}
        </div>
      {:else if activeFieldSection === 'notes'}
        <div class="card space-y-3">
          <div>
            <h3 class="text-base font-semibold text-slate-200">Field Notes & Handover</h3>
            <p class="text-sm text-slate-500">Capture onsite notes with audit trail.</p>
          </div>

          <textarea class="textarea-base" rows={3} bind:value={noteMessage} placeholder="Describe work done, observations, next steps"></textarea>
          <input class="input-base" bind:value={noteAttachment} placeholder="Attachments (comma-separated file names)" />
          <div class="flex gap-2">
            <Button size="sm" variant="primary" onclick={handleAddNote} disabled={!noteMessage.trim() || !fieldDevice}>Save Note</Button>
            {#if noteStatus}
              <span class="text-xs text-slate-500">{noteStatus}</span>
            {/if}
          </div>

          <div class="space-y-2">
            {#if notes.length === 0}
              <p class="text-sm text-slate-500">No notes yet.</p>
            {:else}
              {#each notes as note}
                <div class="border border-slate-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{note.author}</div>
                      <div class="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div class="text-sm mt-2">{note.message}</div>
                  {#if note.attachments && note.attachments.length}
                    <div class="text-xs text-slate-500 mt-2">Attachments: {note.attachments.join(', ')}</div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {:else if activeFieldSection === 'offline'}
        <div class="card space-y-3">
          <div class="flex items-center gap-2">
            <CloudOff class="w-4 h-4 text-slate-500" />
            <div>
              <h3 class="text-base font-semibold text-slate-200">Offline Mode</h3>
              <p class="text-sm text-slate-500">Read-only access to cached playbooks and checklists.</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50" bind:checked={offlineMode} />
            <span class="text-sm">Enable offline mode (blocks execution & push)</span>
          </div>

          <div class="alert alert-warning">
            Offline mode disables SSH execution and config push. Use for low-connectivity sites.
          </div>

          <div class="grid lg:grid-cols-2 gap-3">
            <div class="border border-slate-700 rounded-lg p-3">
              <p class="text-sm font-semibold">Cached playbooks</p>
              <p class="text-xs text-slate-500">{playbookHistory.length} recent playbooks cached</p>
            </div>
            <div class="border border-slate-700 rounded-lg p-3">
              <p class="text-sm font-semibold">Cached snippets</p>
              <p class="text-xs text-slate-500">{snippets.length} snippets available</p>
            </div>
          </div>
        </div>
      {:else if activeFieldSection === 'safety'}
        <div class="card space-y-3">
          <div class="flex items-center gap-2">
            <ShieldAlert class="w-4 h-4 text-red-500" />
            <div>
              <h3 class="text-base font-semibold text-slate-200">Safety Guard & Approvals</h3>
              <p class="text-sm text-slate-500">High-risk actions require confirmation and approval.</p>
            </div>
          </div>

          <div class="grid lg:grid-cols-2 gap-3">
            <div class="border border-slate-700 rounded-lg p-3 space-y-2">
              <div class="text-sm font-semibold">Command policy</div>
              <div class="text-xs text-slate-500">Allowlist: {sshPolicy.allowList.length || 'none'}</div>
              <div class="text-xs text-slate-500">Denylist: {sshPolicy.denyList.length || 'none'}</div>
              <div class="text-xs text-slate-500">Dangerous: {sshPolicy.dangerousList.length || 'none'}</div>
            </div>
            <div class="border border-slate-700 rounded-lg p-3 space-y-2">
              <div class="text-sm font-semibold">Approval gate</div>
              <div class="text-xs text-slate-500">Critical device: {isCriticalDevice() ? 'Yes' : 'No'}</div>
              <div class="text-xs text-slate-500">Environment: {sshPolicy.environment.toUpperCase()}</div>
              <div class="text-xs text-slate-500">Approval required: {requiresApproval() ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div class="space-y-2">
            <label class="label-base">Request approval</label>
            <textarea class="textarea-base" rows={2} bind:value={approvalReason} placeholder="Reason for high-risk action"></textarea>
            <Button size="sm" variant="primary" onclick={handleApprovalRequest} disabled={!approvalReason.trim() || !fieldDevice}>Request approval</Button>
            {#if approvalStatus}
              <div class="alert alert-info">{approvalStatus}</div>
            {/if}
          </div>

          <div class="space-y-2">
            {#if approvals.length === 0}
              <p class="text-sm text-slate-500">No approvals yet.</p>
            {:else}
              {#each approvals as approval}
                <div class="border border-slate-700 rounded-lg p-2">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-semibold">{approval.reason}</div>
                      <div class="text-xs text-slate-500">{approval.requestedBy} · {new Date(approval.createdAt).toLocaleString()}</div>
                    </div>
                    <span class={approval.status === 'approved' ? 'badge-success' : approval.status === 'rejected' ? 'badge-error' : 'badge-warning'}>{approval.status}</span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
