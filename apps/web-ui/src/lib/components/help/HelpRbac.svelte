<script lang="ts">
  import {
    Shield, Check, Link2, Users, Lock, Building2, Key, AlertTriangle,
    ChevronRight, FolderOpen, UserPlus, ShieldCheck, UsersRound, Globe,
    GitMerge, Search, Info, Layers
  } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  let activeTab = $state<'architecture' | 'directory' | 'policies' | 'debug'>('architecture');

  // ── Data ────────────────────────────────────────────────────────────────────
  const classicRoles = [
    { slug: 'admin',            name: 'Admin',            badge: 'badge-red',    desc: 'Toàn quyền hệ thống, quản lý user, cấu hình phân quyền.',              pages: 'Tất cả trang' },
    { slug: 'super_admin',      name: 'Super Admin',      badge: 'badge-red',    desc: 'Tương đương Admin — dành cho tài khoản hệ thống cấp cao nhất.',        pages: 'Tất cả trang' },
    { slug: 'it_asset_manager', name: 'IT Asset Manager', badge: 'badge-blue',   desc: 'Quản lý vòng đời tài sản, danh mục, CMDB, báo cáo.',                   pages: 'Tất cả trừ /admin' },
    { slug: 'warehouse_keeper', name: 'Warehouse Keeper', badge: 'badge-amber',  desc: 'Quản lý kho, linh kiện, phiếu nhập/xuất, kiểm kê.',                    pages: '/warehouse, /reports, /analytics' },
    { slug: 'technician',       name: 'Technician',       badge: 'badge-green',  desc: 'Xử lý work order sửa chữa, ghi nhận chẩn đoán.',                       pages: '/maintenance, /assets (xem), /warehouse (xem)' },
    { slug: 'requester',        name: 'Requester',        badge: 'badge-purple', desc: 'Tạo yêu cầu, theo dõi trạng thái, xem tài sản cá nhân.',               pages: '/requests, /me, /inbox' },
    { slug: 'viewer',           name: 'Viewer',           badge: 'badge-slate',  desc: 'Chỉ xem — không chỉnh sửa. Phù hợp cho lãnh đạo hoặc audit.',          pages: '/assets (xem), /reports, /analytics' },
  ];

  const resources = [
    { r: 'assets',        actions: ['read','create','update','delete','export','import','assign'], desc: 'Tài sản IT' },
    { r: 'categories',    actions: ['read','manage'],                                              desc: 'Danh mục (loại, model, vendor, vị trí)' },
    { r: 'warehouse',     actions: ['read','create','approve'],                                    desc: 'Kho và phiếu nhập/xuất' },
    { r: 'inventory',     actions: ['read','create','manage'],                                     desc: 'Kiểm kê tài sản' },
    { r: 'maintenance',   actions: ['read','create','manage'],                                     desc: 'Work order bảo trì' },
    { r: 'requests',      actions: ['read','create','approve'],                                    desc: 'Workflow phê duyệt' },
    { r: 'reports',       actions: ['read','export'],                                              desc: 'Báo cáo và analytics' },
    { r: 'cmdb',          actions: ['read','create','update','delete'],                            desc: 'Configuration Management DB' },
    { r: 'analytics',     actions: ['read'],                                                       desc: 'Dashboard phân tích' },
    { r: 'security',      actions: ['read','manage'],                                              desc: 'Audit log, compliance' },
    { r: 'rbac',          actions: ['admin','ou:manage','user:manage','group:manage'],             desc: 'Quản trị phân quyền' },
    { r: 'tool',          actions: ['network_change:execute','server_restart:execute','db_migration:execute'], desc: 'Công cụ vận hành (AD-only)' },
  ];

  const actionColors: Record<string, string> = {
    read:   'bg-sky-900/30 text-sky-300 border-sky-700/40',
    create: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40',
    update: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
    delete: 'bg-rose-900/30 text-rose-300 border-rose-700/40',
    export: 'bg-violet-900/30 text-violet-300 border-violet-700/40',
    import: 'bg-violet-900/30 text-violet-300 border-violet-700/40',
    manage: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
    approve:'bg-sky-900/30 text-sky-300 border-sky-700/40',
    assign: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/40',
    admin:  'bg-red-900/30 text-red-300 border-red-700/40',
  };

  function actionColor(a: string): string {
    const base = a.split(':')[0]
    return actionColors[base] ?? 'bg-slate-800/50 text-slate-400 border-slate-700/50'
  }

  const useCases = [
    { scenario: 'Cấp quyền cho 1 user cụ thể toàn hệ thống', principal: 'USER', ptype: 'text-blue-400', scope: 'GLOBAL', stype: 'text-slate-400', effect: 'ALLOW', etype: 'text-emerald-400' },
    { scenario: 'Cấp quyền cho toàn nhóm IT staff',           principal: 'GROUP', ptype: 'text-violet-400', scope: 'GLOBAL', stype: 'text-slate-400', effect: 'ALLOW', etype: 'text-emerald-400' },
    { scenario: 'Cấp policy cho toàn phòng ban (OU)',          principal: 'OU',    ptype: 'text-amber-400', scope: 'GLOBAL', stype: 'text-slate-400', effect: 'ALLOW', etype: 'text-emerald-400' },
    { scenario: 'Kế thừa policy xuống toàn bộ sub-OU',        principal: 'OU',    ptype: 'text-amber-400', scope: 'OU subtree', stype: 'text-amber-400', effect: 'ALLOW', etype: 'text-emerald-400' },
    { scenario: 'Block quyền xóa cho toàn bộ OU',             principal: 'OU',    ptype: 'text-amber-400', scope: 'GLOBAL', stype: 'text-slate-400', effect: 'DENY',  etype: 'text-rose-400' },
    { scenario: 'Block 1 user khỏi resource nhạy cảm',        principal: 'USER',  ptype: 'text-blue-400', scope: 'RESOURCE', stype: 'text-sky-400', effect: 'DENY',  etype: 'text-rose-400' },
  ];
</script>

<!-- ═══════════════════════════════════════════════════════════════════
     RBAC & Phân quyền — Unified System (post migration 061)
════════════════════════════════════════════════════════════════════ -->
<section id="rbac" class="scroll-mt-20">

  <!-- Section header -->
  <div class="flex items-center gap-2 mb-4">
    <Lock class="h-5 w-5 text-violet-400" />
    <h2 class="text-xl font-bold text-slate-50">Phân quyền & RBAC</h2>
    <button onclick={() => copyAnchor('rbac')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'rbac'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <!-- Tabs -->
  <div class="flex flex-wrap gap-1.5 mb-5">
    {#each ([
      ['architecture', Layers,      'Kiến trúc'],
      ['directory',    FolderOpen,  'Thư mục (OU)'],
      ['policies',     ShieldCheck, 'Policy Library'],
      ['debug',        Search,      'Kiểm tra quyền'],
    ] as [string, any, string][]) as [key, Icon, label]}
      <button
        onclick={() => activeTab = key as typeof activeTab}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
          {activeTab === key ? 'bg-violet-600 text-white' : 'bg-surface-3 text-slate-300 hover:text-slate-100'}"
      >
        <Icon class="w-3.5 h-3.5" />
        {label}
      </button>
    {/each}
  </div>

  <!-- ══════════════════════════════════════════════════════════════════
       Tab: Kiến trúc
  ══════════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'architecture'}
    <div class="space-y-4">

      <!-- Two-source banner -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-bold text-indigo-400">①</span>
            </div>
            <h3 class="text-sm font-semibold text-indigo-300">Classic RBAC — lớp nền</h3>
          </div>
          <ul class="text-xs text-slate-400 space-y-1.5 pl-1">
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Mỗi user có 1 role trong trường <code class="bg-slate-700/50 px-1 rounded">users.role</code></li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Role → quyền qua bảng <code class="bg-slate-700/50 px-1 rounded">role_permissions</code></li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Chỉ ALLOW, không có DENY, phạm vi GLOBAL</li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> 7 role có sẵn + tùy chỉnh thêm qua Policy Library</li>
          </ul>
          <p class="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/30">Quản lý tại: <span class="text-slate-400">Admin → Policy Library → chọn role slug</span></p>
        </div>

        <div class="rounded-xl border border-violet-700/40 bg-violet-900/10 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-bold text-violet-400">②</span>
            </div>
            <h3 class="text-sm font-semibold text-violet-300">Policy System — lớp nâng cao</h3>
          </div>
          <ul class="text-xs text-slate-400 space-y-1.5 pl-1">
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Policy = tập quyền có tên, gán cho <span class="text-blue-400">USER</span> / <span class="text-violet-400">GROUP</span> / <span class="text-amber-400">OU</span></li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Hỗ trợ ALLOW <strong>và</strong> DENY với scope: GLOBAL / OU / RESOURCE</li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Kế thừa subtree OU (inherit = true) — kiểu GPO</li>
            <li class="flex items-start gap-2"><ChevronRight class="w-3 h-3 shrink-0 mt-0.5 text-slate-600" /> Dùng chung bảng <code class="bg-slate-700/50 px-1 rounded">permissions</code> với Classic</li>
          </ul>
          <p class="text-xs text-slate-500 mt-3 pt-3 border-t border-violet-700/20">Quản lý tại: <span class="text-slate-400">Admin → Policy Library</span> hoặc <span class="text-slate-400">Admin → Directory → chọn OU → tab Policies</span></p>
        </div>
      </div>

      <!-- Merge algorithm -->
      <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
        <div class="px-4 py-3 border-b border-surface-3 bg-surface-3/30 flex items-center gap-2">
          <GitMerge class="w-4 h-4 text-rose-400" />
          <h3 class="text-sm font-semibold text-slate-200">Thuật toán Effective Permissions (PermissionCenterService)</h3>
        </div>
        <div class="px-4 py-4 space-y-3">
          <!-- Flow diagram -->
          <div class="grid grid-cols-2 gap-2 text-xs text-center">
            <div class="rounded-lg bg-indigo-900/20 border border-indigo-700/30 p-3">
              <p class="font-semibold text-indigo-300 mb-1">① Classic RBAC</p>
              <p class="text-slate-500 font-mono text-[10px]">users.role<br/>→ role_permissions</p>
              <p class="text-emerald-400 mt-2 font-medium">→ ALLOW set</p>
            </div>
            <div class="rounded-lg bg-violet-900/20 border border-violet-700/30 p-3">
              <p class="font-semibold text-violet-300 mb-1">② Policy System</p>
              <p class="text-slate-500 font-mono text-[10px]">policy_assignments<br/>→ policy_permissions</p>
              <p class="mt-2 font-medium"><span class="text-emerald-400">→ ALLOW</span> + <span class="text-rose-400">DENY</span></p>
            </div>
          </div>

          <!-- Rule -->
          <div class="rounded-lg bg-rose-900/15 border border-rose-700/30 p-3 flex items-start gap-3">
            <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div class="text-xs">
              <p class="font-semibold text-rose-400 mb-0.5">DENY luôn thắng ALLOW — không có ngoại lệ</p>
              <p class="text-slate-400">Tất cả DENY từ mọi nguồn được gom vào <code class="bg-surface-3 px-1 rounded">deniedSet</code>, sau đó xóa khỏi <code class="bg-surface-3 px-1 rounded">allowedSet</code>. Một DENY duy nhất đủ để block permission đó.</p>
            </div>
          </div>

          <!-- Code snippet -->
          <div class="rounded-lg bg-slate-900/80 border border-slate-700/50 p-3 font-mono text-xs overflow-x-auto">
            <p class="text-slate-500 mb-1">// PermissionCenterService (packages/application/src/rbac/)</p>
            <p class="text-slate-300">classicKeys = rolePermissions<span class="text-slate-500">(users.role)</span></p>
            <p class="text-slate-300">policyAllowed, policyDenied = getPolicyPermissions<span class="text-slate-500">(systemUserId)</span></p>
            <p class="text-emerald-400 mt-1">allowedSet = [...classicKeys, ...policyAllowed]</p>
            <p class="text-rose-400">deniedSet.forEach(d =&gt; allowedSet.delete(d))  <span class="text-slate-600">// DENY wins</span></p>
          </div>
        </div>
      </div>

      <!-- Classic roles table -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Users class="h-4 w-4 text-violet-400" /> 7 Role mặc định (Classic RBAC)
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-700/40">
                <th class="text-left py-2 px-3 text-slate-400 font-semibold w-40">Role</th>
                <th class="text-left py-2 px-3 text-slate-400 font-semibold">Mô tả</th>
                <th class="text-left py-2 px-3 text-slate-400 font-semibold w-52">Trang mặc định</th>
              </tr>
            </thead>
            <tbody>
              {#each classicRoles as role, i}
                <tr class="border-b border-slate-700/20 {i % 2 !== 0 ? 'bg-slate-800/20' : ''} hover:bg-surface-3/30 transition-colors">
                  <td class="py-2 px-3">
                    <span class="badge {role.badge}">{role.name}</span>
                    <code class="block text-[10px] text-slate-500 mt-0.5">{role.slug}</code>
                  </td>
                  <td class="py-2 px-3 text-slate-300">{role.desc}</td>
                  <td class="py-2 px-3 text-slate-400 text-[11px]">{role.pages}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/20">
          Role được gán qua: <span class="text-slate-400">Admin → Users (cột Role)</span> hoặc <span class="text-slate-400">Directory → OU → Users → edit</span>.
        </p>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════
       Tab: Thư mục (OU)
  ══════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'directory'}
    <div class="space-y-4">

      <!-- Intro -->
      <div class="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4 text-sm">
        <div class="flex items-center gap-2 mb-2">
          <Building2 class="h-4 w-4 text-amber-400" />
          <h3 class="font-semibold text-amber-300">Admin → Directory</h3>
        </div>
        <p class="text-xs text-slate-400">
          Giao diện kiểu Windows Server Active Directory Users & Computers. Quản lý cấu trúc tổ chức (OU), nhân sự (AD Users), nhóm (Groups) và gắn policy theo phòng ban (GPO-style).
        </p>
      </div>

      <!-- Concepts grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {#each [
          { term: 'Org Unit (OU)', Icon: FolderOpen, color: 'border-amber-600/40 text-amber-300', desc: 'Đơn vị tổ chức — phòng/ban/bộ phận. Có thể lồng nhau. Path dạng /root/it/helpdesk.' },
          { term: 'AD User',       Icon: UserPlus,   color: 'border-indigo-600/40 text-indigo-300', desc: 'Nhân sự trong cây thư mục. Có thể liên kết với tài khoản đăng nhập (linkedUserId).' },
          { term: 'Group',         Icon: UsersRound, color: 'border-violet-600/40 text-violet-300', desc: 'Nhóm users hoặc nhóm con. Gán policy cho nhóm → áp dụng cho tất cả thành viên.' },
          { term: 'Policy link',   Icon: ShieldCheck,color: 'border-emerald-600/40 text-emerald-300', desc: 'Policy được liên kết với OU (kiểu GPO). Kế thừa xuống sub-OU nếu inherit = true.' },
        ] as item}
          <div class="rounded-lg border {item.color.split(' ')[0]} bg-slate-800/30 p-3 space-y-1.5">
            <div class="flex items-center gap-1.5">
              <item.Icon class="w-3.5 h-3.5 {item.color.split(' ')[1]}" />
              <p class="text-xs font-semibold {item.color.split(' ')[1]}">{item.term}</p>
            </div>
            <p class="text-xs text-slate-400">{item.desc}</p>
          </div>
        {/each}
      </div>

      <!-- Step by step -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <ChevronRight class="h-4 w-4 text-violet-400" /> Cách thiết lập phân quyền theo tổ chức
        </h3>
        <div class="space-y-4">
          {#each [
            {
              n: '1', color: 'bg-amber-600/25 text-amber-300',
              title: 'Tạo cấu trúc OU',
              body: 'Vào Admin → Directory → nút "Tạo OU". Tạo OU gốc (ví dụ: "Bệnh viện"), sau đó tạo OU con phản ánh sơ đồ tổ chức thực tế.',
              ex: 'Bệnh viện → IT Dept → Helpdesk / Infrastructure / DevOps'
            },
            {
              n: '2', color: 'bg-indigo-600/25 text-indigo-300',
              title: 'Thêm người dùng vào OU',
              body: 'Chọn OU → tab Người dùng → "Thêm người dùng". Điền username, tên hiển thị, email. Người dùng tự động thuộc OU đang chọn.',
              ex: 'john.doe trong OU Helpdesk, liên kết đến tài khoản john@hospital.local'
            },
            {
              n: '3', color: 'bg-violet-600/25 text-violet-300',
              title: 'Tạo Groups trong OU',
              body: 'Chọn OU → tab Nhóm → "Tạo nhóm". Đặt tên nhóm. Group dùng để gán policy cho tập hợp user.',
              ex: 'Group "L1-Support" gồm toàn bộ helpdesk technician'
            },
            {
              n: '4', color: 'bg-emerald-600/25 text-emerald-300',
              title: 'Liên kết Policy với OU (GPO-style)',
              body: 'Chọn OU → tab Policy → "Liên kết policy". Chọn policy từ thư viện, chọn Effect (ALLOW/DENY) và bật "Kế thừa xuống OU con" nếu cần.',
              ex: 'Policy "warehouse_keeper" → OU IT Dept, Effect: ALLOW, Inherit: Có → toàn bộ sub-OU trong IT nhận quyền này'
            },
            {
              n: '5', color: 'bg-sky-600/25 text-sky-300',
              title: 'Gán Classic Role cho OU (bulk)',
              body: 'Dùng chức năng trong Policy Library → Assignments → "Bulk assign to OU" để cập nhật role hệ thống cho tất cả user liên kết trong OU.',
              ex: 'Gán role technician cho toàn bộ OU Helpdesk (bao gồm sub-OU con)'
            },
          ] as s}
            <div class="flex gap-3">
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {s.color} text-xs font-bold">
                {s.n}
              </div>
              <div class="flex-1 min-w-0 pb-4 border-b border-slate-700/20 last:border-0 last:pb-0">
                <p class="text-sm font-semibold text-slate-100">{s.title}</p>
                <p class="text-xs text-slate-400 mt-0.5">{s.body}</p>
                <p class="text-xs text-slate-500 mt-1.5 italic">Ví dụ: {s.ex}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Policy tab in OU -->
      <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
        <div class="px-4 py-3 border-b border-surface-3 bg-surface-3/30">
          <h3 class="text-sm font-semibold text-slate-200">Tab "Policy" trong mỗi OU — hiểu các loại liên kết</h3>
        </div>
        <div class="px-4 py-4 space-y-2 text-xs">
          {#each [
            { type: 'Trực tiếp', color: 'text-sky-400 bg-sky-900/20 border-sky-700/30', desc: 'Policy được link trực tiếp vào OU này. Có nút "Hủy liên kết".' },
            { type: 'Kế thừa',  color: 'text-amber-400 bg-amber-900/20 border-amber-700/30', desc: 'Policy từ OU cha với inherit = true. Hiển thị để tham khảo, không thể xóa từ đây.' },
            { type: 'Qua nhóm', color: 'text-violet-400 bg-violet-900/20 border-violet-700/30', desc: 'Policy được gán cho một Group thuộc OU này.' },
          ] as item}
            <div class="flex items-start gap-3 rounded-lg border border-slate-700/40 bg-slate-800/20 p-3">
              <span class="px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 {item.color}">{item.type}</span>
              <p class="text-slate-400">{item.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════
       Tab: Policy Library
  ══════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'policies'}
    <div class="space-y-4">

      <!-- Interface overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl border border-surface-3 bg-surface-2/50 p-4">
          <h4 class="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <ShieldCheck class="w-3.5 h-3.5 text-violet-400" /> Panel trái — Danh sách Policy
          </h4>
          <ul class="text-slate-400 space-y-1">
            <li>Tìm kiếm và lọc theo slug/tên</li>
            <li>Tạo mới: nhập slug + tên → Enter</li>
            <li>Policy hệ thống (is_system) không thể xóa</li>
            <li>Inline edit tên/mô tả trực tiếp trong list</li>
          </ul>
        </div>
        <div class="rounded-xl border border-surface-3 bg-surface-2/50 p-4">
          <h4 class="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Key class="w-3.5 h-3.5 text-amber-400" /> Panel phải — Chi tiết Policy
          </h4>
          <ul class="text-slate-400 space-y-1">
            <li>Tab <strong>Permissions</strong>: chip picker trực quan theo resource</li>
            <li>Tab <strong>Assignments</strong>: quản lý gán USER/GROUP/OU</li>
            <li>Bulk assign OU: gán nhanh cho toàn phòng ban</li>
          </ul>
        </div>
      </div>

      <!-- Permission chip picker -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Shield class="h-4 w-4 text-emerald-400" /> Cấu hình quyền — Visual Chip Picker
        </h3>
        <p class="text-xs text-slate-400 mb-4">
          Mỗi resource được hiển thị thành một card. Bên trong là các chip hành động (action). Click để toggle — chip sáng màu = được cấp, chip mờ = chưa cấp.
        </p>

        <!-- Demo chip rows per resource -->
        <div class="space-y-3">
          {#each resources.slice(0, 6) as r}
            <div class="flex items-start gap-3 border border-slate-700/30 rounded-lg px-3 py-2.5 bg-slate-800/20">
              <div class="w-28 shrink-0">
                <code class="text-xs text-violet-300 font-mono">{r.r}</code>
                <p class="text-[10px] text-slate-500 mt-0.5">{r.desc}</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each r.actions as a}
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium border {actionColor(a)}">{a}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <p class="text-xs text-slate-500 mt-4">
          Mỗi chip ứng với một <code class="bg-slate-700/50 px-1 rounded">permission.name</code> có dạng <code class="bg-slate-700/50 px-1 rounded">resource:action</code>. Ví dụ: <code class="bg-slate-700/50 px-1 rounded">assets:create</code>, <code class="bg-slate-700/50 px-1 rounded">warehouse:approve</code>.
        </p>
      </div>

      <!-- Assignment guide -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Users class="h-4 w-4 text-sky-400" /> Gán Policy cho Principal
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-700/40">
                <th class="text-left py-2 px-3 text-slate-400 font-semibold">Tình huống</th>
                <th class="text-left py-2 px-3 text-slate-400 font-semibold">Principal</th>
                <th class="text-left py-2 px-3 text-slate-400 font-semibold">Scope</th>
                <th class="text-left py-2 px-3 text-slate-400 font-semibold">Effect</th>
              </tr>
            </thead>
            <tbody>
              {#each useCases as uc, i}
                <tr class="border-b border-slate-700/20 {i % 2 !== 0 ? 'bg-slate-800/20' : ''} hover:bg-surface-3/20 transition-colors">
                  <td class="py-2 px-3 text-slate-300">{uc.scenario}</td>
                  <td class="py-2 px-3 font-semibold {uc.ptype}">{uc.principal}</td>
                  <td class="py-2 px-3 {uc.stype}">{uc.scope}</td>
                  <td class="py-2 px-3 font-semibold {uc.etype}">{uc.effect}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- DENY tip -->
      <div class="rounded-lg bg-rose-900/15 border border-rose-700/30 p-4 flex items-start gap-3">
        <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div class="text-xs">
          <p class="font-semibold text-rose-300 mb-1">Khi nào dùng DENY?</p>
          <p class="text-slate-400">
            Dùng DENY để <strong>thu hẹp</strong> quyền sau khi đã có ALLOW. Ví dụ: cấp policy <code class="bg-surface-3 px-1 rounded">it_asset_manager</code> cho OU IT, sau đó tạo thêm assignment DENY <code class="bg-surface-3 px-1 rounded">assets:delete</code> cho Group "Intern" — nhóm intern trong OU IT sẽ làm được mọi thứ trừ xóa.
          </p>
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════════════
       Tab: Kiểm tra quyền
  ══════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'debug'}
    <div class="space-y-4">

      <!-- Effective Perms viewer -->
      <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
        <div class="px-4 py-3 border-b border-surface-3 bg-surface-3/30 flex items-center gap-2">
          <Search class="w-4 h-4 text-emerald-400" />
          <h3 class="text-sm font-semibold text-slate-200">Effective Permissions Viewer</h3>
          <span class="ml-auto text-xs text-slate-500 font-mono">Admin → tab Quyền thực tế</span>
        </div>
        <div class="px-4 py-4 space-y-3 text-xs text-slate-400">
          <p>Công cụ debug để xem <strong class="text-slate-300">quyền thực tế</strong> của một user sau khi merge tất cả nguồn. Gọi qua <code class="bg-surface-3 px-1 rounded">PermissionCenterService.getEffectiveForSystemUser()</code>.</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="rounded-lg border border-emerald-700/30 bg-emerald-900/10 p-3">
              <p class="font-semibold text-emerald-400 mb-2">✓ ALLOWED</p>
              <p>Tất cả permissions sau khi DENY đã xóa. Đây là quyền user thực sự có.</p>
            </div>
            <div class="rounded-lg border border-rose-700/30 bg-rose-900/10 p-3">
              <p class="font-semibold text-rose-400 mb-2">✕ DENIED</p>
              <p>Tất cả permissions bị block bởi ít nhất một DENY assignment.</p>
            </div>
          </div>

          <div class="rounded-lg bg-slate-800/50 border border-slate-700/40 p-3 space-y-1.5">
            <p class="font-semibold text-slate-300">Breakdown nguồn hiển thị:</p>
            <p><span class="text-indigo-400 font-medium">Classic RBAC:</span> N permissions từ role <code class="bg-surface-3 px-1 rounded">users.role</code></p>
            <p><span class="text-emerald-400 font-medium">Policy System — Allowed:</span> Permissions từ các policy assignment ALLOW</p>
            <p><span class="text-rose-400 font-medium">Policy System — Denied:</span> Permissions từ các policy assignment DENY</p>
          </div>
        </div>
      </div>

      <!-- Debug checklist -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Info class="h-4 w-4 text-sky-400" /> Checklist khi user báo "không có quyền"
        </h3>
        <div class="space-y-2.5">
          {#each [
            { q: 'Permission có trong ALLOWED không?',         a: 'Nếu không → chưa được cấp. Thêm vào Classic role hoặc Policy ALLOW.' },
            { q: 'Permission có trong DENIED không?',          a: 'Nếu có → đang bị block. Tìm DENY assignment và xóa hoặc giảm scope.' },
            { q: 'Policy đã assign cho đúng user/group/OU?',   a: 'Kiểm tra tab Assignments của policy trong Policy Library.' },
            { q: 'OU có đúng hierarchy không?',                a: 'Nếu dùng inherit=true, kiểm tra path OU và vị trí user trong cây Directory.' },
            { q: 'User đã đăng xuất và đăng nhập lại chưa?',  a: 'JWT token còn hiệu lực cũ. Phải refresh session để nhận quyền mới.' },
          ] as item}
            <div class="flex items-start gap-3 border border-slate-700/30 rounded-lg bg-slate-800/20 px-3 py-2.5">
              <CheckCircleIcon />
              <div class="text-xs">
                <p class="font-medium text-slate-200">{item.q}</p>
                <p class="text-slate-400 mt-0.5">{item.a}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- API endpoints -->
      <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5">
        <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Globe class="h-4 w-4 text-slate-400" /> API endpoints liên quan
        </h3>
        <div class="space-y-1.5 font-mono text-xs">
          {#each [
            ['GET',  '/api/v1/admin/permissions/effective/system-users/:id', 'Effective permissions của system user (PermissionCenterService)'],
            ['GET',  '/api/v1/admin/permissions/policies',                   'Danh sách tất cả policy'],
            ['PUT',  '/api/v1/admin/permissions/policies/:id/permissions',   'Cập nhật permissions của policy'],
            ['POST', '/api/v1/admin/permissions/policies/:id/assignments',   'Thêm assignment (USER/GROUP/OU)'],
            ['GET',  '/api/v1/admin/permissions/policies/by-ou/:ouId',       'Policies liên kết với OU (GPO view)'],
            ['GET',  '/api/v1/admin/permissions/classic/roles/:slug/permissions', 'Permissions của classic role'],
          ] as [method, path, desc]}
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 border-b border-slate-700/20 last:border-0">
              <span class="{method === 'GET' ? 'text-sky-400' : method === 'POST' ? 'text-emerald-400' : 'text-amber-400'} font-bold w-10 shrink-0">{method}</span>
              <code class="text-slate-300 text-[11px]">{path}</code>
              <span class="text-slate-500 text-[10px]">— {desc}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

</section>

<!-- Inline icon component to avoid nesting issues -->
{#snippet CheckCircleIcon()}
  <svg class="w-4 h-4 text-sky-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
{/snippet}
