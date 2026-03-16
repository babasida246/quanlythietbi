<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Boxes, Check, Link2 } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  type ModuleRow = {
    module: string;
    frontend: string;
    api: string;
    highlights: string;
  };

  function t(key: string, fallback: string): string {
    return $isLoading ? fallback : $_(key, { default: fallback });
  }

  const rows = $derived.by((): ModuleRow[] => [
    {
      module: t('help.systemMap.rows.assets.module', 'Assets'),
      frontend: '/assets, /assets/catalogs, /assets/[id]',
      api: '/api/v1/assets/*',
      highlights: t('help.systemMap.rows.assets.highlights', 'CRUD, assign/return, timeline, import, attachments')
    },
    {
      module: t('help.systemMap.rows.cmdb.module', 'CMDB'),
      frontend: '/cmdb/*',
      api: '/api/v1/cmdb/*',
      highlights: t('help.systemMap.rows.cmdb.highlights', 'CI types, CI, relationships, services, changes')
    },
    {
      module: t('help.systemMap.rows.warehouse.module', 'Warehouse'),
      frontend: '/warehouse/*',
      api: '/api/v1/warehouse/*',
      highlights: t('help.systemMap.rows.warehouse.highlights', 'Stock docs, ledger, reconciliation, parts, repairs')
    },
    {
      module: t('help.systemMap.rows.maintenance.module', 'Maintenance'),
      frontend: '/maintenance/*',
      api: '/api/v1/maintenance/*',
      highlights: t('help.systemMap.rows.maintenance.highlights', 'Work orders, status transitions, cost tracking')
    },
    {
      module: t('help.systemMap.rows.inventory.module', 'Inventory'),
      frontend: '/inventory, /inventory/[id]',
      api: '/api/v1/inventory/*',
      highlights: t('help.systemMap.rows.inventory.highlights', 'Sessions, scan, reconcile, close session')
    },
    {
      module: t('help.systemMap.rows.workflow.module', 'Workflow'),
      frontend: '/requests, /me/requests, /inbox',
      api: '/api/v1/wf/*',
      highlights: t('help.systemMap.rows.workflow.highlights', 'Request lifecycle, approval steps, inbox actions')
    },
    {
      module: t('help.systemMap.rows.analytics.module', 'Analytics/Reports'),
      frontend: '/analytics, /reports',
      api: '/api/v1/analytics/*, /api/v1/reports/*',
      highlights: t('help.systemMap.rows.analytics.highlights', 'Dashboard, trends, reminders, export')
    },
    {
      module: t('help.systemMap.rows.admin.module', 'Admin/Security'),
      frontend: '/admin, /security',
      api: '/api/v1/admin/*, /api/v1/security/*, /api/v1/rbac-ad/*',
      highlights: t('help.systemMap.rows.admin.highlights', 'Users, RBAC, AD/ACL, audit')
    },
    {
      module: t('help.systemMap.rows.automation.module', 'Automation/Integrations'),
      frontend: '/automation, /integrations',
      api: '/api/v1/automation/*, /api/v1/integrations/*',
      highlights: t('help.systemMap.rows.automation.highlights', 'Rules, tasks, notifications, connectors, webhooks')
    }
  ]);
</script>

<section id="system-map" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <Boxes class="h-5 w-5 text-sky-400" />
    <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'System Map (Module -> Route -> API)' : $_('help.systemMap.title')}</h2>
    <button onclick={() => copyAnchor('system-map')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'system-map'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
    <div class="overflow-x-auto custom-scrollbar">
      <table class="w-full min-w-[920px] text-sm">
        <thead class="bg-slate-900/50 border-b border-slate-700/40">
          <tr class="text-left">
            <th class="px-4 py-3 text-slate-300 font-semibold">{$_('help.systemMap.columns.module', { default: 'Module' })}</th>
            <th class="px-4 py-3 text-slate-300 font-semibold">{$_('help.systemMap.columns.frontend', { default: 'Frontend' })}</th>
            <th class="px-4 py-3 text-slate-300 font-semibold">{$_('help.systemMap.columns.apiPrefix', { default: 'API Prefix' })}</th>
            <th class="px-4 py-3 text-slate-300 font-semibold">{$_('help.systemMap.columns.highlights', { default: 'Highlights' })}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/20">
          {#each rows as row}
            <tr class="hover:bg-surface-3/30 transition-colors">
              <td class="px-4 py-3 text-slate-100 font-medium">{row.module}</td>
              <td class="px-4 py-3 text-slate-300 font-mono text-xs">{row.frontend}</td>
              <td class="px-4 py-3 text-sky-300 font-mono text-xs">{row.api}</td>
              <td class="px-4 py-3 text-slate-300">{row.highlights}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
