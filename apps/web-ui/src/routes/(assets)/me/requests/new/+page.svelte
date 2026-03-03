<script lang="ts">
  import { Button } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import {
    createWfRequest,
    WF_TYPE_LABELS,
    WF_PRIORITY_LABELS,
    type WfRequestType,
    type WfPriority,
    type CreateWfRequestLineInput,
  } from '$lib/api/wf';
  import { listSpareParts, type SparePartRecord } from '$lib/api/warehouse';
  import { listAssets, type Asset } from '$lib/api/assets';
  import WfRequestLineEditor from '$lib/assets/components/WfRequestLineEditor.svelte';
  import { toast } from '$lib/components/toast';
  import { _, isLoading } from '$lib/i18n';
  import { onMount } from 'svelte';

  // ── Catalog data ────────────────────────────────────────────────────────
  let parts  = $state<SparePartRecord[]>([]);
  let assets = $state<Asset[]>([]);
  let catalogLoading = $state(true);

  // ── Form state ───────────────────────────────────────────────────────────
  let title       = $state('');
  let requestType = $state<WfRequestType>('assign');
  let priority    = $state<WfPriority>('normal');
  let dueAt       = $state('');
  let noteText    = $state('');
  let assetModel  = $state('');   // helper field for assign/return
  let lines       = $state<CreateWfRequestLineInput[]>([]);

  let saving      = $state(false);
  let submitAfter = $state(false); // whether to auto-submit after create
  let error       = $state('');

  onMount(async () => {
    try {
      const [partsRes, assetsRes] = await Promise.all([
        listSpareParts({ limit: 500 }),
        listAssets({ limit: 500 }),
      ]);
      parts  = partsRes.data  ?? [];
      assets = assetsRes.data ?? [];
    } catch { /* non-critical */ }
    finally { catalogLoading = false; }
  });

  async function save(andSubmit = false) {
    if (!title.trim()) { error = $_('requests.validation.titleRequired'); return; }
    saving = true;
    submitAfter = andSubmit;
    error = '';
    try {
      const payload: Record<string, unknown> = {};
      if (noteText.trim())   payload.note        = noteText.trim();
      if (assetModel.trim()) payload.asset_model = assetModel.trim();

      const res = await createWfRequest({
        title: title.trim(),
        requestType,
        priority,
        dueAt:   dueAt  || undefined,
        payload,
        lines:   lines.length > 0 ? lines : undefined,
      });

      toast.success($_('requests.toast.createSuccess'));

      if (andSubmit) {
        // Auto-submit is handled server-side or via separate call — navigate to detail
        const { submitWfRequest } = await import('$lib/api/wf');
        await submitWfRequest(res.data.id);
        toast.success($_('requests.toast.submitSuccess'));
      }

      await goto('/me/requests');
    } catch (e) {
      error = e instanceof Error ? e.message : $_('requests.toast.createFailed');
    } finally {
      saving = false;
    }
  }
</script>

<div class="page-shell page-content">
  <!-- ── Top action bar ─────────────────────────────────────────────────── -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-lg font-semibold text-slate-100">{$isLoading ? 'New Request' : $_('requests.newRequest')}</h1>
      <p class="text-xs text-slate-500">{$isLoading ? 'Create a new request...' : $_('requests.newRequestHint')}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => goto('/me/requests')} disabled={saving}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button variant="secondary" onclick={() => save(false)} disabled={saving}>
        {saving && !submitAfter ? ($isLoading ? 'Saving...' : $_('requests.processing')) : ($isLoading ? 'Save Draft' : $_('requests.saveDraft'))}
      </Button>
      <Button variant="primary" onclick={() => save(true)} disabled={saving}>
        {saving && submitAfter ? ($isLoading ? 'Submitting...' : $_('requests.actionBusy.submitting')) : ($isLoading ? 'Create & Submit' : $_('requests.createAndSubmit'))}
      </Button>
    </div>
  </div>

  {#if error}
    <div class="rounded-lg border border-red-700 bg-red-900/20 px-4 py-2.5 text-sm text-red-400">{error}</div>
  {/if}

  <!-- ── Header form ─────────────────────────────────────────────────────── -->
  <div class="rounded-t-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">

      <!-- Tiêu đề (full width) -->
      <div class="col-span-2 md:col-span-4">
        <label for="req-title" class="mb-1 block text-xs font-medium text-slate-400">
          {$isLoading ? 'Title' : $_('requests.field.title')} <span class="text-red-400">*</span>
        </label>
        <input
          id="req-title"
          class="input-base text-sm"
          type="text"
          bind:value={title}
          placeholder={$isLoading ? 'Brief description of the request...' : $_('requests.placeholder.title')}
        />
      </div>

      <!-- Loại yêu cầu -->
      <div>
        <label for="req-type" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Request Type' : $_('requests.field.type')}</label>
        <select id="req-type" class="select-base text-sm" bind:value={requestType}>
          {#each Object.entries(WF_TYPE_LABELS) as [val, label]}
            <option value={val}>{label}</option>
          {/each}
        </select>
      </div>

      <!-- Ưu tiên -->
      <div>
        <label for="req-priority" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Priority' : $_('requests.field.priority')}</label>
        <select id="req-priority" class="select-base text-sm" bind:value={priority}>
          {#each Object.entries(WF_PRIORITY_LABELS) as [val, label]}
            <option value={val}>{label}</option>
          {/each}
        </select>
      </div>

      <!-- Hạn xử lý -->
      <div>
        <label for="req-due" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Due Date' : $_('requests.field.dueDate')}</label>
        <input id="req-due" class="input-base text-sm" type="date" bind:value={dueAt} />
      </div>

      <!-- Asset model (assign / return only) -->
      {#if requestType === 'assign' || requestType === 'return'}
        <div>
          <label for="req-model" class="mb-1 block text-xs font-medium text-slate-400">
            {requestType === 'assign' ? ($isLoading ? 'Device model to assign' : $_('requests.field.assignModel')) : ($isLoading ? 'Device code/name to reclaim' : $_('requests.field.reclaimDevice'))}
          </label>
          <input
            id="req-model"
            class="input-base text-sm"
            type="text"
            bind:value={assetModel}
            placeholder={requestType === 'assign' ? 'VD: Dell XPS 15' : 'VD: HP-001'}
          />
        </div>
      {/if}

      <!-- Ghi chú (takes remaining span) -->
      <div class="col-span-2 md:col-span-{requestType === 'assign' || requestType === 'return' ? '3' : '4'}"
           style="grid-column: span 2">
        <label for="req-note" class="mb-1 block text-xs font-medium text-slate-400">{$isLoading ? 'Notes' : $_('requests.field.notes')}</label>
        <input
          id="req-note"
          class="input-base text-sm"
          type="text"
          bind:value={noteText}
          placeholder={$isLoading ? 'Enter notes...' : $_('requests.placeholder.notes')}
        />
      </div>
    </div>
  </div>

  <!-- ── Lines section ──────────────────────────────────────────────────── -->
  <div class="rounded-b-xl border-x border-b border-slate-700 bg-slate-900/40 px-5 py-4">
    <div class="mb-3">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {$isLoading ? 'Request Lines' : $_('requests.linesSection')}
      </h3>
      <p class="text-xs text-slate-600 mt-0.5">{$isLoading ? 'Add request lines to the list' : $_('requests.linesHint')}</p>
    </div>
    {#if catalogLoading}
      <div class="flex items-center gap-2 py-4 text-xs text-slate-500">
        <div class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        {$isLoading ? 'Loading catalogs...' : $_('requests.loadingCatalogs')}
      </div>
    {:else}
      <WfRequestLineEditor bind:lines {parts} {assets} />
    {/if}
  </div>

  <!-- ── Bottom action bar ──────────────────────────────────────────────── -->
  <div class="flex justify-end gap-2">
    <Button variant="secondary" onclick={() => goto('/me/requests')} disabled={saving}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
    <Button variant="secondary" onclick={() => save(false)} disabled={saving}>
      {saving && !submitAfter ? ($isLoading ? 'Saving...' : $_('requests.processing')) : ($isLoading ? 'Save Draft' : $_('requests.saveDraft'))}
    </Button>
    <Button variant="primary" onclick={() => save(true)} disabled={saving}>
      {saving && submitAfter ? ($isLoading ? 'Submitting...' : $_('requests.actionBusy.submitting')) : ($isLoading ? 'Create & Submit' : $_('requests.createAndSubmit'))}
    </Button>
  </div>
</div>
