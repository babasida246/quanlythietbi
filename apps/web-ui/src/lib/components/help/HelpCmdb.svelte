<script lang="ts">
  import {
    Server, Link2, Check, GitBranch, FileCode, Network,
    History, AlertTriangle, Shield, Plus, Eye, Diff,
    Upload, ArrowRight, Layers
  } from 'lucide-svelte'

  let { copyAnchor, copiedId = '' }: { copyAnchor: (id: string) => void; copiedId?: string } = $props()

  type Step = { label: string; desc?: string }
  type SubTab = { id: string; label: string; desc: string; steps?: Step[]; notes?: string[]; tips?: string[] }

  const tabs: SubTab[] = [
    {
      id: 'overview',
      label: 'Tổng quan CMDB',
      desc: 'CMDB (Configuration Management Database) là kho dữ liệu trung tâm lưu trữ thông tin về tất cả các thành phần hạ tầng CNTT — gọi là Configuration Items (CI) — và quan hệ giữa chúng.',
      steps: [
        { label: 'Loại hạng mục (CI Types)', desc: 'Định nghĩa schema: Server, VM, Database, Network, Firewall…' },
        { label: 'Hạng mục cấu hình (CIs)', desc: 'Các thực thể cụ thể: ESXi Host 01, PostgreSQL Main, Core Switch DC…' },
        { label: 'Quan hệ', desc: 'Liên kết CI với nhau: runs_on, depends_on, hosted_by, uses…' },
        { label: 'Dịch vụ', desc: 'Nhóm CI thành Business Service (HIS System, Email Service…)' },
        { label: 'File cấu hình', desc: 'Lưu trữ + versioning nội dung config/script gắn với từng CI' },
        { label: 'Lịch sử thay đổi', desc: 'Ghi nhận mọi thay đổi cấu hình theo quy trình phê duyệt' },
        { label: 'Sơ đồ topo', desc: 'Visualize quan hệ phụ thuộc giữa các CI dưới dạng đồ thị' }
      ],
      tips: [
        'Truy cập CMDB qua menu "Quản lý cấu hình" ở sidebar.',
        'URL mặc định: /cmdb — có 6 tab chính ở trên đầu trang.'
      ]
    },
    {
      id: 'ci-types',
      label: 'Loại hạng mục',
      desc: 'CI Type là "khuôn" định nghĩa các thuộc tính cho một nhóm CI. Ví dụ: loại "Server" có các trường CPU, RAM, OS; loại "Database" có Engine, Port, Version.',
      steps: [
        { label: 'Vào CMDB → tab Loại hạng mục' },
        { label: 'Bấm "+ Tạo" → nhập Code (viết liền, không dấu) và Tên hiển thị' },
        { label: 'Bấm Lưu — loại mới xuất hiện trong danh sách' },
        { label: '(Tuỳ chọn) Quản lý phiên bản schema tại trang chi tiết CI Type' }
      ],
      notes: [
        'Code phải là duy nhất, không đổi được sau khi tạo.',
        'Mỗi loại có thể có nhiều phiên bản schema (draft → active → retired).',
        'Chỉ phiên bản active mới được dùng khi tạo CI mới.'
      ],
      tips: ['Đặt code ngắn gọn: server, vm, database, network_device, firewall, storage, app, service_it.']
    },
    {
      id: 'cis',
      label: 'Hạng mục cấu hình',
      desc: 'CI (Configuration Item) là thực thể cụ thể trong hạ tầng — một máy chủ, một VM, một database thực sự. Đây là trung tâm của toàn bộ CMDB.',
      steps: [
        { label: 'Vào CMDB → tab Hạng mục → bấm "+ Tạo"' },
        { label: 'Chọn Loại hạng mục (server, vm, database…)' },
        { label: 'Nhập Tên CI và Mã CI (ví dụ: ESXi-Host-01, CI-SRV-001)' },
        { label: 'Chọn Môi trường (dev/test/staging/prod) và Trạng thái' },
        { label: '(Tuỳ chọn) Liên kết với Tài sản vật lý, Vị trí, Nhóm phụ trách' },
        { label: 'Bấm Lưu' }
      ],
      notes: [
        'CI có thể liên kết 1-1 với Tài sản vật lý để traceability đầy đủ.',
        'Trạng thái: active | inactive | decommissioned | maintenance.',
        'Môi trường giúp lọc CI theo dev/test/prod nhanh chóng.'
      ],
      tips: [
        'Bấm vào tên CI để vào trang chi tiết — nơi có đầy đủ quan hệ, file cấu hình, lịch sử.',
        'Ở tab CIs, icon FileCode trên mỗi hàng dẫn thẳng đến File cấu hình của CI đó.'
      ]
    },
    {
      id: 'relationships',
      label: 'Quan hệ',
      desc: 'Quan hệ mô tả sự phụ thuộc giữa các CI. Ví dụ: VM-APP01 runs_on ESXi-Host-01, PostgreSQL depends_on VM-DB01. Quan hệ là nền tảng để phân tích impact.',
      steps: [
        { label: 'Vào CMDB → tab Quan hệ → bấm "+ Tạo"' },
        { label: 'Chọn Loại quan hệ (runs_on, depends_on, hosted_by, uses…)' },
        { label: 'Chọn CI nguồn (From) và CI đích (To)' },
        { label: 'Bấm Lưu' }
      ],
      notes: [
        'Import hàng loạt: bấm "Import quan hệ" → upload CSV hoặc paste JSON → chạy dry-run trước khi xác nhận.',
        'Quan hệ có thể có ngày bắt đầu (sinceDate) và ghi chú.',
        'Hướng quan hệ: A → B có thể đọc theo chiều ngược: B is hosted_by A.'
      ],
      tips: ['Dùng tính năng Import khi cần nhập nhiều quan hệ cùng lúc từ dữ liệu có sẵn.']
    },
    {
      id: 'services',
      label: 'Dịch vụ',
      desc: 'Business Service nhóm nhiều CI lại thành một dịch vụ CNTT (HIS System, Email, ERP…). Mỗi CI tham gia với một vai trò cụ thể (primary, backup, dependency…).',
      steps: [
        { label: 'Vào CMDB → tab Dịch vụ → bấm "+ Tạo"' },
        { label: 'Nhập Code, Tên dịch vụ, Mức độ quan trọng, Chủ sở hữu, SLA' },
        { label: 'Bấm Lưu' },
        { label: 'Trong chi tiết dịch vụ → bấm "+ Thêm CI" → chọn CI và vai trò' }
      ],
      notes: [
        'SLA lưu dưới dạng JSON: { "uptime": "99.9%", "rto": "4h", "rpo": "1h" }.',
        'Phân tích impact của dịch vụ xem được ở trang chi tiết Service.'
      ],
      tips: ['Xây dựng service map giúp hiểu ngay CI nào gây ra downtime khi có sự cố.']
    },
    {
      id: 'config-files',
      label: 'File cấu hình',
      desc: 'Lưu trữ, versioning và so sánh các file config, script, template gắn với CI. Mỗi lần sửa nội dung sẽ tự động tạo phiên bản mới và lưu lịch sử.',
      steps: [
        { label: 'Cách 1 — Từ tab CI của CMDB: bấm icon FileCode trên hàng CI → trang chi tiết CI → tab File cấu hình' },
        { label: 'Cách 2 — Từ tab File cấu hình toàn cục: bấm "+ Thêm file cấu hình" → chọn CI từ dropdown' },
        { label: 'Điền: Tên file, Loại (config/script/template/env/other), Syntax, Đường dẫn máy chủ' },
        { label: 'Nhập nội dung trực tiếp hoặc bấm "Import từ file" để upload từ máy tính' },
        { label: 'Bấm Tạo — file được lưu với phiên bản v1' }
      ],
      notes: [
        'Import từ file: tự động nhận diện syntax từ extension (.sh → bash, .yml → yaml, .conf → nginx…).',
        'Mỗi lần sửa nội dung → phiên bản tăng tự động (v1 → v2 → v3…).',
        'Nếu chỉ sửa metadata (tên, mô tả) mà không sửa nội dung → phiên bản KHÔNG thay đổi.',
        'Edit modal hiển thị "→ v3" khi phát hiện nội dung bị thay đổi.'
      ],
      tips: [
        'Luôn điền "Ghi chú thay đổi" khi update — xuất hiện trong lịch sử để dễ trace.',
        'Đường dẫn máy chủ (ví dụ /etc/nginx/nginx.conf) giúp biết file nằm ở đâu trên server thực tế.'
      ]
    },
    {
      id: 'version-diff',
      label: 'Lịch sử & So sánh',
      desc: 'Xem lịch sử toàn bộ các phiên bản của một file cấu hình, so sánh nội dung giữa 2 phiên bản bằng diff engine tích hợp, và khôi phục phiên bản cũ.',
      steps: [
        { label: 'Trong danh sách file cấu hình → bấm icon Lịch sử (🕐) ở cột Thao tác' },
        { label: 'Modal Lịch sử phiên bản hiển thị danh sách các version với timestamp và ghi chú' },
        { label: 'Bấm "So sánh với trước" trên bất kỳ version nào để mở Diff Viewer' },
        { label: 'Diff Viewer hiển thị: dòng thêm (xanh), dòng xóa (đỏ), số dòng 2 chiều, thống kê (+/-/=)' },
        { label: 'Bấm "Khôi phục phiên bản này" để rollback về version đó' }
      ],
      notes: [
        'Diff engine hoạt động hoàn toàn phía client — không cần server round-trip.',
        'Khôi phục sẽ tạo thêm một phiên bản mới (v.cur+1) với nội dung của version cũ — không xóa lịch sử.'
      ],
      tips: ['Mỗi phiên bản có nút Copy để sao chép nội dung vào clipboard.']
    },
    {
      id: 'topology',
      label: 'Sơ đồ topo',
      desc: 'Visualize toàn bộ hạ tầng CNTT dưới dạng đồ thị tương tác. Thấy rõ CI nào phụ thuộc vào CI nào, phân tích tác động khi có sự cố.',
      steps: [
        { label: 'Vào CMDB → tab Sơ đồ' },
        { label: 'Sơ đồ tự động tải quan hệ — kéo thả để sắp xếp' },
        { label: 'Click vào node CI để xem chi tiết ở panel phải' },
        { label: 'Dùng bộ lọc: lọc theo loại CI, môi trường, trạng thái' },
        { label: 'Đổi layout: COSE (tự động), Breadth-first, Circle, Grid' }
      ],
      notes: [
        'Màu node: xanh lá = active, vàng = maintenance, xám = inactive, đỏ = decommissioned.',
        'Hình dạng node phân biệt loại CI: hình vuông = server/hardware, hình tròn = phần mềm/dịch vụ.'
      ],
      tips: ['Double-click node để navigate đến trang chi tiết CI đó.']
    },
    {
      id: 'changes',
      label: 'Lịch sử thay đổi',
      desc: 'Change Management theo quy trình phê duyệt đầy đủ. Mọi thay đổi cấu hình quan trọng đều phải có Change Request được ghi nhận và phê duyệt trước khi thực thi.',
      steps: [
        { label: 'Bấm "Lịch sử thay đổi" ở góc trên phải trang CMDB' },
        { label: 'Bấm "+ Tạo yêu cầu thay đổi"' },
        { label: 'Nhập Tiêu đề, Mô tả, Mức độ rủi ro (low/medium/high/critical)' },
        { label: 'Liên kết CI chính bị ảnh hưởng' },
        { label: 'Điền Kế hoạch triển khai và Kế hoạch hoàn nguyên (rollback)' },
        { label: 'Đặt thời gian triển khai dự kiến → Nộp (Submit)' },
        { label: 'Approver xem xét → Phê duyệt (Approve)' },
        { label: 'Thực hiện thay đổi → cập nhật trạng thái Đã thực hiện → Đóng' }
      ],
      notes: [
        'Quy trình: Draft → Submitted → Approved → Implemented → Closed.',
        'Có thể Hủy từ bất kỳ trạng thái nào trừ Implemented/Closed.',
        'Mức risk ảnh hưởng đến mức độ ưu tiên xem xét.'
      ],
      tips: [
        'Luôn điền rollback plan — đây là thông tin quan trọng nhất khi có sự cố sau thay đổi.',
        'Lọc theo CI để xem toàn bộ lịch sử thay đổi của một component cụ thể.'
      ]
    }
  ]

  let activeTab = $state('overview')
  const current = $derived(tabs.find(t => t.id === activeTab) ?? tabs[0])
</script>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<section id="cmdb-guide" class="scroll-mt-20">
  <!-- Section header -->
  <div class="flex items-center gap-2 mb-4">
    <Server class="h-5 w-5 text-primary" />
    <h2 class="text-xl font-bold text-slate-50">Hướng dẫn CMDB</h2>
    <button
      onclick={() => copyAnchor('cmdb-guide')}
      class="ml-auto text-slate-500 hover:text-primary transition-colors"
      title="Copy link"
    >
      {#if copiedId === 'cmdb-guide'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
    <!-- Sub-tabs -->
    <div class="flex overflow-x-auto border-b border-slate-700/60 bg-surface-1/50 scrollbar-thin">
      {#each tabs as tab}
        <button
          type="button"
          onclick={() => (activeTab = tab.id)}
          class="px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors
                 {activeTab === tab.id
                   ? 'border-primary text-primary bg-primary/8'
                   : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-3/40'}"
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Content -->
    <div class="p-5 space-y-5">
      <!-- Description -->
      <p class="text-sm text-slate-300 leading-relaxed">{current.desc}</p>

      <!-- Steps -->
      {#if current.steps && current.steps.length > 0}
        <div>
          {#if current.id === 'overview'}
            <!-- Overview: module grid -->
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">7 thành phần chính</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {#each current.steps as step, i}
                <div class="flex items-start gap-3 rounded-md border border-slate-700/40 bg-surface-1/60 px-3 py-2.5">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div>
                    <p class="text-xs font-semibold text-slate-200">{step.label}</p>
                    {#if step.desc}<p class="text-xs text-slate-500 mt-0.5">{step.desc}</p>{/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <!-- Other tabs: numbered steps -->
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Các bước thực hiện</p>
            <ol class="space-y-2">
              {#each current.steps as step, i}
                <li class="flex items-start gap-3">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div class="text-sm text-slate-300">
                    <span class="font-medium text-slate-200">{step.label}</span>
                    {#if step.desc}<span class="text-slate-500"> — {step.desc}</span>{/if}
                  </div>
                </li>
              {/each}
            </ol>
          {/if}
        </div>
      {/if}

      <!-- Tips -->
      {#if current.tips && current.tips.length > 0}
        <div class="rounded-md bg-blue-500/8 border border-blue-500/20 p-3 space-y-1.5">
          <p class="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Mẹo & lưu ý nhanh</p>
          {#each current.tips as tip}
            <div class="flex items-start gap-2 text-xs text-blue-300">
              <ArrowRight class="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
              <span>{tip}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Notes / Warnings -->
      {#if current.notes && current.notes.length > 0}
        <div class="rounded-md bg-amber-500/8 border border-amber-500/20 p-3 space-y-1.5">
          <p class="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Lưu ý quan trọng</p>
          {#each current.notes as note}
            <div class="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle class="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
              <span>{note}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Extra: Workflow diagram for changes tab -->
      {#if current.id === 'changes'}
        <div class="rounded-md bg-surface-1/60 border border-slate-700/40 p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quy trình trạng thái</p>
          <div class="flex items-center gap-1 flex-wrap text-xs">
            {#each [
              { label: 'Draft', color: 'bg-slate-600 text-slate-200' },
              { label: '→', color: 'text-slate-500' },
              { label: 'Submitted', color: 'bg-blue-600/80 text-blue-100' },
              { label: '→', color: 'text-slate-500' },
              { label: 'Approved', color: 'bg-green-600/80 text-green-100' },
              { label: '→', color: 'text-slate-500' },
              { label: 'Implemented', color: 'bg-primary/80 text-white' },
              { label: '→', color: 'text-slate-500' },
              { label: 'Closed', color: 'bg-slate-700 text-slate-300' }
            ] as s}
              {#if s.label === '→'}
                <span class="text-slate-500 font-bold">{s.label}</span>
              {:else}
                <span class="px-2 py-0.5 rounded font-medium {s.color}">{s.label}</span>
              {/if}
            {/each}
            <span class="ml-2 text-slate-500">|</span>
            <span class="px-2 py-0.5 rounded bg-red-700/70 text-red-200 ml-1">Canceled</span>
            <span class="text-xs text-slate-500 ml-1">(từ mọi bước trước Implemented)</span>
          </div>
        </div>
      {/if}

      <!-- Extra: File types for config-files tab -->
      {#if current.id === 'config-files'}
        <div class="rounded-md bg-surface-1/60 border border-slate-700/40 p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Loại file & auto-detect</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {#each [
              { type: 'config', badge: 'badge-info', exts: '.conf, .cfg, .ini, .toml' },
              { type: 'script', badge: 'badge-warning', exts: '.sh, .bash, .py, .rb' },
              { type: 'template', badge: 'badge-secondary', exts: '.j2, .jinja, .tpl' },
              { type: 'env', badge: 'badge-success', exts: '.env, .properties' },
              { type: 'other', badge: 'badge-neutral', exts: 'Các loại khác' }
            ] as ft}
              <div class="flex flex-col gap-1 p-2 rounded border border-slate-700/30 bg-surface-2/60">
                <span class="badge {ft.badge} text-xs w-fit">{ft.type}</span>
                <span class="text-slate-500">{ft.exts}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Extra: Diff viewer guide -->
      {#if current.id === 'version-diff'}
        <div class="rounded-md bg-surface-1/60 border border-slate-700/40 p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Đọc kết quả Diff Viewer</p>
          <div class="space-y-2 text-xs font-mono">
            <div class="flex items-center gap-3 bg-green-950/50 rounded px-3 py-1.5">
              <span class="text-green-400 font-bold">+</span>
              <span class="text-green-300">Dòng được thêm vào (màu xanh lá)</span>
            </div>
            <div class="flex items-center gap-3 bg-red-950/50 rounded px-3 py-1.5">
              <span class="text-red-400 font-bold">−</span>
              <span class="text-red-300">Dòng bị xóa (màu đỏ)</span>
            </div>
            <div class="flex items-center gap-3 bg-slate-800/50 rounded px-3 py-1.5">
              <span class="text-slate-500">&nbsp;</span>
              <span class="text-slate-400">Dòng không thay đổi</span>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-2">Số cột bên trái: số dòng trong phiên bản cũ | Số cột bên phải: số dòng trong phiên bản mới.</p>
        </div>
      {/if}
    </div>
  </div>
</section>
