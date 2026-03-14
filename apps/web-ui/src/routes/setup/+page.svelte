<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { _ } from '$lib/i18n';

  import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Copy,
    Loader2,
    RefreshCw
  } from 'lucide-svelte';

  import {
    createSetupAdmin,
    finalizeSetup,
    getApiHealth,
    getSetupJob,
    getSetupStatus,
    runSetupMigrate,
    runSetupSeed,
    saveSetupOrgInfo,
    SetupApiError,
    type SetupAdminResult,
    type SetupStatusResponse
  } from '$lib/api/setup';

  type ActionState = 'idle' | 'running' | 'success' | 'failed';
  type JobKind = 'migrate' | 'seed';

  const COMMON_PASSWORDS = new Set([
    '123456',
    '123456789',
    '12345678',
    'password',
    'qwerty',
    'abc123',
    '111111',
    '123123',
    'admin',
    'admin123',
    'password123',
    'letmein'
  ]);

  const dockerCommand = 'docker compose up -d postgres api web-ui pgadmin';
  const manualCommand = 'pnpm db:migrate && pnpm db:seed';
  const pgAdminLink = 'http://localhost:8080';
  const loginLink = '/login';

  let loading = $state(true);
  let checkingStatus = $state(false);
  let wizardAvailable = $state(true);
  let status = $state<SetupStatusResponse | null>(null);
  let apiHealthOk = $state(false);
  let globalError = $state<string | null>(null);
  let infoMessage = $state<string | null>(null);
  let copiedKey = $state<string | null>(null);

  let migrateState = $state<ActionState>('idle');
  let seedState = $state<ActionState>('idle');
  let migrateLogs = $state<string[]>([]);
  let seedLogs = $state<string[]>([]);
  let migrateExpanded = $state(false);
  let seedExpanded = $state(false);

  let adminBusy = $state(false);
  let adminError = $state<string | null>(null);
  let adminCreated = $state<SetupAdminResult | null>(null);
  let adminForm = $state({
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    locale: 'vi' as 'vi' | 'en'
  });

  let orgBusy = $state(false);
  let orgError = $state<string | null>(null);
  let orgSaved = $state(false);
  let orgForm = $state({
    name: '',
    shortName: '',
    address: '',
    phone: '',
    taxCode: '',
    website: ''
  });

  let finalizeBusy = $state(false);
  let finalizeError = $state<string | null>(null);
  let finalizedOk = $state(false);

  let disposed = false;

  function errorToMessage(error: unknown): string {
    if (error instanceof SetupApiError) {
      const details =
        error.details && typeof error.details === 'object'
          ? Object.values(error.details as Record<string, string>).filter(Boolean)
          : [];
      if (details.length > 0) {
        return `${error.message}: ${details[0]}`;
      }
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }

  function normalizeUsername(raw: string): string | undefined {
    const value = raw.trim();
    if (!value) return undefined;
    if (!/^[A-Za-z0-9._@-]+$/.test(value)) return undefined;
    return value;
  }

  function chipClass(ok: boolean): string {
    return ok ? 'setup-chip setup-chip-ok' : 'setup-chip setup-chip-fail';
  }

  function actionBadgeClass(state: ActionState): string {
    if (state === 'success') return 'setup-chip setup-chip-ok';
    if (state === 'failed') return 'setup-chip setup-chip-fail';
    if (state === 'running') return 'setup-chip setup-chip-running';
    return 'setup-chip setup-chip-idle';
  }

  function actionLabel(state: ActionState): string {
    if (state === 'success') return 'success';
    if (state === 'failed') return 'failed';
    if (state === 'running') return 'running';
    return 'idle';
  }

  function validateAdminForm(): string | null {
    if (!adminForm.fullName.trim()) return `${$_('setup.wizard.fullName')} is required`;
    if (!adminForm.email.trim()) return `${$_('setup.wizard.email')} is required`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email.trim())) return 'Invalid email format';
    if (!adminForm.password) return `${$_('setup.wizard.password')} is required`;
    if (adminForm.password !== adminForm.confirmPassword) return 'Password confirmation does not match';
    if (adminForm.password.length < 12) return 'Password must be at least 12 characters';
    if (!/[A-Z]/.test(adminForm.password)) return 'Password must include at least one uppercase letter';
    if (!/[a-z]/.test(adminForm.password)) return 'Password must include at least one lowercase letter';
    if (!/[0-9]/.test(adminForm.password)) return 'Password must include at least one number';
    if (!/[^A-Za-z0-9]/.test(adminForm.password)) return 'Password must include at least one special character';
    if (COMMON_PASSWORDS.has(adminForm.password.toLowerCase())) return 'Password is too common';
    return null;
  }

  async function submitOrg(): Promise<void> {
    if (orgBusy) return;
    orgError = null;
    if (!orgForm.name.trim()) {
      orgError = `${$_('setup.wizard.orgName')} is required`;
      return;
    }
    if (!orgForm.shortName.trim()) {
      orgError = `${$_('setup.wizard.orgShortName')} is required`;
      return;
    }
    orgBusy = true;
    try {
      await saveSetupOrgInfo({
        name: orgForm.name.trim(),
        shortName: orgForm.shortName.trim(),
        address: orgForm.address.trim() || undefined,
        phone: orgForm.phone.trim() || undefined,
        taxCode: orgForm.taxCode.trim() || undefined,
        website: orgForm.website.trim() || undefined,
      });
      orgSaved = true;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('orgName', orgForm.name.trim());
        localStorage.setItem('orgShortName', orgForm.shortName.trim().toUpperCase());
      }
    } catch (error) {
      orgError = errorToMessage(error);
    } finally {
      orgBusy = false;
    }
  }

  async function copyToClipboard(key: string, value: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    copiedKey = key;
    setTimeout(() => {
      if (copiedKey === key) copiedKey = null;
    }, 1500);
  }

  async function refreshHealth(): Promise<void> {
    const apiHealth = await getApiHealth();
    apiHealthOk = apiHealth.ok;
  }

  async function refreshStatus(silent = false): Promise<void> {
    if (!silent) {
      checkingStatus = true;
      globalError = null;
      infoMessage = $_('setup.wizard.refreshing');
    }

    try {
      const nextStatus = await getSetupStatus();
      wizardAvailable = true;
      status = nextStatus;

      if (nextStatus.migrations.ok && migrateState !== 'running') migrateState = 'success';
      if (nextStatus.seed.ok && seedState !== 'running') seedState = 'success';

      if (nextStatus.initialized) {
        finalizedOk = true;
        infoMessage = $_('setup.wizard.alreadyInitialized');
        // Chỉ redirect tự động khi đang chạy wizard (không phải lúc khởi tạo trang — handled in onMount)
        if (!loading) {
          setTimeout(() => {
            if (!disposed) goto('/login', { replaceState: true });
          }, 1500);
        }
      } else if (!silent) {
        infoMessage = null;
      }
    } catch (error) {
      if (error instanceof SetupApiError && error.status === 404) {
        wizardAvailable = false;
        status = null;
        infoMessage = null;
        return;
      }
      globalError = errorToMessage(error);
    } finally {
      checkingStatus = false;
      if (!silent && infoMessage === $_('setup.wizard.refreshing')) {
        infoMessage = null;
      }
    }
  }

  async function pollJob(kind: JobKind, jobId: string): Promise<void> {
    while (!disposed) {
      try {
        const job = await getSetupJob(jobId);
        if (kind === 'migrate') {
          migrateLogs = [...job.logs];
          migrateState =
            job.status === 'running' ? 'running' : job.status === 'success' ? 'success' : 'failed';
          if (job.status === 'failed' && job.error) {
            globalError = job.error;
          }
        } else {
          seedLogs = [...job.logs];
          seedState = job.status === 'running' ? 'running' : job.status === 'success' ? 'success' : 'failed';
          if (job.status === 'failed' && job.error) {
            globalError = job.error;
          }
        }

        if (job.status !== 'running') {
          await refreshStatus(true);
          return;
        }
      } catch (error) {
        const message = errorToMessage(error);
        if (kind === 'migrate') {
          migrateState = 'failed';
          migrateLogs = [...migrateLogs, `ERROR: ${message}`];
        } else {
          seedState = 'failed';
          seedLogs = [...seedLogs, `ERROR: ${message}`];
        }
        globalError = message;
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  async function runMigrate(): Promise<void> {
    if (!wizardAvailable || migrateState === 'running') return;
    globalError = null;
    migrateState = 'running';
    migrateLogs = [];
    migrateExpanded = true;

    try {
      const job = await runSetupMigrate();
      await pollJob('migrate', job.jobId);
    } catch (error) {
      migrateState = 'failed';
      const message = errorToMessage(error);
      migrateLogs = [...migrateLogs, `ERROR: ${message}`];
      globalError = message;
    }
  }

  async function runSeed(): Promise<void> {
    if (!wizardAvailable || seedState === 'running') return;
    globalError = null;
    seedState = 'running';
    seedLogs = [];
    seedExpanded = true;

    try {
      const job = await runSetupSeed();
      await pollJob('seed', job.jobId);
    } catch (error) {
      seedState = 'failed';
      const message = errorToMessage(error);
      seedLogs = [...seedLogs, `ERROR: ${message}`];
      globalError = message;
    }
  }

  async function submitAdmin(): Promise<void> {
    if (!wizardAvailable || adminBusy) return;
    adminError = null;
    const validationError = validateAdminForm();
    if (validationError) {
      adminError = validationError;
      return;
    }

    adminBusy = true;
    try {
      const created = await createSetupAdmin({
        fullName: adminForm.fullName.trim(),
        email: adminForm.email.trim().toLowerCase(),
        username: normalizeUsername(adminForm.username),
        password: adminForm.password,
        locale: adminForm.locale
      });
      adminCreated = created;
      adminForm.password = '';
      adminForm.confirmPassword = '';
      // Also save org info if filled and not yet saved
      if (!orgSaved && orgForm.name.trim()) {
        void submitOrg();
      }
      if (status) {
        status = { ...status, adminExists: true };
      }
      await refreshStatus(true);
    } catch (error) {
      adminError = errorToMessage(error);
    } finally {
      adminBusy = false;
    }
  }

  async function finalizeWizard(): Promise<void> {
    if (!wizardAvailable || finalizeBusy) return;
    finalizeError = null;
    finalizeBusy = true;
    try {
      await finalizeSetup({});
      finalizedOk = true;
      await refreshStatus(true);
      setTimeout(() => {
        if (!disposed) goto('/login');
      }, 2000);
    } catch (error) {
      finalizeError = errorToMessage(error);
    } finally {
      finalizeBusy = false;
    }
  }

  const migrateDone = $derived.by(() => Boolean(status?.migrations.ok) || migrateState === 'success');
  const seedDone = $derived.by(() => Boolean(status?.seed.ok) || seedState === 'success');
  const adminDone = $derived.by(() => Boolean(status?.adminExists) || adminCreated !== null);
  const servicesDone = $derived.by(() => Boolean(status?.db.ok) && apiHealthOk);
  const canFinalize = $derived.by(() =>
    Boolean(status?.db.ok) && migrateDone && seedDone && adminDone && !status?.initialized
  );

  const currentStep = $derived.by(() => {
    if (status?.initialized || finalizedOk) return 4;
    if (adminDone) return 4;
    if (migrateDone && seedDone) return 3;
    if (servicesDone) return 2;
    return 1;
  });

  onMount(() => {
    void (async () => {
      await Promise.all([refreshStatus(true), refreshHealth()]);
      if (status?.initialized) {
        if (!disposed) goto('/login', { replaceState: true });
        return;
      }
      loading = false;
    })();

    return () => {
      disposed = true;
    };
  });
</script>

<svelte:head>
  <title>{$_('setup.wizard.pageTitle')}</title>
</svelte:head>

<div class="setup-bg">
  <div class="mx-auto w-full max-w-5xl space-y-6">
    <header class="setup-section">
      <h1 class="setup-title">{$_('setup.wizard.title')}</h1>
      <p class="setup-subtitle">{wizardAvailable ? $_('setup.wizard.subtitleWizard') : $_('setup.wizard.subtitleFallback')}</p>

      {#if !loading}
        <!-- Step progress indicator -->
        <div class="mt-6 flex items-center gap-0">
          {#each [
            { num: 1, label: $_('setup.wizard.stepServices'), done: servicesDone },
            { num: 2, label: $_('setup.wizard.stepMigration'), done: migrateDone && seedDone },
            { num: 3, label: $_('setup.wizard.stepAdmin'), done: adminDone },
            { num: 4, label: $_('setup.wizard.stepFinalize'), done: status?.initialized || finalizedOk }
          ] as step, i (step.num)}
            <div class="flex items-center" style="flex: 1">
              <div class="flex flex-col items-center gap-1" style="min-width: 72px">
                <div class={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step.done
                    ? 'bg-green-600 text-white'
                    : currentStep === step.num
                      ? 'bg-primary text-white ring-2 ring-primary/40'
                      : 'border-2 border-slate-600 text-slate-400'
                }`}>
                  {#if step.done}
                    <CheckCircle2 class="h-4 w-4" />
                  {:else}
                    {step.num}
                  {/if}
                </div>
                <span class={`text-center text-[10px] leading-tight ${
                  step.done ? 'text-green-400' : currentStep === step.num ? 'text-primary' : 'text-slate-500'
                }`}>{step.label}</span>
              </div>
              {#if i < 3}
                <div class={`h-0.5 flex-1 mx-1 transition-colors ${
                  step.done ? 'bg-green-600' : 'bg-slate-700'
                }`}></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </header>

    {#if loading}
      <section class="setup-section">
        <div class="flex items-center gap-3" style="color: var(--color-text-muted)">
          <Loader2 class="h-5 w-5 animate-spin" style="color: var(--color-primary)" />
          <span>{$_('setup.wizard.checking')}</span>
        </div>
      </section>
    {:else}
      {#if infoMessage}
        <section class="setup-alert setup-alert-info">
          <CheckCircle2 class="h-4 w-4" />
          <span>{infoMessage}</span>
        </section>
      {/if}

      {#if globalError}
        <section class="setup-alert setup-alert-error">
          <AlertTriangle class="h-4 w-4" />
          <span>{globalError}</span>
        </section>
      {/if}

      <!-- Step 1: Services / Health -->
      <section class="setup-section">
        <div class="flex items-center justify-between gap-4">
          <h2 class="setup-step-title">{$_('setup.wizard.step1Title')}</h2>
          <button
            class="setup-btn setup-btn-ghost"
            onclick={() => { void Promise.all([refreshStatus(), refreshHealth()]); }}
            disabled={checkingStatus}
          >
            <RefreshCw class={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} />
            {$_('setup.wizard.recheck')}
          </button>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <span class={chipClass(apiHealthOk)}>{$_('setup.wizard.apiHealth')}: {apiHealthOk ? 'OK' : 'FAIL'}</span>
          <span class={chipClass(Boolean(status?.db.ok))}>{$_('setup.wizard.dbHealth')}: {status?.db.ok ? 'OK' : 'FAIL'}</span>
          <span class={chipClass(Boolean(status?.migrations.ok))}>{$_('setup.wizard.migrations')}: {status?.migrations.ok ? 'OK' : 'PENDING'}</span>
          <span class={chipClass(Boolean(status?.seed.ok))}>{$_('setup.wizard.seed')}: {status?.seed.ok ? 'OK' : 'PENDING'}</span>
          <span class={chipClass(Boolean(status?.adminExists))}>{$_('setup.wizard.admin')}: {status?.adminExists ? 'OK' : 'PENDING'}</span>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div class="setup-code-box">
            <div class="setup-code-label">{$_('setup.wizard.commandDocker')}</div>
            <pre class="setup-code-pre"><code>{dockerCommand}</code></pre>
            <button class="setup-copy-btn" onclick={() => void copyToClipboard('docker', dockerCommand)}>
              <Copy class="h-3.5 w-3.5" />
              {copiedKey === 'docker' ? $_('setup.wizard.copied') : $_('setup.wizard.copy')}
            </button>
          </div>
          <div class="setup-code-box">
            <div class="setup-code-label">{$_('setup.wizard.commandManual')}</div>
            <pre class="setup-code-pre"><code>{manualCommand}</code></pre>
            <button class="setup-copy-btn" onclick={() => void copyToClipboard('manual', manualCommand)}>
              <Copy class="h-3.5 w-3.5" />
              {copiedKey === 'manual' ? $_('setup.wizard.copied') : $_('setup.wizard.copy')}
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <a class="setup-link" href={pgAdminLink} target="_blank" rel="noreferrer">{$_('setup.wizard.linkPgAdmin')}</a>
          <a class="setup-link" href={loginLink}>{$_('setup.wizard.linkLogin')}</a>
        </div>
      </section>

      <!-- Step 2: Migration and Seed -->
      <section class="setup-section">
        <h2 class="setup-step-title">{$_('setup.wizard.step2Title')}</h2>
        {#if !wizardAvailable}
          <p class="mt-2" style="color: var(--color-warning); font-size: 0.8125rem;">{$_('setup.wizard.wizardUnavailableHint')}</p>
        {/if}

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            class="setup-btn setup-btn-primary"
            onclick={() => void runMigrate()}
            disabled={!wizardAvailable || migrateState === 'running' || status?.initialized}
          >
            {#if migrateState === 'running'}<Loader2 class="h-4 w-4 animate-spin" />{/if}
            {$_('setup.wizard.runMigration')}
          </button>

          <button
            class="setup-btn setup-btn-secondary"
            onclick={() => void runSeed()}
            disabled={!wizardAvailable || seedState === 'running' || status?.initialized}
          >
            {#if seedState === 'running'}<Loader2 class="h-4 w-4 animate-spin" />{/if}
            {$_('setup.wizard.runSeed')}
          </button>

          <button
            class="setup-btn setup-btn-ghost"
            onclick={() => void refreshStatus()}
            disabled={checkingStatus}
          >
            <RefreshCw class={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} />
            {$_('setup.wizard.recheck')}
          </button>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <span class={actionBadgeClass(migrateState)}>migration: {actionLabel(migrateState)}</span>
          <span class={actionBadgeClass(seedState)}>seed: {actionLabel(seedState)}</span>
        </div>

        <div class="mt-4 space-y-3">
          <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
            <button class="setup-log-toggle" onclick={() => (migrateExpanded = !migrateExpanded)}>
              <span>Migration logs ({migrateLogs.length})</span>
              {#if migrateExpanded}<ChevronUp class="h-4 w-4" />{:else}<ChevronDown class="h-4 w-4" />{/if}
            </button>
            {#if migrateExpanded}
              <pre class="setup-log-content"><code>{migrateLogs.join('\n') || 'No logs yet'}</code></pre>
            {/if}
          </div>

          <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
            <button class="setup-log-toggle" onclick={() => (seedExpanded = !seedExpanded)}>
              <span>Seed logs ({seedLogs.length})</span>
              {#if seedExpanded}<ChevronUp class="h-4 w-4" />{:else}<ChevronDown class="h-4 w-4" />{/if}
            </button>
            {#if seedExpanded}
              <pre class="setup-log-content"><code>{seedLogs.join('\n') || 'No logs yet'}</code></pre>
            {/if}
          </div>
        </div>
      </section>

      <!-- Step 3: Create first admin -->
      <section class="setup-section">
        <h2 class="setup-step-title">{$_('setup.wizard.step3Title')}</h2>

        <!-- Org Info subsection -->
        <h3 class="mt-4 mb-3 text-sm font-semibold" style="color: var(--color-text-muted);">{$_('setup.wizard.orgInfoTitle')}</h3>

        {#if orgSaved}
          <div class="setup-alert setup-alert-success mb-3">
            <CheckCircle2 class="h-4 w-4" />
            <span>{$_('setup.wizard.orgSaved')}</span>
          </div>
        {/if}

        <form class="grid gap-4 md:grid-cols-2" onsubmit={(event) => { event.preventDefault(); void submitOrg(); }}>
          <label class="setup-label">
            <span>{$_('setup.wizard.orgName')} <span style="color: var(--color-error)">*</span></span>
            <input class="setup-input" bind:value={orgForm.name} disabled={orgBusy || orgSaved} placeholder="{$_('setup.wizard.orgNamePlaceholder')}" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.orgShortName')} <span style="color: var(--color-error)">*</span></span>
            <input class="setup-input" bind:value={orgForm.shortName} disabled={orgBusy || orgSaved} placeholder="e.g. ABC" maxlength="20" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.orgAddress')}</span>
            <input class="setup-input" bind:value={orgForm.address} disabled={orgBusy || orgSaved} />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.orgPhone')}</span>
            <input class="setup-input" bind:value={orgForm.phone} type="tel" disabled={orgBusy || orgSaved} />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.orgTaxCode')}</span>
            <input class="setup-input" bind:value={orgForm.taxCode} disabled={orgBusy || orgSaved} />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.orgWebsite')}</span>
            <input class="setup-input" bind:value={orgForm.website} type="url" disabled={orgBusy || orgSaved} />
          </label>

          <div class="md:col-span-2">
            <button type="submit" class="setup-btn setup-btn-secondary" disabled={orgBusy || orgSaved}>
              {#if orgBusy}<Loader2 class="h-4 w-4 animate-spin" />{/if}
              {orgSaved ? $_('setup.wizard.orgSaved') : $_('setup.wizard.saveOrg')}
            </button>
          </div>
        </form>

        {#if orgError}
          <div class="setup-alert setup-alert-error mt-3">
            <AlertTriangle class="h-4 w-4" />
            <span>{orgError}</span>
          </div>
        {/if}

        <hr class="my-5" style="border-color: var(--color-border);" />
        <h3 class="mb-3 text-sm font-semibold" style="color: var(--color-text-muted);">{$_('setup.wizard.adminAccountTitle')}</h3>

        {#if status?.adminExists && !adminCreated}
          <div class="setup-alert setup-alert-success mt-3">
            <CheckCircle2 class="h-4 w-4" />
            <span>{$_('setup.wizard.adminExistsHint')}</span>
          </div>
        {/if}

        {#if adminCreated}
          <div class="setup-alert setup-alert-success mt-3">
            <CheckCircle2 class="h-4 w-4" />
            <div>
              <p style="font-weight: 600;">{$_('setup.wizard.credentialsReady')}</p>
              <p class="mt-1">Email: <span style="font-weight: 500;">{adminCreated.email}</span></p>
              <p>Username: <span style="font-weight: 500;">{adminCreated.username ?? '-'}</span></p>
              <p>Role: <span style="font-weight: 500;">{adminCreated.role}</span></p>
            </div>
          </div>
        {/if}

        <form class="mt-4 grid gap-4 md:grid-cols-2" onsubmit={(event) => {
          event.preventDefault();
          void submitAdmin();
        }}>
          <label class="setup-label">
            <span>{$_('setup.wizard.fullName')}</span>
            <input class="setup-input" bind:value={adminForm.fullName} disabled={adminBusy || status?.initialized || status?.adminExists} autocomplete="name" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.email')}</span>
            <input class="setup-input" bind:value={adminForm.email} type="email" disabled={adminBusy || status?.initialized || status?.adminExists} autocomplete="email" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.username')}</span>
            <input class="setup-input" bind:value={adminForm.username} disabled={adminBusy || status?.initialized || status?.adminExists} autocomplete="username" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.locale')}</span>
            <select class="setup-input setup-select" bind:value={adminForm.locale} disabled={adminBusy || status?.initialized || status?.adminExists}>
              <option value="vi">Tieng Viet</option>
              <option value="en">English</option>
            </select>
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.password')}</span>
            <input class="setup-input" bind:value={adminForm.password} type="password" disabled={adminBusy || status?.initialized || status?.adminExists} autocomplete="new-password" />
          </label>

          <label class="setup-label">
            <span>{$_('setup.wizard.confirmPassword')}</span>
            <input class="setup-input" bind:value={adminForm.confirmPassword} type="password" disabled={adminBusy || status?.initialized || status?.adminExists} autocomplete="new-password" />
          </label>

          <div class="md:col-span-2">
            <button type="submit" class="setup-btn setup-btn-primary" disabled={adminBusy || status?.initialized || status?.adminExists}>
              {#if adminBusy}<Loader2 class="h-4 w-4 animate-spin" />{/if}
              {$_('setup.wizard.createAdmin')}
            </button>
          </div>
        </form>

        {#if adminError}
          <div class="setup-alert setup-alert-error mt-4">
            <AlertTriangle class="h-4 w-4" />
            <span>{adminError}</span>
          </div>
        {/if}
      </section>

      <!-- Finalize -->
      <section class="setup-section">
        <h2 class="setup-step-title">{$_('setup.wizard.finalizeTitle')}</h2>

        {#if finalizeError}
          <div class="setup-alert setup-alert-error mt-3">
            <AlertTriangle class="h-4 w-4" />
            <span>{finalizeError}</span>
          </div>
        {/if}

        {#if finalizedOk}
          <div class="setup-alert setup-alert-success mt-3">
            <CheckCircle2 class="h-4 w-4" />
            <span>{$_('setup.wizard.successFinalize')}</span>
          </div>
        {/if}

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            class="setup-btn setup-btn-success"
            onclick={() => void finalizeWizard()}
            disabled={!wizardAvailable || !canFinalize || finalizeBusy}
          >
            {#if finalizeBusy}<Loader2 class="h-4 w-4 animate-spin" />{/if}
            {$_('setup.wizard.finalize')}
          </button>
          <a class="setup-btn setup-btn-ghost" style="text-decoration: none;" href="/login">
            {$_('setup.wizard.loginRedirect')}
          </a>
        </div>
      </section>

      {#if !wizardAvailable}
        <section class="setup-alert setup-alert-warning">
          <AlertTriangle class="h-4 w-4" />
          <div>
            <p style="font-weight: 600;">{$_('setup.wizard.wizardUnavailableTitle')}</p>
            <p class="mt-1">{$_('setup.wizard.wizardUnavailableHint')}</p>
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>
