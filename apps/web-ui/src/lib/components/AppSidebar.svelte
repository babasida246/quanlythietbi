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
    Palette
  } from 'lucide-svelte';

  type NavItem = {
    href: string;
    labelKey: string;
    icon: typeof HardDrive;
    testId: string;
    requires?: (caps: Capabilities) => boolean;
    match?: (path: string) => boolean;
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
    { href: '/me/assets', labelKey: 'nav.myAssets', icon: HardDrive, testId: 'nav-my-assets', requires: (caps) => caps.assets.read },
    {
      href: '/requests',
      labelKey: 'nav.requests',
      icon: ClipboardList,
      testId: 'nav-requests',
      requires: (caps) => caps.requests.read,
      match: (path) => path === '/requests' || path.startsWith('/requests?') || path === '/me/requests' || path === '/inbox'
    },
    { href: '/notifications', labelKey: 'nav.notifications', icon: Bell, testId: 'nav-notifications', requires: (caps) => caps.requests.read || caps.assets.read },
  ];

  const assetItems: NavItem[] = [
    {
      href: '/assets',
      labelKey: 'nav.assets',
      icon: HardDrive,
      testId: 'nav-assets',
      requires: (caps) => caps.assets.read,
      match: (path) => path === '/assets' || (path.startsWith('/assets/') && !path.startsWith('/assets/catalogs'))
    },
    { href: '/assets/catalogs', labelKey: 'nav.catalogs', icon: Layers, testId: 'nav-catalogs', requires: (caps) => caps.categories.read },
    { href: '/cmdb', labelKey: 'nav.cmdb', icon: Database, testId: 'nav-cmdb', requires: (caps) => caps.cmdb.read },
    { href: '/inventory', labelKey: 'nav.inventory', icon: ClipboardList, testId: 'nav-inventory', requires: (caps) => caps.inventory.read },
    { href: '/warehouse/stock', labelKey: 'nav.warehouse', icon: Warehouse, testId: 'nav-warehouse', requires: (caps) => caps.warehouse.read },
    { href: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench, testId: 'nav-maintenance', requires: (caps) => caps.maintenance.read, match: (path) => path === '/maintenance' || path.startsWith('/maintenance/') },
    { href: '/reports', labelKey: 'nav.reports', icon: BarChart3, testId: 'nav-reports', requires: (caps) => caps.reports.read, match: (path) => path.startsWith('/reports') },
    { href: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp, testId: 'nav-analytics', requires: (caps) => caps.analytics.read },
    { href: '/automation', labelKey: 'nav.automation', icon: GitBranch, testId: 'nav-automation', requires: (caps) => caps.automation.read },
    { href: '/integrations', labelKey: 'nav.integrations', icon: Link, testId: 'nav-integrations', requires: (caps) => caps.integrations.read },
    { href: '/security', labelKey: 'nav.security', icon: ShieldCheck, testId: 'nav-security', requires: (caps) => caps.security.read },
    { href: '/admin', labelKey: 'nav.admin', icon: Shield, testId: 'nav-admin', requires: (caps) => caps.admin.users || caps.admin.roles || caps.admin.settings }
  ];

  const supportItems: NavItem[] = [
    { href: '/settings/theme', labelKey: 'nav.themeCustomizer', icon: Palette, testId: 'nav-theme-customizer' },
    { href: '/settings/print', labelKey: 'nav.printCustomizer', icon: Palette, testId: 'nav-print-customizer', requires: (caps) => caps.reports.read },
    { href: '/help', labelKey: 'nav.help', icon: HelpCircle, testId: 'nav-help' }
  ];

  const visibleMyItems = $derived(myItems.filter((item) => !item.requires || item.requires(capabilities)));
  const visibleAssetItems = $derived(assetItems.filter((item) => !item.requires || item.requires(capabilities)));
  const visibleSupportItems = $derived(supportItems.filter((item) => !item.requires || item.requires(capabilities)));

  const activeItemClass = 'sidebar-nav-active';
  const inactiveItemClass = 'sidebar-nav-item';

  const isActiveItem = (item: NavItem) => {
    const path = page.url.pathname;
    if (item.match) return item.match(path);
    return path === item.href || path.startsWith(`${item.href}/`);
  };
</script>

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
        <p id="nav-group-assets" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest sidebar-group-label">
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
        <p id="nav-group-support" class="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest sidebar-group-label">
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
