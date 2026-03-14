<script lang="ts">
  import { Monitor, Link2, Check, ChevronRight } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  type TabGuide = {
    tab: string;
    label: string;
    purpose: string;
    fields?: { name: string; desc: string }[];
    actions?: { action: string; steps: string[] }[];
    tips?: string[];
  };

  const tabGuides: TabGuide[] = [
    {
      tab: 'overview',
      label: 'Tổng quan',
      purpose: 'Xem thông tin cơ bản của tài sản: model, nhà cung cấp, vị trí, serial, IP quản lý, ngày mua, bảo hành, và điểm sức khỏe tài sản.',
      fields: [
        { name: 'Model', desc: 'Tên model thiết bị (liên kết từ Danh mục).' },
        { name: 'Nhà cung cấp', desc: 'Hãng/NCC cung cấp thiết bị.' },
        { name: 'Vị trí', desc: 'Địa điểm đặt thiết bị (phòng, tầng, chi nhánh).' },
        { name: 'Số seri', desc: 'Mã serial number nhà sản xuất.' },
        { name: 'IP quản lý', desc: 'Địa chỉ IP dùng để quản lý từ xa (nếu có).' },
        { name: 'Tên máy chủ', desc: 'Hostname trên mạng.' },
        { name: 'Ngày mua', desc: 'Ngày mua/nhận thiết bị.' },
        { name: 'Kết thúc bảo hành', desc: 'Ngày hết hạn bảo hành.' },
        { name: 'Kho', desc: 'Kho hàng đang chứa thiết bị (nếu ở trạng thái trong kho).' },
        { name: 'Điểm sức khỏe', desc: 'Điểm 0-100, trừ điểm nếu có WO mở, bảo hành sắp hết, hoặc thiết bị thanh lý.' }
      ],
      tips: [
        'Điểm sức khỏe tự động tính: 100 điểm trừ đi penalty cho bảo trì đang mở, bảo hành hết hạn, trạng thái retired/disposed.',
        'Mục "Driver đề xuất" hiển thị driver phù hợp dựa trên model và loại thiết bị.',
        'Mục "Tài liệu liên quan" liệt kê tài liệu kỹ thuật liên kết với tài sản.'
      ]
    },
    {
      tab: 'specs',
      label: 'Thông số kỹ thuật',
      purpose: 'Hiển thị thông số kỹ thuật chi tiết theo loại tài sản (CPU, RAM, dung lượng, cổng kết nối...).',
      actions: [
        {
          action: 'Xem thông số',
          steps: [
            'Chọn tab "Thông số kỹ thuật".',
            'Hệ thống tải định nghĩa spec theo loại tài sản từ Danh mục.',
            'Hiển thị các trường đã có giá trị + đơn vị đo.'
          ]
        }
      ],
      tips: [
        'Spec definitions được cấu hình ở Danh mục → Loại tài sản → Định nghĩa spec.',
        'Nếu không thấy thông số: kiểm tra xem tài sản đã được gán spec chưa (cập nhật qua API hoặc import).'
      ]
    },
    {
      tab: 'lifecycle',
      label: 'Vòng đời',
      purpose: 'Theo dõi lịch sử gán/trả tài sản và dòng thời gian sự kiện.',
      fields: [
        { name: 'Bảng Gán nhiệm vụ', desc: 'Danh sách các lần gán tài sản cho người/phòng ban, thời gian gán và trả.' },
        { name: 'Dòng thời gian', desc: 'Timeline ghi lại mọi sự kiện: tạo, gán, trả, di chuyển, thay đổi trạng thái, bảo trì.' }
      ],
      tips: [
        'Mỗi lần gán/trả đều tự động ghi sự kiện vào timeline.',
        'Có thể tìm kiếm và lọc theo trang trong timeline.'
      ]
    },
    {
      tab: 'repairs',
      label: 'Sửa chữa',
      purpose: 'Xem tất cả đơn sửa chữa (Work Order) liên quan đến tài sản, bao gồm trạng thái, chi phí, linh kiện đã dùng.',
      actions: [
        {
          action: 'Xem chi tiết WO',
          steps: [
            'Click vào đơn sửa chữa để mở rộng.',
            'Xem loại sửa chữa, kỹ thuật viên, thời gian downtime.',
            'Xem chẩn đoán và giải pháp.',
            'Xem danh sách linh kiện đã sử dụng (nếu có).'
          ]
        }
      ],
      tips: [
        'Để tạo WO mới, vào Bảo trì → Đơn sửa chữa hoặc bấm nút "Bảo trì" trên trang chi tiết.',
        'Linh kiện được liên kết từ kho, chi phí tự động tính.'
      ]
    },
    {
      tab: 'maintenance',
      label: 'Bảo trì',
      purpose: 'Danh sách phiếu bảo trì (maintenance ticket) bao gồm bảo trì định kỳ và sự cố.',
      actions: [
        {
          action: 'Tạo phiếu bảo trì',
          steps: [
            'Bấm nút "Bảo trì" trên thanh công cụ.',
            'Nhập tiêu đề mô tả vấn đề.',
            'Chọn mức độ (low/medium/high/critical).',
            'Bấm Tạo.'
          ]
        }
      ],
      tips: ['Phiếu bảo trì khác với WO sửa chữa: bảo trì là phòng ngừa, WO là xử lý sự cố.']
    },
    {
      tab: 'software',
      label: 'Phần mềm',
      purpose: 'Quản lý license phần mềm đã gán cho thiết bị.',
      fields: [
        { name: 'Phần mềm', desc: 'Tên phần mềm được cấp phép.' },
        { name: 'Mã license', desc: 'Product key / activation code.' },
        { name: 'Loại', desc: 'Perpetual, subscription, OEM, volume...' },
        { name: 'Trạng thái', desc: 'Active / expired / revoked.' },
        { name: 'Ngày hết hạn', desc: 'Ngày hết hạn license (nếu subscription).' }
      ],
      tips: [
        'Gán license cho tài sản ở module Quản lý License.',
        'License hết hạn hiển thị badge đỏ.'
      ]
    },
    {
      tab: 'components',
      label: 'Linh kiện',
      purpose: 'Xem và quản lý các linh kiện phần cứng đang lắp đặt trên thiết bị (RAM, HDD, PSU...).',
      actions: [
        {
          action: 'Gán linh kiện',
          steps: [
            'Bấm "+ Gán linh kiện".',
            'Chọn linh kiện từ kho.',
            'Xác nhận lắp đặt.'
          ]
        },
        {
          action: 'Tháo linh kiện',
          steps: [
            'Bấm nút Tháo bên cạnh linh kiện.',
            'Xác nhận tháo — linh kiện trả về kho.'
          ]
        }
      ],
      tips: ['Linh kiện được quản lý tồn kho riêng, không trộn với tài sản chính.']
    },
    {
      tab: 'warranty',
      label: 'Bảo hành',
      purpose: 'Theo dõi thông tin bảo hành và tính khấu hao tài sản.',
      fields: [
        { name: 'Ngày mua', desc: 'Ngày bắt đầu sở hữu.' },
        { name: 'Ngày hết bảo hành', desc: 'Ngày hết hiệu lực bảo hành nhà sản xuất.' },
        { name: 'Số ngày còn lại', desc: 'Tự động tính số ngày đến khi hết bảo hành.' },
        { name: 'Khấu hao', desc: 'Nhập nguyên giá + thời gian sử dụng → hệ thống tính khấu hao hàng năm/tháng.' }
      ],
      actions: [
        {
          action: 'Chạy nhắc bảo hành (Admin)',
          steps: [
            'Bấm "Chạy nhắc bảo hành".',
            'Hệ thống tạo nhắc nhở cho các tài sản sắp hết bảo hành (30/60/90 ngày).'
          ]
        }
      ],
      tips: [
        'Nhắc bảo hành chỉ Admin mới thấy nút chạy.',
        'Bộ tính khấu hao dùng phương pháp đường thẳng (straight-line).'
      ]
    },
    {
      tab: 'inventory',
      label: 'Kiểm kê',
      purpose: 'Quản lý phiên kiểm kê tài sản: tạo, quét barcode/QR, đối soát thực tế vs. hệ thống.',
      actions: [
        {
          action: 'Tạo phiên kiểm kê',
          steps: [
            'Nhập tên phiên.',
            'Chọn vị trí (tùy chọn).',
            'Bấm "Tạo phiên".'
          ]
        },
        {
          action: 'Quét tài sản',
          steps: [
            'Chọn phiên kiểm kê đang mở.',
            'Dùng panel "Quick scan" để quét mã tài sản.',
            'Hệ thống cập nhật trạng thái kiểm kê.'
          ]
        },
        {
          action: 'Đóng phiên',
          steps: [
            'Bấm "Đóng phiên".',
            'Hệ thống tổng hợp kết quả kiểm kê.'
          ]
        }
      ],
      tips: [
        'Chỉ Admin/Kỹ thuật mới thấy tab Kiểm kê.',
        'Có thể tạo nhiều phiên kiểm kê song song cho các vị trí khác nhau.'
      ]
    },
    {
      tab: 'attachments',
      label: 'Tài liệu',
      purpose: 'Tải lên và quản lý file đính kèm cho tài sản (hình ảnh, hóa đơn, hợp đồng, tài liệu kỹ thuật).',
      actions: [
        {
          action: 'Tải file lên',
          steps: [
            'Bấm nút "Tải lên" hoặc kéo thả file.',
            'File được lưu và liên kết với tài sản.',
            'Có thể tải xuống bất kỳ lúc nào.'
          ]
        }
      ],
      tips: ['Hỗ trợ nhiều định dạng: PDF, hình ảnh, documents, spreadsheets.']
    },
    {
      tab: 'compliance',
      label: 'Tuân thủ',
      purpose: 'Tải xuống gói chứng cứ (evidence pack) phục vụ kiểm toán bao gồm: thông tin tài sản, lịch sử gán, bảo trì, timeline, tệp đính kèm.',
      actions: [
        {
          action: 'Tải evidence pack',
          steps: [
            'Bấm "Tải xuống".',
            'Hệ thống tạo file JSON chứa toàn bộ dữ liệu kiểm toán.',
            'Lưu file để nộp kiểm toán.'
          ]
        }
      ],
      tips: ['File evidence chứa đầy đủ: asset info, assignments, maintenance, timeline, attachments, reminders.']
    }
  ];

  let expandedTab = $state<string | null>(null);
</script>

<section id="asset-detail" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <Monitor class="h-5 w-5 text-cyan-400" />
    <h2 class="text-xl font-bold text-slate-50">Quản lý chi tiết tài sản</h2>
    <button onclick={() => copyAnchor('asset-detail')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'asset-detail'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5 space-y-4">
    <p class="text-sm text-slate-300">
      Trang chi tiết tài sản cho phép xem và quản lý toàn bộ thông tin liên quan đến một thiết bị cụ thể.
      Truy cập bằng cách click vào mã tài sản trong danh sách tài sản, hoặc vào URL <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded">/assets/[id]</code>.
    </p>

    <div class="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs text-blue-300">
      <strong>Quyền truy cập:</strong> Tất cả người dùng có thể xem. Chỉ Admin/Kỹ thuật mới thấy nút Gán, Trả, Bảo trì và tab Kiểm kê.
    </div>

    <!-- Header actions -->
    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-200">Thao tác nhanh (thanh công cụ)</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div class="bg-slate-800/50 rounded-lg p-3 border border-white/5">
          <span class="font-semibold text-blue-400">Gán</span>
          <p class="text-slate-400 mt-1">Gán tài sản cho người dùng / phòng ban / hệ thống. Tự động chuyển trạng thái sang "Đang sử dụng".</p>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 border border-white/5">
          <span class="font-semibold text-amber-400">Trả</span>
          <p class="text-slate-400 mt-1">Trả tài sản về kho. Có thể nhập ghi chú trả lại.</p>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 border border-white/5">
          <span class="font-semibold text-green-400">Bảo trì</span>
          <p class="text-slate-400 mt-1">Tạo phiếu bảo trì mới cho tài sản. Chọn mức độ ưu tiên và mô tả vấn đề.</p>
        </div>
      </div>
    </div>

    <!-- Tab guides -->
    <h3 class="text-sm font-semibold text-slate-200 pt-2">Các tab thông tin</h3>
    <div class="space-y-2">
      {#each tabGuides as guide (guide.tab)}
        <div class="bg-slate-800/30 rounded-lg border border-white/5 overflow-hidden">
          <button
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-800/50 transition-colors"
            onclick={() => expandedTab = expandedTab === guide.tab ? null : guide.tab}
          >
            <ChevronRight class="w-4 h-4 text-slate-400 transition-transform {expandedTab === guide.tab ? 'rotate-90' : ''}" />
            <span class="font-medium text-sm text-slate-100">{guide.label}</span>
            <span class="text-xs text-slate-500 flex-1 truncate">{guide.purpose}</span>
          </button>

          {#if expandedTab === guide.tab}
            <div class="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <p class="text-xs text-slate-300">{guide.purpose}</p>

              {#if guide.fields?.length}
                <div>
                  <h4 class="text-xs font-semibold text-slate-400 mb-2">Trường thông tin</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {#each guide.fields as field}
                      <div class="flex gap-2">
                        <span class="font-medium text-slate-200 whitespace-nowrap">{field.name}:</span>
                        <span class="text-slate-400">{field.desc}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if guide.actions?.length}
                <div>
                  <h4 class="text-xs font-semibold text-slate-400 mb-2">Thao tác</h4>
                  {#each guide.actions as act}
                    <div class="mb-2">
                      <span class="text-xs font-medium text-blue-300">{act.action}</span>
                      <ol class="list-decimal list-inside text-xs text-slate-400 mt-1 space-y-0.5">
                        {#each act.steps as step}
                          <li>{step}</li>
                        {/each}
                      </ol>
                    </div>
                  {/each}
                </div>
              {/if}

              {#if guide.tips?.length}
                <div>
                  <h4 class="text-xs font-semibold text-amber-400 mb-1">💡 Mẹo</h4>
                  <ul class="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                    {#each guide.tips as tip}
                      <li>{tip}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>
