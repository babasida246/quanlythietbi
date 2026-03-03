<script lang="ts">
  import UserManagementPanel from '$lib/components/admin/UserManagementPanel.svelte';
  import AuditLogsPanel from '$lib/components/admin/AuditLogsPanel.svelte';
  import RbacPanel from '$lib/components/admin/RbacPanel.svelte';
  import AdRbacPanel from '$lib/components/admin/AdRbacPanel.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { _, isLoading } from '$lib/i18n';
  import { Users, Shield, ClipboardList, FolderTree } from 'lucide-svelte';

  const tabs = $derived([
    { id: 'users'   as const, label: $isLoading ? 'Users'        : $_('admin.tab.users'),  icon: Users },
    { id: 'rbac'    as const, label: $isLoading ? 'RBAC'         : $_('admin.tab.rbac'),   icon: Shield },
    { id: 'ad-rbac' as const, label: $isLoading ? 'AD RBAC (OU)' : $_('admin.tab.adRbac'), icon: FolderTree },
    { id: 'logs'    as const, label: $isLoading ? 'Logs'         : $_('admin.tab.logs'),   icon: ClipboardList },
  ]);

  type TabId = 'users' | 'rbac' | 'ad-rbac' | 'logs';
  let activeTab = $state<TabId>('users');
</script>

<svelte:head>
  <title>{$isLoading ? 'Admin' : $_('nav.admin', { default: 'Quản trị' })} - QuanLyThietBi</title>
</svelte:head>

<div class="page-shell page-content" data-testid="admin-console-page">
  <PageHeader
    title={$isLoading ? 'Admin Console' : $_('admin.title', { default: 'Bảng điều khiển Quản trị' })}
    subtitle={$isLoading ? 'User administration and audit activity' : $_('admin.subtitle', { default: 'Quản lý người dùng, phân quyền và nhật ký hoạt động' })}
  />

  <!-- Tab bar -->
  <div class="flex gap-1 border-b border-surface-3 mb-6">
    {#each tabs as tab}
      {@const TabIcon = tab.icon}
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === tab.id
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}"
        onclick={() => activeTab = tab.id}
      >
        <TabIcon class="w-4 h-4" />
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'users'}
    <UserManagementPanel />
  {:else if activeTab === 'rbac'}
    <RbacPanel />
  {:else if activeTab === 'ad-rbac'}
    <AdRbacPanel />
  {:else if activeTab === 'logs'}
    <AuditLogsPanel />
  {/if}
</div>

