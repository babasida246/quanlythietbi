<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import {
    HelpCircle, BookOpen, Link2, Check
  } from 'lucide-svelte';
  import HelpTOC from './HelpTOC.svelte';
  import HelpCharts from './HelpCharts.svelte';
  import HelpPrerequisites from './HelpPrerequisites.svelte';
  import HelpQuickStart from './HelpQuickStart.svelte';
  import HelpModules from './HelpModules.svelte';
  import HelpRepairPlaybooks from './HelpRepairPlaybooks.svelte';
  import HelpFieldGuide from './HelpFieldGuide.svelte';
  import HelpDiagrams from './HelpDiagrams.svelte';
  import HelpFAQ from './HelpFAQ.svelte';
  import HelpAssetDetail from './HelpAssetDetail.svelte';
  import HelpBusinessProcess from './HelpBusinessProcess.svelte';
  import HelpRoleJourneys from './HelpRoleJourneys.svelte';
  import HelpSystemMap from './HelpSystemMap.svelte';
  import HelpRbac from './HelpRbac.svelte';
  import HelpPolicy from './HelpPolicy.svelte';
  import HelpCmdb from './HelpCmdb.svelte';

  type TocItem = { id: string; label: string; level: number };

  let searchQuery = $state('');
  let copiedId = $state('');

  function t(key: string, fallback: string): string {
    return $isLoading ? fallback : $_(key, { default: fallback });
  }

  const tocItems = $derived.by((): TocItem[] => [
    { id: 'intro',            label: t('help.tocItems.intro', 'Giới thiệu dự án'), level: 1 },
    { id: 'prerequisites',    label: t('help.tocItems.prerequisites', 'Trước khi bắt đầu'), level: 1 },
    { id: 'quickstart',       label: t('help.tocItems.quickstart', 'Quick Start (5 bước)'), level: 1 },
    { id: 'role-journeys',    label: t('help.tocItems.roleJourneys', 'Lộ trình theo vai trò'), level: 1 },
    { id: 'system-map',       label: t('help.tocItems.systemMap', 'Bản đồ module/route/API'), level: 1 },
    { id: 'rbac',             label: t('help.tocItems.rbac', 'Phân quyền & RBAC'), level: 1 },
    { id: 'policy-system',   label: t('help.tocItems.policySystem', 'Unified Policy System'), level: 1 },
    { id: 'modules',          label: t('help.tocItems.modules', 'Hướng dẫn theo module'), level: 1 },
    { id: 'cmdb-guide',       label: t('help.tocItems.cmdbGuide', 'Hướng dẫn CMDB'), level: 1 },
    { id: 'asset-detail',     label: t('help.tocItems.assetDetail', 'Quản lý chi tiết tài sản'), level: 1 },
    { id: 'business-process', label: t('help.tocItems.businessProcess', 'Quy trình nghiệp vụ (SOP)'), level: 1 },
    { id: 'playbooks',        label: t('help.tocItems.playbooks', 'Kịch bản Work Order'), level: 1 },
    { id: 'field-guide',      label: t('help.tocItems.fieldGuide', 'Bảng mapping trường nhập'), level: 1 },
    { id: 'charts',           label: t('help.tocItems.charts', 'Biểu đồ & Thống kê'), level: 1 },
    { id: 'diagrams',         label: t('help.tocItems.diagrams', 'Flow Diagrams (Mermaid)'), level: 1 },
    { id: 'faq',              label: t('help.tocItems.faq', 'Troubleshooting'), level: 1 }
  ]);

  let activeSection = $state('intro');

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

  onMount(() => {
    const sectionIds = tocItems.map((i) => i.id);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          activeSection = visible[0].target.id;
        }
      },
      {
        root: null,
        threshold: [0.2, 0.5, 0.8],
        rootMargin: '-20% 0px -60% 0px'
      }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    const hash = window.location.hash.replace('#', '');
    if (hash && sectionIds.includes(hash)) {
      const target = document.getElementById(hash);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          activeSection = hash;
        });
      }
    }

    return () => {
      observer.disconnect();
    };
  });
</script>

<div class="flex gap-6 relative">
  <!-- ── Main content ──────────────────────────────────────────── -->
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

    <!-- 1. Introduction -->
    <section id="intro" class="scroll-mt-20">
      <div class="flex items-center gap-2 mb-3">
        <BookOpen class="h-5 w-5 text-primary" />
        <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'Introduction' : $_('help.intro.title')}</h2>
        <button onclick={() => copyAnchor('intro')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
          {#if copiedId === 'intro'}
            <Check class="h-4 w-4 text-green-400" />
          {:else}
            <Link2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5 space-y-3 text-sm">
        <p class="text-slate-200 font-medium">{$isLoading ? '' : $_('help.intro.desc')}</p>
        <p class="text-slate-300">{$isLoading ? '' : $_('help.intro.goal')}</p>
        <div class="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs text-blue-300 mt-2">
          {$_('help.intro.standardProcessLabel', { default: 'Quy trình chuẩn' })}: <span class="font-semibold text-blue-200">{$_('help.intro.standardProcessFlow', { default: 'Danh mục → Tài sản → Nhập kho → Work Order → Đóng → Báo cáo' })}</span>
        </div>
      </div>
    </section>

    <!-- 2. Prerequisites -->
    <HelpPrerequisites {copyAnchor} {copiedId} />

    <!-- 3. Quick Start Stepper -->
    <HelpQuickStart {copyAnchor} {copiedId} />

    <!-- 3b. Role Journeys -->
    <HelpRoleJourneys {copyAnchor} {copiedId} />

    <!-- 3c. System Map -->
    <HelpSystemMap {copyAnchor} {copiedId} />

    <!-- 4. RBAC Guide -->
    <HelpRbac {copyAnchor} {copiedId} />

    <!-- 4b. Policy System Guide -->
    <HelpPolicy {copyAnchor} {copiedId} />

    <!-- 5. Module Guide -->
    <HelpModules {copyAnchor} {copiedId} />

    <!-- CMDB Guide -->
    <HelpCmdb {copyAnchor} {copiedId} />

    <!-- 4b. Asset Detail Management Guide -->
    <HelpAssetDetail {copyAnchor} {copiedId} />

    <!-- 4c. Business Process SOPs -->
    <HelpBusinessProcess {copyAnchor} {copiedId} />

    <!-- 5. Repair Playbooks -->
    <HelpRepairPlaybooks {copyAnchor} {copiedId} />

    <!-- 6. Field Guide -->
    <HelpFieldGuide {copyAnchor} {copiedId} />

    <!-- 7. Charts -->
    <HelpCharts />

    <!-- 8. Mermaid Diagrams -->
    <HelpDiagrams {copyAnchor} {copiedId} />

    <!-- 9. Troubleshooting FAQ -->
    <HelpFAQ {copyAnchor} {copiedId} />

  </div>

  <!-- ── Sticky TOC (desktop) ──────────────────────────────────── -->
  <HelpTOC items={filteredToc} activeId={activeSection} bind:searchQuery />
</div>

