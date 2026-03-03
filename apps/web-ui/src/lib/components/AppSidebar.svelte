<script lang="ts">
  import { page } from '$app/state';
  import { _, isLoading } from '$lib/i18n';
  import {
    Bell,
    ClipboardList,
    Database,
    HardDrive,
    Inbox,
    Layers,
    LogIn,
    LogOut,
    Shield,
    Warehouse,
    Wrench,
    BarChart3,
    TrendingUp,
    Zap,
    Link,
    ShieldCheck,
    HelpCircle
  } from 'lucide-svelte';

  type NavItem = {
    href: string;
    labelKey: string;
    icon: typeof HardDrive;
    testId: string;
    requires?: (caps: Capabilities) => boolean;
    match?: (path: string) => boolean;
  };

  type Capabilities = {
    canViewAssets: boolean;
    canViewRequests: boolean;
    isAdmin: boolean;
  };

  type Props = {
    visible: boolean;
    capabilities: Capabilities;
    userEmail: string;
    userRole: string;
    onclose: () => void;
  };

  let { visible, capabilities, userEmail, userRole, onclose }: Props = $props();

  const myItems: NavItem[] = [
    { href: '/me/assets', labelKey: 'nav.myAssets', icon: HardDrive, testId: 'nav-my-assets', requires: (caps) => caps.canViewAssets },
    { href: '/me/requests', labelKey: 'nav.myRequests', icon: ClipboardList, testId: 'nav-my-requests', requires: (caps) => caps.canViewRequests },
    { href: '/notifications', labelKey: 'nav.notifications', icon: Bell, testId: 'nav-notifications', requires: (caps) => caps.canViewRequests || caps.canViewAssets },
    { href: '/inbox', labelKey: 'nav.inbox', icon: Inbox, testId: 'nav-inbox', requires: (caps) => caps.canViewRequests }
  ];

  const assetItems: NavItem[] = [
    {
      href: '/assets',
      labelKey: 'nav.assets',
      icon: HardDrive,
      testId: 'nav-assets',
      requires: (caps) => caps.canViewAssets,
      match: (path) => path === '/assets' || (path.startsWith('/assets/') && !path.startsWith('/assets/catalogs'))
    },
    { href: '/assets/catalogs', labelKey: 'nav.catalogs', icon: Layers, testId: 'nav-catalogs', requires: (caps) => caps.canViewAssets },
    { href: '/cmdb', labelKey: 'nav.cmdb', icon: Database, testId: 'nav-cmdb', requires: (caps) => caps.canViewAssets },
    { href: '/inventory', labelKey: 'nav.inventory', icon: ClipboardList, testId: 'nav-inventory', requires: (caps) => caps.canViewAssets },
    { href: '/warehouse/stock', labelKey: 'nav.warehouse', icon: Warehouse, testId: 'nav-warehouse', requires: (caps) => caps.canViewAssets },
    { href: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench, testId: 'nav-maintenance', requires: (caps) => caps.canViewAssets },
    { href: '/requests', labelKey: 'nav.requests', icon: ClipboardList, testId: 'nav-requests', requires: (caps) => caps.canViewRequests },
    { href: '/reports/assets', labelKey: 'nav.reports', icon: BarChart3, testId: 'nav-asset-reports', requires: (caps) => caps.canViewAssets, match: (path) => path === '/reports' || path.startsWith('/reports') },
    { href: '/warehouse/reports', labelKey: 'nav.warehouseReports', icon: BarChart3, testId: 'nav-warehouse-reports', requires: (caps) => caps.canViewAssets },
    { href: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp, testId: 'nav-analytics', requires: (caps) => caps.canViewAssets },
    { href: '/automation', labelKey: 'nav.automation', icon: Zap, testId: 'nav-automation', requires: (caps) => caps.isAdmin },
    { href: '/integrations', labelKey: 'nav.integrations', icon: Link, testId: 'nav-integrations', requires: (caps) => caps.isAdmin },
    { href: '/security', labelKey: 'nav.security', icon: ShieldCheck, testId: 'nav-security', requires: (caps) => caps.isAdmin },
    { href: '/admin', labelKey: 'nav.admin', icon: Shield, testId: 'nav-admin', requires: (caps) => caps.isAdmin }
  ];

  const supportItems: NavItem[] = [
    { href: '/help', labelKey: 'nav.help', icon: HelpCircle, testId: 'nav-help' }
  ];

  const visibleMyItems = $derived.by(() => myItems.filter((item) => !item.requires || item.requires(capabilities)));
  const visibleAssetItems = $derived.by(() => assetItems.filter((item) => !item.requires || item.requires(capabilities)));
  const visibleSupportItems = $derived.by(() => supportItems.filter((item) => !item.requires || item.requires(capabilities)));

  const activeItemClass = 'bg-primary/15 text-primary font-semibold';
  const inactiveItemClass = 'text-slate-300 hover:bg-surface-3/50 hover:text-slate-100 font-medium';

  const isActiveItem = (item: NavItem) => {
    const path = page.url.pathname;
    if (item.match) return item.match(path);
    return path === item.href || path.startsWith(`${item.href}/`);
  };
</script>

<aside
  class="
    fixed left-0 top-[49px] bottom-0 z-40 w-64 bg-surface-bg
    border-r border-slate-700/60
    transform transition-transform duration-200 ease-in-out
    {visible ? 'translate-x-0' : '-translate-x-full'}
  "
  aria-label="Main navigation"
>
  <nav class="h-full overflow-y-auto custom-scrollbar px-2 py-3 space-y-4" aria-label="Sidebar navigation">
    {#if visibleMyItems.length > 0}
      <div role="group" aria-labelledby="nav-group-my">
        <p id="nav-group-my" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-slate-400">
          {$isLoading ? 'MY' : $_('nav.groupMy', { default: 'MY' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleMyItems as item}
            {@const Icon = item.icon}
            {@const active = isActiveItem(item)}
            <a
              href={item.href}
              data-testid={item.testId}
              class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active ? activeItemClass : inactiveItemClass}"
              aria-current={active ? 'page' : undefined}
              onclick={() => onclose()}
            >
              <Icon class="h-4 w-4 shrink-0" />
              <span class="truncate">{$isLoading ? '' : $_(item.labelKey)}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    {#if visibleAssetItems.length > 0}
      <div role="group" aria-labelledby="nav-group-assets">
        <p id="nav-group-assets" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-slate-400">
          {$isLoading ? 'ASSETS' : $_('nav.groupAssets', { default: 'ASSETS' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleAssetItems as item}
            {@const Icon = item.icon}
            {@const active = isActiveItem(item)}
            <a
              href={item.href}
              data-testid={item.testId}
              class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active ? activeItemClass : inactiveItemClass}"
              aria-current={active ? 'page' : undefined}
              onclick={() => onclose()}
            >
              <Icon class="h-4 w-4 shrink-0" />
              <span class="truncate">{$isLoading ? '' : $_(item.labelKey)}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    {#if visibleSupportItems.length > 0}
      <div role="group" aria-labelledby="nav-group-support">
        <p id="nav-group-support" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-slate-400">
          {$isLoading ? 'SUPPORT' : $_('nav.groupSupport', { default: 'SUPPORT' })}
        </p>
        <div class="space-y-0.5">
          {#each visibleSupportItems as item}
            {@const Icon = item.icon}
            {@const active = isActiveItem(item)}
            <a
              href={item.href}
              data-testid={item.testId}
              class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active ? activeItemClass : inactiveItemClass}"
              aria-current={active ? 'page' : undefined}
              onclick={() => onclose()}
            >
              <Icon class="h-4 w-4 shrink-0" />
              <span class="truncate">{$isLoading ? '' : $_(item.labelKey)}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Mobile-only user info -->
    <div class="mt-auto border-t border-slate-700/40 pt-3 sm:hidden">
      <div class="px-3 text-xs text-slate-400">
        {#if userEmail}
          <div class="font-semibold text-slate-100 truncate">{userEmail}</div>
          {#if userRole}
            <div class="mt-0.5 text-2xs uppercase tracking-wide text-slate-400">{userRole}</div>
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
