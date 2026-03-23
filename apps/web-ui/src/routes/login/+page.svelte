<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Loader2, Lock, Mail } from 'lucide-svelte';

  import { login } from '$lib/api/auth';
  import { defaultLandingPath, getCapabilities } from '$lib/auth/capabilities';
  import { _, isLoading as i18nLoading } from '$lib/i18n';
  import { getSetupStatus } from '$lib/api/setup';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let systemInitialized = $state(false);

  function isSafePostLoginRedirect(path: string | null): path is string {
    if (!path || !path.startsWith('/')) return false;
    if (path.startsWith('/login') || path.startsWith('/setup') || path.startsWith('/logout')) return false;
    return true;
  }

  async function handleLogin(): Promise<void> {
    if (!email.trim() || !password) {
      error = $i18nLoading ? 'Email and password are required' : $_('auth.errors.required', { default: 'Email và mật khẩu là bắt buộc' });
      return;
    }

    loading = true;
    error = null;
    try {
      const result = await login(email.trim(), password);
      const query = new URLSearchParams(window.location.search);
      const redirect = query.get('redirect');
      if (isSafePostLoginRedirect(redirect)) {
        goto(redirect, { replaceState: true });
        return;
      }

      // Redirect dùng role từ login response — caps chưa load từ Policy Library
      // nhưng defaultLandingPath chỉ cần biết loại role (admin/manager/user) để chọn trang
      const caps = getCapabilities(result.user.role);
      const landing = defaultLandingPath(caps);
      goto(landing, { replaceState: true });
    } catch (err) {
      error = err instanceof Error ? err.message : ($i18nLoading ? 'Login failed' : $_('auth.errors.failed', { default: 'Đăng nhập thất bại' }));
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      const caps = getCapabilities(localStorage.getItem('userRole'));
      goto(defaultLandingPath(caps), { replaceState: true });
      return;
    }
    // Kiểm tra trạng thái setup để ẩn/hiện link /setup
    void getSetupStatus()
      .then((s) => { systemInitialized = s.initialized; })
      .catch(() => { /* ignore — setup API có thể chưa sẵn sàng */ });
  });
</script>

<svelte:head>
  <title>{$i18nLoading ? 'Login' : $_('auth.login', { default: 'Đăng nhập' })} - QuanLyThietBi</title>
</svelte:head>

<div class="login-bg">
  <div class="w-full max-w-md animate-slide-up">
    <div class="login-card">
      <!-- Logo & heading -->
      <div class="mb-8 text-center">
        <div class="login-logo">QLTB</div>
        <h1 class="login-title">
          {$i18nLoading ? 'Sign in' : $_('auth.signIn', { default: 'Đăng nhập' })}
        </h1>
        <p class="login-subtitle">
          {$i18nLoading ? 'Access the asset management system' : $_('auth.signInSubtitle', { default: 'Truy cập hệ thống Quản Lý Thiết Bị' })}
        </p>
      </div>

      {#if error}
        <div class="login-error mb-6" role="alert" aria-live="polite">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      <form class="space-y-5" onsubmit={(event) => {
        event.preventDefault();
        void handleLogin();
      }}>
        <div class="space-y-1.5">
          <label for="login-email" class="login-label">Email</label>
          <div class="login-input-wrap">
            <div class="login-input-icon">
              <Mail class="h-4 w-4" />
            </div>
            <input
              id="login-email"
              class="login-input"
              type="email"
              bind:value={email}
              autocomplete="email"
              disabled={loading}
              required
              placeholder="admin@example.com"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <label for="login-password" class="login-label">
            {$i18nLoading ? 'Password' : $_('auth.password', { default: 'Mật khẩu' })}
          </label>
          <div class="login-input-wrap">
            <div class="login-input-icon">
              <Lock class="h-4 w-4" />
            </div>
            <input
              id="login-password"
              class="login-input"
              type="password"
              bind:value={password}
              autocomplete="current-password"
              disabled={loading}
              required
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          class="login-btn mt-2"
          type="submit"
          disabled={loading}
        >
          {#if loading}
            <Loader2 class="h-4 w-4 animate-spin" />
          {/if}
          {$i18nLoading ? 'Sign in' : $_('auth.signIn', { default: 'Đăng nhập' })}
        </button>
      </form>

      {#if !systemInitialized}
        <div class="login-footer">
          {$i18nLoading ? 'First time? Visit' : $_('auth.setupHint', { default: 'Lần đầu sử dụng? Truy cập' })}
          <a href="/setup">/setup</a>
          {$i18nLoading ? 'to initialize.' : $_('auth.setupHintSuffix', { default: 'để khởi tạo.' })}
        </div>
      {/if}
    </div>
  </div>
</div>

