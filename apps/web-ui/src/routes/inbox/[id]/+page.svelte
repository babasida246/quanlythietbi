<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui';
  import { ArrowLeft, Send } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { getInboxThread, sendInboxReply, type InboxMessage } from '$lib/api/communications';

  const threadId = $derived.by(() => page.params.id);

  let loading = $state(true);
  let sending = $state(false);
  let error = $state('');
  let title = $state('');
  let messages = $state<InboxMessage[]>([]);
  let replyContent = $state('');

  async function load() {
    if (!threadId) return;
    try {
      loading = true;
      error = '';
      const response = await getInboxThread(threadId);
      title = response.thread.title;
      messages = response.messages;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load thread';
    } finally {
      loading = false;
    }
  }

  async function sendReply() {
    if (!threadId || !replyContent.trim() || sending) return;
    try {
      sending = true;
      error = '';
      await sendInboxReply(threadId, replyContent.trim());
      replyContent = '';
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send reply';
    } finally {
      sending = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="page-shell page-content">
  <div class="mb-6 flex items-center justify-between gap-4">
    <div class="min-w-0">
      <a href="/inbox" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
        <ArrowLeft class="h-4 w-4" /> {$isLoading ? 'Back' : $_('common.back')}
      </a>
      <h1 class="truncate text-2xl font-semibold text-slate-900 dark:text-white">{title || threadId}</h1>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center p-8">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else}
    <div class="space-y-3">
      {#if messages.length === 0}
        <div class="rounded-xl border border-slate-800 bg-surface-1 p-5 text-sm text-slate-500">
          {$isLoading ? 'No messages yet.' : $_('inbox.emptyThread')}
        </div>
      {:else}
        {#each messages as message}
          <div class="rounded-xl border border-slate-800 bg-surface-1 p-4">
            <div class="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span class="font-semibold uppercase">{message.role}</span>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <div class="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{message.content}</div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="mt-6 rounded-xl border border-slate-800 bg-surface-1 p-4">
      <label for="inbox-reply" class="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {$isLoading ? 'Reply' : $_('inbox.reply')}
      </label>
      <textarea
        id="inbox-reply"
        bind:value={replyContent}
        rows={4}
        placeholder={$isLoading ? 'Write your message...' : $_('inbox.replyPlaceholder')}
        class="textarea-base"
      ></textarea>
      <div class="mt-3 flex justify-end">
        <Button onclick={() => sendReply()} disabled={sending || !replyContent.trim()}>
          <Send class="mr-2 h-4 w-4" />
          {sending ? 'Sending...' : ($isLoading ? 'Send' : $_('inbox.send'))}
        </Button>
      </div>
    </div>
  {/if}
</div>
