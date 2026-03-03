<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { MaintenanceSeverity } from '$lib/api/assets';

  let { open = $bindable(false), assetCode = '', onsubmit } = $props<{
    open?: boolean;
    assetCode?: string;
    onsubmit?: (data: { title: string; severity: MaintenanceSeverity; diagnosis?: string; resolution?: string }) => void;
  }>();

  let title = $state('');
  let severity = $state<MaintenanceSeverity>('low');
  let diagnosis = $state('');
  let resolution = $state('');

  function submit() {
    onsubmit?.({
      title,
      severity,
      diagnosis: diagnosis || undefined,
      resolution: resolution || undefined
    });
  }

  function reset() {
    title = '';
    severity = 'low';
    diagnosis = '';
    resolution = '';
  }

  $effect(() => {
    if (!open) reset();
  });
</script>

<Modal bind:open title="{$isLoading ? 'Open Maintenance' : $_('maintenance.openMaintenance')} {assetCode ? `(${assetCode})` : ''}">

  <div class="space-y-4">
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Title' : $_('maintenance.ticketTitle')}</label>
      <input class="input-base" bind:value={title} placeholder={$isLoading ? 'Issue summary' : $_('assets.placeholders.issueSummary')} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Severity' : $_('maintenance.severity')}</label>
      <select class="select-base" bind:value={severity}>
        <option value="low">{$isLoading ? 'Low' : $_('maintenance.low')}</option>
        <option value="medium">{$isLoading ? 'Medium' : $_('maintenance.medium')}</option>
        <option value="high">{$isLoading ? 'High' : $_('maintenance.high')}</option>
        <option value="critical">{$isLoading ? 'Critical' : $_('maintenance.critical')}</option>
      </select>
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Diagnosis' : $_('maintenance.diagnosis')}</label>
      <input class="input-base" bind:value={diagnosis} placeholder={$isLoading ? 'Optional diagnosis' : $_('assets.placeholders.optionalDiagnosis')} />
    </div>
    <div>
      <label class="label-base mb-2">{$isLoading ? 'Resolution' : $_('maintenance.resolution')}</label>
      <input class="input-base" bind:value={resolution} placeholder={$isLoading ? 'Optional resolution' : $_('assets.placeholders.optionalResolution')} />
    </div>
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => { open = false; }}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
        <Button onclick={submit} disabled={!title}>{$isLoading ? 'Create' : $_('common.create')}</Button>
      </div>
  {/snippet}
</Modal>

