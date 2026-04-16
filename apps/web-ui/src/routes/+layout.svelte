<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { defaultLandingPath, getCapabilities, isRouteAllowed } from '$lib/auth/capabilities';
  import { getUnifiedEffectivePerms } from '$lib/api/admin';
  import { effectivePermsStore, allowedPerms, permsLoaded } from '$lib/stores/effectivePermsStore';
  import { locale, _, isLoading } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import NotificationCenter from '$lib/components/NotificationCenter.svelte';
  import { theme } from '$lib/stores/themeStore';
  import { themeCustomizer } from '$lib/stores/themeCustomizer';
  import { themePresets } from '$lib/stores/themePresets';
  import type { ThemePresetId } from '$lib/stores/themePresets';
  import { getUserThemeSettings, putUserThemeSettings } from '$lib/api/userSettings';
  import { orgStore, orgLogoLetters } from '$lib/stores/orgStore';
  import {
    LogIn,
    LogOut,
    Menu,
    Moon,
    Sun
  } from 'lucide-svelte';

  let { children } = $props();

  let sidebarOpen = $state(false);
  let sidebarPinned = $state(true);
  let isDesktop = $state(false);
  let userEmail = $state('');
  let userRole = $state('');
  // Theme API sync — prevent saves before server settings are loaded
  let themeApiSyncReady = $state(false);

  // Synchronous auth gate — evaluated before first render to prevent shell flash.
  // If there's no token and we're not on a public path, suppress the shell until
  // the $effect fires and redirects to /login.
  const _shelllessPaths = ['/login', '/setup', '/logout', '/print'];
  const _hasTokenSync = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : true;
  const _isPublicSync = _shelllessPaths.some(p => page.url.pathname.startsWith(p));
  let authGatePassed = $state(_hasTokenSync || _isPublicSync);
  let themeSaveTimer: ReturnType<typeof setTimeout> | undefined;
  const shelllessPaths = ['/login', '/setup', '/logout', '/print'];
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

  // Capabilities: reactive via $allowedPerms derived store — updates immediately when
  // fetchEffectivePerms() completes (first login, page refresh, or invalidate).
  // Falls back to SYSTEM_ROLE_PERMISSIONS hardcode only when store hasn't been loaded yet
  // (null). If store is loaded but allowed=[], pass [] so policy DENY is respected
  // and admin doesn't get wildcard fallback from ROLE_PERMISSIONS['admin']=['*'].
  const capabilities = $derived.by(() => {
    const allowed = $allowedPerms;
    const loaded = $permsLoaded;
    return getCapabilities(userRole, loaded ? allowed : undefined);
  });
  const isShelllessRoute = $derived.by(() => shelllessPaths.some((path) => page.url.pathname.startsWith(path)));

  $effect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale');
      if (savedLocale) {
        locale.set(savedLocale);
      }
    }
  });

  // Auto-save theme settings to API (debounced) whenever preset or customizer changes.
  // Only activates after server settings have been loaded to avoid overwriting server data on init.
  $effect(() => {
    const preset = $themePresets;
    const customizer = $themeCustomizer;
    if (!themeApiSyncReady) return;
    clearTimeout(themeSaveTimer);
    themeSaveTimer = setTimeout(() => {
      void putUserThemeSettings({ preset, customizer });
    }, 800);
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

    void orgStore.fetchAndSync();
    themePresets.init();
    themeCustomizer.init();

    // Load per-user theme settings from server (sync across devices).
    // Falls back silently to localStorage state if unauthenticated or offline.
    async function loadThemeFromApi() {
      try {
        const settings = await getUserThemeSettings();
        if (settings?.preset) {
          themePresets.setTheme(settings.preset as ThemePresetId);
        }
        if (settings?.customizer) {
          themeCustomizer.initFromExternal(settings.customizer);
        }
      } catch { /* non-critical — localStorage state already applied */ }
      themeApiSyncReady = true;
    }
    void loadThemeFromApi();

    // Load unified effective perms (Classic RBAC + Policy System)
    async function fetchEffectivePerms(force = false) {
      let userId = localStorage.getItem('userId') || '';
      // Fallback: decode userId from JWT if localStorage key is missing (old sessions)
      if (!userId) {
        try {
          const token = localStorage.getItem('authToken') || '';
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.userId || '';
            if (userId) localStorage.setItem('userId', userId);
          }
        } catch { /* malformed token — ignore */ }
      }
      if (!userId) return;
      if (!force && effectivePermsStore.hasCache(userId)) return;
      try {
        const res = await getUnifiedEffectivePerms(userId);
        effectivePermsStore.set({
          userId,
          allowed: res.data.allowed,
          denied: res.data.denied,
          cachedAt: Date.now(),
        });
        // Enforce route guard immediately — don't rely solely on Svelte 5 $effect scheduling
        // after an async store update (microtask ordering not guaranteed before next render).
        const currentRole = localStorage.getItem('userRole') || '';
        const newCaps = getCapabilities(currentRole, res.data.allowed);
        const pathname = window.location.pathname;
        if (!isRouteAllowed(pathname, newCaps)) {
          const fallback = defaultLandingPath(newCaps);
          window.location.replace(`/forbidden?from=${encodeURIComponent(pathname)}&home=${encodeURIComponent(fallback)}`);
        }
      } catch { /* non-critical — fallback to hardcoded ROLE_PERMISSIONS */ }
    }

    // Register callback so any component can trigger a re-fetch after policy changes
    effectivePermsStore.onRefreshNeeded(() => void fetchEffectivePerms(true));

    void fetchEffectivePerms();

    return () => {
      media.removeEventListener('change', update);
    };
  });

  function sanitizeLoginRedirectTarget(targetPath: string): string | null {
    if (!targetPath.startsWith('/')) return null;
    if (targetPath.startsWith('/login') || targetPath.startsWith('/setup') || targetPath.startsWith('/logout')) {
      return null;
    }
    return targetPath;
  }

  function redirectToLogin(targetPath: string) {
    if (typeof window === 'undefined') return;
    const safeTarget = sanitizeLoginRedirectTarget(targetPath);
    const redirectTo = safeTarget ? `/login?redirect=${encodeURIComponent(safeTarget)}` : '/login';
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

    const publicPaths = ['/login', '/setup', '/logout'];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    // Dev bypass: khi VITE_DISABLE_AUTH=true, tự động inject mock admin và bỏ qua login
    const disableAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';
    if (disableAuth && !token) {
      localStorage.setItem('authToken', 'dev-bypass-token');
      localStorage.setItem('userEmail', 'dev@local');
      localStorage.setItem('userRole', 'admin');
      userEmail = 'dev@local';
      userRole = 'admin';
      authGatePassed = true;
      return;
    }

    if (!token && !isPublicPath) {
      redirectToLogin(pathname + page.url.search);
      return;
    }

    // Auth is valid (token present, or on a public path) — allow shell to render
    authGatePassed = true;

    if (!token || isPublicPath) return;

    const caps = capabilities;
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
{:else if !authGatePassed}
  <!-- blank screen while redirect to /login is in progress -->
{:else}
  <div class="min-h-screen bg-surface-1 text-slate-100">
    <!-- WCAG 2.4.1 – Skip to main content -->
    <a href="#main-content" class="skip-link">
      {$isLoading ? 'Skip to content' : $_('a11y.skipToContent', { default: 'Skip to content' })}
    </a>

    <ToastHost />

    <header class="sticky top-0 z-50 header-always-dark">
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
            <div class="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
              {$orgLogoLetters}
            </div>
            <span class="text-sm">{$isLoading ? '' : $orgStore.name}</span>
          </a>
        </div>

        <div class="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
          <LanguageSwitcher />
          <NotificationCenter />
          <button
            type="button"
            onclick={() => theme.toggle()}
            aria-label={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            class="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-300 hover:bg-surface-3/60 hover:text-slate-100 transition-colors"
          >
            {#if $theme === 'dark'}
              <Sun class="w-3.5 h-3.5" />
            {:else}
              <Moon class="w-3.5 h-3.5" />
            {/if}
          </button>
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
