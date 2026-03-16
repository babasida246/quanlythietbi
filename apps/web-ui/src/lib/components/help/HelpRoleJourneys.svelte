<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import { Briefcase, Check, ExternalLink, Link2, Shield, Users, Wrench } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  type RoleKey = 'admin' | 'asset' | 'warehouse' | 'technician' | 'requester';

  type Journey = {
    key: RoleKey;
    label: string;
    badge: string;
    badgeClass: string;
    goal: string;
    dailyChecklist: string[];
    controlPoints: string[];
    links: string[];
  };

  function t(key: string, fallback: string): string {
    return $isLoading ? fallback : $_(key, { default: fallback });
  }

  const journeys = $derived.by((): Journey[] => [
    {
      key: 'admin',
      label: t('help.roleJourneys.roles.admin.label', 'Admin'),
      badge: t('help.roleJourneys.roles.admin.badge', 'Quyền hệ thống'),
      badgeClass: 'badge-red',
      goal: t('help.roleJourneys.roles.admin.goal', 'Đảm bảo hệ thống vận hành ổn định, quyền truy cập đúng vai trò, dữ liệu audit đầy đủ.'),
      dailyChecklist: [
        t('help.roleJourneys.roles.admin.daily.1', 'Kiểm tra inbox phê duyệt và thông báo quan trọng.'),
        t('help.roleJourneys.roles.admin.daily.2', 'Rà soát user mới, reset password, role changes.'),
        t('help.roleJourneys.roles.admin.daily.3', 'Xem dashboard sự cố và trend bảo trì.'),
        t('help.roleJourneys.roles.admin.daily.4', 'Kiểm tra các thay đổi nhạy cảm trên security/audit.')
      ],
      controlPoints: [
        t('help.roleJourneys.roles.admin.control.1', 'Không cấp quyền vượt mức cần thiết.'),
        t('help.roleJourneys.roles.admin.control.2', 'Mọi thao tác nhạy cảm phải có lý do và audit trail.'),
        t('help.roleJourneys.roles.admin.control.3', 'Prod change nên qua flow phê duyệt.')
      ],
      links: ['/admin', '/security', '/inbox']
    },
    {
      key: 'asset',
      label: t('help.roleJourneys.roles.asset.label', 'IT Asset Manager'),
      badge: t('help.roleJourneys.roles.asset.badge', 'Vòng đời tài sản'),
      badgeClass: 'badge-blue',
      goal: t('help.roleJourneys.roles.asset.goal', 'Quản lý vòng đời tài sản từ đăng ký, cấp phát, bảo trì đến báo cáo.'),
      dailyChecklist: [
        t('help.roleJourneys.roles.asset.daily.1', 'Cập nhật danh mục nếu có model/vendor mới.'),
        t('help.roleJourneys.roles.asset.daily.2', 'Theo dõi tài sản sắp hết bảo hành.'),
        t('help.roleJourneys.roles.asset.daily.3', 'Kiểm tra tài sản đang chờ xử lý WO.'),
        t('help.roleJourneys.roles.asset.daily.4', 'Chốt report sử dụng và tình trạng tài sản.')
      ],
      controlPoints: [
        t('help.roleJourneys.roles.asset.control.1', 'Mã tài sản và serial phải duy nhất.'),
        t('help.roleJourneys.roles.asset.control.2', 'Không xóa tài sản đã có lịch sử giao dịch.'),
        t('help.roleJourneys.roles.asset.control.3', 'Đồng bộ status tài sản với kết quả WO.')
      ],
      links: ['/assets', '/assets/catalogs', '/reports/assets']
    },
    {
      key: 'warehouse',
      label: t('help.roleJourneys.roles.warehouse.label', 'Warehouse Keeper'),
      badge: t('help.roleJourneys.roles.warehouse.badge', 'Kho và linh kiện'),
      badgeClass: 'badge-amber',
      goal: t('help.roleJourneys.roles.warehouse.goal', 'Đảm bảo tồn kho đúng, phiếu nhập/xuất chính xác, hỗ trợ WO kịp thời.'),
      dailyChecklist: [
        t('help.roleJourneys.roles.warehouse.daily.1', 'Theo dõi low-stock và linh kiện critical.'),
        t('help.roleJourneys.roles.warehouse.daily.2', 'Đối chiếu phiếu nhập/xuất đang chờ xử lý.'),
        t('help.roleJourneys.roles.warehouse.daily.3', 'Kiểm tra sai lệch tồn kho và ghi nhận adjustment.'),
        t('help.roleJourneys.roles.warehouse.daily.4', 'Rà soát lịch sử xuất linh kiện cho WO.')
      ],
      controlPoints: [
        t('help.roleJourneys.roles.warehouse.control.1', 'Chỉ post phiếu khi line item đầy đủ.'),
        t('help.roleJourneys.roles.warehouse.control.2', 'Mọi adjustment cần lý do rõ ràng.'),
        t('help.roleJourneys.roles.warehouse.control.3', 'Kiểm kê định kỳ theo kho/nhóm part.')
      ],
      links: ['/warehouse/stock', '/warehouse/documents', '/warehouse/reconciliation']
    },
    {
      key: 'technician',
      label: t('help.roleJourneys.roles.technician.label', 'Technician'),
      badge: t('help.roleJourneys.roles.technician.badge', 'Xử lý sự cố'),
      badgeClass: 'badge-green',
      goal: t('help.roleJourneys.roles.technician.goal', 'Xử lý work order nhanh, đúng quy trình, ghi nhận đầy đủ chẩn đoán và kết quả.'),
      dailyChecklist: [
        t('help.roleJourneys.roles.technician.daily.1', 'Kiểm tra WO mới theo mức độ ưu tiên.'),
        t('help.roleJourneys.roles.technician.daily.2', 'Cập nhật trạng thái WO theo tiến độ thực tế.'),
        t('help.roleJourneys.roles.technician.daily.3', 'Ghi nhận linh kiện/chi phí test sau sửa.'),
        t('help.roleJourneys.roles.technician.daily.4', 'Đồng bộ kết quả sửa chữa vào lịch sử tài sản.')
      ],
      controlPoints: [
        t('help.roleJourneys.roles.technician.control.1', 'Không bỏ qua bước test sau sửa.'),
        t('help.roleJourneys.roles.technician.control.2', 'Không đóng WO khi chưa có kết quả rõ ràng.'),
        t('help.roleJourneys.roles.technician.control.3', 'Escalate nếu chi phí vượt ngưỡng.')
      ],
      links: ['/maintenance/repairs', '/warehouse/repairs', '/inventory']
    },
    {
      key: 'requester',
      label: t('help.roleJourneys.roles.requester.label', 'Requester/User'),
      badge: t('help.roleJourneys.roles.requester.badge', 'Yêu cầu và theo dõi'),
      badgeClass: 'badge-purple',
      goal: t('help.roleJourneys.roles.requester.goal', 'Tạo yêu cầu đúng thông tin, theo dõi trạng thái và hoàn tất giao tiếp với bộ phận xử lý.'),
      dailyChecklist: [
        t('help.roleJourneys.roles.requester.daily.1', 'Tạo request với mô tả rõ ràng, đúng loại yêu cầu.'),
        t('help.roleJourneys.roles.requester.daily.2', 'Theo dõi trạng thái và phản hồi bổ sung khi được yêu cầu.'),
        t('help.roleJourneys.roles.requester.daily.3', 'Kiểm tra tài sản được cấp phát trong My Assets.')
      ],
      controlPoints: [
        t('help.roleJourneys.roles.requester.control.1', 'Không tạo duplicate request cho cùng một vấn đề.'),
        t('help.roleJourneys.roles.requester.control.2', 'Luôn cập nhật thông tin liên hệ và bộ phận.'),
        t('help.roleJourneys.roles.requester.control.3', 'Đọc kết quả xử lý trước khi đóng trao đổi.')
      ],
      links: ['/me/requests', '/me/requests/new', '/me/assets']
    }
  ]);

  let activeRole = $state<RoleKey>('admin');
</script>

<section id="role-journeys" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <Users class="h-5 w-5 text-indigo-400" />
    <h2 class="text-xl font-bold text-slate-50">{$isLoading ? 'Role Journeys' : $_('help.roleJourneys.title')}</h2>
    <button onclick={() => copyAnchor('role-journeys')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'role-journeys'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 overflow-hidden">
    <div class="flex flex-wrap gap-1.5 p-3 border-b border-slate-700/40">
      {#each journeys as role}
        <button
          onclick={() => (activeRole = role.key)}
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            {activeRole === role.key
              ? 'bg-primary text-white'
              : 'bg-surface-3 text-slate-300 hover:text-slate-100'}"
        >
          {role.label}
        </button>
      {/each}
    </div>

    {#each journeys as role}
      {#if activeRole === role.key}
        <div class="p-5 space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <Briefcase class="h-4 w-4 text-slate-400" />
            <span class="text-sm text-slate-200 font-medium">{role.goal}</span>
            <span class="badge {role.badgeClass} text-xs">{role.badge}</span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-lg border border-slate-700/40 bg-slate-800/30 p-4">
              <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">{$isLoading ? 'Daily Checklist' : $_('help.roleJourneys.checklistTitle')}</p>
              <ul class="space-y-2">
                {#each role.dailyChecklist as item}
                  <li class="text-sm text-slate-200 flex items-start gap-2">
                    <Check class="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                {/each}
              </ul>
            </div>

            <div class="rounded-lg border border-slate-700/40 bg-slate-800/30 p-4">
              <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">{$isLoading ? 'Control Points' : $_('help.roleJourneys.controlTitle')}</p>
              <ul class="space-y-2">
                {#each role.controlPoints as item}
                  <li class="text-sm text-slate-200 flex items-start gap-2">
                    <Shield class="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                {/each}
              </ul>
            </div>
          </div>

          <div class="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">{$isLoading ? 'Shortcuts' : $_('help.roleJourneys.shortcutsTitle')}</p>
            <div class="flex flex-wrap gap-2">
              {#each role.links as l}
                <a
                  href={l}
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink class="h-3.5 w-3.5" />
                  {`${$_('help.roleJourneys.openPath', { default: 'Mở' })} ${l}`}
                </a>
              {/each}
              <a
                href="/settings/print"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-surface-3 text-slate-200 border border-slate-600 hover:border-slate-400 transition-colors"
              >
                <Wrench class="h-3.5 w-3.5" />
                {$_('help.roleJourneys.printSettings', { default: 'Mở /settings/print' })}
              </a>
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</section>
