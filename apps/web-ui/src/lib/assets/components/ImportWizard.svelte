<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {
    commitAssetImport,
    previewAssetImport,
    type AssetImportPreview,
    type AssetImportRow
  } from '$lib/api/assetMgmt';

  let { open = $bindable(false), onimported } = $props<{ open?: boolean; onimported?: () => void }>();

  let preview = $state<AssetImportPreview | null>(null);
  let rows = $state<AssetImportRow[]>([]);
  let error = $state('');
  let previewing = $state(false);
  let committing = $state(false);
  let fileName = $state('');

  function reset() {
    preview = null;
    rows = [];
    error = '';
    previewing = false;
    committing = false;
    fileName = '';
  }

  $effect(() => {
    if (!open) reset();
  });

  function normalizeHeader(header: string): string {
    return header.replace(/\ufeff/g, '').replace(/[\s_-]/g, '').toLowerCase();
  }

  function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (current.length > 0 || row.length > 0) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  }

  function mapRow(headers: string[], values: string[]): AssetImportRow {
    const row: Partial<AssetImportRow> = {};
    headers.forEach((header, index) => {
      const key = normalizeHeader(header);
      const value = values[index]?.trim();
      if (!value) return;

      switch (key) {
        case 'assetcode':
          row.assetCode = value;
          break;
        case 'modelid':
          row.modelId = value;
          break;
        case 'status':
          row.status = value as AssetImportRow['status'];
          break;
        case 'locationid':
          row.locationId = value;
          break;
        case 'vendorid':
          row.vendorId = value;
          break;
        case 'serialno':
          row.serialNo = value;
          break;
        case 'macaddress':
          row.macAddress = value;
          break;
        case 'mgmtip':
          row.mgmtIp = value;
          break;
        case 'hostname':
          row.hostname = value;
          break;
        case 'vlanid': {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) row.vlanId = parsed;
          break;
        }
        case 'switchname':
          row.switchName = value;
          break;
        case 'switchport':
          row.switchPort = value;
          break;
        case 'purchasedate':
          row.purchaseDate = value;
          break;
        case 'warrantyend':
          row.warrantyEnd = value;
          break;
        case 'notes':
          row.notes = value;
          break;
        default:
          break;
      }
    });

    return row as AssetImportRow;
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      previewing = true;
      error = '';
      fileName = file.name;
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        throw new Error('CSV file must include header row and data rows');
      }
      const headers = parsed[0] || [];
      rows = parsed.slice(1).map(values => mapRow(headers, values));
      const response = await previewAssetImport(rows);
      preview = response.data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to parse CSV';
    } finally {
      previewing = false;
    }
  }

  async function commitImport() {
    try {
      committing = true;
      error = '';
      await commitAssetImport(rows);
      onimported?.();
      open = false;
      reset();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to import assets';
    } finally {
      committing = false;
    }
  }
</script>

<Modal bind:open title={$isLoading ? 'Import Assets' : $_('assets.importAssets')} size="lg">

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  <div class="space-y-4">
    <div class="border border-dashed border-slate-300 rounded-lg p-4">
      <input type="file" accept=".csv" onchange={handleFileChange} />
      {#if fileName}
        <p class="text-sm text-slate-500 mt-2">Selected: {fileName}</p>
      {/if}
    </div>

    {#if previewing}
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div> Parsing and validating...
      </div>
    {/if}

    {#if preview}
      <div class="rounded-lg bg-slate-900/40 p-4 text-sm">
        <div class="flex justify-between">
          <span>{$isLoading ? 'Total rows' : $_('assets.totalRows')}</span>
          <span class="font-semibold">{preview.total}</span>
        </div>
        <div class="flex justify-between">
          <span>{$isLoading ? 'Valid' : $_('assets.valid')}</span>
          <span class="font-semibold text-emerald-600">{preview.validCount}</span>
        </div>
        <div class="flex justify-between">
          <span>{$isLoading ? 'Invalid' : $_('assets.invalid')}</span>
          <span class="font-semibold text-red-600">{preview.invalidCount}</span>
        </div>
      </div>
    {/if}
  </div>

  {#snippet footer()}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" onclick={() => open = false}>Close</Button>
        <Button onclick={commitImport} disabled={!preview || preview.validCount === 0 || committing}>
          {committing ? 'Importing...' : 'Commit Import'}
        </Button>
      </div>
  {/snippet}
</Modal>

