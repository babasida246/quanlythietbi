<script lang="ts">
  import { LifeBuoy, Link2, Check, ChevronDown, ChevronUp, AlertTriangle, Lock, RefreshCw, PackageX, Download } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  type Symptom = {
    icon: typeof AlertTriangle;
    iconColor: string;
    title: string;
    badge: string;
    badgeColor: string;
    cases: { cause: string; fix: string }[];
  };

  const symptoms: Symptom[] = [
    {
      icon: Lock,
      iconColor: 'text-red-400',
      title: 'Không thấy nút / Không có quyền',
      badge: 'Quyền truy cập',
      badgeColor: 'badge-red',
      cases: [
        { cause: 'Không thấy nút "+ Tạo đơn" trong Sửa chữa', fix: 'Tài khoản cần được gán vai trò Kỹ thuật hoặc Admin. Liên hệ Admin để cấp quyền.' },
        { cause: 'Không thấy module Kho hàng trong menu', fix: 'Module Kho yêu cầu vai trò Kho hoặc Admin. Kiểm tra Settings → Users → quyền tài khoản.' },
        { cause: 'Nút Export bị mờ / disabled', fix: 'Chỉ Admin mới có quyền Export tổng hợp. Hoặc chưa có dữ liệu trong khoảng thời gian đã chọn.' },
        { cause: 'Không thể đổi trạng thái WO sang "closed"', fix: 'Chỉ Quản lý mới được đóng WO chính thức. Kỹ thuật chỉ đổi đến "repaired".' }
      ]
    },
    {
      icon: RefreshCw,
      iconColor: 'text-amber-400',
      title: 'Dữ liệu không cập nhật / không đồng bộ',
      badge: 'Dữ liệu',
      badgeColor: 'badge-amber',
      cases: [
        { cause: 'Tồn kho vừa nhập không hiển thị ngay', fix: 'Bấm F5 hoặc nút Làm mới. Cache trình duyệt có thể delay 5–10 giây.' },
        { cause: 'WO vừa tạo không xuất hiện trong danh sách', fix: 'Kiểm tra bộ lọc: trạng thái hoặc khoảng ngày có thể đang chặn. Reset bộ lọc về mặc định.' },
        { cause: 'Lịch sử tài sản không hiển thị WO mới đóng', fix: 'Vào chi tiết tài sản → Tab Lịch sử → bấm Làm mới. Kiểm tra WO đã đóng đúng trạng thái "closed" chưa.' },
        { cause: 'Dashboard báo cáo số liệu cũ', fix: 'Báo cáo cache 5 phút. Chọn lại khoảng thời gian hoặc chờ cache hết hạn.' }
      ]
    },
    {
      icon: PackageX,
      iconColor: 'text-orange-400',
      title: 'Xuất kho thất bại do tồn kho',
      badge: 'Kho',
      badgeColor: 'badge-amber',
      cases: [
        { cause: 'Lỗi "Tồn kho không đủ" khi tạo phiếu xuất', fix: 'Kiểm tra tồn: Kho → Tồn kho → lọc theo linh kiện. Tạo phiếu nhập trước, sau đó mới xuất.' },
        { cause: 'Linh kiện không có trong dropdown', fix: 'Phải tạo linh kiện trước tại Kho → Linh kiện → "+ Thêm", sau đó nhập kho.' },
        { cause: 'Kho không có trong dropdown khi xuất', fix: 'Kho chưa được tạo hoặc bị vô hiệu. Vào Kho → Kho hàng để kiểm tra và kích hoạt lại.' },
        { cause: 'Phiếu xuất kho thành công nhưng tồn vẫn không giảm', fix: 'Kiểm tra trạng thái phiếu: phải ở trạng thái "Đã xác nhận". Phiếu nháp chưa trừ tồn.' }
      ]
    },
    {
      icon: Download,
      iconColor: 'text-blue-400',
      title: 'Export báo cáo lỗi',
      badge: 'Export',
      badgeColor: 'badge-blue',
      cases: [
        { cause: 'Nút Export không phản hồi khi click', fix: 'Kiểm tra trình duyệt có chặn popup/download không. Thử Chrome/Edge. Disable Ad-blocker tạm thời.' },
        { cause: 'File Excel tải về bị lỗi / không mở được', fix: 'Thử lại với bộ lọc ngày ngắn hơn (1 tháng). File quá lớn (>50k dòng) có thể timeout.' },
        { cause: 'Export ra file nhưng thiếu cột dữ liệu', fix: 'Một số cột chỉ export nếu được điền đầy đủ (VD: chi phí, downtime). Bổ sung trước khi export.' }
      ]
    }
  ];

  let openIndex = $state<number | null>(0);
</script>

<section id="faq" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <LifeBuoy class="h-5 w-5 text-rose-400" />
    <h2 class="text-xl font-bold text-slate-50">Troubleshooting — Xử lý sự cố thường gặp</h2>
    <button onclick={() => copyAnchor('faq')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'faq'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="space-y-2">
    {#each symptoms as sym, i}
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
        <button
          onclick={() => openIndex = openIndex === i ? null : i}
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-3/40 transition-colors"
        >
          <sym.icon class="h-4 w-4 {sym.iconColor} shrink-0" />
          <span class="text-sm font-semibold text-slate-100 flex-1">{sym.title}</span>
          <span class="badge {sym.badgeColor} text-xs shrink-0">{sym.badge}</span>
          {#if openIndex === i}
            <ChevronUp class="h-4 w-4 text-slate-400 shrink-0" />
          {:else}
            <ChevronDown class="h-4 w-4 text-slate-400 shrink-0" />
          {/if}
        </button>

        {#if openIndex === i}
          <div class="border-t border-slate-700/30 divide-y divide-slate-700/20">
            {#each sym.cases as c}
              <div class="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p class="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle class="h-3 w-3" /> Triệu chứng
                  </p>
                  <p class="text-sm text-slate-300">{c.cause}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                    <Check class="h-3 w-3" /> Cách xử lý
                  </p>
                  <p class="text-sm text-slate-200">{c.fix}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>
