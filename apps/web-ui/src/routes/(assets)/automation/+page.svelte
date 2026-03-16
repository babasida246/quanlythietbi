<script lang="ts">
  import { _ } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Table from '$lib/components/ui/Table.svelte';
  import TableHeader from '$lib/components/ui/TableHeader.svelte';
  import TableRow from '$lib/components/ui/TableRow.svelte';
  import TableCell from '$lib/components/ui/TableCell.svelte';
  import CreateEditModal from '$lib/components/crud/CreateEditModal.svelte';
  import DeleteConfirmModal from '$lib/components/crud/DeleteConfirmModal.svelte';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';
  import {
    GitBranch, Plus, Trash2, Edit, Bell, Clock, Play, Eye,
    EyeOff, RefreshCw, ShieldCheck, Workflow, ArrowRight
  } from 'lucide-svelte';
  import {
    listRules, createRule, updateRule, deleteRule,
    listNotifications, listTasks, createTask, deleteTask,
    type AutomationRule, type Notification, type ScheduledTask
  } from '$lib/api/automation';
  import { z } from 'zod';
  import { toast } from '$lib/components/toast';

  type TabKey = 'workflows' | 'rules' | 'notifications' | 'tasks';
  let activeTab = $state<TabKey>('workflows');
  const tabs: { key: TabKey; icon: typeof GitBranch }[] = [
    { key: 'workflows', icon: Workflow },
    { key: 'rules', icon: ShieldCheck },
    { key: 'notifications', icon: Bell },
    { key: 'tasks', icon: Clock }
  ];

  // Data state
  let rules = $state<AutomationRule[]>([]);
  let notifications = $state<Notification[]>([]);
  let tasks = $state<ScheduledTask[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Rule form
  let showRuleModal = $state(false);
  let editingRule = $state<AutomationRule | null>(null);
  let ruleForm = $state({ name: '', eventType: 'asset_status_change', conditions: '{}', actions: '{}', isActive: true, priority: 1 });

  // Task form
  let showTaskModal = $state(false);
  let taskForm = $state({ name: '', taskType: 'maintenance_check', schedule: '0 9 * * 1', config: '{}', isActive: true });

  // Delete confirmation
  let showDeleteModal = $state(false);
  let deleteTarget = $state<{ type: 'rule' | 'task'; id: string; name: string } | null>(null);

  // Mermaid diagrams for business workflows
  type WorkflowDef = { key: string; code: string };
  const workflows: WorkflowDef[] = [
    {
      key: 'assetLifecycle',
      code: `flowchart LR
    A[📦 Tiếp nhận] --> B[✅ Kiểm tra]
    B --> C{Đạt?}
    C -->|Có| D[🏷️ Gán mã TS]
    C -->|Không| E[↩️ Trả lại NCC]
    D --> F[📋 Phân bổ sử dụng]
    F --> G[🔄 Đang sử dụng]
    G --> H{Hỏng?}
    H -->|Có| I[🔧 Sửa chữa]
    I --> J{Sửa được?}
    J -->|Có| G
    J -->|Không| K[📤 Thanh lý]
    H -->|Không| L{Hết HSD?}
    L -->|Có| K
    L -->|Không| G`
    },
    {
      key: 'repairWorkflow',
      code: `flowchart TD
    A[🔧 Yêu cầu sửa chữa] --> B[📋 Tạo phiếu SC]
    B --> C[👨‍🔧 Phân công KTV]
    C --> D[🔍 Chẩn đoán]
    D --> E{Cần vật tư?}
    E -->|Có| F[📦 Xuất kho vật tư]
    E -->|Không| G[🛠️ Thực hiện SC]
    F --> G
    G --> H[✅ Kiểm tra kết quả]
    H --> I{Đạt?}
    I -->|Có| J[📝 Hoàn thành phiếu]
    I -->|Không| D
    J --> K[💰 Tính chi phí]
    K --> L[📊 Cập nhật lịch sử TS]`
    },
    {
      key: 'procurement',
      code: `flowchart LR
    A[📊 Kiểm tra tồn kho] --> B{Dưới mức?}
    B -->|Có| C[📝 Lập kế hoạch mua]
    B -->|Không| A
    C --> D[✍️ Duyệt đề xuất]
    D --> E{Được duyệt?}
    E -->|Có| F[📄 Tạo đơn đặt hàng]
    E -->|Không| G[🔄 Chỉnh sửa]
    G --> D
    F --> H[📦 Nhận hàng]
    H --> I[🔍 Kiểm tra chất lượng]
    I --> J[📥 Nhập kho]
    J --> K[💳 Xử lý thanh toán]`
    },
    {
      key: 'inventoryMgmt',
      code: `flowchart TD
    A[📥 Nhập kho] --> B[📋 Tạo phiếu nhập]
    B --> C[🏷️ Gán lô / HSD]
    C --> D[📍 Xếp vị trí kho]
    D --> E[📊 Cập nhật tồn kho]
    E --> F{Loại yêu cầu?}
    F -->|Xuất| G[📤 Phiếu xuất kho]
    F -->|Kiểm kê| H[🔢 Kiểm kê]
    F -->|Điều chuyển| I[🔄 Phiếu điều chuyển]
    G --> J[✅ Xác nhận xuất]
    H --> K[📝 Biên bản kiểm kê]
    I --> L[📦 Chuyển kho đích]
    J --> E
    K --> E
    L --> E`
    },
    {
      key: 'assetAllocation',
      code: `flowchart LR
    A[📋 Yêu cầu cấp phát] --> B{Duyệt?}
    B -->|Có| C[🔍 Tìm TB trong kho]
    B -->|Không| D[↩️ Từ chối]
    C --> E{Có sẵn?}
    E -->|Có| F[🛠️ Chuẩn bị & Cài đặt]
    E -->|Không| G[🛒 Tạo đề xuất mua]
    F --> H[📝 Gán cho người dùng]
    H --> I[✍️ Ký biên bản bàn giao]
    I --> J[✅ Đang sử dụng]`
    },
    {
      key: 'assetDisposal',
      code: `flowchart TD
    A[📝 Đề xuất thanh lý] --> B[👔 Phê duyệt quản lý]
    B --> C{Duyệt?}
    C -->|Có| D[🔒 Xóa dữ liệu bảo mật]
    C -->|Không| E[↩️ Giữ lại / Sửa chữa]
    D --> F[♻️ Thu hồi linh kiện tái dùng]
    F --> G[📦 Bàn giao đơn vị thanh lý]
    G --> H[📊 Cập nhật trạng thái Disposed]
    H --> I[📋 Lưu hồ sơ kiểm toán]`
    }
  ];

  let diagramContainers: (HTMLDivElement | null)[] = $state(new Array(workflows.length).fill(null));
  let diagramRendered: boolean[] = $state(new Array(workflows.length).fill(false));
  let expandedDiagram = $state<number | null>(null);
  let mermaidCounter = 0;

  async function renderDiagram(idx: number) {
    const el = diagramContainers[idx];
    if (!el || diagramRendered[idx]) return;
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        darkMode: true,
        themeVariables: {
          primaryColor: '#3b82f6',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#60a5fa',
          lineColor: '#64748b',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
          background: '#0f172a',
          mainBkg: '#1e293b',
          nodeBorder: '#3b82f6',
          clusterBkg: '#1e293b',
          clusterBorder: '#334155',
          titleColor: '#e2e8f0',
          edgeLabelBackground: '#1e293b'
        },
        flowchart: { htmlLabels: true, curve: 'basis' }
      });
      const uid = `wf-${Date.now()}-${++mermaidCounter}`;
      const { svg } = await mermaid.default.render(uid, workflows[idx].code);
      el.innerHTML = svg;
      diagramRendered[idx] = true;
    } catch (e) {
      if (el) el.innerHTML = `<p class="text-red-400 text-sm">Render error: ${e instanceof Error ? e.message : String(e)}</p>`;
    }
  }

  $effect(() => {
    if (activeTab === 'workflows' && expandedDiagram !== null) {
      setTimeout(() => renderDiagram(expandedDiagram!), 20);
    }
  });

  // Data loading
  async function loadData() {
    try {
      loading = true;
      error = '';
      const [rulesRes, notifRes, tasksRes] = await Promise.all([
        listRules().catch(() => ({ data: [] })),
        listNotifications().catch(() => ({ data: [] })),
        listTasks().catch(() => ({ data: [] }))
      ]);
      rules = rulesRes.data ?? [];
      notifications = notifRes.data ?? [];
      tasks = tasksRes.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  // Rule CRUD
  const ruleSchema = z.object({
    name: z.string().min(1),
    eventType: z.string(),
    conditions: z.string().refine(s => { try { JSON.parse(s); return true; } catch { return false; } }),
    actions: z.string().refine(s => { try { JSON.parse(s); return true; } catch { return false; } }),
    priority: z.string(),
    isActive: z.any()
  });

  const taskSchema = z.object({
    name: z.string().min(1),
    taskType: z.string(),
    schedule: z.string().min(1),
    config: z.string().refine(s => { try { JSON.parse(s); return true; } catch { return false; } }),
    isActive: z.any()
  });

  function openNewRule() {
    editingRule = null;
    ruleForm = { name: '', eventType: 'asset_status_change', conditions: '{}', actions: '{}', isActive: true, priority: 1 };
    showRuleModal = true;
  }

  function openEditRule(rule: AutomationRule) {
    editingRule = rule;
    ruleForm = {
      name: rule.name,
      eventType: rule.eventType,
      conditions: JSON.stringify(rule.conditions, null, 2),
      actions: JSON.stringify(rule.actions, null, 2),
      isActive: rule.isActive,
      priority: rule.priority
    };
    showRuleModal = true;
  }

  async function handleSaveRuleSubmit(values: Record<string, unknown>) {
    try {
      const data = {
        name: String(values.name),
        eventType: String(values.eventType),
        conditions: JSON.parse(String(values.conditions)),
        actions: JSON.parse(String(values.actions)),
        isActive: !!values.isActive,
        priority: Number(values.priority) || 1
      };
      if (editingRule) {
        await updateRule(editingRule.id, data);
      } else {
        await createRule(data);
      }
      showRuleModal = false;
      toast.success($_('workflow.toast.ruleSaved'));
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Save failed';
    }
  }

  function confirmDeleteRule(rule: AutomationRule) {
    deleteTarget = { type: 'rule', id: rule.id, name: rule.name };
    showDeleteModal = true;
  }

  // Task CRUD
  function openNewTask() {
    taskForm = { name: '', taskType: 'maintenance_check', schedule: '0 9 * * 1', config: '{}', isActive: true };
    showTaskModal = true;
  }

  async function handleSaveTaskSubmit(values: Record<string, unknown>) {
    try {
      const config = JSON.parse(String(values.config ?? '{}'));
      await createTask({
        name: String(values.name),
        taskType: String(values.taskType),
        schedule: String(values.schedule),
        config,
        isActive: !!values.isActive
      });
      showTaskModal = false;
      toast.success($_('workflow.toast.taskCreated'));
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    }
  }

  function confirmDeleteTask(task: ScheduledTask) {
    deleteTarget = { type: 'task', id: task.id, name: task.name };
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'rule') {
        await deleteRule(deleteTarget.id);
      } else {
        await deleteTask(deleteTarget.id);
      }
      showDeleteModal = false;
      deleteTarget = null;
      toast.success($_('workflow.toast.deleted'));
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  const eventTypeOptions = [
    { value: 'asset_status_change', label: 'Asset Status Change' },
    { value: 'maintenance_created', label: 'Maintenance Created' },
    { value: 'warranty_expiring', label: 'Warranty Expiring' },
    { value: 'inventory_low', label: 'Inventory Low' },
    { value: 'cost_threshold', label: 'Cost Threshold' }
  ];

  const taskTypeOptions = [
    { value: 'maintenance_check', label: 'Maintenance Check' },
    { value: 'warranty_check', label: 'Warranty Check' },
    { value: 'inventory_audit', label: 'Inventory Audit' },
    { value: 'report_generation', label: 'Report Generation' },
    { value: 'data_cleanup', label: 'Data Cleanup' }
  ];

  $effect(() => { void loadData(); });
</script>

<div class="page-shell page-content space-y-6">
  <!-- Header -->
  <PageHeader
    title={$_('workflow.pageTitle')}
    subtitle={$_('workflow.pageSubtitle')}
  >
    {#snippet actions()}
      <Button variant="secondary" onclick={loadData}>
        <RefreshCw class="w-4 h-4 mr-2" />{$_('common.refresh')}
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="alert-error px-4 py-3 rounded-lg text-sm">{error}</div>
  {/if}

  <!-- Tabs -->
  <div class="border-b border-white/10">
    <nav class="flex gap-1 -mb-px">
      {#each tabs as tab}
        <button
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            {activeTab === tab.key
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'}"
          onclick={() => (activeTab = tab.key)}
        >
          <tab.icon class="w-4 h-4" />
          {$_(`workflow.tabs.${tab.key}`)}
        </button>
      {/each}
    </nav>
  </div>

  <!-- TAB: Workflows (Mermaid diagrams) -->
  {#if activeTab === 'workflows'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each workflows as wf, i}
        <button
          class="bg-surface-2 rounded-xl border border-white/10 p-4 text-left hover:border-blue-500/40 transition-colors
            {expandedDiagram === i ? 'md:col-span-2 border-blue-500/60' : ''}"
          onclick={() => { expandedDiagram = expandedDiagram === i ? null : i; }}
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white flex items-center gap-2">
              <Workflow class="w-5 h-5 text-blue-400" />
              {$_(`workflow.diagrams.${wf.key}`)}
            </h3>
            <span class="text-xs text-gray-400">
              {expandedDiagram === i ? $_('workflow.clickCollapse') : $_('workflow.clickExpand')}
            </span>
          </div>
          <p class="text-sm text-gray-400 mb-3">{$_(`workflow.diagramDesc.${wf.key}`)}</p>
          {#if expandedDiagram === i}
            <div
              bind:this={diagramContainers[i]}
              class="p-4 overflow-x-auto bg-slate-900/60 rounded-lg min-h-[200px]"
            >
              {#if !diagramRendered[i]}
                <div class="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                  <RefreshCw class="w-4 h-4 animate-spin" /> {$_('workflow.rendering')}
                </div>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Process steps summary -->
    <div class="bg-surface-2 rounded-xl border border-white/10 p-6 mt-4">
      <h3 class="font-semibold text-white mb-4 flex items-center gap-2">
        <ArrowRight class="w-5 h-5 text-green-400" />
        {$_('workflow.keySteps')}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each ['receive', 'inspect', 'assign', 'track'] as step}
          <div class="bg-slate-800/50 rounded-lg p-4 border border-white/5">
            <div class="text-2xl mb-2">
              {step === 'receive' ? '📦' : step === 'inspect' ? '🔍' : step === 'assign' ? '🏷️' : '📊'}
            </div>
            <h4 class="text-sm font-semibold text-white">{$_(`workflow.steps.${step}`)}</h4>
            <p class="text-xs text-gray-400 mt-1">{$_(`workflow.stepDesc.${step}`)}</p>
          </div>
        {/each}
      </div>
    </div>

  <!-- TAB: Automation Rules -->
  {:else if activeTab === 'rules'}
    <div class="flex justify-end mb-2">
      <Button data-testid="btn-new-rule" onclick={openNewRule}>
        <Plus class="w-4 h-4 mr-2" />{$_('workflow.newRule')}
      </Button>
    </div>
    {#if loading}
      <Skeleton rows={5} />
    {:else if rules.length === 0}
      <EmptyState title={$_('workflow.noRules')} />
    {:else}
      <Table>
        <TableHeader>
          <th class="px-4 py-3">{$_('workflow.ruleCols.name')}</th>
          <th class="px-4 py-3">{$_('workflow.ruleCols.event')}</th>
          <th class="px-4 py-3">{$_('workflow.ruleCols.priority')}</th>
          <th class="px-4 py-3">{$_('workflow.ruleCols.status')}</th>
          <th class="px-4 py-3">{$_('common.actions')}</th>
        </TableHeader>
        {#each rules as rule}
          <TableRow data-testid="rule-row">
            <TableCell>{rule.name}</TableCell>
            <TableCell><span class="badge-info">{rule.eventType}</span></TableCell>
            <TableCell>{rule.priority}</TableCell>
            <TableCell>
              {#if rule.isActive}
                <span class="badge-success flex items-center gap-1 w-fit"><Eye class="w-3 h-3" />{$_('common.active')}</span>
              {:else}
                <span class="badge-secondary flex items-center gap-1 w-fit"><EyeOff class="w-3 h-3" />{$_('common.inactive')}</span>
              {/if}
            </TableCell>
            <TableCell>
              <div class="flex gap-2">
                <Button variant="secondary" size="sm" data-testid="btn-edit-rule" onclick={() => openEditRule(rule)}>
                  <Edit class="w-3 h-3" />
                </Button>
                <Button variant="danger" size="sm" data-testid="btn-delete-rule" onclick={() => confirmDeleteRule(rule)}>
                  <Trash2 class="w-3 h-3" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        {/each}
      </Table>
    {/if}

  <!-- TAB: Notifications -->
  {:else if activeTab === 'notifications'}
    {#if notifications.length === 0}
      <EmptyState title={$_('workflow.noNotifications')} />
    {:else}
      <div class="space-y-3">
        {#each notifications as notif}
          <div class="bg-surface-2 rounded-lg border border-white/10 p-4 flex items-start gap-3">
            <Bell class="w-5 h-5 {notif.isRead ? 'text-gray-500' : 'text-blue-400'} mt-0.5" />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm text-white">{notif.title}</p>
              <p class="text-sm text-gray-400 mt-0.5">{notif.message}</p>
              <p class="text-xs text-gray-500 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
            </div>
            {#if !notif.isRead}
              <span class="badge-info text-xs">New</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  <!-- TAB: Scheduled Tasks -->
  {:else if activeTab === 'tasks'}
    <div class="flex justify-end mb-2">
      <Button data-testid="btn-new-task" onclick={openNewTask}>
        <Plus class="w-4 h-4 mr-2" />{$_('workflow.newTask')}
      </Button>
    </div>
    {#if loading}
      <Skeleton rows={5} />
    {:else if tasks.length === 0}
      <EmptyState title={$_('workflow.noTasks')} />
    {:else}
      <Table>
        <TableHeader>
          <th class="px-4 py-3">{$_('workflow.taskCols.name')}</th>
          <th class="px-4 py-3">{$_('workflow.taskCols.type')}</th>
          <th class="px-4 py-3">{$_('workflow.taskCols.schedule')}</th>
          <th class="px-4 py-3">{$_('workflow.taskCols.status')}</th>
          <th class="px-4 py-3">{$_('workflow.taskCols.lastRun')}</th>
          <th class="px-4 py-3">{$_('common.actions')}</th>
        </TableHeader>
        {#each tasks as task}
          <TableRow data-testid="task-row">
            <TableCell>{task.name}</TableCell>
            <TableCell><span class="badge-purple">{task.taskType}</span></TableCell>
            <TableCell><code class="code-inline">{task.schedule}</code></TableCell>
            <TableCell>
              {#if task.isActive}
                <span class="badge-success flex items-center gap-1 w-fit"><Play class="w-3 h-3" />{$_('common.active')}</span>
              {:else}
                <span class="badge-secondary">{$_('common.inactive')}</span>
              {/if}
            </TableCell>
            <TableCell>{task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : $_('workflow.never')}</TableCell>
            <TableCell>
              <Button variant="danger" size="sm" data-testid="btn-delete-task" onclick={() => confirmDeleteTask(task)}>
                <Trash2 class="w-3 h-3" />
              </Button>
            </TableCell>
          </TableRow>
        {/each}
      </Table>
    {/if}
  {/if}
</div>

<!-- Rule Modal -->
<CreateEditModal
  bind:open={showRuleModal}
  mode={editingRule ? 'edit' : 'create'}
  title={editingRule ? $_('workflow.modal.editRule') : $_('workflow.modal.newRule')}
  schema={ruleSchema}
  initialValues={{ name: ruleForm.name, eventType: ruleForm.eventType, conditions: ruleForm.conditions, actions: ruleForm.actions, priority: String(ruleForm.priority), isActive: ruleForm.isActive }}
  onSubmit={handleSaveRuleSubmit}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="wf-rule-name" label={$_('workflow.field.ruleName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} {disabled} dataTestid="input-rule-name" />
    <SelectField id="wf-rule-event" label={$_('workflow.field.eventType')} value={String(values.eventType ?? 'asset_status_change')} options={eventTypeOptions} onValueChange={(v) => setValue('eventType', v)} {disabled} dataTestid="select-event-type" />
    <TextField id="wf-rule-priority" label={$_('workflow.field.priority')} type="number" value={String(values.priority ?? '1')} onValueChange={(v) => setValue('priority', v)} {disabled} dataTestid="input-priority" />
    <TextareaField id="wf-rule-conditions" label={$_('workflow.field.conditions')} rows={3} value={String(values.conditions ?? '{}')} onValueChange={(v) => setValue('conditions', v)} {disabled} dataTestid="input-conditions" />
    <TextareaField id="wf-rule-actions" label={$_('workflow.field.actions')} rows={3} value={String(values.actions ?? '{}')} onValueChange={(v) => setValue('actions', v)} {disabled} dataTestid="input-actions" />
    <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
      <input type="checkbox" checked={!!values.isActive} onchange={(e) => setValue('isActive', (e.currentTarget as HTMLInputElement).checked)} class="rounded border-gray-600 bg-gray-700 text-blue-500" />
      {$_('common.active')}
    </label>
  {/snippet}
</CreateEditModal>

<!-- Task Modal -->
<CreateEditModal
  bind:open={showTaskModal}
  mode="create"
  title={$_('workflow.modal.newTask')}
  schema={taskSchema}
  initialValues={{ name: taskForm.name, taskType: taskForm.taskType, schedule: taskForm.schedule, config: taskForm.config, isActive: taskForm.isActive }}
  onSubmit={handleSaveTaskSubmit}
>
  {#snippet fields({ values, errors, setValue, disabled })}
    <TextField id="wf-task-name" label={$_('workflow.field.taskName')} required value={String(values.name ?? '')} error={errors.name} onValueChange={(v) => setValue('name', v)} {disabled} dataTestid="input-task-name" />
    <SelectField id="wf-task-type" label={$_('workflow.field.taskType')} value={String(values.taskType ?? 'maintenance_check')} options={taskTypeOptions} onValueChange={(v) => setValue('taskType', v)} {disabled} dataTestid="select-task-type" />
    <TextField id="wf-task-schedule" label={$_('workflow.field.schedule')} value={String(values.schedule ?? '0 9 * * 1')} onValueChange={(v) => setValue('schedule', v)} {disabled} dataTestid="input-schedule" />
    <p class="text-xs text-gray-400 -mt-2">{$_('workflow.scheduleTip')}</p>
    <TextareaField id="wf-task-config" label={$_('workflow.field.config')} rows={3} value={String(values.config ?? '{}')} onValueChange={(v) => setValue('config', v)} {disabled} dataTestid="input-task-config" />
    <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
      <input type="checkbox" checked={!!values.isActive} onchange={(e) => setValue('isActive', (e.currentTarget as HTMLInputElement).checked)} class="rounded border-gray-600 bg-gray-700 text-blue-500" />
      {$_('common.active')}
    </label>
  {/snippet}
</CreateEditModal>

<!-- Delete Confirm -->
<DeleteConfirmModal
  bind:open={showDeleteModal}
  entityName={deleteTarget?.name ?? ''}
  description={$_('workflow.deleteConfirm', { values: { name: deleteTarget?.name ?? '' } })}
  onConfirm={handleConfirmDelete}
/>
