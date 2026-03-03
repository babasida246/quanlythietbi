<script lang="ts">
  import { ShieldCheck, Database, FolderOpen, Link2, Check } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  const roles = [
    {
      name: 'Admin',
      color: 'badge-red',
      duties: ['Cấu hình danh mục (loại tài sản, hãng, model)', 'Phân quyền người dùng', 'Export báo cáo tổng hợp', 'Thiết lập hệ thống & tích hợp']
    },
    {
      name: 'Kho',
      color: 'badge-amber',
      duties: ['Nhập / xuất / kiểm kê vật tư, linh kiện', 'Duyệt phiếu xuất kho cho Work Order', 'Quản lý tồn kho tối thiểu']
    },
    {
      name: 'Kỹ thuật',
      color: 'badge-blue',
      duties: ['Tạo & xử lý Work Order', 'Ghi nhận chẩn đoán, giải pháp', 'Thêm linh kiện vào WO', 'Cập nhật trạng thái, downtime']
    },
    {
      name: 'Quản lý',
      color: 'badge-green',
      duties: ['Duyệt & đóng Work Order', 'Xem báo cáo hiệu quả sửa chữa', 'Phê duyệt kế hoạch mua sắm']
    }
  ];

  const prerequisites = [
    {
      icon: FolderOpen,
      color: 'text-cyan-400',
      title: 'Danh mục',
      items: ['Loại tài sản (UPS, Laptop, Server…)', 'Hãng sản xuất (APC, Dell, HPE…)', 'Model thiết bị']
    },
    {
      icon: Database,
      color: 'text-amber-400',
      title: 'Tài sản',
      items: ['Mã tài sản + số serial', 'Model & hãng liên kết', 'Vị trí & người dùng phụ trách']
    },
    {
      icon: Database,
      color: 'text-emerald-400',
      title: 'Kho',
      items: ['Kho được tạo với mã kho', 'Danh sách vật tư / linh kiện với tồn ban đầu', 'Mức tồn tối thiểu (để cảnh báo)']
    }
  ];

  const conventions = [
    { term: 'WO', def: 'Work Order — Đơn sửa chữa' },
    { term: 'Mã tài sản', def: 'Định danh duy nhất. Ví dụ: UPS-2024-001' },
    { term: 'Severity', def: 'Mức độ ưu tiên: low / medium / high / critical' },
    { term: 'Downtime', def: 'Số phút thiết bị ngừng hoạt động' },
    { term: 'Stock-out', def: 'Phiếu xuất kho linh kiện cho WO' },
    { term: 'Repaired', def: 'Trạng thái: đã sửa xong, chờ đóng chính thức' }
  ];
</script>

<section id="prerequisites" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <ShieldCheck class="h-5 w-5 text-emerald-400" />
    <h2 class="text-xl font-bold text-slate-50">Trước khi bắt đầu</h2>
    <button onclick={() => copyAnchor('prerequisites')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'prerequisites'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="space-y-4">
    <!-- Roles -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
      <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
        <ShieldCheck class="h-4 w-4 text-emerald-400" /> Vai trò & quyền hạn
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {#each roles as role}
          <div class="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 space-y-2">
            <span class="badge {role.color} text-xs">{role.name}</span>
            <ul class="space-y-1">
              {#each role.duties as duty}
                <li class="text-xs text-slate-300 flex items-start gap-1.5">
                  <span class="text-slate-500 shrink-0 mt-0.5">›</span>{duty}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>

    <!-- Data prerequisites -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
      <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
        <Database class="h-4 w-4 text-amber-400" /> Dữ liệu phải có trước
      </h3>
      <div class="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 mb-4 text-xs text-blue-300">
        Quy trình chuẩn: <span class="font-semibold text-blue-200">Danh mục → Tài sản → Nhập kho → Work Order → Đóng → Báo cáo</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {#each prerequisites as pre}
          <div class="rounded-lg border border-slate-700/40 bg-slate-800/30 p-3 space-y-2">
            <p class="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <pre.icon class="h-3.5 w-3.5 {pre.color}" />{pre.title}
            </p>
            <ul class="space-y-1">
              {#each pre.items as item}
                <li class="text-xs text-slate-400 flex items-start gap-1.5">
                  <span class="text-slate-600 shrink-0">·</span>{item}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>

    <!-- Terminology -->
    <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
      <h3 class="text-sm font-semibold text-slate-100 mb-3">Thuật ngữ & quy ước mã</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-slate-700/40">
              <th class="text-left py-2 px-3 text-slate-400 font-semibold w-32">Ký hiệu</th>
              <th class="text-left py-2 px-3 text-slate-400 font-semibold">Ý nghĩa</th>
            </tr>
          </thead>
          <tbody>
            {#each conventions as c, i}
              <tr class="border-b border-slate-700/20 {i % 2 === 0 ? '' : 'bg-slate-800/20'} hover:bg-surface-3/30 transition-colors">
                <td class="py-2 px-3 font-mono text-primary font-semibold">{c.term}</td>
                <td class="py-2 px-3 text-slate-300">{c.def}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>
