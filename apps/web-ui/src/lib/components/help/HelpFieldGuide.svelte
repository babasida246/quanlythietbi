<script lang="ts">
  import { TableProperties, Link2, Check } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  let activeTable = $state<'create-wo' | 'close-wo'>('create-wo');

  type FieldRow = { field: string; meaning: string; example: string; note: string; required: boolean };

  const createWOFields: FieldRow[] = [
    { field: 'Tài sản', meaning: 'Thiết bị cần sửa chữa', example: 'UPS-2024-001', note: 'Bắt buộc. Phải đã được đăng ký trong hệ thống.', required: true },
    { field: 'Tiêu đề', meaning: 'Mô tả ngắn gọn sự cố', example: 'UPS phòng server B2 không lên nguồn', note: 'Bắt buộc. Tối đa 255 ký tự. Nên kèm phòng ban / vị trí.', required: true },
    { field: 'Mức độ (Severity)', meaning: 'Mức ưu tiên xử lý', example: 'critical', note: 'low / medium / high / critical. Ảnh hưởng đến SLA.', required: true },
    { field: 'Loại sửa chữa', meaning: 'Nội bộ tự xử lý hay thuê nhà thầu', example: 'internal', note: 'internal = tự làm; vendor = gửi ra ngoài.', required: true },
    { field: 'Kỹ thuật viên', meaning: 'Người phụ trách xử lý', example: 'Nguyễn Văn A', note: 'Tùy chọn khi tạo, điền sau ở bước cập nhật.', required: false },
    { field: 'Ghi chú (Note)', meaning: 'Thông tin bổ sung ban đầu', example: 'Phát hiện lúc 08:30, ảnh hưởng 5 máy trạm', note: 'Tùy chọn. Ghi thêm context để kỹ thuật viên dễ hiểu.', required: false }
  ];

  const closeWOFields: FieldRow[] = [
    { field: 'Chẩn đoán (Diagnosis)', meaning: 'Kết luận nguyên nhân gốc rễ', example: 'Tụ điện bo mạch chính bị phồng rộp, mất điện dự phòng', note: 'Bắt buộc khi đóng. Dùng làm báo cáo kỹ thuật.', required: true },
    { field: 'Giải pháp (Resolution)', meaning: 'Mô tả thao tác đã thực hiện', example: 'Thay thế bo mạch chính APC Smart-UPS 1500, flash firmware v6.9', note: 'Bắt buộc khi đóng.', required: true },
    { field: 'Chi phí nhân công', meaning: 'Giờ công kỹ thuật viên (VNĐ)', example: '1.200.000', note: 'Nhập số nguyên (VNĐ). Tự động cộng vào chi phí tổng WO.', required: false },
    { field: 'Chi phí linh kiện', meaning: 'Tổng giá trị linh kiện đã dùng', example: '3.500.000', note: 'Tự động tính từ phiếu xuất kho liên kết WO.', required: false },
    { field: 'Downtime (phút)', meaning: 'Số phút thiết bị ngừng phục vụ', example: '240', note: 'Bắt buộc khi đóng. 240 = 4 tiếng downtime.', required: true },
    { field: 'Trạng thái đóng', meaning: 'Đổi sang closed để kết thúc', example: 'closed', note: 'closed = đóng chính thức. Không thể sửa thêm (trừ khi reopen).', required: true }
  ];

  const partFields: FieldRow[] = [
    { field: 'Linh kiện dự phòng', meaning: 'Chọn từ danh sách vật tư trong kho', example: 'Tụ Capacitor 470µF 25V', note: 'Tùy chọn nếu linh kiện đã có mã trong hệ thống.', required: false },
    { field: 'Tên linh kiện (tự nhập)', meaning: 'Tên tự do khi không có mã', example: 'Dây nguồn Dell laptop 65W', note: 'Dùng khi linh kiện chưa có trong danh mục.', required: false },
    { field: 'Kho hàng', meaning: 'Kho xuất linh kiện', example: 'Kho-IT-01', note: 'Bắt buộc nếu chọn linh kiện có mã.', required: true },
    { field: 'Hành động', meaning: 'Loại thao tác với linh kiện', example: 'replace', note: 'replace / add / remove / upgrade.', required: true },
    { field: 'Số lượng', meaning: 'Số lượng linh kiện sử dụng', example: '2', note: 'Phải > 0 và ≤ tồn kho hiện tại.', required: true },
    { field: 'Đơn giá', meaning: 'Giá một đơn vị linh kiện (VNĐ)', example: '250.000', note: 'Tùy chọn. Nhập để chi phí linh kiện chính xác.', required: false },
    { field: 'Số Serial', meaning: 'Serial của linh kiện được thay', example: 'SN-APC-2024-9876', note: 'Tùy chọn. Quan trọng với linh kiện có giá trị.', required: false }
  ];

  const tables = {
    'create-wo': { label: 'Tạo Work Order', data: createWOFields },
    'close-wo': { label: 'Đóng Work Order', data: closeWOFields },
    'add-part': { label: 'Thêm linh kiện', data: partFields }
  } as const;

  type TableKey = keyof typeof tables;
  let activeTableKey = $state<TableKey>('create-wo');
</script>

<section id="field-guide" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <TableProperties class="h-5 w-5 text-cyan-400" />
    <h2 class="text-xl font-bold text-slate-50">Bảng mapping trường nhập liệu</h2>
    <button onclick={() => copyAnchor('field-guide')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'field-guide'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
    <!-- Tab selector -->
    <div class="flex border-b border-slate-700/40">
      {#each Object.entries(tables) as [key, tbl]}
        <button
          onclick={() => activeTableKey = key as TableKey}
          class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2
            {activeTableKey === key
              ? 'border-cyan-400 text-cyan-300 bg-cyan-400/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-3/30'}"
        >
          {tbl.label}
        </button>
      {/each}
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700/40 bg-slate-800/30">
            <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide w-40">Trường</th>
            <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ý nghĩa</th>
            <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide w-48">Ví dụ</th>
            <th class="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Lưu ý</th>
            <th class="text-center py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide w-20">Bắt buộc</th>
          </tr>
        </thead>
        <tbody>
          {#each tables[activeTableKey].data as row, i}
            <tr class="border-b border-slate-700/20 {i % 2 === 0 ? '' : 'bg-slate-800/20'} hover:bg-surface-3/30 transition-colors">
              <td class="py-2.5 px-4 font-mono text-xs text-primary font-semibold">{row.field}</td>
              <td class="py-2.5 px-4 text-slate-200 text-xs">{row.meaning}</td>
              <td class="py-2.5 px-4">
                <code class="text-xs bg-slate-700/50 text-emerald-300 rounded px-1.5 py-0.5 font-mono">{row.example}</code>
              </td>
              <td class="py-2.5 px-4 text-slate-400 text-xs">{row.note}</td>
              <td class="py-2.5 px-4 text-center">
                {#if row.required}
                  <span class="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs">✓</span>
                {:else}
                  <span class="text-slate-600 text-xs">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
