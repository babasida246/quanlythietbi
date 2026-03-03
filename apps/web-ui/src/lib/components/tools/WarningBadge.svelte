<script lang="ts">
  type Tone = 'warning' | 'danger' | 'info' | 'success';

  const { label, tone = 'warning' } = $props<{
    label: string;
    tone?: Tone;
  }>();

  const badgeClass = $derived.by(() => {
    const map: Record<Tone, string> = {
      danger: 'badge-error',
      success: 'badge-success',
      info: 'badge-info',
      warning: 'badge-warning'
    };
    return map[tone] ?? 'badge-warning';
  });
</script>

<span class="{badgeClass} text-xs font-semibold">{label}</span>
