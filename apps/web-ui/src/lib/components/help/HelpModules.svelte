<script lang="ts">
  import { Layers, Link2, Check, ExternalLink, Lock } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  const moduleTabKeys = ['assets', 'catalogs', 'warehouse', 'repairs', 'cmdb', 'reports'] as const;
  type Tab = typeof moduleTabKeys[number];
  let activeModule = $state<Tab>('assets');

  type Operation = { action: string; path: string; who: string; clicks: string[] };
  type ModuleDef = {
    key: Tab;
    label: string;
    when: string;
    role: string;
    roleColor: string;
    href: string;
    operations: Operation[];
    templates?: { title: string; content: string }[];
    notes?: string[];
  };

  const modules: ModuleDef[] = [
    {
      key: 'assets',
      label: 'Tài sản',
      when: 'Khi cần đăng ký thiết bị mới, tra cứu thông tin, gán người dùng hoặc cập nhật trạng thái thiết bị.',
      role: 'Admin / Kỹ thuật',
      roleColor: 'badge-blue',
      href: '/assets',
      operations: [
        { action: 'Tạo tài sản mới', path: 'Tài sản → + Thêm', who: 'Admin', clicks: ['Bấm "+ Thêm tài sản"', 'Nhập Mã (VD: SVR-2024-001), Serial, chọn Model', 'Chọn Vị trí & Người phụ trách', 'Bấm Lưu'] },
        { action: 'Chỉnh sửa thông tin', path: 'Tài sản → Hàng → ✏️', who: 'Admin', clicks: ['Chọn tài sản trong danh sách', 'Bấm nút Sửa hoặc click vào tên', 'Sửa trường cần thiết → Lưu'] },
        { action: 'Xem lịch sử', path: 'Tài sản → Chi tiết → Tab Lịch sử', who: 'All', clicks: ['Click vào mã tài sản', 'Chọn tab "Lịch sử"', 'Xem các sự kiện, WO liên quan'] }
      ],
      notes: ['Mã tài sản không thể thay đổi sau khi tạo.', 'Thiết bị có WO đang mở không thể xóa.']
    },
    {
      key: 'catalogs',
      label: 'Danh mục',
      when: 'Trước khi tạo bất kỳ tài sản nào. Cấu hình một lần và tái sử dụng.',
      role: 'Admin',
      roleColor: 'badge-red',
      href: '/assets/catalogs',
      operations: [
        { action: 'Thêm Loại tài sản', path: 'Danh mục → Loại → + Thêm', who: 'Admin', clicks: ['Vào Tài sản → Danh mục', 'Tab "Loại tài sản" → "+ Thêm"', 'Nhập tên (VD: UPS, Laptop) → Lưu'] },
        { action: 'Thêm Hãng sản xuất', path: 'Danh mục → Hãng', who: 'Admin', clicks: ['Tab "Hãng" → "+ Thêm"', 'Nhập tên hãng (VD: APC, Dell) → Lưu'] },
        { action: 'Thêm Model', path: 'Danh mục → Model', who: 'Admin', clicks: ['Tab "Model" → "+ Thêm"', 'Nhập tên model, chọn hãng tương ứng', 'Điền thông số kỹ thuật nếu cần → Lưu'] }
      ],
      notes: ['Không xóa loại/model đang được dùng bởi tài sản đang hoạt động.']
    },
    {
      key: 'warehouse',
      label: 'Kho hàng',
      when: 'Quản lý vật tư, linh kiện: nhập kho, xuất kho, kiểm kê, tra tồn.',
      role: 'Kho',
      roleColor: 'badge-amber',
      href: '/warehouse',
      operations: [
        { action: 'Nhập kho', path: 'Kho → Phiếu → + Tạo phiếu → Nhập kho', who: 'Kho', clicks: ['Vào Kho hàng → Phiếu nhập/xuất', 'Bấm "+ Tạo phiếu" → chọn loại Nhập kho', 'Chọn kho, thêm từng dòng linh kiện + số lượng + đơn giá', 'Bấm Xác nhận → tồn kho tăng'] },
        { action: 'Xuất kho cho WO', path: 'Kho → Phiếu → + Tạo phiếu → Xuất kho', who: 'Kho', clicks: ['Bấm "+ Tạo phiếu" → chọn Xuất kho', 'Chọn WO liên quan', 'Thêm linh kiện + số lượng → Xác nhận'] },
        { action: 'Kiểm kê tồn', path: 'Kho → Linh kiện hoặc Tồn kho', who: 'Kho', clicks: ['Vào Kho hàng → Tồn kho', 'Lọc theo kho / loại linh kiện', 'Xem tồn thực tế vs. tồn tối thiểu'] }
      ],
      notes: ['Xuất kho sẽ thất bại nếu tồn kho không đủ — phải nhập thêm trước.', 'Mỗi WO có thể liên kết nhiều phiếu xuất kho.']
    },
    {
      key: 'repairs',
      label: 'Sửa chữa (WO)',
      when: 'Khi phát hiện sự cố thiết bị, cần theo dõi quy trình sửa chữa đầu cuối.',
      role: 'Kỹ thuật / Quản lý',
      roleColor: 'badge-green',
      href: '/maintenance/repairs',
      operations: [
        { action: 'Tạo Work Order', path: 'Kho → Sửa chữa → + Tạo đơn', who: 'Kỹ thuật', clicks: ['Vào Kho hàng → Đơn sửa chữa', 'Bấm "+ Tạo đơn"', 'Chọn tài sản, nhập tiêu đề mô tả sự cố', 'Chọn severity + loại → Tạo đơn'] },
        { action: 'Cập nhật trạng thái', path: 'Chi tiết WO → Dropdown trạng thái → Đổi', who: 'Kỹ thuật', clicks: ['Mở chi tiết WO', 'Chọn trạng thái mới (diagnosing/repaired/closed…)', 'Bấm "Đổi trạng thái"'] },
        { action: 'Thêm linh kiện', path: 'Chi tiết WO → Card "Thêm linh kiện"', who: 'Kỹ thuật', clicks: ['Trong chi tiết WO → card phải', 'Chọn linh kiện dự phòng hoặc nhập tên tự do', 'Chọn kho, hành động, số lượng → Thêm linh kiện'] }
      ],
      templates: [
        { title: 'Mô tả sự cố (copy/paste)', content: 'Thiết bị [mã tài sản] tại [vị trí] gặp sự cố: [mô tả hiện tượng]. Phát hiện lúc [giờ/ngày]. Mức ảnh hưởng: [người dùng/hệ thống bị ảnh hưởng].' },
        { title: 'Chẩn đoán', content: 'Nguyên nhân: [hardware failure / driver lỗi / cấu hình sai / linh kiện hỏng]. Xác định bằng: [test/log/visual inspection].' },
        { title: 'Giải pháp', content: 'Đã thực hiện: [thay [linh kiện] / cập nhật firmware / reset cấu hình]. Kiểm thử: [kết quả test sau sửa]. Thời gian sửa: [X giờ].' }
      ],
      notes: ['Chỉ Kỹ thuật mới có thể tạo WO.', 'Chỉ Quản lý mới có thể đóng WO chính thức (closed).']
    },
    {
      key: 'cmdb',
      label: 'CMDB',
      when: 'Quản lý cấu hình IT, quan hệ giữa các CI (Configuration Item), vòng đời thay đổi.',
      role: 'Admin / Kỹ thuật',
      roleColor: 'badge-purple',
      href: '/cmdb',
      operations: [
        { action: 'Tạo loại CI', path: 'CMDB → Loại CI → + Thêm', who: 'Admin', clicks: ['Vào CMDB → Loại CI', 'Bấm "+ Thêm"', 'Nhập tên, thuộc tính → Lưu'] },
        { action: 'Thêm CI instance', path: 'CMDB → CI → + Thêm', who: 'Kỹ thuật', clicks: ['Chọn loại CI → Bấm "+ Thêm CI"', 'Điền thuộc tính theo loại', 'Lưu'] },
        { action: 'Định nghĩa quan hệ', path: 'CMDB → Quan hệ → Import hoặc Add', who: 'Admin', clicks: ['Vào CMDB → Quan hệ', 'Chọn CI nguồn → CI đích → Loại quan hệ → Lưu'] }
      ],
      notes: ['CI phải được tạo trước khi tạo quan hệ.']
    },
    {
      key: 'reports',
      label: 'Báo cáo',
      when: 'Xem thống kê tổng hợp, xuất dữ liệu, phân tích chi phí bảo trì.',
      role: 'Quản lý / Admin',
      roleColor: 'badge-green',
      href: '/reports',
      operations: [
        { action: 'Xem báo cáo tổng hợp', path: 'Báo cáo → Dashboard', who: 'Quản lý', clicks: ['Vào Báo cáo', 'Chọn khoảng thời gian', 'Xem KPI: số WO, chi phí, downtime'] },
        { action: 'Lọc & Xuất', path: 'Báo cáo → Lọc → Export', who: 'Admin', clicks: ['Bấm Lọc → chọn ngày/trạng thái/kỹ thuật viên', 'Bấm "Xuất Excel/CSV"', 'Download file'] }
      ],
      notes: ['Chỉ Admin mới thấy nút Export tổng hợp.']
    }
  ];
</script>

<section id="modules" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <Layers class="h-5 w-5 text-amber-400" />
    <h2 class="text-xl font-bold text-slate-50">Hướng dẫn theo module</h2>
    <button onclick={() => copyAnchor('modules')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
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
      {#each modules as mod}
        <button
          onclick={() => activeModule = mod.key}
          class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2
            {activeModule === mod.key
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-3/30'}"
        >
          {mod.label}
        </button>
      {/each}
    </div>

    <!-- Content -->
    {#each modules as mod}
      {#if activeModule === mod.key}
        <div class="p-5 space-y-5">
          <!-- When + Role -->
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex-1">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Bạn dùng khi nào?</p>
              <p class="text-sm text-slate-200">{mod.when}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Lock class="h-3.5 w-3.5 text-slate-500" />
              <span class="badge {mod.roleColor} text-xs">{mod.role}</span>
              <a href={mod.href} class="flex items-center gap-1 text-xs text-primary hover:text-blue-300 transition-colors">
                <ExternalLink class="h-3 w-3" /> Mở
              </a>
            </div>
          </div>

          <!-- Operations -->
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Các thao tác chính</p>
            <div class="space-y-3">
              {#each mod.operations as op}
                <div class="rounded-lg border border-slate-700/40 bg-slate-800/30 p-3">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <p class="text-sm font-semibold text-slate-100">{op.action}</p>
                    <span class="text-xs text-slate-500 font-mono">{op.path}</span>
                  </div>
                  <ol class="space-y-1">
                    {#each op.clicks as click, j}
                      <li class="text-xs text-slate-300 flex items-start gap-2">
                        <span class="text-slate-500 shrink-0 font-mono">{j + 1}.</span>{click}
                      </li>
                    {/each}
                  </ol>
                </div>
              {/each}
            </div>
          </div>

          <!-- Templates -->
          {#if mod.templates}
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Template copy/paste</p>
              <div class="space-y-2">
                {#each mod.templates as tpl}
                  <div class="rounded-md border border-slate-700/40 bg-slate-900/50">
                    <p class="text-xs font-semibold text-slate-400 px-3 pt-2 pb-1">{tpl.title}</p>
                    <pre class="text-xs text-slate-300 px-3 pb-3 whitespace-pre-wrap leading-relaxed font-mono">{tpl.content}</pre>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Notes -->
          {#if mod.notes}
            <div class="space-y-1.5">
              {#each mod.notes as note}
                <div class="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded px-3 py-2 flex items-start gap-2">
                  <span class="text-amber-500 shrink-0 font-bold">!</span>{note}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</section>
