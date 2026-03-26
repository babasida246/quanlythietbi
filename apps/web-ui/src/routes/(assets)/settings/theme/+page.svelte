<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Button } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';
  import {
    TOKEN_GROUPS,
    DEFAULT_DARK,
    DEFAULT_LIGHT,
    themeCustomizer,
    tokenHexValue,
    type ThemeMode,
    type ThemeTokenDef
  } from '$lib/stores/themeCustomizer';
  import {
    THEME_PRESETS,
    themePresets,
    type ThemePresetId
  } from '$lib/stores/themePresets';

  type SettingsTab = 'presets' | 'tokens';

  let settingsTab = $state<SettingsTab>('presets');
  let mode = $state<ThemeMode>('dark');

  const config = $derived($themeCustomizer);
  const activePreset = $derived($themePresets);

  // Count tokens that differ from defaults in the current mode
  const modifiedCount = $derived.by(() => {
    const defaults = mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT;
    const current = mode === 'dark' ? config.dark : config.light;
    return Object.entries(current).filter(([k, v]) => v !== defaults[k]).length;
  });

  function onPick(token: ThemeTokenDef, event: Event) {
    const hex = (event.target as HTMLInputElement).value;
    themeCustomizer.setTokenFromHex(mode, token.key, hex);
  }

  function getHex(token: ThemeTokenDef): string {
    return tokenHexValue(config, mode, token);
  }

  function selectPreset(id: ThemePresetId) {
    themePresets.setTheme(id);
  }

  function t(key: string, fallback: string): string {
    return $isLoading ? fallback : $_(key, { default: fallback });
  }
</script>

<div class="page-shell page-content">
  <PageHeader
    title={$isLoading ? 'Theme & Interface' : $_('themeCustomizer.title')}
    subtitle={$isLoading ? 'Customize colors for the interface.' : $_('themeCustomizer.subtitle')}
  ></PageHeader>

  <div class="card p-3">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        class:bg-primary={settingsTab === 'presets'}
        class:text-white={settingsTab === 'presets'}
        class:bg-surface-3={settingsTab !== 'presets'}
        class:text-slate-300={settingsTab !== 'presets'}
        onclick={() => (settingsTab = 'presets')}
      >
        {t('themeCustomizer.tabs.presets', 'Theme presets')}
      </button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        class:bg-primary={settingsTab === 'tokens'}
        class:text-white={settingsTab === 'tokens'}
        class:bg-surface-3={settingsTab !== 'tokens'}
        class:text-slate-300={settingsTab !== 'tokens'}
        onclick={() => (settingsTab = 'tokens')}
      >
        {t('themeCustomizer.tabs.tokens', 'Advanced colors')}
      </button>
    </div>
  </div>

  {#if settingsTab === 'presets'}
    <div class="card p-4 space-y-3">
      <h2 class="text-sm font-semibold" style="color: var(--color-text)">
        {$isLoading ? 'Color Themes' : $_('themePresets.title')}
      </h2>
      <p class="text-xs" style="color: var(--color-text-muted)">
        {$isLoading ? 'Select a preset color scheme for the entire application.' : $_('themePresets.subtitle')}
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {#each THEME_PRESETS as preset}
          {@const isActive = activePreset === preset.id}
          <button
            type="button"
            onclick={() => selectPreset(preset.id)}
            class="theme-preset-card relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all"
            style="
              border-color: {isActive ? 'var(--color-primary)' : 'var(--color-border)'};
              background: {isActive ? 'var(--color-primary-muted)' : 'rgb(var(--color-surface-2))'};
            "
          >
            {#if preset.recommended}
              <span class="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style="background: var(--color-success-bg); color: var(--color-success)">
                {$isLoading ? 'Recommended' : $_('themePresets.recommended')}
              </span>
            {/if}
            {#if isActive}
              <span class="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style="background: var(--color-primary); color: var(--color-primary-contrast)">✓</span>
            {/if}
            <div class="flex gap-1 pt-3">
              {#each preset.swatches as color}
                <span
                  class="h-4 w-4 rounded-sm border"
                  style="background: {color}; border-color: rgba(0,0,0,0.12)"
                ></span>
              {/each}
            </div>
            <div>
              <p class="text-xs font-semibold" style="color: var(--color-text)">
                {$isLoading ? preset.nameKey : $_(preset.nameKey)}
              </p>
              <p class="mt-0.5 text-[11px] leading-tight" style="color: var(--color-text-muted)">
                {$isLoading ? preset.descKey : $_(preset.descKey)}
              </p>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <div class="card p-4 space-y-3">
      <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Preview' : $_('themeCustomizer.preview')}</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-md border p-3" style="border-color: var(--color-border); background: rgb(var(--color-surface-2))">
          <p class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? 'Surface sample' : $_('themeCustomizer.surfaceSample')}</p>
          <p class="text-xs mt-1" style="color: var(--color-text-muted)">{$isLoading ? 'Secondary text sample' : $_('themeCustomizer.mutedSample')}</p>
          <div class="mt-3 flex gap-2">
            <button class="btn btn-sm btn-primary">Primary</button>
            <button class="btn btn-sm btn-secondary">Secondary</button>
            <button class="btn btn-sm btn-danger">Danger</button>
          </div>
        </div>
        <div class="rounded-md border p-3" style="border-color: var(--color-border); background: rgb(var(--color-surface-2))">
          <p class="text-sm font-semibold" style="color: var(--color-text)">Sidebar/Header</p>
          <div class="mt-2 rounded-md p-3" style="background: var(--sidebar-bg)">
            <div class="inline-flex rounded px-2 py-1 text-xs" style="background: var(--sidebar-accent); color: var(--sidebar-accent-text)">Active nav</div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if settingsTab === 'tokens'}
    <div class="card p-4 space-y-4">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-sm font-semibold" style="color: var(--color-text)">
            {$isLoading ? 'Custom Color Overrides' : $_('themeCustomizer.sectionTitle')}
          </h2>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            {$isLoading ? 'Fine-tune individual tokens on top of the selected theme.' : $_('themeCustomizer.sectionSubtitle')}
          </p>
        </div>
        {#if config.enabled && modifiedCount > 0}
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0" style="background: var(--color-primary-muted); color: var(--color-primary)">
            {modifiedCount} override{modifiedCount !== 1 ? 's' : ''} active
          </span>
        {:else if config.enabled}
          <span class="rounded-full px-2.5 py-0.5 text-xs" style="background: var(--color-success-bg); color: var(--color-success)">
            Active (no overrides)
          </span>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-2">
          <button class="btn btn-sm {mode === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick={() => (mode = 'dark')}>
            {$isLoading ? 'Dark Mode' : $_('themeCustomizer.dark')}
          </button>
          <button class="btn btn-sm {mode === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick={() => (mode = 'light')}>
            {$isLoading ? 'Light Mode' : $_('themeCustomizer.light')}
          </button>
        </div>
        <div class="ml-auto flex gap-2">
          {#if config.enabled}
            <Button variant="secondary" size="sm" onclick={() => themeCustomizer.setEnabled(false)}>
              Disable overrides
            </Button>
          {/if}
          <Button variant="secondary" size="sm" onclick={() => themeCustomizer.resetMode(mode)}>
            {$isLoading ? 'Reset mode' : $_('themeCustomizer.resetMode')}
          </Button>
          <Button variant="danger" size="sm" onclick={() => themeCustomizer.resetAll()}>
            {$isLoading ? 'Reset all' : $_('themeCustomizer.resetAll')}
          </Button>
        </div>
      </div>

      {#if !config.enabled}
        <div class="rounded-md border px-3 py-2.5 text-sm" style="border-color: var(--color-primary-muted); background: var(--color-primary-muted); color: var(--color-primary)">
          Pick any color below — overrides will activate automatically and save to your profile.
        </div>
      {/if}

      {#each TOKEN_GROUPS as group}
        <section class="space-y-2">
          <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? group.titleKey : $_(group.titleKey)}</h3>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {#each group.tokens as token}
              {@const isModified = (mode === 'dark' ? config.dark : config.light)[token.key] !== (mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT)[token.key]}
              <label class="flex items-center justify-between gap-3 rounded-md border px-3 py-2" style="border-color: {isModified ? 'var(--color-primary)' : 'var(--color-border)'}; background: rgb(var(--color-surface-2))">
                <span class="text-sm flex items-center gap-1.5" style="color: var(--color-text)">
                  {$isLoading ? token.key : $_(token.labelKey)}
                  {#if isModified}
                    <span class="inline-block h-1.5 w-1.5 rounded-full" style="background: var(--color-primary)"></span>
                  {/if}
                </span>
                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    value={getHex(token)}
                    oninput={(e) => onPick(token, e)}
                    class="h-8 w-10 rounded border border-slate-500/30 bg-transparent"
                    aria-label={token.key}
                  />
                  <span class="font-mono text-xs" style="color: var(--color-text-muted)">{getHex(token)}</span>
                </div>
              </label>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>
