<script lang="ts">
  /**
   * NotificationCenter - Shows recent workflow notifications as a dropdown.
   * Uses shared notification store for cross-component communication.
   */
  import { Bell } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { getNotifications, markAllRead, clearNotifications, subscribe, type WorkflowNotification } from '$lib/stores/notifications';
  import { _, isLoading } from '$lib/i18n';

  let open = $state(false);
  let notifications = $state<WorkflowNotification[]>([]);

  const unreadCount = $derived(notifications.filter(n => !n.read).length);

  onMount(() => {
    notifications = getNotifications();
    const unsub = subscribe(() => {
      notifications = getNotifications();
    });
    return unsub;
  });

  function handleMarkAllRead() {
    markAllRead();
  }

  function handleClearAll() {
    clearNotifications();
  }

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return $isLoading ? 'Just now' : $_('notifications.justNow');
    if (diff < 3600000) {
      const count = Math.floor(diff / 60000);
      return $isLoading ? `${count} minutes ago` : $_('notifications.minutesAgo', { values: { count } });
    }
    if (diff < 86400000) {
      const count = Math.floor(diff / 3600000);
      return $isLoading ? `${count} hours ago` : $_('notifications.hoursAgo', { values: { count } });
    }
    return new Date(ts).toLocaleDateString('vi-VN');
  }

  const typeColors: Record<WorkflowNotification['type'], string> = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-notification-center]')) {
      open = false;
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div class="relative" data-notification-center>
  <button
    type="button"
    class="relative rounded-lg p-1.5 text-slate-400 hover:text-white transition"
    data-testid="notification-bell"
    onclick={() => { open = !open; }}
  >
    <Bell class="h-4 w-4" />
    {#if unreadCount > 0}
      <span class="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    {/if}
  </button>

  {#if open}
    <div class="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl" data-testid="notification-panel">
      <div class="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <span class="text-sm font-semibold">{$isLoading ? 'Notifications' : $_('notifications.title')} ({notifications.length})</span>
        <div class="flex gap-2">
          {#if unreadCount > 0}
            <button type="button" class="text-xs text-primary hover:underline" onclick={handleMarkAllRead}>{$isLoading ? 'Mark all read' : $_('notifications.markAllRead')}</button>
          {/if}
          {#if notifications.length > 0}
            <button type="button" class="text-xs text-red-400 hover:underline" onclick={handleClearAll}>{$isLoading ? 'Clear all' : $_('notifications.clearAll')}</button>
          {/if}
        </div>
      </div>
      <div class="max-h-80 overflow-y-auto">
        {#if notifications.length === 0}
          <div class="px-3 py-6 text-center text-sm text-slate-500">{$isLoading ? 'No notifications' : $_('notifications.empty')}</div>
        {:else}
          {#each notifications.slice(0, 20) as notif}
            <div class={`flex items-start gap-2 border-b border-slate-800 px-3 py-2 last:border-0 ${!notif.read ? 'bg-slate-800' : ''}`}>
              <div class={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${typeColors[notif.type]}`}></div>
              <div class="min-w-0 flex-1">
                <p class="text-sm leading-tight">{notif.message}</p>
                <p class="text-xs text-slate-500 mt-0.5">{formatTime(notif.timestamp)}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
