<script lang="ts">
  import { onMount } from 'svelte';
  import { Bell, RefreshCw } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { listNotifications, markNotificationRead, type NotificationItem } from '$lib/api/communications';
  import { toast } from '$lib/components/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { Button } from '$lib/components/ui';

  let loading = $state(true);
  let busyId = $state<string | null>(null);
  let error = $state('');
  let notifications = $state<NotificationItem[]>([]);
  let offset = $state(0);
  const limit = 20;

  async function load(reset = false) {
    try {
      loading = true;
      error = '';
      const nextOffset = reset ? 0 : offset;
      const response = await listNotifications(limit, nextOffset);
      notifications = response.items;
      offset = response.offset;
    } catch (err) {
      error = err instanceof Error ? err.message : $_('notifications.errors.loadFailed');
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function markRead(item: NotificationItem) {
    if (item.read || busyId !== null) return;
    busyId = item.id;
    try {
      await markNotificationRead(item.id);
      notifications = notifications.map((entry) =>
        entry.id === item.id ? { ...entry, read: true } : entry
      );
    } catch (err) {
      error = err instanceof Error ? err.message : $_('notifications.errors.loadFailed');
      toast.error(error);
    } finally {
      busyId = null;
    }
  }

  onMount(() => {
    void load(true);
  });
</script>

<div class="page-shell page-content">
  <PageHeader
    title={$isLoading ? 'Thông báo' : $_('notifications.title')}
    subtitle={$isLoading ? 'Theo dõi sự kiện' : $_('notifications.subtitle')}
  >
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={() => load(true)} disabled={loading}>
        {#snippet leftIcon()}<RefreshCw class={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{/snippet}
        {$isLoading ? 'Làm mới' : $_('common.refresh')}
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else if notifications.length === 0}
    <EmptyState
      icon={Bell}
      title={$isLoading ? 'Không có thông báo' : $_('notifications.empty', { default: 'Không có thông báo nào' })}
      description={$isLoading ? 'Sẽ hiện thông báo khi có sự kiện mới.' : $_('notifications.emptyDesc', { default: 'Bạn sẽ thấy thông báo ở đây khi có sự kiện mới.' })}
    />
  {:else}
    <div class="data-table-wrap">
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{$isLoading ? 'Loại' : $_('common.type')}</th>
              <th>{$isLoading ? 'Tiêu đề' : $_('common.title')}</th>
              <th>{$isLoading ? 'Trạng thái' : $_('assets.status')}</th>
              <th>{$isLoading ? 'Ngày tạo' : $_('requests.createdAt')}</th>
              <th class="text-right">{$isLoading ? 'Thao tác' : $_('notifications.read')}</th>
            </tr>
          </thead>
          <tbody>
            {#each notifications as item}
              <tr>
                <td>
                  <span class={`badge ${item.type === 'workflow' ? 'badge-blue' : 'badge-purple'}`}>{item.type}</span>
                </td>
                <td>
                  <div class="font-medium text-slate-100">{item.title}</div>
                  <div class="text-xs text-slate-500">{item.body || '-'}</div>
                </td>
                <td><span class="badge badge-gray">{item.status}</span></td>
                <td class="text-slate-400">{new Date(item.createdAt).toLocaleString()}</td>
                <td>
                  <div class="cell-actions">
                    {#if item.read}
                      <span class="badge badge-green">{$isLoading ? 'Đã đọc' : $_('notifications.read')}</span>
                    {:else}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === item.id}
                        onclick={() => markRead(item)}
                      >
                        {busyId === item.id ? '...' : ($isLoading ? 'Đánh dấu đã đọc' : $_('notifications.markRead'))}
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
