<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { API_BASE, apiJson } from '$lib/api/httpClient'
  import type { PurchaseSuggestion } from '$lib/types/qlts.js'

  let suggestions = $state<PurchaseSuggestion[]>([])
  let loading = $state(true)
  let selectedPriority = $state<string>('all')
  let selectedCategory = $state<string>('all')

  async function loadSuggestions() {
    loading = true
    try {
      const params = new URLSearchParams()
      if (selectedPriority !== 'all') params.append('minPriority', selectedPriority)
      if (selectedCategory !== 'all') params.append('categoryId', selectedCategory)

      const data = await apiJson<{ suggestions?: PurchaseSuggestion[] }>(
        `${API_BASE}/v1/assets/purchase-plans/suggestions?${params.toString()}`
      )
      suggestions = data.suggestions || []
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    } finally {
      loading = false
    }
  }

  $effect(() => {
    void loadSuggestions();
  })

  function getPriorityClass(priority: string) {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  function getPriorityIcon(priority: string) {
    switch (priority) {
      case 'critical': return '🔴'
      case 'high': return '🟠'
      case 'medium': return '🟡'
      case 'low': return '🔵'
      default: return '⚪'
    }
  }
</script>

<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">{$_('qlts.purchasePlan.dashboard.title')}</h1>
    <a
      href="/assets/purchase-plans/new"
      class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
    >
      {$_('qlts.purchasePlan.dashboard.createNew')}
    </a>
  </div>

  <div class="mb-6 rounded-lg bg-surface-1 shadow">
    <div class="p-4">
      <h2 class="text-lg font-semibold mb-4">{$_('qlts.purchasePlan.dashboard.filters')}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label for="selectedPriority" class="block text-sm font-medium mb-1">
            {$_('qlts.purchasePlan.dashboard.priority')}
          </label>
          <select
            id="selectedPriority"
            bind:value={selectedPriority} 
            onchange={() => loadSuggestions()}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">{$_('qlts.common.all')}</option>
            <option value="critical">{$_('qlts.priority.critical')}</option>
            <option value="high">{$_('qlts.priority.high')}</option>
            <option value="medium">{$_('qlts.priority.medium')}</option>
            <option value="low">{$_('qlts.priority.low')}</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label for="selectedCategory" class="block text-sm font-medium mb-1">
            {$_('qlts.purchasePlan.dashboard.category')}
          </label>
          <select
            id="selectedCategory"
            bind:value={selectedCategory}
            onchange={() => loadSuggestions()}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">{$_('qlts.common.all')}</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="inline-block h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
    </div>
  {:else if suggestions.length === 0}
    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
      {$_('qlts.purchasePlan.dashboard.noSuggestions')}
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each suggestions as suggestion}
        <div class={`rounded-lg border-2 shadow ${getPriorityClass(suggestion.priority)}`}>
          <div class="p-4">
            <div class="flex items-start justify-between mb-2">
              <h3 class="font-semibold text-lg">{suggestion.modelName}</h3>
              <span class="text-2xl">{getPriorityIcon(suggestion.priority)}</span>
            </div>
            
            <p class="text-sm text-gray-600 mb-3">{suggestion.categoryName}</p>
            
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="font-medium">{$_('qlts.inventory.currentStock')}:</span>
                <span class="font-bold">{suggestion.currentStock}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="font-medium">{$_('qlts.inventory.minStock')}:</span>
                <span>{suggestion.minStockQty}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="font-medium">{$_('qlts.inventory.avgDaily')}:</span>
                <span>{suggestion.avgDailyConsumption.toFixed(2)}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="font-medium">{$_('qlts.inventory.daysUntilStockout')}:</span>
                <span class="font-bold text-red-600">{suggestion.daysUntilStockout}</span>
              </div>
            </div>

            <div class="my-2 border-t border-gray-300"></div>

            <div class="bg-surface-1/50 p-2 rounded">
              <p class="text-sm font-medium mb-1">{$_('qlts.purchasePlan.suggestedQuantity')}:</p>
              <p class="text-2xl font-bold text-center">{suggestion.suggestedQuantity}</p>
            </div>

            <p class="text-xs mt-2 italic">{suggestion.reason}</p>

            <button class="mt-3 w-full rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              {$_('qlts.purchasePlan.addToPlan')}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-8">
    <h2 class="text-xl font-semibold mb-4">{$_('qlts.purchasePlan.dashboard.recentPlans')}</h2>
    <div class="rounded-lg bg-surface-1 shadow">
      <div class="p-4">
        <p class="text-gray-500">{$_('qlts.purchasePlan.dashboard.loadingPlans')}</p>
      </div>
    </div>
  </div>
</div>
