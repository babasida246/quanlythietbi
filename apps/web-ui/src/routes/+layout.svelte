<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { defaultLandingPath, getCapabilities, isRouteAllowed } from '$lib/auth/capabilities';
  import { locale, _, isLoading } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import NotificationCenter from '$lib/components/NotificationCenter.svelte';
  import {
    LogIn,
    LogOut,
    Menu
  } from 'lucide-svelte';

  let { children } = $props();

  let sidebarOpen = $state(false);
  let sidebarPinned = $state(true);
  let isDesktop = $state(false);
  let userEmail = $state('');
  let userRole = $state('');
  const shelllessPaths = ['/login', '/setup'];
  const legacyRedirectPrefixes = [
    '/chat',
    '/stats',
    '/models',
    '/netops',
    '/tools',
    '/profile',
    '/devices',
    '/changes',
    '/rulepacks',
    '/field-kit',
    '/field'
  ];
  const legacyRedirectTarget = '/me/assets';

  const capabilities = $derived.by(() => getCapabilities(userRole));
  const isShelllessRoute = $derived.by(() => shelllessPaths.some((path) => page.url.pathname.startsWith(path)));

  $effect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale');
      if (savedLocale) {
        locale.set(savedLocale);
      }
    }
  });

  onMount(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      isDesktop = media.matches;
    };
    update();
    media.addEventListener('change', update);

    const savedPinned = localStorage.getItem('sidebarPinned');
    if (savedPinned !== null) {
      sidebarPinned = savedPinned === 'true';
    }

    return () => media.removeEventListener('change', update);
  });

  function redirectToLogin(targetPath: string) {
    if (typeof window === 'undefined') return;
    const redirectTo = `/login?redirect=${encodeURIComponent(targetPath)}`;
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace(redirectTo);
    }
  }

  function isLegacyPath(pathname: string): boolean {
    return legacyRedirectPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }

  $effect(() => {
    if (typeof window === 'undefined') return;

    const pathname = page.url.pathname;
    const token = localStorage.getItem('authToken');
    userEmail = localStorage.getItem('userEmail') || '';
    userRole = localStorage.getItem('userRole') || '';

    if (isLegacyPath(pathname)) {
      window.location.replace(legacyRedirectTarget);
      return;
    }

    const publicPaths = ['/login', '/setup'];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    // Dev bypass: khi VITE_DISABLE_AUTH=true, tự động inject mock admin và bỏ qua login
    const disableAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';
    if (disableAuth && !token) {
      localStorage.setItem('authToken', 'dev-bypass-token');
      localStorage.setItem('userEmail', 'dev@local');
      localStorage.setItem('userRole', 'admin');
      userEmail = 'dev@local';
      userRole = 'admin';
      return;
    }

    if (!token && !isPublicPath) {
      redirectToLogin(pathname + page.url.search);
      return;
    }

    if (!token || isPublicPath) return;

    const caps = getCapabilities(localStorage.getItem('userRole') || userRole);
    const routeId = page.route.id ?? '';
    const isLegacyNotFoundRoute = routeId === '/[legacy]' || routeId === '/[legacy]/[...rest]';
    if (!isRouteAllowed(pathname, caps)) {
      if (isLegacyNotFoundRoute) return;
      const fallback = defaultLandingPath(caps);
      const target = `/forbidden?from=${encodeURIComponent(pathname)}&home=${encodeURIComponent(fallback)}`;
      window.location.replace(target);
    }
  });

  let lastRoute = $state('');

  $effect(() => {
    const currentRoute = `${page.url.pathname}${page.url.hash}`;
    if (!isDesktop && sidebarOpen && lastRoute && currentRoute !== lastRoute) {
      sidebarOpen = false;
    }
    lastRoute = currentRoute;
  });

  const sidebarVisible = $derived.by(() => (isDesktop ? sidebarPinned : sidebarOpen));

  function toggleSidebar() {
    if (isDesktop) {
      sidebarPinned = !sidebarPinned;
      return;
    }
    sidebarOpen = !sidebarOpen;
  }

  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarPinned', String(sidebarPinned));
    }
  });
</script>

{#if isShelllessRoute}
  {@render children()}
{:else}
  <div class="min-h-screen bg-surface-1 text-slate-100">
    <!-- WCAG 2.4.1 – Skip to main content -->
    <a href="#main-content" class="skip-link">
      {$isLoading ? 'Skip to content' : $_('a11y.skipToContent', { default: 'Skip to content' })}
    </a>

    <ToastHost />

    <header class="sticky top-0 z-50 border-b border-slate-700/60 bg-surface-bg/95 backdrop-blur supports-[backdrop-filter]:bg-surface-bg/80">
      <div class="h-12 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div class="flex items-center gap-2.5">
          <button
            class="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:bg-surface-3/60 hover:text-slate-100 transition-colors"
            onclick={toggleSidebar}
            aria-label={sidebarVisible ? 'Close navigation' : 'Open navigation'}
            aria-expanded={sidebarVisible}
            aria-controls="app-sidebar"
          >
            <Menu class="w-4.5 h-4.5" />
          </button>
          <a href="/me/assets" class="flex items-center gap-2 font-semibold text-slate-100">
            <div class="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shadow-xs">
              AI
            </div>
            <span class="text-sm">{$isLoading ? '' : $_('common.brand')}</span>
          </a>
        </div>

        <div class="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
          <LanguageSwitcher />
          <NotificationCenter />
          <span class="badge badge-gray">v6.0.0</span>
          {#if userEmail}
            <span class="badge badge-blue max-w-[180px] truncate">{userEmail}</span>
            {#if userRole}
              <span class="badge badge-purple">{userRole}</span>
            {/if}
            <a
              href="/logout"
              data-testid="header-logout"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>{$isLoading ? '' : $_('auth.logout')}</span>
            </a>
          {:else}
            <a href="/login" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-primary hover:bg-primary/10 transition-colors">
              <LogIn class="w-3.5 h-3.5" />
              <span>{$isLoading ? '' : $_('auth.login')}</span>
            </a>
          {/if}
        </div>
      </div>
    </header>

    <div class="flex">
      <AppSidebar
        visible={sidebarVisible}
        {capabilities}
        {userEmail}
        {userRole}
        onclose={() => { if (!isDesktop) sidebarOpen = false; }}
      />

      {#if sidebarOpen && !isDesktop}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="fixed inset-0 bg-black/50 z-30 lg:hidden cursor-pointer transition-opacity"
          onclick={() => (sidebarOpen = false)}
          onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
          role="button"
          tabindex="0"
          aria-label="Close navigation overlay"
        ></div>
      {/if}

      <main
        id="main-content"
        class={`flex-1 min-w-0 transition-[margin] duration-200 ${isDesktop && sidebarPinned ? 'lg:ml-64' : 'lg:ml-0'}`}
      >
        <div class="page-padding">
          {@render children()}
        </div>
      </main>
    </div>
  </div>
{/if}
