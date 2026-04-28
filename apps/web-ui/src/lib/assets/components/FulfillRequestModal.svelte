<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/Modal.svelte';
  import ScanVerifyInput from './ScanVerifyInput.svelte';
  import { getAdminWfRequestDetail, type WfRequestLine } from '$lib/api/wf';
  import { assignAsset } from '$lib/api/assets';
  import { toast } from '$lib/components/toast';
  import type { VerifyScanResult } from '$lib/api/assetMgmt';

  let {
    requestId,
    requestCode = '',
    requesterId,
    requesterName = null,
    open = $bindable(false),
    onfulfilled
  } = $props<{
    requestId: string;
    requestCode?: string;
    requesterId: string;
    requesterName?: string | null;
    open?: boolean;
    onfulfilled?: () => void;
  }>();

  type VerifiedEntry = { result: VerifyScanResult; scanType: 'barcode' | 'manual' };

  let lines = $state<WfRequestLine[]>([]);
  let loading = $state(false);
  let error = $state('');
  let busy = $state(false);
  let verifiedMap = $state(new Map<string, VerifiedEntry>());

  let assetLines = $derived(
    lines.filter((l) => l.itemType === 'asset' && l.status !== 'cancelled')
  );

  let allVerified = $derived(
    assetLines.length > 0 && assetLines.every((l) => verifiedMap.has(l.id))
  );

  onMount(() => {
    void loadLines();
  });

  async function loadLines() {
    loading = true;
    error = '';
    try {
      const res = await getAdminWfRequestDetail(requestId);
      lines = res.data.lines ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function handleVerified(result: VerifyScanResult, scanType: 'barcode' | 'manual') {
    if (!result.lineId) return;
    const next = new Map(verifiedMap);
    next.set(result.lineId, { result, scanType });
    verifiedMap = next;
  }

  async function handleConfirm() {
    if (!allVerified || busy) return;
    busy = true;
    const verifiedAt = new Date().toISOString();
    try {
      for (const [, { result, scanType }] of verifiedMap) {
        if (!result.asset) continue;
        await assignAsset(result.asset.id, {
          assigneeType: 'person',
          assigneeId: requesterId,
          assigneeName: requesterName ?? requesterId,
          verificationMethod: scanType,
          verifiedAt,
          wfRequestId: requestId
        });
      }
      toast.success('Cấp phát thiết bị thành công');
      open = false;
      onfulfilled?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi khi cấp phát');
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Xác nhận cấp phát — {requestCode}" bind:open>
  <div class="space-y-4 p-4">
    {#if loading}
      <div class="flex items-center gap-2 text-sm text-slate-400">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block"></span>
        Đang tải danh sách thiết bị...
      </div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else if assetLines.length === 0}
      <p class="text-sm text-slate-400">Phiếu không có dòng thiết bị nào cần xác nhận.</p>
    {:else}
      <!-- Requester info -->
      <div class="rounded-lg border border-slate-700 bg-surface-2 px-4 py-2.5 text-sm">
        <span class="text-slate-400">Người nhận: </span>
        <span class="font-medium text-slate-100">{requesterName ?? requesterId}</span>
      </div>

      <!-- Lines -->
      <div class="space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Danh sách thiết bị ({assetLines.length})
        </div>
        {#each assetLines as line (line.id)}
          {@const verified = verifiedMap.get(line.id)}
          <div
            class="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors
              {verified ? 'border-success/40 bg-success/5' : 'border-slate-700 bg-surface-2'}"
          >
            <div class="flex-1 min-w-0">
              <div class="text-xs text-slate-500 font-mono">#{line.lineNo}</div>
              {#if line.assetCode}
                <div class="text-sm font-medium text-slate-100">
                  {line.assetCode}{#if line.assetName}<span class="text-slate-400"> — {line.assetName}</span>{/if}
                </div>
              {:else}
                <div class="text-sm text-slate-400 italic">Chưa xác định thiết bị</div>
              {/if}
              {#if verified}
                <div class="text-xs text-success mt-0.5">
                  ✓ Đã quét: <span class="font-mono">{verified.result.asset?.assetCode}</span>
                  {#if verified.result.asset?.name} — {verified.result.asset.name}{/if}
                </div>
              {/if}
            </div>
            <div class="shrink-0">
              {#if verified}
                <span class="text-success text-xl leading-none">✓</span>
              {:else}
                <span class="text-xs text-slate-500 bg-slate-800 rounded px-2 py-0.5">Chờ quét</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Scan input -->
      {#if !allVerified}
        <div class="pt-1">
          <p class="text-xs text-slate-400 mb-2">
            Quét mã vạch thiết bị để xác nhận từng dòng:
          </p>
          <ScanVerifyInput
            {requestId}
            onverified={handleVerified}
            disabled={busy}
          />
        </div>
      {:else}
        <div class="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-success">
          <span>✓</span>
          <span>Tất cả thiết bị đã được xác nhận. Nhấn "Xác nhận cấp phát" để hoàn tất.</span>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex justify-end gap-2 border-t border-slate-700 pt-4">
        <button
          type="button"
          class="btn btn-sm"
          onclick={() => { open = false; }}
          disabled={busy}
        >
          Đóng
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleConfirm}
          disabled={!allVerified || busy}
        >
          {busy ? 'Đang xử lý...' : 'Xác nhận cấp phát'}
        </button>
      </div>
    {/if}
  </div>
</Modal>
