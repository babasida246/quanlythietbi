<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Button, Tabs, TabsList, TabsTrigger } from '$lib/components/ui';
  import { _, isLoading } from '$lib/i18n';
  import {
    TOKEN_GROUPS,
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

  let mode = $state<ThemeMode>('dark');

  const config = $derived($themeCustomizer);
  const activePreset = $derived($themePresets);

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
</script>

<div class="page-shell page-content">
  <PageHeader
    title={$isLoading ? 'Theme & Colors' : $_('themeCustomizer.title')}
    subtitle={$isLoading ? 'Choose a preset theme or customize individual colors' : $_('themeCustomizer.subtitle')}
  ></PageHeader>

  <!-- ── Theme Presets ─────────────────────────────────────────── -->
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
              {$isLoading ? 'Gợi ý' : $_('themePresets.recommended')}
            </span>
          {/if}
          {#if isActive}
            <span class="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style="background: var(--color-primary); color: var(--color-primary-contrast)">✓</span>
          {/if}
          <!-- Swatches -->
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

  <!-- ── Custom Token Overrides ─────────────────────────────────── -->
  <div class="card p-4 space-y-4">
    <div>
      <h2 class="text-sm font-semibold" style="color: var(--color-text)">
        {$isLoading ? 'Custom Color Overrides' : $_('themeCustomizer.sectionTitle')}
      </h2>
      <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
        {$isLoading ? 'Fine-tune individual tokens on top of the selected theme.' : $_('themeCustomizer.sectionSubtitle')}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm" style="border-color: var(--color-border); color: var(--color-text)">
        <input
          type="checkbox"
          checked={config.enabled}
          onchange={(e) => themeCustomizer.setEnabled((e.target as HTMLInputElement).checked)}
        />
        <span>{$isLoading ? 'Enable custom palette' : $_('themeCustomizer.enable')}</span>
      </label>
      <Button variant="secondary" size="sm" onclick={() => themeCustomizer.resetMode(mode)}>
        {$isLoading ? 'Reset mode' : $_('themeCustomizer.resetMode')}
      </Button>
      <Button variant="danger" size="sm" onclick={() => themeCustomizer.resetAll()}>
        {$isLoading ? 'Reset all' : $_('themeCustomizer.resetAll')}
      </Button>
    </div>

    <Tabs>
      <TabsList>
        <TabsTrigger active={mode === 'dark'} onclick={() => (mode = 'dark')}>
          {$isLoading ? 'Dark Mode' : $_('themeCustomizer.dark')}
        </TabsTrigger>
        <TabsTrigger active={mode === 'light'} onclick={() => (mode = 'light')}>
          {$isLoading ? 'Light Mode' : $_('themeCustomizer.light')}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    {#if !config.enabled}
      <div class="alert alert-info">
        {$isLoading ? 'Enable custom palette to apply your colors globally.' : $_('themeCustomizer.enableHint')}
      </div>
    {/if}

    {#each TOKEN_GROUPS as group}
      <section class="space-y-2">
        <h3 class="text-sm font-semibold" style="color: var(--color-text)">{$isLoading ? group.titleKey : $_(group.titleKey)}</h3>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {#each group.tokens as token}
            <label class="flex items-center justify-between gap-3 rounded-md border px-3 py-2" style="border-color: var(--color-border); background: rgb(var(--color-surface-2))">
              <span class="text-sm" style="color: var(--color-text)">{$isLoading ? token.key : $_(token.labelKey)}</span>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  value={getHex(token)}
                  onchange={(e) => onPick(token, e)}
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
</div>
