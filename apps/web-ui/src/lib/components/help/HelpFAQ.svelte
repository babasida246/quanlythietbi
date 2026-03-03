<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { ChevronDown, ChevronUp } from 'lucide-svelte';

  type FaqItem = {
    qKey: string;
    aKey: string;
  };

  const faqs: FaqItem[] = [
    { qKey: 'help.faq.q1', aKey: 'help.faq.a1' },
    { qKey: 'help.faq.q2', aKey: 'help.faq.a2' },
    { qKey: 'help.faq.q3', aKey: 'help.faq.a3' },
    { qKey: 'help.faq.q4', aKey: 'help.faq.a4' },
    { qKey: 'help.faq.q5', aKey: 'help.faq.a5' },
    { qKey: 'help.faq.q6', aKey: 'help.faq.a6' }
  ];

  let openIndex = $state<number | null>(null);

  function toggle(i: number) {
    openIndex = openIndex === i ? null : i;
  }
</script>

<section id="faq" class="scroll-mt-20">
  <h2 class="text-xl font-bold text-slate-50 mb-4">{$isLoading ? 'FAQ' : $_('help.faq.title')}</h2>
  <div class="space-y-2">
    {#each faqs as faq, i}
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
        <button
          onclick={() => toggle(i)}
          class="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-100 hover:bg-surface-3/50 transition-colors"
        >
          <span>{$isLoading ? '' : $_(faq.qKey)}</span>
          {#if openIndex === i}
            <ChevronUp class="h-4 w-4 shrink-0 text-slate-400" />
          {:else}
            <ChevronDown class="h-4 w-4 shrink-0 text-slate-400" />
          {/if}
        </button>
        {#if openIndex === i}
          <div class="px-4 pb-3 text-sm text-slate-300 border-t border-slate-700/30 pt-3">
            {$isLoading ? '' : $_(faq.aKey)}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>
