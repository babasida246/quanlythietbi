<script lang="ts">
  import { page } from '$app/state';
  import { _, isLoading } from '$lib/i18n';
  import type { Capabilities } from '$lib/auth/capabilities';
  import {
    Bell,
    ClipboardList,
    Database,
    HardDrive,
    Layers,
    LogIn,
    LogOut,
    Shield,
    Warehouse,
    Wrench,
    BarChart3,
    TrendingUp,
    Link,
    ShieldCheck,
    HelpCircle,
    GitBranch,
    Palette,
    TrendingDown,
    ShoppingCart,
    ChevronDown,
    Package,
    FileText,
    Scan,
    Settings2,
    LayoutDashboard,
    Building2,
    BookOpen,
    ClipboardCheck,
    Tag,
    Cpu,
    MapPin,
    LayoutGrid,
    Server,
    Share2,
    Globe,
    FileCode,
    Network,
    History
  } from 'lucide-svelte';

  type IconComponent = typeof HardDrive;

  type NavLeaf = {
    kind: 'leaf';
    href: string;
    labelKey: string;
    icon: IconComponent;
    testId: string;
    badge?: string;
    requires?: (caps: Capabilities) => boolean;
    match?: (path: string) => boolean;
  };

  type NavGroup = {
    kind: 'group';
    id: string;
    labelKey: string;
    icon: IconComponent;
    children: NavNode[];
    requires?: (caps: Capabilities) => boolean;
  };

  type NavNode = NavLeaf | NavGroup;

  type Props = {
    visible: boolean;
    capabilities: Capabilities;
    userEmail: string;
    userRole: string;
    onclose: () => void;
  };

  let { visible, capabilities, userEmail, userRole, onclose }: Props = $props();

  // ─── Nav tree ───────────────────────────────────────────────────────────
  const myItems: NavLeaf[] = [
    { kind: 'leaf', href: '/me/assets', labelKey: 'nav.myAssets', icon: HardDrive, testId: 'nav-my-assets', requires: (caps) => caps.assets.read },
    { kind: 'leaf', href: '/me/requests', labelKey: 'nav.myRequests', icon: ClipboardList, testId: 'nav-my-requests', requires: (caps) => caps.requests.read },
    { kind: 'leaf', href: '/notifications', labelKey: 'nav.notifications', icon: Bell, testId: 'nav-notifications', requires: (caps) => caps.requests.read || caps.assets.read },
  ];

  const assetNodes: NavNode[] = [
    {
      kind: 'group', id: 'g-assets', labelKey: 'nav.assetGroup', icon: HardDrive,
      requires: (caps) => caps.assets.read || caps.categories.read || caps.cmdb.read || caps.inventory.read || caps.depreciation.read,
      children: [
        {
          kind: 'leaf', href: '/assets', labelKey: 'nav.assets', icon: HardDrive, testId: 'nav-assets',
          requires: (caps) => caps.assets.read,
          match: (path) => path === '/assets' || (path.startsWith('/assets/') && !path.startsWith('/assets/catalogs') && !path.startsWith('/assets/purchase-plans'))
        },
        {
          kind: 'group', id: 'g-catalogs', labelKey: 'nav.catalogs', icon: Layers,
          requires: (caps) => caps.categories.read,
          children: [
            {
              kind: 'leaf', href: '/assets/catalogs?tab=categories', labelKey: 'catalogs.tab.categories', icon: Layers, testId: 'nav-catalogs-categories',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && (!page.url.searchParams.get('tab') || page.url.searchParams.get('tab') === 'categories')
            },
            {
              kind: 'leaf', href: '/assets/catalogs?tab=models', labelKey: 'catalogs.tab.models', icon: Cpu, testId: 'nav-catalogs-models',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && page.url.searchParams.get('tab') === 'models'
            },
            {
              kind: 'leaf', href: '/assets/catalogs?tab=vendors', labelKey: 'catalogs.tab.vendors', icon: Building2, testId: 'nav-catalogs-vendors',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && page.url.searchParams.get('tab') === 'vendors'
            },
            {
              kind: 'leaf', href: '/assets/catalogs?tab=locations', labelKey: 'catalogs.tab.locations', icon: MapPin, testId: 'nav-catalogs-locations',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && page.url.searchParams.get('tab') === 'locations'
            },
            {
              kind: 'leaf', href: '/assets/catalogs?tab=statuses', labelKey: 'catalogs.tab.statuses', icon: Tag, testId: 'nav-catalogs-statuses',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && page.url.searchParams.get('tab') === 'statuses'
            },
            {
              kind: 'leaf', href: '/assets/catalogs?tab=equipmentGroups', labelKey: 'catalogs.tab.equipmentGroups', icon: LayoutGrid, testId: 'nav-catalogs-groups',
              requires: (caps) => caps.categories.read,
              match: (path) => path === '/assets/catalogs' && page.url.searchParams.get('tab') === 'equipmentGroups'
            },
          ]
        },
        {
          kind: 'group', id: 'g-cmdb', labelKey: 'nav.cmdb', icon: Database,
          requires: (caps) => caps.cmdb.read,
          children: [
            {
              kind: 'leaf', href: '/cmdb?tab=types', labelKey: 'cmdb.tabs.ciTypes', icon: Tag, testId: 'nav-cmdb-types',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && (!page.url.searchParams.get('tab') || page.url.searchParams.get('tab') === 'types')
            },
            {
              kind: 'leaf', href: '/cmdb?tab=cis', labelKey: 'cmdb.tabs.ci', icon: Server, testId: 'nav-cmdb-cis',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && page.url.searchParams.get('tab') === 'cis'
            },
            {
              kind: 'leaf', href: '/cmdb?tab=relationships', labelKey: 'cmdb.tabs.rel', icon: Share2, testId: 'nav-cmdb-rel',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && page.url.searchParams.get('tab') === 'relationships'
            },
            {
              kind: 'leaf', href: '/cmdb?tab=services', labelKey: 'cmdb.tabs.svc', icon: Globe, testId: 'nav-cmdb-services',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && page.url.searchParams.get('tab') === 'services'
            },
            {
              kind: 'leaf', href: '/cmdb?tab=config-files', labelKey: 'cmdb.configFiles.tab', icon: FileCode, testId: 'nav-cmdb-configs',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && page.url.searchParams.get('tab') === 'config-files'
            },
            {
              kind: 'leaf', href: '/cmdb?tab=topology', labelKey: 'cmdb.tabs.topology', icon: Network, testId: 'nav-cmdb-topology',
              requires: (caps) => caps.cmdb.read,
              match: (path) => path === '/cmdb' && page.url.searchParams.get('tab') === 'topology'
            },
            { kind: 'leaf', href: '/cmdb/changes', labelKey: 'cmdb.changes.title', icon: History, testId: 'nav-cmdb-changes', requires: (caps) => caps.cmdb.read },
            { kind: 'leaf', href: '/cmdb/reports', labelKey: 'cmdb.report.pageTitle', icon: BarChart3, testId: 'nav-cmdb-reports', requires: (caps) => caps.cmdb.read },
          ]
        },
        { kind: 'leaf', href: '/inventory', labelKey: 'nav.inventory', icon: ClipboardList, testId: 'nav-inventory', requires: (caps) => caps.inventory.read },
        { kind: 'leaf', href: '/depreciation', labelKey: 'nav.depreciation', icon: TrendingDown, testId: 'nav-depreciation', requires: (caps) => caps.depreciation.read },
        { kind: 'leaf', href: '/licenses', labelKey: 'nav.licenses', icon: ShieldCheck, testId: 'nav-licenses', requires: (caps) => caps.licenses.read },
      ]
    },
    {
      kind: 'group', id: 'g-warehouse', labelKey: 'nav.warehouseGroup', icon: Warehouse,
      requires: (caps) => caps.warehouse.read,
      children: [
        {
          kind: 'leaf', href: '/warehouse', labelKey: 'warehouse.tabs.dashboard', icon: LayoutDashboard, testId: 'nav-warehouse-dashboard',
          requires: (caps) => caps.warehouse.read,
          match: (path) => path === '/warehouse'
        },
        { kind: 'leaf', href: '/warehouse/stock', labelKey: 'warehouse.tabs.stock', icon: Package, testId: 'nav-warehouse-stock', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/warehouses', labelKey: 'warehouse.tabs.warehouses', icon: Building2, testId: 'nav-warehouses', requires: (caps) => caps.warehouse.read },
        {
          kind: 'leaf', href: '/warehouse/documents', labelKey: 'warehouse.tabs.documents', icon: FileText, testId: 'nav-warehouse-docs',
          requires: (caps) => caps.warehouse.read,
          match: (path) => path.startsWith('/warehouse/documents')
        },
        { kind: 'leaf', href: '/warehouse/issue-return', labelKey: 'warehouse.tabs.issueReturn', icon: FileText, testId: 'nav-issue-return', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/ledger', labelKey: 'warehouse.tabs.ledger', icon: BookOpen, testId: 'nav-warehouse-ledger', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/reconciliation', labelKey: 'warehouse.tabs.reconciliation', icon: ClipboardCheck, testId: 'nav-warehouse-reconciliation', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/purchase-plans', labelKey: 'warehouse.tabs.purchasePlans', icon: ShoppingCart, testId: 'nav-purchase-plans', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/allocate', labelKey: 'nav.allocate', icon: Scan, testId: 'nav-allocate', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/recall', labelKey: 'nav.recall', icon: LogIn, testId: 'nav-recall', requires: (caps) => caps.warehouse.read },
        { kind: 'leaf', href: '/warehouse/reports', labelKey: 'warehouse.tabs.reports', icon: BarChart3, testId: 'nav-warehouse-reports', requires: (caps) => caps.warehouse.read },
      ]
    },
    {
      kind: 'group', id: 'g-maintenance', labelKey: 'nav.maintenanceGroup', icon: Wrench,
      requires: (caps) => caps.maintenance.read,
      children: [
        {
          kind: 'leaf', href: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench, testId: 'nav-maintenance',
          requires: (caps) => caps.maintenance.read,
          match: (path) => path === '/maintenance' || path.startsWith('/maintenance/')
        },
      ]
    },
    {
      kind: 'group', id: 'g-workflow', labelKey: 'nav.workflowGroup', icon: ClipboardList,
      requires: (caps) => caps.requests.read,
      children: [
        {
          kind: 'leaf', href: '/requests', labelKey: 'nav.requests', icon: ClipboardList, testId: 'nav-requests',
          requires: (caps) => caps.requests.read,
          match: (path) => path === '/requests' || path.startsWith('/requests?')
        },
      ]
    },
    {
      kind: 'group', id: 'g-analytics', labelKey: 'nav.analyticsGroup', icon: BarChart3,
      requires: (caps) => caps.reports.read || caps.analytics.read,
      children: [
        {
          kind: 'leaf', href: '/reports', labelKey: 'nav.reports', icon: BarChart3, testId: 'nav-reports',
          requires: (caps) => caps.reports.read,
          match: (path) => path.startsWith('/reports') && !path.startsWith('/reports/assets')
        },
        { kind: 'leaf', href: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp, testId: 'nav-analytics', requires: (caps) => caps.analytics.read },
      ]
    },
    {
      kind: 'group', id: 'g-ops', labelKey: 'nav.opsGroup', icon: Settings2,
      requires: (caps) => caps.automation.read || caps.integrations.read || caps.security.read || caps.admin.users || caps.admin.roles || caps.admin.settings,
      children: [
        { kind: 'leaf', href: '/automation', labelKey: 'nav.automation', icon: GitBranch, testId: 'nav-automation', requires: (caps) => caps.automation.read },
        { kind: 'leaf', href: '/integrations', labelKey: 'nav.integrations', icon: Link, testId: 'nav-integrations', requires: (caps) => caps.integrations.read },
        { kind: 'leaf', href: '/security', labelKey: 'nav.security', icon: ShieldCheck, testId: 'nav-security', requires: (caps) => caps.security.read },
        { kind: 'leaf', href: '/admin', labelKey: 'nav.admin', icon: Shield, testId: 'nav-admin', requires: (caps) => caps.admin.users || caps.admin.roles || caps.admin.settings },
        { kind: 'leaf', href: '/admin/ldap', labelKey: 'nav.ldap', icon: Network, testId: 'nav-ldap', requires: (caps) => caps.admin.settings },
      ]
    },
  ];

  const supportItems: NavLeaf[] = [
    { kind: 'leaf', href: '/settings/theme', labelKey: 'nav.themeCustomizer', icon: Palette, testId: 'nav-theme-customizer' },
    { kind: 'leaf', href: '/settings/print', labelKey: 'nav.printCustomizer', icon: Palette, testId: 'nav-print-customizer', requires: (caps) => caps.reports.read },
    { kind: 'leaf', href: '/help', labelKey: 'nav.help', icon: HelpCircle, testId: 'nav-help' },
  ];

  // ─── Open state (persisted) ──────────────────────────────────────────────
  const STORAGE_KEY = 'sidebar-tree-open';

  function loadOpenState(): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  let openState = $state<Record<string, boolean>>(loadOpenState());

  function isOpen(id: string): boolean {
    return openState[id] ?? false;
  }

  function toggle(id: string): void {
    openState = { ...openState, [id]: !isOpen(id) };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openState)) } catch { /* ignore */ }
  }

  // ─── Visibility helpers ──────────────────────────────────────────────────
  function isNodeVisible(node: NavNode): boolean {
    if (node.requires && !node.requires(capabilities)) return false;
    if (node.kind === 'group') return node.children.some(isNodeVisible);
    return true;
  }

  function visibleChildren(children: NavNode[]): NavNode[] {
    return children.filter(isNodeVisible);
  }

  function isLeafActive(leaf: NavLeaf): boolean {
    const path = page.url.pathname;
    if (leaf.match) return leaf.match(path);
    return path === leaf.href || path.startsWith(`${leaf.href}/`);
  }

  function groupContainsActive(group: NavGroup): boolean {
    return group.children.some((child) => {
      if (child.kind === 'leaf') return isLeafActive(child);
      return groupContainsActive(child);
    });
  }

  // Auto-open groups that contain the active route (tracks both path and search params)
  $effect(() => {
    void page.url.pathname;
    void page.url.search;
    const updates: Record<string, boolean> = {};
    for (const node of assetNodes) {
      if (node.kind === 'group' && groupContainsActive(node) && !isOpen(node.id)) {
        updates[node.id] = true;
      }
    }
    if (Object.keys(updates).length > 0) {
      openState = { ...openState, ...updates };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openState)) } catch { /* ignore */ }
    }
  });

  const visibleMyItems = $derived(myItems.filter(isNodeVisible));
  const visibleAssetNodes = $derived(assetNodes.filter(isNodeVisible));
  const visibleSupportItems = $derived(supportItems.filter(isNodeVisible));
</script>

{#snippet navNode(node: NavNode)}
  {#if node.kind === 'leaf'}
    {@const active = isLeafActive(node)}
    {@const Icon = node.icon}
    <a
      href={node.href}
      data-testid={node.testId}
      class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active ? 'sidebar-nav-active' : 'sidebar-nav-item'}"
      aria-current={active ? 'page' : undefined}
      onclick={onclose}
    >
      <Icon class="h-4 w-4 shrink-0" />
      <span class="flex-1 truncate">{$isLoading ? '' : $_(node.labelKey)}</span>
      {#if node.badge}
        <span class="text-2xs font-bold px-1 rounded bg-primary/80 text-white leading-none">{node.badge}</span>
      {/if}
    </a>
  {:else}
    {@const open = isOpen(node.id)}
    {@const hasActive = groupContainsActive(node)}
    {@const Icon = node.icon}
    {@const kids = visibleChildren(node.children)}
    <div>
      <button
        type="button"
        onclick={() => toggle(node.id)}
        class="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors {hasActive && !open ? 'sidebar-nav-active' : 'sidebar-nav-item'}"
      >
        <Icon class="h-4 w-4 shrink-0" />
        <span class="flex-1 text-left truncate">{$isLoading ? '' : $_(node.labelKey)}</span>
        <ChevronDown class="h-3.5 w-3.5 shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}" />
      </button>
      {#if open && kids.length > 0}
        <div class="mt-0.5 ml-3.5 pl-2.5 border-l border-slate-700/50 space-y-0.5">
          {#each kids as child}
            {@render navNode(child)}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<aside
  class="
    fixed left-0 top-[49px] bottom-0 z-40 w-64 sidebar-always-dark
    transform transition-transform duration-200 ease-in-out
    {visible ? 'translate-x-0' : '-translate-x-full'}
  "
  aria-label="Main navigation"
>
  <nav class="h-full overflow-y-auto custom-scrollbar px-2 py-3 space-y-4" aria-label="Sidebar navigation">
    {#if visibleMyItems.length > 0}
      <div role="group" aria-labelledby="nav-group-my">
        <p id="nav-group-my" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest sidebar-group-label">
          {$isLoading ? 'MY' : $_('nav.groupMy', { default: 'MY' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleMyItems as item}
            {@render navNode(item)}
          {/each}
        </div>
      </div>
    {/if}

    {#if visibleAssetNodes.length > 0}
      <div role="group" aria-labelledby="nav-group-assets">
        <p id="nav-group-assets" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest sidebar-group-label">
          {$isLoading ? 'ASSETS' : $_('nav.groupAssets', { default: 'ASSETS' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleAssetNodes as node}
            {@render navNode(node)}
          {/each}
        </div>
      </div>
    {/if}

    {#if visibleSupportItems.length > 0}
      <div role="group" aria-labelledby="nav-group-support">
        <p id="nav-group-support" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest sidebar-group-label">
          {$isLoading ? 'SUPPORT' : $_('nav.groupSupport', { default: 'SUPPORT' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleSupportItems as item}
            {@render navNode(item)}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Mobile-only user info -->
    <div class="mt-auto border-t border-slate-700/40 pt-3 sm:hidden">
      <div class="px-3 text-xs sidebar-group-label">
        {#if userEmail}
          <div class="font-semibold text-slate-100 truncate">{userEmail}</div>
          {#if userRole}
            <div class="mt-0.5 text-2xs uppercase tracking-wide sidebar-group-label">{userRole}</div>
          {/if}
        {:else}
          <div>{$isLoading ? 'Guest' : $_('auth.login')}</div>
        {/if}
      </div>
      <div class="mt-2 px-3">
        {#if userEmail}
          <a
            href="/logout"
            data-testid="sidebar-logout"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut class="h-3.5 w-3.5" />
            <span>{$isLoading ? '' : $_('auth.logout')}</span>
          </a>
        {:else}
          <a href="/login" class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <LogIn class="h-3.5 w-3.5" />
            <span>{$isLoading ? '' : $_('auth.login')}</span>
          </a>
        {/if}
      </div>
    </div>
  </nav>
</aside>
