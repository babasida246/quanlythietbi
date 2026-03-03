<script lang="ts">
  import type { Message } from '$lib/api/conversations';
  import { User, Bot } from 'lucide-svelte';
  
  let { message } = $props<{ message: Message }>();
  const isUser = $derived(message.role === 'user');
</script>

<div class="flex gap-4 mb-6 {isUser ? 'flex-row-reverse' : 'flex-row'}">
  <div class="flex-shrink-0">
    <div class="w-8 h-8 rounded-full flex items-center justify-center {isUser ? 'bg-blue-600' : 'bg-gray-700'}">
      {#if isUser}
        <User class="w-5 h-5 text-white" />
      {:else}
        <Bot class="w-5 h-5 text-white" />
      {/if}
    </div>
  </div>
  
  <div class="flex-1 {isUser ? 'text-right' : 'text-left'}">
    <div class="inline-block max-w-[80%] {isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'} rounded-2xl px-4 py-3">
      <div class="whitespace-pre-wrap break-words">{message.content}</div>
    </div>
    <div class="text-xs text-gray-500 mt-1 {isUser ? 'mr-2' : 'ml-2'}">
      {new Date(message.createdAt).toLocaleTimeString()}
    </div>
  </div>
</div>
