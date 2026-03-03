<script lang="ts">
  let { status } = $props<{ status: string }>();

  const statusClasses: Record<string, string> = {
    in_stock: 'bg-slate-100 text-slate-700',
    in_use: 'bg-emerald-100 text-emerald-700',
    in_repair: 'bg-amber-100 text-amber-700',
    retired: 'bg-slate-200 text-slate-700',
    disposed: 'bg-red-100 text-red-700',
    lost: 'bg-purple-100 text-purple-700'
  };

  const label = $derived(status.replace('_', ' '));
</script>

<span class={`px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[status] || 'bg-slate-100 text-slate-700'}`}>
  {label}
</span>
