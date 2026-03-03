<script lang="ts">
  import { onMount } from 'svelte';
  import { GitBranch, Link2, Check } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  let flowEl = $state<HTMLDivElement | null>(null);
  let seqEl = $state<HTMLDivElement | null>(null);
  let stateEl = $state<HTMLDivElement | null>(null);
  let loading = $state(true);
  let error = $state('');

  const flowCode = `flowchart TB
  A[Phát hiện sự cố] --> B[Tạo Work Order **open**]
  B --> C[Chẩn đoán **diagnosing**]

  C --> D{Cần linh kiện?}
  D -- Không --> E[Sửa / Khắc phục]
  D -- Có --> F[Chuyển trạng thái: **waiting_parts**]
  F --> G[Kho: kiểm tra tồn kho]

  G --> H{Có sẵn linh kiện?}
  H -- Có --> I[Kho: Xuất kho linh kiện]
  I --> E
  H -- Không --> J[Đề nghị mua sắm / đặt hàng]
  J --> K[Nhận linh kiện]
  K --> I

  E --> L[Kiểm thử / xác nhận]
  L --> M{Nội bộ hay nhà cung cấp?}
  M -- Nội bộ --> N[**Repaired**]
  M -- Vendor --> V[Gửi nhà cung cấp]
  V --> V2[Nhận lại / nghiệm thu]
  V2 --> N

  N --> O[Nhập chi phí + downtime + ghi chú]
  O --> P[Đóng Work Order **closed**]
  P --> Q[Cập nhật lịch sử tài sản + báo cáo]

  B --> X{Tạo nhầm / Trùng?}
  X -- Có --> Y[**Hủy canceled**]
  X -- Không --> C`;

  const seqCode = `sequenceDiagram
  actor U as Người dùng
  participant UI as Web UI
  participant API as API Server
  participant DB as Database

  U->>UI: Tạo Work Order (asset, mô tả, severity)
  UI->>API: POST /work-orders
  API->>DB: INSERT work_orders + log
  DB-->>API: id, code
  API-->>UI: 201 Created

  U->>UI: Cập nhật trạng thái "diagnosing"
  UI->>API: PATCH /work-orders/{id}
  API->>DB: UPDATE status + INSERT log
  API-->>UI: OK

  U->>UI: Chọn "waiting_parts" + yêu cầu linh kiện
  UI->>API: POST /work-orders/{id}/parts-request
  API->>DB: INSERT parts_request
  API-->>UI: OK

  U->>UI: Kho thực hiện Xuất kho cho WO
  UI->>API: POST /stock-out (wo_id, items)
  API->>DB: INSERT stock_out + UPDATE inventory
  API-->>UI: OK

  U->>UI: Đóng WO (cost, downtime, note)
  UI->>API: POST /work-orders/{id}/close
  API->>DB: UPDATE status=closed + cost + downtime
  API->>DB: INSERT asset_history
  API-->>UI: OK`;

  const stateCode = `stateDiagram-v2
  [*] --> open
  open --> diagnosing
  diagnosing --> waiting_parts : cần linh kiện
  diagnosing --> repaired : sửa xong
  waiting_parts --> diagnosing : có linh kiện
  repaired --> closed
  open --> canceled
  diagnosing --> canceled
  waiting_parts --> canceled
  closed --> open : reopen (tùy chính sách)`;

  const diagrams = [
    { id: 'diag-flow', label: 'Flowchart — Quy trình Repair Order', code: flowCode },
    { id: 'diag-seq', label: 'Sequence — User → UI → API → DB', code: seqCode },
    { id: 'diag-state', label: 'State — Trạng thái Work Order', code: stateCode }
  ];

  let activeIndex = $state(0);

  const containers: (HTMLDivElement | null)[] = $state(new Array(diagrams.length).fill(null));
  let rendered = $state<boolean[]>(new Array(diagrams.length).fill(false));
  let counter = 0;

  async function renderDiagram(idx: number) {
    const el = containers[idx];
    if (!el || rendered[idx]) return;
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        darkMode: true,
        themeVariables: {
          darkMode: true,
          background: '#0f172a',
          primaryColor: '#6366f1',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#4f46e5',
          lineColor: '#64748b',
          secondaryColor: '#1e293b',
          tertiaryColor: '#1a2540',
          edgeLabelBackground: '#1e293b',
          clusterBkg: '#1e293b'
        },
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { actorMargin: 50, messageMargin: 35 }
      });
      const uid = `m-${Date.now()}-${++counter}`;
      const { svg } = await mermaid.default.render(uid, diagrams[idx].code);
      el.innerHTML = svg;
      rendered[idx] = true;
    } catch (e) {
      if (el) el.innerHTML = `<p class="text-red-400 text-xs p-4">Render error: ${e instanceof Error ? e.message : String(e)}</p>`;
    }
  }

  $effect(() => {
    const idx = activeIndex;
    // trigger render on next tick so DOM is ready
    setTimeout(() => renderDiagram(idx), 10);
  });

  onMount(() => {
    loading = false;
    renderDiagram(0);
  });
</script>

<section id="diagrams" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <GitBranch class="h-5 w-5 text-primary" />
    <h2 class="text-xl font-bold text-slate-50">Flow Diagrams</h2>
    <button onclick={() => copyAnchor('diagrams')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'diagrams'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
    <!-- Tab selector -->
    <div class="flex flex-wrap border-b border-slate-700/40">
      {#each diagrams as diag, i}
        <button
          onclick={() => activeIndex = i}
          class="px-4 py-2.5 text-xs font-medium transition-colors border-b-2
            {activeIndex === i
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-3/30'}"
        >
          {diag.label}
        </button>
      {/each}
    </div>

    <!-- Diagram renders (all in DOM, only active visible) -->
    {#each diagrams as diag, i}
      <div class="{activeIndex === i ? 'block' : 'hidden'}">
        <div
          bind:this={containers[i]}
          class="p-4 overflow-x-auto min-h-[200px] flex items-start justify-center [&>svg]:max-w-full [&>svg]:h-auto"
        >
          {#if !rendered[i]}
            <div class="flex items-center gap-2 text-slate-400 text-sm py-10">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              Đang render diagram...
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>
