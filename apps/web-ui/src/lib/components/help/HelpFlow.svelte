<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';

  let flowContainer = $state<HTMLDivElement | null>(null);
  let seqContainer = $state<HTMLDivElement | null>(null);
  let loading = $state(true);
  let error = $state('');

  const flowchartCode = `flowchart TD
    A["🆕 Tạo Work Order"] --> B["🔍 Chẩn đoán"]
    B --> C{"Cần linh kiện?"}
    C -- Có --> D["⏳ Chờ linh kiện"]
    D --> E["🔧 Sửa chữa"]
    C -- Không --> E
    E --> F["✅ Kiểm thử"]
    F --> G{"Đạt?"}
    G -- Không --> B
    G -- Có --> H["📋 Đóng WO"]
    H --> I["💰 Ghi nhận chi phí + Downtime"]
    I --> J["📊 Cập nhật báo cáo"]

    style A fill:#6366f1,stroke:#4f46e5,color:#fff
    style B fill:#22d3ee,stroke:#06b6d4,color:#000
    style C fill:#f59e0b,stroke:#d97706,color:#000
    style D fill:#f97316,stroke:#ea580c,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style F fill:#3b82f6,stroke:#2563eb,color:#fff
    style G fill:#f59e0b,stroke:#d97706,color:#000
    style H fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style I fill:#ec4899,stroke:#db2777,color:#fff
    style J fill:#14b8a6,stroke:#0d9488,color:#fff`;

  const sequenceCode = `sequenceDiagram
    actor User
    participant UI as Web UI
    participant API as API Server
    participant DB as PostgreSQL

    User->>UI: Tạo Work Order
    UI->>API: POST /v1/maintenance
    API->>DB: INSERT work_order
    DB-->>API: WO record
    API-->>UI: 201 Created
    UI-->>User: Hiển thị WO mới

    User->>UI: Cập nhật trạng thái
    UI->>API: PUT /v1/maintenance/:id/status
    API->>DB: UPDATE work_order SET status
    DB-->>API: Updated
    API-->>UI: 200 OK
    UI-->>User: Cập nhật UI

    User->>UI: Đóng Work Order
    UI->>API: PUT /v1/maintenance/:id/close
    API->>DB: UPDATE status='closed'
    API->>DB: INSERT event_log
    DB-->>API: Completed
    API-->>UI: 200 OK
    UI-->>User: WO đã đóng`;

  let renderCounter = 0;

  onMount(async () => {
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#0f172a',
          primaryColor: '#6366f1',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#4f46e5',
          lineColor: '#64748b',
          secondaryColor: '#1e293b',
          tertiaryColor: '#1a2540'
        },
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { actorMargin: 50, messageMargin: 40 }
      });

      if (flowContainer) {
        const flowId = `help-flow-${++renderCounter}`;
        const { svg } = await mermaid.default.render(flowId, flowchartCode);
        flowContainer.innerHTML = svg;
      }

      if (seqContainer) {
        const seqId = `help-seq-${++renderCounter}`;
        const { svg } = await mermaid.default.render(seqId, sequenceCode);
        seqContainer.innerHTML = svg;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Mermaid render error';
    } finally {
      loading = false;
    }
  });
</script>

<section id="flow" class="scroll-mt-20">
  <h2 class="text-xl font-bold text-slate-50 mb-4">{$isLoading ? 'Diagrams' : $_('help.flow.title')}</h2>

  {#if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-300 mb-4">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
    <!-- Flowchart -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
      <p class="text-sm font-semibold text-slate-100 mb-1">{$isLoading ? 'Repair Flow' : $_('help.flow.repairFlow')}</p>
      <p class="text-xs text-slate-400 mb-3">{$isLoading ? '' : $_('help.flow.repairFlowDesc')}</p>
      {#if loading}
        <div class="flex items-center justify-center h-64">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      {:else}
        <div bind:this={flowContainer} class="overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"></div>
      {/if}
    </div>

    <!-- Sequence -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-4">
      <p class="text-sm font-semibold text-slate-100 mb-1">{$isLoading ? 'Sequence' : $_('help.flow.sequence')}</p>
      <p class="text-xs text-slate-400 mb-3">{$isLoading ? '' : $_('help.flow.sequenceDesc')}</p>
      {#if loading}
        <div class="flex items-center justify-center h-64">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      {:else}
        <div bind:this={seqContainer} class="overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"></div>
      {/if}
    </div>
  </div>
</section>
