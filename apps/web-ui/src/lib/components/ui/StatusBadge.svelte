<!--
  StatusBadge — Unified status badge component.
  Uses token-driven colors from tokens.css --status-* variables.
  Single source of truth: $lib/types/status.ts

  Props:
    status   — raw status string (e.g. 'in_use', 'open')
    registry — status config registry from status.ts (e.g. ASSET_STATUS)
    label?   — override label text (otherwise uses status string)
    size?    — 'sm' | 'md' (default: 'sm')
    dot?     — show leading dot indicator
-->
<script lang="ts">
  import type { StatusConfig, BadgeVariant } from '$lib/types/status';
  import { VARIANT_CLASSES, getStatusConfig } from '$lib/types/status';

  interface Props {
    status: string;
    registry?: Record<string, StatusConfig>;
    label?: string;
    size?: 'sm' | 'md';
    dot?: boolean;
  }

  const {
    status,
    registry,
    label,
    size = 'sm',
    dot = false,
  }: Props = $props();

  const config = $derived(
    registry ? getStatusConfig(registry, status) : { variant: 'neutral' as BadgeVariant }
  );
  const variantClass = $derived(VARIANT_CLASSES[config.variant]);
  const sizeClass = $derived(size === 'md' ? 'status-badge-md' : '');
  const displayLabel = $derived(label ?? status);
</script>

<span class="status-badge {variantClass} {sizeClass}">
  {#if dot}
    <span class="status-badge-dot"></span>
  {/if}
  {displayLabel}
</span>
