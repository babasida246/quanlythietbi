<!--
  PageShell — Standard page layout wrapper.
  Provides consistent padding, max-width, and header section.

  Props:
    title    — page heading text
    subtitle? — optional description below title
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    actions?: Snippet;
    children: Snippet;
  }

  const { title, subtitle, actions, children }: Props = $props();
</script>

<div class="page-shell page-padding">
  {#if title}
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
      <div>
        <h1 class="text-xl font-bold" style="color: var(--color-text);">{title}</h1>
        {#if subtitle}
          <p class="text-sm mt-0.5" style="color: var(--color-text-muted);">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2 flex-shrink-0">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  <div class="page-content">
    {@render children()}
  </div>
</div>
