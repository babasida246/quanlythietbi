<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import {
    HelpCircle, BookOpen, Rocket, Layers, BarChart3, GitBranch,
    MessageCircleQuestion, Link2, Check, Server, Database as DbIcon,
    Monitor, ClipboardList
  } from 'lucide-svelte';
  import HelpTOC from './HelpTOC.svelte';
  import HelpCharts from './HelpCharts.svelte';
  import HelpFlow from './HelpFlow.svelte';
  import HelpFAQ from './HelpFAQ.svelte';

  type TocItem = { id: string; label: string; level: number };

  let searchQuery = $state('');
  let copiedId = $state('');

  const tocItems: TocItem[] = [
    { id: 'intro', label: 'Giới thiệu dự án', level: 1 },
    { id: 'quickstart', label: 'Hướng dẫn nhanh', level: 1 },
    { id: 'modules', label: 'Hướng dẫn theo module', level: 1 },
    { id: 'repair-steps', label: 'Quy trình Repair Order', level: 1 },
    { id: 'charts', label: 'Biểu đồ & Thống kê', level: 1 },
    { id: 'flow', label: 'Sơ đồ luồng', level: 1 },
    { id: 'faq', label: 'FAQ', level: 1 }
  ];

  let activeSection = $state('intro');

  const moduleTabKeys = ['assets', 'catalogs', 'warehouse', 'maintenance', 'cmdb', 'reports'] as const;
  let activeModule = $state<typeof moduleTabKeys[number]>('assets');

  const filteredToc = $derived(
    searchQuery.trim()
      ? tocItems.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : tocItems
  );

  function copyAnchor(id: string) {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
    copiedId = id;
    setTimeout(() => { copiedId = ''; }, 1500);
  }

  const repairStepKeys = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;
</script>

<div class="flex gap-6 relative">
  <!-- Main content -->
  <div class="flex-1 min-w-0 space-y-8">

    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="rounded-lg bg-primary/15 p-2.5">
        <HelpCircle class="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-slate-50">{$isLoading ? 'Guide' : $_('help.title')}</h1>
        <p class="text-sm text-slate-400">{$isLoading ? '' : $_('help.subtitle')}</p>
      </div>
    </div>

    <!-- Mobile search -->
    <div class="xl:hidden">
      <input
        type="text"
        class="input-base text-sm w-full"
        placeholder={$isLoading ? 'Search...' : $_('help.searchPlaceholder')}
        bind:value={searchQuery}
      />
    </div>

    <!-- 1. Intro -->
    <section id="intro" class="scroll-mt-20">
      <div class="flex items-center gap-2 mb-3">
        <BookOpen class="h-5 w-5 text-primary" />
        <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'Introduction' : $_('help.intro.title')}</h2>
        <button onclick={() => copyAnchor('intro')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title={$isLoading ? 'Copy link' : $_('help.copyLink')}>
          {#if copiedId === 'intro'}
            <Check class="h-4 w-4 text-green-400" />
          {:else}
            <Link2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5 space-y-3">
        <p class="text-sm text-slate-200 font-medium">{$isLoading ? '' : $_('help.intro.desc')}</p>
        <p class="text-sm text-slate-300">{$isLoading ? '' : $_('help.intro.goal')}</p>

        <h3 class="text-sm font-semibold text-slate-100 mt-4">{$isLoading ? 'Modules' : $_('help.intro.modules')}</h3>
        <ul class="space-y-1.5 text-sm text-slate-300">
          <li class="flex items-start gap-2"><Monitor class="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modAssets')}</li>
          <li class="flex items-start gap-2"><Layers class="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modCatalogs')}</li>
          <li class="flex items-start gap-2"><DbIcon class="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modCmdb')}</li>
          <li class="flex items-start gap-2"><ClipboardList class="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modWarehouse')}</li>
          <li class="flex items-start gap-2"><Server class="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modMaintenance')}</li>
          <li class="flex items-start gap-2"><ClipboardList class="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modRequests')}</li>
          <li class="flex items-start gap-2"><BarChart3 class="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />{$isLoading ? '' : $_('help.intro.modReports')}</li>
        </ul>

        <div class="mt-4 bg-surface-3/60 rounded-md p-3 flex items-center gap-3 text-sm text-slate-300">
          <GitBranch class="h-5 w-5 text-primary shrink-0" />
          <span>{$isLoading ? '' : $_('help.intro.arch')}</span>
        </div>
      </div>
    </section>

    <!-- 2. Quick Start -->
    <section id="quickstart" class="scroll-mt-20">
      <div class="flex items-center gap-2 mb-3">
        <Rocket class="h-5 w-5 text-cyan-400" />
        <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'Quick Start' : $_('help.quickStart.title')}</h2>
        <button onclick={() => copyAnchor('quickstart')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title={$isLoading ? 'Copy link' : $_('help.copyLink')}>
          {#if copiedId === 'quickstart'}
            <Check class="h-4 w-4 text-green-400" />
          {:else}
            <Link2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <p class="text-sm text-slate-300 mb-4">{$isLoading ? '' : $_('help.quickStart.desc')}</p>
        <ol class="space-y-3">
          {#each ['step1', 'step2', 'step3', 'step4', 'step5'] as step, i}
            <li class="flex items-start gap-3">
              <span class="flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 text-primary font-bold text-xs shrink-0">{i + 1}</span>
              <span class="text-sm text-slate-200">{$isLoading ? '' : $_(`help.quickStart.${step}`)}</span>
            </li>
          {/each}
        </ol>
      </div>
    </section>

    <!-- 3. Module Guide -->
    <section id="modules" class="scroll-mt-20">
      <div class="flex items-center gap-2 mb-3">
        <Layers class="h-5 w-5 text-amber-400" />
        <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'Modules' : $_('help.modules.title')}</h2>
        <button onclick={() => copyAnchor('modules')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title={$isLoading ? 'Copy link' : $_('help.copyLink')}>
          {#if copiedId === 'modules'}
            <Check class="h-4 w-4 text-green-400" />
          {:else}
            <Link2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
        <!-- Tabs -->
        <div class="flex flex-wrap border-b border-slate-700/40">
          {#each moduleTabKeys as key}
            <button
              onclick={() => activeModule = key}
              class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2
                {activeModule === key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-3/30'}"
            >
              {$isLoading ? key : $_(`help.modules.${key}.title`)}
            </button>
          {/each}
        </div>
        <!-- Content -->
        <div class="p-5">
          {#if activeModule === 'assets'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.assets.create')}</li>
              <li>{$isLoading ? '' : $_('help.modules.assets.edit')}</li>
              <li>{$isLoading ? '' : $_('help.modules.assets.delete')}</li>
              <li>{$isLoading ? '' : $_('help.modules.assets.assign')}</li>
              <li>{$isLoading ? '' : $_('help.modules.assets.history')}</li>
            </ul>
          {:else if activeModule === 'catalogs'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.catalogs.types')}</li>
              <li>{$isLoading ? '' : $_('help.modules.catalogs.models')}</li>
              <li>{$isLoading ? '' : $_('help.modules.catalogs.brands')}</li>
            </ul>
          {:else if activeModule === 'warehouse'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.warehouse.import')}</li>
              <li>{$isLoading ? '' : $_('help.modules.warehouse.export')}</li>
              <li>{$isLoading ? '' : $_('help.modules.warehouse.inventory')}</li>
              <li>{$isLoading ? '' : $_('help.modules.warehouse.spareParts')}</li>
            </ul>
          {:else if activeModule === 'maintenance'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.maintenance.create')}</li>
              <li>{$isLoading ? '' : $_('help.modules.maintenance.statuses')}</li>
              <li>{$isLoading ? '' : $_('help.modules.maintenance.downtime')}</li>
              <li>{$isLoading ? '' : $_('help.modules.maintenance.cost')}</li>
            </ul>
          {:else if activeModule === 'cmdb'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.cmdb.ciTypes')}</li>
              <li>{$isLoading ? '' : $_('help.modules.cmdb.versions')}</li>
              <li>{$isLoading ? '' : $_('help.modules.cmdb.attrs')}</li>
              <li>{$isLoading ? '' : $_('help.modules.cmdb.instances')}</li>
              <li>{$isLoading ? '' : $_('help.modules.cmdb.relations')}</li>
              <li>{$isLoading ? '' : $_('help.modules.cmdb.services')}</li>
            </ul>
          {:else if activeModule === 'reports'}
            <ul class="space-y-2 text-sm text-slate-300">
              <li>{$isLoading ? '' : $_('help.modules.reports.filter')}</li>
              <li>{$isLoading ? '' : $_('help.modules.reports.export')}</li>
            </ul>
          {/if}
        </div>
      </div>
    </section>

    <!-- 4. Repair Steps Detail -->
    <section id="repair-steps" class="scroll-mt-20">
      <div class="flex items-center gap-2 mb-3">
        <ClipboardList class="h-5 w-5 text-emerald-400" />
        <h2 class="text-xl font-bold text-slate-50">Quy trình Repair Order</h2>
        <button onclick={() => copyAnchor('repair-steps')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title={$isLoading ? 'Copy link' : $_('help.copyLink')}>
          {#if copiedId === 'repair-steps'}
            <Check class="h-4 w-4 text-green-400" />
          {:else}
            <Link2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-700/40 text-slate-400">
              <th class="text-left py-2 px-3 font-semibold">#</th>
              <th class="text-left py-2 px-3 font-semibold">Bước</th>
              <th class="text-left py-2 px-3 font-semibold">Ai làm</th>
              <th class="text-left py-2 px-3 font-semibold">Làm ở đâu</th>
              <th class="text-left py-2 px-3 font-semibold">Dữ liệu sinh ra</th>
            </tr>
          </thead>
          <tbody>
            {#each repairStepKeys as key, i}
              <tr class="border-b border-slate-700/20 hover:bg-surface-3/30 transition-colors">
                <td class="py-2.5 px-3 text-primary font-bold">{i + 1}</td>
                <td class="py-2.5 px-3 text-slate-100 font-medium">{$isLoading ? '' : $_(`help.repairSteps.${key}.title`)}</td>
                <td class="py-2.5 px-3 text-slate-300">{$isLoading ? '' : $_(`help.repairSteps.${key}.who`)}</td>
                <td class="py-2.5 px-3 text-slate-300">{$isLoading ? '' : $_(`help.repairSteps.${key}.where`)}</td>
                <td class="py-2.5 px-3 text-slate-300">{$isLoading ? '' : $_(`help.repairSteps.${key}.data`)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- 5. Charts -->
    <HelpCharts />

    <!-- 6. Flow Diagrams -->
    <HelpFlow />

    <!-- 7. FAQ -->
    <HelpFAQ />
  </div>

  <!-- Sticky TOC (desktop) -->
  <HelpTOC items={filteredToc} activeId={activeSection} bind:searchQuery />
</div>
