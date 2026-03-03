<script lang="ts">
  import { Rocket, Link2, Check, ExternalLink, AlertTriangle } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  let activeStep = $state(0);

  const steps = [
    {
      num: 1,
      title: 'Cấu hình Danh mục',
      role: 'Admin',
      roleColor: 'badge-red',
      purpose: 'Tạo các loại tài sản, hãng và model trước khi đăng ký bất kỳ thiết bị nào.',
      goTo: 'Tài sản → Danh mục',
      href: '/assets/catalogs',
      steps: [
        'Chọn menu Tài sản → Danh mục.',
        'Bấm "+ Thêm loại" → nhập tên (VD: UPS, Server, Laptop).',
        'Thêm Hãng sản xuất (APC, Dell, HPE…).',
        'Thêm Model liên kết với hãng đó.',
        'Bấm Lưu.'
      ],
      result: 'Có thể chọn loại / hãng / model khi đăng ký tài sản.',
      errors: ['Không thấy loại tài sản khi tạo asset → chưa tạo danh mục. Quay lại bước này.']
    },
    {
      num: 2,
      title: 'Đăng ký Tài sản',
      role: 'Admin / Kỹ thuật',
      roleColor: 'badge-blue',
      purpose: 'Đăng ký từng thiết bị vật lý vào hệ thống với đầy đủ thông tin định danh.',
      goTo: 'Tài sản → Danh sách',
      href: '/assets',
      steps: [
        'Vào Tài sản → Danh sách.',
        'Bấm "+ Thêm tài sản".',
        'Nhập Mã tài sản (VD: UPS-2024-001), Số serial, Model.',
        'Chọn Vị trí & Người phụ trách.',
        'Bấm Lưu.'
      ],
      result: 'Tài sản xuất hiện trong danh sách, có thể tạo Work Order cho tài sản này.',
      errors: [
        'Mã bị trùng → đổi mã theo quy ước phòng ban.',
        'Model không có trong dropdown → thêm model ở Danh mục trước.'
      ]
    },
    {
      num: 3,
      title: 'Nhập kho linh kiện',
      role: 'Kho',
      roleColor: 'badge-amber',
      purpose: 'Tạo phiếu nhập kho để có tồn vật tư trước khi xuất cho Work Order.',
      goTo: 'Kho hàng → Phiếu nhập/xuất',
      href: '/warehouse/documents',
      steps: [
        'Vào Kho hàng → Phiếu nhập/xuất.',
        'Bấm "+ Tạo phiếu" → chọn loại "Nhập kho".',
        'Chọn kho đích, nhập danh sách linh kiện + số lượng + đơn giá.',
        'Bấm Xác nhận.'
      ],
      result: 'Tồn kho linh kiện được cập nhật, sẵn sàng xuất cho WO.',
      errors: [
        'Không thấy linh kiện trong dropdown → vào Kho → Linh kiện để thêm trước.',
        'Kho chưa có → vào Kho → Kho hàng để tạo kho.'
      ]
    },
    {
      num: 4,
      title: 'Tạo Work Order',
      role: 'Kỹ thuật',
      roleColor: 'badge-blue',
      purpose: 'Ghi nhận sự cố của một tài sản cụ thể và theo dõi quy trình sửa chữa.',
      goTo: 'Kho hàng → Đơn sửa chữa',
      href: '/warehouse/repairs',
      steps: [
        'Vào Kho hàng → Đơn sửa chữa.',
        'Bấm "+ Tạo đơn".',
        'Chọn Tài sản → nhập Tiêu đề mô tả sự cố.',
        'Chọn Mức độ (low/medium/high/critical), Loại (nội bộ/nhà thầu).',
        'Bấm Tạo đơn → WO ở trạng thái open.'
      ],
      result: 'Work Order được tạo với mã tự động (WO-XXXX). Kỹ thuật viên có thể bắt đầu xử lý.',
      errors: [
        'Tài sản không có trong dropdown → đăng ký tài sản trước (Bước 2).',
        'Không thấy nút "+ Tạo đơn" → kiểm tra quyền Kỹ thuật.'
      ]
    },
    {
      num: 5,
      title: 'Xử lý & Đóng Work Order',
      role: 'Kỹ thuật / Quản lý',
      roleColor: 'badge-green',
      purpose: 'Cập nhật tiến độ, thêm linh kiện sử dụng, ghi nhận chi phí và đóng WO.',
      goTo: 'Kho hàng → Đơn sửa chữa → Chi tiết WO',
      href: '/warehouse/repairs',
      steps: [
        'Mở chi tiết WO → đổi trạng thái sang diagnosing.',
        'Nếu cần linh kiện: đổi sang waiting_parts, kho xuất linh kiện.',
        'Sau sửa xong: đổi sang repaired.',
        'Nhập Chi phí nhân công, Downtime, Chẩn đoán, Giải pháp.',
        'Bấm Đổi trạng thái → closed.'
      ],
      result: 'WO đóng. Lịch sử tài sản được cập nhật. Chi phí & downtime vào báo cáo.',
      errors: [
        'Không đổi được trạng thái → xem thứ tự trạng thái hợp lệ ở section Diagrams.',
        'Xuất kho thất bại → kiểm tra tồn kho linh kiện (Bước 3).'
      ]
    }
  ];
</script>

<section id="quickstart" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <Rocket class="h-5 w-5 text-cyan-400" />
    <h2 class="text-xl font-bold text-slate-50">Quick Start — 5 bước cơ bản</h2>
    <button onclick={() => copyAnchor('quickstart')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'quickstart'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <!-- Step nav bar -->
  <div class="flex flex-wrap gap-1.5 mb-4">
    {#each steps as step, i}
      <button
        onclick={() => activeStep = i}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
          {activeStep === i ? 'bg-primary text-white' : 'bg-surface-2 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-500'}"
      >
        <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
          {activeStep === i ? 'bg-white/20' : 'bg-slate-700'}">{step.num}</span>
        {step.title}
      </button>
    {/each}
  </div>

  <!-- Active step card -->
  {#each steps as step, i}
    {#if activeStep === i}
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-700/40 bg-slate-800/30">
          <div class="flex items-center gap-2">
            <span class="flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">{step.num}</span>
            <h3 class="font-semibold text-slate-100">{step.title}</h3>
            <span class="badge {step.roleColor} text-xs">{step.role}</span>
          </div>
          <a href={step.href} class="flex items-center gap-1.5 text-xs text-primary hover:text-blue-300 transition-colors font-medium">
            <ExternalLink class="h-3.5 w-3.5" /> Mở {step.goTo}
          </a>
        </div>

        <div class="p-5 space-y-5">
          <!-- Purpose -->
          <div class="bg-cyan-500/10 border border-cyan-500/20 rounded-md p-3 text-sm text-cyan-200">
            <strong>Mục đích:</strong> {step.purpose}
          </div>

          <!-- Click path -->
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Click-path (từng bước)</p>
            <ol class="space-y-2">
              {#each step.steps as action, j}
                <li class="flex items-start gap-2.5 text-sm text-slate-200">
                  <span class="flex items-center justify-center h-5 w-5 rounded-full bg-slate-700 text-slate-300 text-xs font-bold shrink-0 mt-0.5">{j + 1}</span>
                  {action}
                </li>
              {/each}
            </ol>
          </div>

          <!-- Result -->
          <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3 flex items-start gap-2 text-sm text-emerald-300">
            <Check class="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Kết quả:</strong> {step.result}</span>
          </div>

          <!-- Errors -->
          {#if step.errors.length > 0}
            <div>
              <p class="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle class="h-3.5 w-3.5" /> Lỗi hay gặp
              </p>
              <ul class="space-y-1.5">
                {#each step.errors as err}
                  <li class="text-xs text-amber-300/80 flex items-start gap-2 bg-amber-500/5 rounded px-3 py-1.5 border border-amber-500/10">
                    <span class="shrink-0 text-amber-500 mt-0.5">!</span>{err}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Nav buttons -->
          <div class="flex justify-between pt-2">
            <button
              onclick={() => activeStep = Math.max(0, i - 1)}
              disabled={i === 0}
              class="px-3 py-1.5 text-xs rounded border border-slate-600 text-slate-300 hover:border-slate-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Bước trước
            </button>
            <button
              onclick={() => activeStep = Math.min(steps.length - 1, i + 1)}
              disabled={i === steps.length - 1}
              class="px-3 py-1.5 text-xs rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Bước tiếp →
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/each}
</section>
