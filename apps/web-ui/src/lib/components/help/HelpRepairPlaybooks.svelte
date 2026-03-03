<script lang="ts">
  import { BookMarked, Link2, Check, ChevronDown, ChevronRight } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  let openScenario = $state<number | null>(0);

  const scenarios = [
    {
      title: 'Sửa chữa không cần linh kiện',
      badge: 'badge-green',
      badgeLabel: 'Đơn giản nhất',
      desc: 'Sự cố có thể giải quyết bằng cấu hình lại, reset, cập nhật firmware — không tiêu thụ vật tư.',
      path: [
        { state: 'open', action: 'Tạo WO → chọn tài sản, mô tả sự cố' },
        { state: 'diagnosing', action: 'Đổi trạng thái → ghi chẩn đoán' },
        { state: 'repaired', action: 'Sửa xong → đổi sang Repaired, ghi giải pháp' },
        { state: 'closed', action: 'Nhập chi phí nhân công + downtime → Đóng WO' }
      ],
      notes: ['Không cần thao tác kho.', 'Downtime = thời gian từ tạo WO đến repaired.']
    },
    {
      title: 'Cần linh kiện — tồn kho đủ',
      badge: 'badge-blue',
      badgeLabel: 'Phổ biến',
      desc: 'Thiết bị cần thay thế linh kiện đang có sẵn trong kho.',
      path: [
        { state: 'open', action: 'Tạo WO' },
        { state: 'diagnosing', action: 'Chẩn đoán → xác định cần linh kiện' },
        { state: 'waiting_parts', action: 'Đổi trạng thái → waiting_parts' },
        { state: 'kho', action: 'Kho: Xuất kho linh kiện → liên kết phiếu với WO' },
        { state: 'diagnosing', action: 'Nhận linh kiện → đổi lại diagnosing' },
        { state: 'repaired', action: 'Thay linh kiện, kiểm thử → Repaired' },
        { state: 'closed', action: 'Nhập chi phí linh kiện + nhân công + downtime → Đóng' }
      ],
      notes: ['Trong chi tiết WO có card "Thêm linh kiện" — ghi nhận linh kiện đã dùng.', 'Phiếu xuất kho sẽ tự động trừ tồn kho.']
    },
    {
      title: 'Cần linh kiện — tồn kho không đủ',
      badge: 'badge-amber',
      badgeLabel: 'Cần mua thêm',
      desc: 'Linh kiện cần thiết chưa có hoặc tồn dưới mức tối thiểu.',
      path: [
        { state: 'open', action: 'Tạo WO' },
        { state: 'diagnosing', action: 'Chẩn đoán → xác định linh kiện thiếu' },
        { state: 'waiting_parts', action: 'Đổi → waiting_parts → ghi chú "cần mua: [linh kiện]"' },
        { state: 'purchase', action: 'Admin tạo Kế hoạch mua sắm → đặt hàng' },
        { state: 'kho', action: 'Kho nhận hàng → tạo Phiếu nhập kho' },
        { state: 'kho', action: 'Kho xuất kho cho WO' },
        { state: 'repaired', action: 'Kỹ thuật tiếp tục xử lý → Repaired' },
        { state: 'closed', action: 'Đóng WO' }
      ],
      notes: ['WO có thể ở trạng thái waiting_parts nhiều ngày — downtime tích lũy.', 'Ghi chú rõ linh kiện cần mua để tránh nhầm lẫn.']
    },
    {
      title: 'Gửi nhà cung cấp (Vendor)',
      badge: 'badge-purple',
      badgeLabel: 'Bảo hành / Outsource',
      desc: 'Thiết bị phức tạp, còn bảo hành, hoặc cần chuyên gia vendor xử lý.',
      path: [
        { state: 'open', action: 'Tạo WO → chọn Loại: Nhà thầu' },
        { state: 'diagnosing', action: 'Mô tả sự cố, thu thập thông tin bảo hành' },
        { state: 'waiting_parts', action: 'Gửi thiết bị cho vendor → đổi trạng thái, ghi chú số vé vendor' },
        { state: 'vendor', action: 'Chờ vendor xử lý (có thể nhiều ngày)' },
        { state: 'diagnosing', action: 'Nhận lại thiết bị → kiểm tra nghiệm thu' },
        { state: 'repaired', action: 'Nghiệm thu OK → Repaired' },
        { state: 'closed', action: 'Nhập chi phí vendor + downtime → Đóng' }
      ],
      notes: ['Chi phí nhà thầu ghi vào "Chi phí nhân công".', 'Ghi số vé/ticket vendor vào phần Ghi chú để tra cứu sau.']
    },
    {
      title: 'Hủy Work Order',
      badge: 'badge-gray',
      badgeLabel: 'Tạo nhầm / Trùng',
      desc: 'WO được tạo nhầm, trùng lặp, hoặc sự cố tự giải quyết trước khi xử lý.',
      path: [
        { state: 'open', action: 'Xác nhận WO tạo nhầm hoặc trùng với WO khác' },
        { state: 'canceled', action: 'Mở chi tiết WO → Đổi trạng thái → canceled → ghi lý do hủy' }
      ],
      notes: ['WO đã canceled không thể chỉnh sửa thêm.', 'Tồn kho không bị ảnh hưởng nếu chưa xuất kho.']
    },
    {
      title: 'Reopen Work Order',
      badge: 'badge-cyan',
      badgeLabel: 'Sự cố tái phát',
      desc: 'WO đã đóng nhưng sự cố xuất hiện lại (tùy chính sách công ty).',
      path: [
        { state: 'closed', action: 'Phát hiện sự cố tái phát trên tài sản đã có WO closed' },
        { state: 'open', action: 'Admin/Quản lý: Reopen WO → trạng thái trở lại open' },
        { state: 'diagnosing', action: 'Tiếp tục quy trình sửa chữa bình thường' }
      ],
      notes: ['Reopen chỉ được phép nếu chính sách công ty cho phép.', 'Lịch sử WO gốc được giữ nguyên, reopen tạo thêm log mới.']
    }
  ];
</script>

<section id="playbooks" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <BookMarked class="h-5 w-5 text-purple-400" />
    <h2 class="text-xl font-bold text-slate-50">Kịch bản Work Order hay gặp</h2>
    <button onclick={() => copyAnchor('playbooks')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'playbooks'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="space-y-2">
    {#each scenarios as sc, i}
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
        <!-- Header -->
        <button
          onclick={() => openScenario = openScenario === i ? null : i}
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-3/40 transition-colors"
        >
          <span class="badge {sc.badge} text-xs shrink-0">{sc.badgeLabel}</span>
          <span class="text-sm font-semibold text-slate-100 flex-1">{sc.title}</span>
          {#if openScenario === i}
            <ChevronDown class="h-4 w-4 text-slate-400 shrink-0" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-400 shrink-0" />
          {/if}
        </button>

        {#if openScenario === i}
          <div class="px-4 pb-4 space-y-4 border-t border-slate-700/30 pt-3">
            <p class="text-sm text-slate-300">{sc.desc}</p>

            <!-- Flow steps -->
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Luồng xử lý</p>
              <div class="flex flex-col gap-0">
                {#each sc.path as step, j}
                  <div class="flex items-start gap-3">
                    <div class="flex flex-col items-center shrink-0">
                      <div class="flex items-center justify-center h-7 w-7 rounded-full border-2 border-slate-600 bg-slate-800 text-xs font-bold text-slate-300">{j + 1}</div>
                      {#if j < sc.path.length - 1}
                        <div class="w-0.5 h-5 bg-slate-700"></div>
                      {/if}
                    </div>
                    <div class="pb-2">
                      <span class="inline-block font-mono text-xs bg-slate-700/60 text-slate-300 rounded px-2 py-0.5 mr-2 mb-1 border border-slate-600/40">{step.state}</span>
                      <span class="text-sm text-slate-200">{step.action}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Notes -->
            {#if sc.notes.length > 0}
              <div class="space-y-1.5">
                {#each sc.notes as note}
                  <div class="text-xs text-slate-400 bg-slate-800/40 border border-slate-700/30 rounded px-3 py-1.5 flex items-start gap-2">
                    <span class="text-primary shrink-0">›</span>{note}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>
