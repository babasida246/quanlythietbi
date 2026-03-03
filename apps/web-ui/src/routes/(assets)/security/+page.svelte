<script lang="ts">
  import {
    Alert, Badge, Button, Card, Input, Label, Modal, Select, Spinner,
    Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell,
    Tabs, TabItem, Textarea, Progressbar
  } from 'flowbite-svelte';
  import { Shield, ClipboardList, Eye, Plus, Check, X, AlertTriangle } from 'lucide-svelte';
  import {
    listPermissions, getAuditLogs, listFrameworks, listControls, listAssessments,
    createAssessment, getComplianceSummary,
    type Permission, type AuditLog, type ComplianceFramework,
    type ComplianceControl, type ComplianceAssessment, type ComplianceSummary
  } from '$lib/api/security';

  let loading = $state(true);
  let error = $state('');

  let permissions = $state<Permission[]>([]);
  let auditLogs = $state<AuditLog[]>([]);
  let frameworks = $state<ComplianceFramework[]>([]);
  let selectedFramework = $state<ComplianceFramework | null>(null);
  let controls = $state<ComplianceControl[]>([]);
  let assessments = $state<ComplianceAssessment[]>([]);
  let summary = $state<ComplianceSummary | null>(null);

  // Audit log filters
  let logAction = $state('');
  let logRiskLevel = $state('');

  // Assessment form
  let showAssessmentModal = $state(false);
  let assControlId = $state('');
  let assStatus = $state<'compliant' | 'non_compliant' | 'partial' | 'not_assessed'>('not_assessed');
  let assEvidence = $state('');
  let assNotes = $state('');
  let saving = $state(false);

  async function loadData() {
    try {
      loading = true;
      error = '';
      const [permRes, logRes, fwRes, summRes] = await Promise.all([
        listPermissions().catch(() => ({ data: [] })),
        getAuditLogs({ limit: 50 }).catch(() => ({ data: [] })),
        listFrameworks().catch(() => ({ data: [] })),
        getComplianceSummary().catch(() => ({ data: null }))
      ]);
      permissions = permRes.data ?? [];
      auditLogs = logRes.data ?? [];
      frameworks = fwRes.data ?? [];
      summary = summRes.data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function loadAuditLogs() {
    try {
      const res = await getAuditLogs({
        action: logAction || undefined,
        riskLevel: logRiskLevel || undefined,
        limit: 50
      });
      auditLogs = res.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function selectFramework(fw: ComplianceFramework) {
    selectedFramework = fw;
    try {
      const [ctrlRes, assRes] = await Promise.all([
        listControls(fw.id),
        listAssessments({ frameworkId: fw.id })
      ]);
      controls = ctrlRes.data ?? [];
      assessments = assRes.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    }
  }

  function openNewAssessment() {
    assControlId = controls.length > 0 ? controls[0].id : '';
    assStatus = 'not_assessed';
    assEvidence = '';
    assNotes = '';
    showAssessmentModal = true;
  }

  async function handleSaveAssessment() {
    if (!assControlId) return;
    try {
      saving = true;
      await createAssessment({
        controlId: assControlId,
        status: assStatus,
        evidence: assEvidence || undefined,
        notes: assNotes || undefined
      });
      showAssessmentModal = false;
      if (selectedFramework) await selectFramework(selectedFramework);
      const summRes = await getComplianceSummary().catch(() => ({ data: null }));
      summary = summRes.data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  $effect(() => { void loadData(); });
</script>

<div class="page-shell page-content">
  <div class="mb-6">
    <h1 class="text-2xl font-semibold flex items-center gap-2">
      <Shield class="w-6 h-6 text-red-500" /> Security & Compliance
    </h1>
    <p class="text-sm text-gray-500 mt-1">RBAC, audit logs, and compliance framework management</p>
  </div>

  {#if error}
    <Alert color="red" class="mb-4" dismissable>{error}</Alert>
  {/if}

  <!-- Compliance Summary -->
  {#if summary}
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <Card class="p-4">
        <p class="text-sm text-gray-500">Total Controls</p>
        <p class="text-2xl font-bold">{summary.totalControls}</p>
      </Card>
      <Card class="p-4">
        <p class="text-sm text-gray-500">Compliant</p>
        <p class="text-2xl font-bold text-green-600">{summary.compliant}</p>
      </Card>
      <Card class="p-4">
        <p class="text-sm text-gray-500">Non-Compliant</p>
        <p class="text-2xl font-bold text-red-600">{summary.nonCompliant}</p>
      </Card>
      <Card class="p-4">
        <p class="text-sm text-gray-500">Partial</p>
        <p class="text-2xl font-bold text-yellow-600">{summary.partial}</p>
      </Card>
      <Card class="p-4">
        <p class="text-sm text-gray-500">Compliance Rate</p>
        <p class="text-2xl font-bold text-blue-600">{summary.complianceRate}%</p>
        <Progressbar progress={summary.complianceRate} color={summary.complianceRate >= 80 ? 'green' : summary.complianceRate >= 50 ? 'yellow' : 'red'} class="mt-2" />
      </Card>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-10"><Spinner size="8" /></div>
  {:else}
    <Tabs style="underline">
      <!-- RBAC Permissions -->
      <TabItem open title="Permissions">
        <div class="mt-4">
          <Table>
            <TableHead>
              <TableHeadCell>Code</TableHeadCell>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Module</TableHeadCell>
              <TableHeadCell>Action</TableHeadCell>
            </TableHead>
            <TableBody>
              {#each permissions as perm}
                <TableBodyRow>
                  <TableBodyCell><code class="text-xs">{perm.code}</code></TableBodyCell>
                  <TableBodyCell>{perm.name}</TableBodyCell>
                  <TableBodyCell><Badge color="blue">{perm.module}</Badge></TableBodyCell>
                  <TableBodyCell><Badge color="purple">{perm.action}</Badge></TableBodyCell>
                </TableBodyRow>
              {:else}
                <TableBodyRow><TableBodyCell colspan={4} class="text-center text-gray-500">No permissions configured</TableBodyCell></TableBodyRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      </TabItem>

      <!-- Audit Logs -->
      <TabItem title="Audit Logs">
        <div class="flex gap-4 mt-4 mb-4">
          <div>
            <Label class="mb-1 text-xs">Action</Label>
            <Input bind:value={logAction} placeholder="Filter action" size="sm" onchange={loadAuditLogs} />
          </div>
          <div>
            <Label class="mb-1 text-xs">Risk Level</Label>
            <Select bind:value={logRiskLevel} size="sm" onchange={loadAuditLogs}>
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>
        <Table>
          <TableHead>
            <TableHeadCell>Time</TableHeadCell>
            <TableHeadCell>User</TableHeadCell>
            <TableHeadCell>Action</TableHeadCell>
            <TableHeadCell>Entity</TableHeadCell>
            <TableHeadCell>Risk</TableHeadCell>
            <TableHeadCell>IP</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each auditLogs as log}
              <TableBodyRow>
                <TableBodyCell class="text-xs">{new Date(log.createdAt).toLocaleString()}</TableBodyCell>
                <TableBodyCell class="text-xs">{log.userId}</TableBodyCell>
                <TableBodyCell><Badge>{log.action}</Badge></TableBodyCell>
                <TableBodyCell>{log.entityType}{log.entityId ? ` / ${log.entityId.substring(0,8)}` : ''}</TableBodyCell>
                <TableBodyCell>
                  <Badge color={log.riskLevel === 'critical' ? 'red' : log.riskLevel === 'high' ? 'yellow' : log.riskLevel === 'medium' ? 'blue' : 'green'}>
                    {log.riskLevel}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell class="text-xs">{log.ipAddress || '-'}</TableBodyCell>
              </TableBodyRow>
            {:else}
              <TableBodyRow><TableBodyCell colspan={6} class="text-center text-gray-500">No audit logs</TableBodyCell></TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      </TabItem>

      <!-- Compliance -->
      <TabItem title="Compliance">
        <div class="mt-4">
          <h3 class="text-lg font-semibold mb-3">Frameworks</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {#each frameworks as fw}
              <Card class="p-4 cursor-pointer hover:ring-2 ring-blue-400 transition-all {selectedFramework?.id === fw.id ? 'ring-2 ring-blue-500' : ''}" onclick={() => selectFramework(fw)}>
                <h4 class="font-semibold">{fw.name}</h4>
                <p class="text-xs text-gray-500">{fw.code} v{fw.version}</p>
                <p class="text-sm text-gray-600 mt-1">{fw.description || ''}</p>
                <Badge color={fw.isActive ? 'green' : 'dark'} class="mt-2">{fw.isActive ? 'Active' : 'Inactive'}</Badge>
              </Card>
            {:else}
              <p class="text-gray-500">No frameworks configured</p>
            {/each}
          </div>

          {#if selectedFramework}
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Controls — {selectedFramework.name}</h3>
              <Button data-testid="btn-new-assessment" onclick={openNewAssessment} size="sm">
                <Plus class="w-3 h-3 mr-1" /> New Assessment
              </Button>
            </div>
            <Table>
              <TableHead>
                <TableHeadCell>Code</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Category</TableHeadCell>
                <TableHeadCell>Severity</TableHeadCell>
              </TableHead>
              <TableBody>
                {#each controls as ctrl}
                  <TableBodyRow>
                    <TableBodyCell><code class="text-xs">{ctrl.controlCode}</code></TableBodyCell>
                    <TableBodyCell>{ctrl.name}</TableBodyCell>
                    <TableBodyCell>{ctrl.category || '-'}</TableBodyCell>
                    <TableBodyCell>
                      <Badge color={ctrl.severity === 'critical' ? 'red' : ctrl.severity === 'high' ? 'yellow' : ctrl.severity === 'medium' ? 'blue' : 'green'}>
                        {ctrl.severity}
                      </Badge>
                    </TableBodyCell>
                  </TableBodyRow>
                {:else}
                  <TableBodyRow><TableBodyCell colspan={4} class="text-center text-gray-500">No controls</TableBodyCell></TableBodyRow>
                {/each}
              </TableBody>
            </Table>
          {/if}
        </div>
      </TabItem>
    </Tabs>
  {/if}
</div>

<!-- Assessment Modal -->
<Modal bind:open={showAssessmentModal}>
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">New Compliance Assessment</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Control</Label>
      <Select data-testid="select-assessment-control" bind:value={assControlId}>
        {#each controls as ctrl}
          <option value={ctrl.id}>{ctrl.controlCode} — {ctrl.name}</option>
        {/each}
      </Select>
    </div>
    <div>
      <Label class="mb-2">Status</Label>
      <Select data-testid="select-assessment-status" bind:value={assStatus}>
        <option value="compliant">Compliant</option>
        <option value="non_compliant">Non-Compliant</option>
        <option value="partial">Partial</option>
        <option value="not_assessed">Not Assessed</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">Evidence</Label>
      <Textarea data-testid="input-evidence" bind:value={assEvidence} rows={3} placeholder="Describe evidence..." />
    </div>
    <div>
      <Label class="mb-2">Notes</Label>
      <Textarea data-testid="input-notes" bind:value={assNotes} rows={2} />
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showAssessmentModal = false}>Cancel</Button>
      <Button data-testid="btn-save-assessment" onclick={handleSaveAssessment} disabled={saving || !assControlId}>
        {saving ? 'Saving...' : 'Submit'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
