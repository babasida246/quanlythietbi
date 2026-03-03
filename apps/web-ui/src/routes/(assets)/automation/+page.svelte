<script lang="ts">
  import {
    Alert, Badge, Button, Card, Input, Label, Modal, Select, Spinner,
    Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell,
    Toggle, Textarea, Tabs, TabItem
  } from 'flowbite-svelte';
  import { Plus, Trash2, Edit, Zap, Bell, Clock } from 'lucide-svelte';
  import {
    listRules, createRule, updateRule, deleteRule,
    listNotifications, listTasks, createTask, deleteTask,
    type AutomationRule, type Notification, type ScheduledTask
  } from '$lib/api/automation';

  let activeTab = $state<'rules' | 'notifications' | 'tasks'>('rules');

  // Rules state
  let rules = $state<AutomationRule[]>([]);
  let notifications = $state<Notification[]>([]);
  let tasks = $state<ScheduledTask[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Rule form
  let showRuleModal = $state(false);
  let editingRule = $state<AutomationRule | null>(null);
  let ruleName = $state('');
  let ruleEventType = $state('asset_status_change');
  let ruleConditions = $state('{}');
  let ruleActions = $state('{}');
  let ruleIsActive = $state(true);
  let rulePriority = $state(1);
  let saving = $state(false);

  // Task form
  let showTaskModal = $state(false);
  let taskName = $state('');
  let taskType = $state('maintenance_check');
  let taskSchedule = $state('0 9 * * 1');
  let taskConfig = $state('{}');
  let taskIsActive = $state(true);

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

  function openNewRule() {
    editingRule = null;
    ruleName = '';
    ruleEventType = 'asset_status_change';
    ruleConditions = '{}';
    ruleActions = '{}';
    ruleIsActive = true;
    rulePriority = 1;
    showRuleModal = true;
  }

  function openEditRule(rule: AutomationRule) {
    editingRule = rule;
    ruleName = rule.name;
    ruleEventType = rule.eventType;
    ruleConditions = JSON.stringify(rule.conditions, null, 2);
    ruleActions = JSON.stringify(rule.actions, null, 2);
    ruleIsActive = rule.isActive;
    rulePriority = rule.priority;
    showRuleModal = true;
  }

  async function handleSaveRule() {
    if (!ruleName) return;
    try {
      saving = true;
      let conditions: Record<string, unknown>, actions: Record<string, unknown>;
      try { conditions = JSON.parse(ruleConditions); } catch { error = 'Invalid JSON for conditions'; return; }
      try { actions = JSON.parse(ruleActions); } catch { error = 'Invalid JSON for actions'; return; }

      const data = { name: ruleName, eventType: ruleEventType, conditions, actions, isActive: ruleIsActive, priority: rulePriority };
      if (editingRule) {
        await updateRule(editingRule.id, data);
      } else {
        await createRule(data);
      }
      showRuleModal = false;
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  function openNewTask() {
    taskName = '';
    taskType = 'maintenance_check';
    taskSchedule = '0 9 * * 1';
    taskConfig = '{}';
    taskIsActive = true;
    showTaskModal = true;
  }

  async function handleSaveTask() {
    if (!taskName) return;
    try {
      saving = true;
      let config: Record<string, unknown>;
      try { config = JSON.parse(taskConfig); } catch { error = 'Invalid JSON'; return; }
      await createTask({ name: taskName, taskType: taskType, schedule: taskSchedule, config, isActive: taskIsActive });
      showTaskModal = false;
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed';
    } finally {
      saving = false;
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  $effect(() => { void loadData(); });
</script>

<div class="page-shell page-content">
  <div class="mb-6">
    <h1 class="text-2xl font-semibold flex items-center gap-2">
      <Zap class="w-6 h-6 text-yellow-500" /> Workflow Automation
    </h1>
    <p class="text-sm text-gray-500 mt-1">Manage automation rules, notifications, and scheduled tasks</p>
  </div>

  {#if error}
    <Alert color="red" class="mb-4" dismissable>{error}</Alert>
  {/if}

  <Tabs style="underline">
    <TabItem open={activeTab === 'rules'} title="Automation Rules" on:click={() => activeTab = 'rules'}>
      <div class="flex justify-end mb-4">
        <Button data-testid="btn-new-rule" onclick={openNewRule}><Plus class="w-4 h-4 mr-2" /> New Rule</Button>
      </div>
      {#if loading}
        <div class="flex justify-center py-10"><Spinner size="8" /></div>
      {:else}
        <Table>
          <TableHead>
            <TableHeadCell>Name</TableHeadCell>
            <TableHeadCell>Event</TableHeadCell>
            <TableHeadCell>Priority</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each rules as rule}
              <TableBodyRow data-testid="rule-row">
                <TableBodyCell>{rule.name}</TableBodyCell>
                <TableBodyCell><Badge>{rule.eventType}</Badge></TableBodyCell>
                <TableBodyCell>{rule.priority}</TableBodyCell>
                <TableBodyCell>
                  <Badge color={rule.isActive ? 'green' : 'dark'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <div class="flex gap-2">
                    <Button size="xs" color="light" data-testid="btn-edit-rule" onclick={() => openEditRule(rule)}>
                      <Edit class="w-3 h-3" />
                    </Button>
                    <Button size="xs" color="red" data-testid="btn-delete-rule" onclick={() => handleDeleteRule(rule.id)}>
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </TableBodyCell>
              </TableBodyRow>
            {:else}
              <TableBodyRow><TableBodyCell colspan={5} class="text-center text-gray-500">No automation rules yet</TableBodyCell></TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </TabItem>

    <TabItem title="Notifications" on:click={() => activeTab = 'notifications'}>
      <div class="space-y-3 mt-4">
        {#if notifications.length === 0}
          <p class="text-center text-gray-500 py-8">No notifications</p>
        {:else}
          {#each notifications as notif}
            <Card class="p-4">
              <div class="flex items-start gap-3">
                <Bell class={`w-5 h-5 ${notif.isRead ? 'text-gray-400' : 'text-blue-600'}`} />
                <div class="flex-1">
                  <p class="font-semibold text-sm">{notif.title}</p>
                  <p class="text-sm text-gray-500">{notif.message}</p>
                  <p class="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
                {#if !notif.isRead}
                  <Badge color="blue">New</Badge>
                {/if}
              </div>
            </Card>
          {/each}
        {/if}
      </div>
    </TabItem>

    <TabItem title="Scheduled Tasks" on:click={() => activeTab = 'tasks'}>
      <div class="flex justify-end mb-4 mt-4">
        <Button data-testid="btn-new-task" onclick={openNewTask}><Plus class="w-4 h-4 mr-2" /> New Task</Button>
      </div>
      <Table>
        <TableHead>
          <TableHeadCell>Name</TableHeadCell>
          <TableHeadCell>Type</TableHeadCell>
          <TableHeadCell>Schedule</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
          <TableHeadCell>Last Run</TableHeadCell>
          <TableHeadCell>Actions</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each tasks as task}
            <TableBodyRow data-testid="task-row">
              <TableBodyCell>{task.name}</TableBodyCell>
              <TableBodyCell><Badge color="purple">{task.taskType}</Badge></TableBodyCell>
              <TableBodyCell><code class="text-xs">{task.schedule}</code></TableBodyCell>
              <TableBodyCell>
                <Badge color={task.isActive ? 'green' : 'dark'}>{task.isActive ? 'Active' : 'Inactive'}</Badge>
              </TableBodyCell>
              <TableBodyCell>{task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : 'Never'}</TableBodyCell>
              <TableBodyCell>
                <Button size="xs" color="red" data-testid="btn-delete-task" onclick={() => handleDeleteTask(task.id)}>
                  <Trash2 class="w-3 h-3" />
                </Button>
              </TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={6} class="text-center text-gray-500">No scheduled tasks</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </TabItem>
  </Tabs>
</div>

<!-- Rule Modal -->
<Modal bind:open={showRuleModal} size="lg">
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">{editingRule ? 'Edit Rule' : 'New Automation Rule'}</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Rule Name</Label>
      <Input data-testid="input-rule-name" bind:value={ruleName} placeholder="e.g. Auto-assign maintenance" />
    </div>
    <div>
      <Label class="mb-2">Event Type</Label>
      <Select data-testid="select-event-type" bind:value={ruleEventType}>
        <option value="asset_status_change">Asset Status Change</option>
        <option value="maintenance_created">Maintenance Created</option>
        <option value="warranty_expiring">Warranty Expiring</option>
        <option value="inventory_low">Inventory Low</option>
        <option value="cost_threshold">Cost Threshold</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">Priority (1-10)</Label>
      <Input data-testid="input-priority" type="number" min="1" max="10" bind:value={rulePriority} />
    </div>
    <div>
      <Label class="mb-2">Conditions (JSON)</Label>
      <Textarea data-testid="input-conditions" bind:value={ruleConditions} rows={3} placeholder={'{"status": "in_repair"}'} />
    </div>
    <div>
      <Label class="mb-2">Actions (JSON)</Label>
      <Textarea data-testid="input-actions" bind:value={ruleActions} rows={3} placeholder={'{"notify": true, "assignTo": "team-a"}'} />
    </div>
    <div class="flex items-center gap-2">
      <Toggle bind:checked={ruleIsActive} /> <span>Active</span>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showRuleModal = false}>Cancel</Button>
      <Button data-testid="btn-save-rule" onclick={handleSaveRule} disabled={saving || !ruleName}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<!-- Task Modal -->
<Modal bind:open={showTaskModal} size="lg">
  <svelte:fragment slot="header">
    <h3 class="text-lg font-semibold">New Scheduled Task</h3>
  </svelte:fragment>
  <div class="space-y-4">
    <div>
      <Label class="mb-2">Task Name</Label>
      <Input data-testid="input-task-name" bind:value={taskName} placeholder="e.g. Weekly maintenance check" />
    </div>
    <div>
      <Label class="mb-2">Task Type</Label>
      <Select data-testid="select-task-type" bind:value={taskType}>
        <option value="maintenance_check">Maintenance Check</option>
        <option value="warranty_check">Warranty Check</option>
        <option value="inventory_audit">Inventory Audit</option>
        <option value="report_generation">Report Generation</option>
        <option value="data_cleanup">Data Cleanup</option>
      </Select>
    </div>
    <div>
      <Label class="mb-2">Cron Schedule</Label>
      <Input data-testid="input-schedule" bind:value={taskSchedule} placeholder="0 9 * * 1" />
      <p class="text-xs text-gray-400 mt-1">Example: 0 9 * * 1 = every Monday at 9am</p>
    </div>
    <div>
      <Label class="mb-2">Configuration (JSON)</Label>
      <Textarea data-testid="input-task-config" bind:value={taskConfig} rows={3} />
    </div>
    <div class="flex items-center gap-2">
      <Toggle bind:checked={taskIsActive} /> <span>Active</span>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <Button color="alternative" onclick={() => showTaskModal = false}>Cancel</Button>
      <Button data-testid="btn-save-task" onclick={handleSaveTask} disabled={saving || !taskName}>
        {saving ? 'Saving...' : 'Create'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
