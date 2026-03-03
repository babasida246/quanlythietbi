<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronDown } from 'lucide-svelte';

  type Tone = 'neutral' | 'success' | 'warning';

  const {
    title,
    description = '',
    icon: Icon,
    badge = '',
    badgeTone = 'neutral',
    open = false,
    onToggle,
    children
  } = $props<{
    title: string;
    description?: string;
    icon?: typeof ChevronDown;
    badge?: string;
    badgeTone?: Tone;
    open?: boolean;
    onToggle?: () => void;
    children?: Snippet;
  }>();

  const badgeClass = $derived.by(() =>
    badgeTone === 'success'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
      : badgeTone === 'warning'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  );
</script>

<div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
  <button
    class="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
    onclick={() => onToggle?.()}
  >
    <div class="flex items-start gap-3">
      {#if Icon}
        <div class="mt-0.5 text-blue-600 dark:text-blue-300">
          <Icon class="w-4 h-4" />
        </div>
      {/if}
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        {#if description}
          <div class="text-xs text-slate-500">{description}</div>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2">
      {#if badge}
        <span class={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${badgeClass}`}>{badge}</span>
      {/if}
      <ChevronDown class={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </div>
  </button>
  {#if open}
    <div class="px-4 pb-4 pt-2 space-y-4">
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>
