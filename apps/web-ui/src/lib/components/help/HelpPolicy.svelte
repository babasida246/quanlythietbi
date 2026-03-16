<script lang="ts">
  import { Copy, Check, ShieldCheck, Users, Building2, Globe, FileText, AlertTriangle, GitMerge, Link2 } from 'lucide-svelte';

  let { copyAnchor, copiedId }: { copyAnchor: (id: string) => void; copiedId: string } = $props();
</script>

<!-- ═══════════════════════════════════════════════════════════════════════════
     Policy System — Unified Permission Management (post migration 061)
══════════════════════════════════════════════════════════════════════════════ -->
<section id="policy-system" class="scroll-mt-20 space-y-5">

  <!-- Section header -->
  <div class="flex items-start gap-3">
    <div class="rounded-lg bg-violet-900/30 p-2 mt-0.5 flex-shrink-0">
      <ShieldCheck class="h-5 w-5 text-violet-400" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold text-slate-100">Unified Policy System</h2>
        <button
          type="button"
          class="text-slate-600 hover:text-slate-300 transition-colors"
          onclick={() => copyAnchor('policy-system')}
          title="Copy link"
        >
          {#if copiedId === 'policy-system'}<Check class="h-3.5 w-3.5 text-emerald-400" />{:else}<Copy class="h-3.5 w-3.5" />{/if}
        </button>
      </div>
      <p class="text-sm text-slate-400 mt-1">
        Từ migration 061, AD ACL và Classic RBAC được hợp nhất vào một namespace duy nhất.
        Policy System là cơ chế phân quyền nâng cao duy nhất — thay thế cho cả AD Role và Classic Role permissions.
      </p>
    </div>
  </div>

  <!-- Before / After migration 061 -->
  <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
    <div class="px-5 py-3 border-b border-surface-3 bg-surface-3/30">
      <h3 class="text-sm font-semibold text-slate-200">Trước và sau Migration 061</h3>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-3">
      <div class="p-4">
        <p class="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Trước (3 nguồn)</p>
        <div class="space-y-2 text-xs">
          <div class="flex items-center gap-2.5 text-slate-400">
            <span class="w-5 h-5 rounded-full bg-indigo-900/50 border border-indigo-700/40 flex items-center justify-center text-indigo-400 text-[10px] font-bold">①</span>
            Classic RBAC: <code class="bg-surface-3 px-1 rounded">role_permissions</code>
          </div>
          <div class="flex items-center gap-2.5 text-slate-400">
            <span class="w-5 h-5 rounded-full bg-amber-900/50 border border-amber-700/40 flex items-center justify-center text-amber-400 text-[10px] font-bold">②</span>
            AD Directory: <code class="bg-surface-3 px-1 rounded">rbac_acl → rbac_permissions</code>
          </div>
          <div class="flex items-center gap-2.5 text-slate-400">
            <span class="w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/40 flex items-center justify-center text-violet-400 text-[10px] font-bold">③</span>
            Policy System: <code class="bg-surface-3 px-1 rounded">policy_assignments</code>
          </div>
        </div>
      </div>
      <div class="p-4">
        <p class="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wide">Sau (2 nguồn, hợp nhất)</p>
        <div class="space-y-2 text-xs">
          <div class="flex items-center gap-2.5 text-slate-400">
            <span class="w-5 h-5 rounded-full bg-indigo-900/50 border border-indigo-700/40 flex items-center justify-center text-indigo-400 text-[10px] font-bold">①</span>
            Classic RBAC: <code class="bg-surface-3 px-1 rounded">role_permissions</code> (giữ nguyên)
          </div>
          <div class="flex items-center gap-2.5 text-slate-400">
            <span class="w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/40 flex items-center justify-center text-violet-400 text-[10px] font-bold">②</span>
            Policy System: <code class="bg-surface-3 px-1 rounded">policy_assignments</code> <span class="text-emerald-400">(includes AD ACL)</span>
          </div>
          <div class="mt-2 rounded-md bg-emerald-900/20 border border-emerald-700/30 px-2.5 py-1.5 text-emerald-400">
            rbac_acl đã được migrate vào policy_assignments. AD Directory source bị bỏ.
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Core concepts -->
  <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
    <div class="px-5 py-3 border-b border-surface-3 bg-surface-3/30">
      <h3 class="text-sm font-semibold text-slate-200">Các khái niệm cốt lõi</h3>
    </div>
    <div class="divide-y divide-surface-3 text-xs">

      <div class="px-5 py-3 flex gap-4">
        <div class="w-24 flex-shrink-0">
          <span class="font-bold text-violet-400 font-mono">Policy</span>
        </div>
        <div class="text-slate-400">
          Tập hợp quyền có tên (<code class="bg-surface-3 px-1 rounded">slug</code> + tên + mô tả). Gán được cho nhiều loại principal khác nhau.
          <span class="text-slate-500"> Ví dụ: <code class="bg-surface-3 px-1 rounded">warehouse_keeper</code>, <code class="bg-surface-3 px-1 rounded">it_readonly</code></span>
        </div>
      </div>

      <div class="px-5 py-3 flex gap-4">
        <div class="w-24 flex-shrink-0">
          <span class="font-bold text-sky-400 font-mono">Principal</span>
        </div>
        <div class="text-slate-400 space-y-2">
          <p>Ai nhận policy. Có 3 loại:</p>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <Users class="w-3.5 h-3.5 text-blue-400 mb-1" />
              <p class="font-semibold text-blue-400">USER</p>
              <p class="text-slate-500">System user cụ thể (bảng <code>users</code>)</p>
            </div>
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <Users class="w-3.5 h-3.5 text-violet-400 mb-1" />
              <p class="font-semibold text-violet-400">GROUP</p>
              <p class="text-slate-500">AD directory group (bảng <code>rbac_groups</code>)</p>
            </div>
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <Building2 class="w-3.5 h-3.5 text-amber-400 mb-1" />
              <p class="font-semibold text-amber-400">OU</p>
              <p class="text-slate-500">Toàn bộ user trong Org Unit (+ subtree nếu inherit)</p>
            </div>
          </div>
        </div>
      </div>

      <div class="px-5 py-3 flex gap-4">
        <div class="w-24 flex-shrink-0">
          <span class="font-bold text-emerald-400 font-mono">Scope</span>
        </div>
        <div class="text-slate-400 space-y-2">
          <p>Phạm vi áp dụng:</p>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <Globe class="w-3.5 h-3.5 text-slate-400 mb-1" />
              <p class="font-semibold text-slate-300">GLOBAL</p>
              <p class="text-slate-500">Toàn hệ thống</p>
            </div>
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <Building2 class="w-3.5 h-3.5 text-amber-400 mb-1" />
              <p class="font-semibold text-slate-300">OU</p>
              <p class="text-slate-500">Trong OU subtree chỉ định</p>
            </div>
            <div class="bg-surface-3/50 rounded p-2 border border-surface-3">
              <FileText class="w-3.5 h-3.5 text-sky-400 mb-1" />
              <p class="font-semibold text-slate-300">RESOURCE</p>
              <p class="text-slate-500">Resource key cụ thể (<code>assets:123</code>)</p>
            </div>
          </div>
        </div>
      </div>

      <div class="px-5 py-3 flex gap-4">
        <div class="w-24 flex-shrink-0">
          <span class="font-bold text-rose-400 font-mono">Effect</span>
        </div>
        <div class="text-slate-400">
          <span class="text-emerald-400 font-semibold">ALLOW</span> — cấp quyền.
          <span class="text-rose-400 font-semibold">DENY</span> — từ chối và luôn thắng ALLOW.
          <p class="text-slate-500 mt-1">Khi merge, mọi DENY xóa permission khỏi ALLOW set cuối cùng — kể cả khi permission đó được ALLOW từ Classic RBAC.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Merge algorithm (updated — 2 sources) -->
  <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
    <div class="px-5 py-3 border-b border-surface-3 bg-surface-3/30 flex items-center gap-2">
      <GitMerge class="w-4 h-4 text-rose-400" />
      <h3 class="text-sm font-semibold text-slate-200">Merge Effective Permissions — 2 nguồn (post 061)</h3>
    </div>
    <div class="px-5 py-4">
      <div class="grid grid-cols-2 gap-2 text-xs text-center mb-3">
        <div class="rounded-lg bg-indigo-900/20 border border-indigo-700/30 p-3">
          <p class="font-semibold text-indigo-300 mb-1">① Classic RBAC</p>
          <p class="text-slate-500 font-mono text-[10px]">users.role → role_permissions</p>
          <p class="text-emerald-400 mt-2">→ ALLOW set</p>
        </div>
        <div class="rounded-lg bg-violet-900/20 border border-violet-700/30 p-3">
          <p class="font-semibold text-violet-300 mb-1">② Policy System</p>
          <p class="text-slate-500 font-mono text-[10px]">policy_assignments → policy_permissions</p>
          <p class="mt-2"><span class="text-emerald-400">→ ALLOW</span> + <span class="text-rose-400">DENY</span></p>
        </div>
      </div>
      <div class="rounded-lg bg-rose-900/15 border border-rose-700/30 p-2.5 text-center text-xs">
        <p class="text-rose-400 font-semibold">deniedSet xóa khỏi allowedSet → Effective Permissions</p>
      </div>
      <div class="mt-3 flex items-start gap-2 text-xs">
        <AlertTriangle class="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p class="text-slate-500">
          AD Directory source (<code class="bg-surface-3 px-1 rounded">directoryAllowed</code>, <code class="bg-surface-3 px-1 rounded">directoryDenied</code>) vẫn tồn tại trong API response nhưng luôn là mảng rỗng sau migration 061.
          Dữ liệu đã được migrate vào <code class="bg-surface-3 px-1 rounded">policy_assignments</code>.
        </p>
      </div>
    </div>
  </div>

  <!-- Quick how-to -->
  <div class="rounded-xl border border-surface-3 bg-surface-1/30 overflow-hidden">
    <div class="px-5 py-3 border-b border-surface-3 bg-surface-3/30">
      <h3 class="text-sm font-semibold text-slate-200">Hướng dẫn nhanh</h3>
    </div>
    <div class="px-5 py-4 space-y-4 text-xs text-slate-400">
      {#each [
        { n: '1', c: 'bg-violet-600/20 text-violet-300', title: 'Tạo Policy', body: 'Admin → Policy Library → nhập slug (chữ thường, dấu gạch dưới), tên hiển thị, mô tả → Enter hoặc nút Tạo.' },
        { n: '2', c: 'bg-emerald-600/20 text-emerald-300', title: 'Cấu hình Permissions', body: 'Chọn policy → tab Permissions → click chip để toggle quyền theo resource. Grant all / Clear all để thao tác nhanh cả resource.' },
        { n: '3', c: 'bg-sky-600/20 text-sky-300', title: 'Gán cho User / Group / OU', body: 'Tab Assignments → chọn Principal Type + ID + Scope + Effect → Add. Hoặc vào Directory → chọn OU → tab Policy → Liên kết policy (cách GPO).' },
        { n: '4', c: 'bg-rose-600/20 text-rose-300', title: 'Kiểm tra quyền thực tế', body: 'Admin → tab Quyền thực tế → chọn user → "Xem quyền" → xem breakdown Classic + Policy Allowed/Denied.' },
      ] as s}
        <div class="flex items-start gap-3">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full {s.c} text-[11px] font-bold">{s.n}</span>
          <div>
            <p class="font-semibold text-slate-300 mb-0.5">{s.title}</p>
            <p>{s.body}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Cross-reference -->
  <div class="rounded-lg border border-slate-700/30 bg-slate-800/20 p-3 flex items-start gap-2 text-xs">
    <Link2 class="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
    <p class="text-slate-500">
      Xem thêm chi tiết giao diện quản lý và trường hợp sử dụng cụ thể tại phần
      <button onclick={() => document.getElementById('rbac')?.scrollIntoView({ behavior: 'smooth' })}
        class="text-primary hover:underline">Phân quyền & RBAC</button>
      phía trên.
    </p>
  </div>

</section>
