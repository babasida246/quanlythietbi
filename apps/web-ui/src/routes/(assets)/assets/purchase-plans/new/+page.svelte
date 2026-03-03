<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { goto } from '$app/navigation'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import type { PurchasePlanLine } from '$lib/types/qlts.js'

  let docDate = $state(new Date().toISOString().split('T')[0])
  let fiscalYear = $state(new Date().getFullYear())
  let orgUnitName = $state('')
  let requiredByDate = $state('')
  let purpose = $state('')
  let note = $state('')
  let lines = $state<PurchasePlanLine[]>([{
    lineNo: 1,
    modelName: '',
    quantity: 1,
    unit: '',
    estimatedCost: 0,
    note: ''
  }])

  let saving = $state(false)
  let errorMessage = $state('')

  function addLine() {
    lines.push({
      lineNo: lines.length + 1,
      modelName: '',
      quantity: 1,
      unit: '',
      estimatedCost: 0,
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
    return lines.reduce((sum, line) => sum + (line.quantity * line.estimatedCost), 0)
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
        fiscalYear,
        orgUnitName: orgUnitName || undefined,
        requiredByDate: requiredByDate || undefined,
        purpose: purpose || undefined,
        note: note || undefined,
        lines: lines.map(line => ({
          ...line,
          modelName: line.modelName.trim(),
          unit: line.unit || undefined,
          note: line.note || undefined
        }))
      }

      const created = await apiJson<{ data: { id: string } }>(`${API_BASE}/v1/assets/purchase-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const { data } = created

      if (action === 'submit') {
        const approvers = ['00000000-0000-0000-0000-000000000001']
        await apiJson(`${API_BASE}/v1/assets/purchase-plans/${data.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvers })
        })
      }

      goto('/assets/purchase-plans')
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      saving = false
    }
  }
</script>

<div class="page-shell page-content">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">{$_('qlts.purchasePlan.form.createTitle')}</h1>
    <a href="/assets/purchase-plans" class="rounded-lg px-4 py-2 font-medium transition-colors hover:bg-gray-100">
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
        <h2 class="text-lg font-semibold mb-4">{$_('qlts.purchasePlan.form.basicInfo')}</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="docDate" class="block text-sm font-medium mb-1">
              {$_('qlts.common.docDate')} <span class="text-red-500">*</span>
            </label>
            <input
              id="docDate"
              type="date" 
              bind:value={docDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label for="fiscalYear" class="block text-sm font-medium mb-1">
              {$_('qlts.purchasePlan.form.fiscalYear')} <span class="text-red-500">*</span>
            </label>
            <input
              id="fiscalYear"
              type="number" 
              bind:value={fiscalYear}
              min="2020"
              max="2100"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label for="orgUnitName" class="block text-sm font-medium mb-1">
              {$_('qlts.common.orgUnit')}
            </label>
            <input
              id="orgUnitName"
              type="text" 
              bind:value={orgUnitName}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="requiredByDate" class="block text-sm font-medium mb-1">
              {$_('qlts.purchasePlan.form.requiredByDate')}
            </label>
            <input
              id="requiredByDate"
              type="date" 
              bind:value={requiredByDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="mt-4">
          <label for="purpose" class="block text-sm font-medium mb-1">
            {$_('qlts.purchasePlan.form.purpose')}
          </label>
          <textarea
            id="purpose"
            bind:value={purpose}
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="mt-4">
          <label for="note" class="block text-sm font-medium mb-1">
            {$_('qlts.common.note')}
          </label>
          <textarea
            id="note"
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
          <h2 class="text-lg font-semibold">{$_('qlts.purchasePlan.form.lineItems')}</h2>
          <button
            type="button"
            onclick={() => addLine()}
            class="rounded-lg bg-gray-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {$_('qlts.common.addLine')}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-100">
              <tr>
                <th class="w-16 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.lineNo')}</th>
                <th class="w-64 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.modelName')}</th>
                <th class="w-24 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.quantity')}</th>
                <th class="w-24 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.unit')}</th>
                <th class="w-32 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.estimatedCost')}</th>
                <th class="w-48 px-3 py-1 text-left text-sm font-semibold">{$_('qlts.common.note')}</th>
                <th class="w-16 px-3 py-1 text-left text-sm font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {#each lines as line, index}
                <tr>
                  <td class="border-t px-3 py-1">{line.lineNo}</td>
                  <td class="border-t px-3 py-1">
                    <input 
                      type="text" 
                      bind:value={line.modelName}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td class="border-t px-3 py-1">
                    <input 
                      type="number" 
                      bind:value={line.quantity}
                      min="1"
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td class="border-t px-3 py-1">
                    <input 
                      type="text" 
                      bind:value={line.unit}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-3 py-1">
                    <input 
                      type="number" 
                      bind:value={line.estimatedCost}
                      min="0"
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-3 py-1">
                    <input 
                      type="text" 
                      bind:value={line.note}
                      class="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td class="border-t px-3 py-1">
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
                <td colspan="4" class="border-t px-3 py-1 text-right">{$_('qlts.common.total')}:</td>
                <td class="border-t px-3 py-1 font-semibold">{calculateTotal().toLocaleString()}</td>
                <td class="border-t px-3 py-1"></td>
                <td class="border-t px-3 py-1"></td>
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
