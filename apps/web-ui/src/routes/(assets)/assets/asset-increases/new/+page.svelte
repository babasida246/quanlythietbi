<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { goto } from '$app/navigation'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import type { AssetIncreaseLine, IncreaseType } from '$lib/types/qlts.js'

  let docDate = $state(new Date().toISOString().split('T')[0])
  let increaseType = $state<IncreaseType>('purchase')
  let orgUnitName = $state('')
  let vendorId = $state('')
  let invoiceNo = $state('')
  let invoiceDate = $state('')
  let purchasePlanDocId = $state('')
  let note = $state('')
  let lines = $state<AssetIncreaseLine[]>([{
    lineNo: 1,
    assetName: '',
    quantity: 1,
    unit: '',
    originalCost: 0,
    serialNumber: '',
    locationName: '',
    custodianName: '',
    note: ''
  }])

  let saving = $state(false)
  let errorMessage = $state('')

  const increaseTypes: IncreaseType[] = ['purchase', 'donation', 'transfer_in', 'found', 'other']

  function addLine() {
    lines.push({
      lineNo: lines.length + 1,
      assetName: '',
      quantity: 1,
      unit: '',
      originalCost: 0,
      serialNumber: '',
      locationName: '',
      custodianName: '',
      note: ''
    })
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      lines.splice(index, 1)
      lines.forEach((line, idx) => { line.lineNo = idx + 1 })
    }
  }

  function calculateTotal() {
    return lines.reduce((sum, line) => sum + (line.quantity * line.originalCost), 0)
  }

  async function saveDraft() {
    await saveDocument('draft')
  }

  async function saveAndSubmit() {
    await saveDocument('submit')
  }

  async function saveDocument(action: 'draft' | 'submit') {
    saving = true
    errorMessage = ''

    try {
      const payload = {
        docDate,
        increaseType,
        orgUnitName: orgUnitName || undefined,
        vendorId: vendorId || undefined,
        invoiceNo: invoiceNo || undefined,
        invoiceDate: invoiceDate || undefined,
        purchasePlanDocId: purchasePlanDocId || undefined,
        note: note || undefined,
        lines: lines.map(line => ({
          ...line,
          assetName: line.assetName.trim(),
          serialNumber: line.serialNumber || undefined,
          unit: line.unit || undefined,
          locationName: line.locationName || undefined,
          custodianName: line.custodianName || undefined,
          currentValue: line.originalCost,
          acquisitionDate: docDate,
          note: line.note || undefined
        }))
      }

      const created = await apiJson<{ data: { id: string } }>(`${API_BASE}/v1/assets/asset-increases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const { data } = created

      if (action === 'submit') {
        const approvers = ['00000000-0000-0000-0000-000000000001']
        await apiJson(`${API_BASE}/v1/assets/asset-increases/${data.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvers })
        })
      }

      goto('/assets/asset-increases')
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      saving = false
    }
  }
</script>

<div class="page-shell page-content">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">{$_('qlts.assetIncrease.form.createTitle')}</h1>
    <a href="/assets/asset-increases" class="rounded-lg px-4 py-2 font-medium transition-colors hover:bg-gray-100">
      {$_('common.cancel')}
    </a>
  </div>

  {#if errorMessage}
    <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      {errorMessage}
    </div>
  {/if}

  <form class="space-y-6">
    <div class="rounded-lg bg-surface-1 shadow">
      <div class="p-6">
        <h2 class="text-lg font-semibold mb-4">{$_('qlts.assetIncrease.form.basicInfo')}</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label for="aiDocDate" class="block text-sm font-medium mb-1">
              {$_('qlts.common.docDate')} <span class="text-red-500">*</span>
            </label>
            <input
              id="aiDocDate"
              type="date" 
              bind:value={docDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label for="increaseType" class="block text-sm font-medium mb-1">
              {$_('qlts.assetIncrease.form.increaseType')} <span class="text-red-500">*</span>
            </label>
            <select
              id="increaseType"
              bind:value={increaseType}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {#each increaseTypes as type}
                <option value={type}>{$_(`qlts.increaseType.${type}`)}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="aiOrgUnit" class="block text-sm font-medium mb-1">
              {$_('qlts.common.orgUnit')}
            </label>
            <input
              id="aiOrgUnit"
              type="text" 
              bind:value={orgUnitName}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="invoiceNo" class="block text-sm font-medium mb-1">
              {$_('qlts.assetIncrease.form.invoiceNo')}
            </label>
            <input
              id="invoiceNo"
              type="text" 
              bind:value={invoiceNo}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="invoiceDate" class="block text-sm font-medium mb-1">
              {$_('qlts.assetIncrease.form.invoiceDate')}
            </label>
            <input
              id="invoiceDate"
              type="date" 
              bind:value={invoiceDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="purchasePlanRef" class="block text-sm font-medium mb-1">
              {$_('qlts.assetIncrease.form.purchasePlanRef')}
            </label>
            <input
              id="purchasePlanRef"
              type="text" 
              bind:value={purchasePlanDocId}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="PP-2024-0001"
            />
          </div>
        </div>

        <div class="mt-4">
          <label for="aiNote" class="block text-sm font-medium mb-1">
            {$_('qlts.common.note')}
          </label>
          <textarea
            id="aiNote"
            bind:value={note}
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          ></textarea>
        </div>
      </div>
    </div>

    <div class="rounded-lg bg-surface-1 shadow">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold">{$_('qlts.assetIncrease.form.assetLines')}</h2>
          <button
            type="button"
            onclick={() => addLine()}
            class="rounded-lg bg-gray-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {$_('qlts.common.addLine')}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="w-12 px-2 py-1 text-left font-semibold">#</th>
                <th class="w-48 px-2 py-1 text-left font-semibold">{$_('qlts.common.assetName')}</th>
                <th class="w-32 px-2 py-1 text-left font-semibold">{$_('qlts.common.serialNumber')}</th>
                <th class="w-20 px-2 py-1 text-left font-semibold">{$_('qlts.common.quantity')}</th>
                <th class="w-20 px-2 py-1 text-left font-semibold">{$_('qlts.common.unit')}</th>
                <th class="w-32 px-2 py-1 text-left font-semibold">{$_('qlts.common.originalCost')}</th>
                <th class="w-32 px-2 py-1 text-left font-semibold">{$_('qlts.common.location')}</th>
                <th class="w-32 px-2 py-1 text-left font-semibold">{$_('qlts.common.custodian')}</th>
                <th class="w-48 px-2 py-1 text-left font-semibold">{$_('qlts.common.note')}</th>
                <th class="w-12 px-2 py-1 text-left font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {#each lines as line, index}
                <tr>
                  <td class="border-t px-2 py-1">{line.lineNo}</td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.assetName}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.serialNumber}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="number"
                      bind:value={line.quantity}
                      min="1"
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.unit}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="number"
                      bind:value={line.originalCost}
                      min="0"
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.locationName}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.custodianName}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    <input
                      type="text"
                      bind:value={line.note}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-2 py-1">
                    {#if lines.length > 1}
                      <button
                        type="button"
                        onclick={() => removeLine(index)}
                        class="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
              <tr>
                <td colspan="5" class="border-t px-2 py-1 text-right">{$_('qlts.common.total')}:</td>
                <td class="border-t px-2 py-1 font-semibold">{calculateTotal().toLocaleString()}</td>
                <td class="border-t px-2 py-1"></td>
                <td class="border-t px-2 py-1"></td>
                <td class="border-t px-2 py-1"></td>
                <td class="border-t px-2 py-1"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-3">
      <button
        type="button"
        onclick={() => saveDraft()}
        disabled={saving}
        class="rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {$_('qlts.common.saveDraft')}
      </button>
      <button
        type="button"
        onclick={() => saveAndSubmit()}
        disabled={saving}
        class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {$_('qlts.common.saveAndSubmit')}
      </button>
    </div>
  </form>
</div>
