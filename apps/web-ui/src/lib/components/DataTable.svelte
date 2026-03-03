<script lang="ts" generics="T extends Record<string, any>">
  import { Table, TableHeader, TableHeaderCell, TableRow, TableCell, Button } from '$lib/components/ui';
  import { ChevronDown, ChevronUp, Search, Trash2, Edit, MoreVertical, Check, X } from 'lucide-svelte';
  import { _ } from '$lib/i18n';

  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

  interface Column<T> {
    key: keyof T;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    editable?: boolean;
    render?: (...args: any[]) => string;
    width?: string;
  }

  interface CustomAction<T> {
    label: string;
    icon?: any;
    color?: ButtonVariant;
    onClick: (row: T) => void;
  }

  interface Props {
    data: T[];
    columns: Column<T>[];
    selectable?: boolean;
    onSelect?: (selected: T[]) => void;
    onEdit?: (row: T, changes: Partial<T>) => Promise<void>;
    onDelete?: (rows: T[]) => Promise<void>;
    onBulkEdit?: (rows: T[], changes: Partial<T>) => Promise<void>;
    onRowClick?: (row: T) => void;
    customActions?: CustomAction<T>[];
    rowKey?: keyof T;
    loading?: boolean;
    hideBulkToolbar?: boolean;
    selectionResetKey?: number;
    filterDebounceMs?: number;
    stickyHeader?: boolean;
  }

  let {
    data = [],
    columns = [],
    selectable = false,
    onSelect,
    onEdit,
    onDelete,
    onBulkEdit,
    onRowClick,
    customActions = [],
    rowKey = 'id' as keyof T,
    loading = false,
    hideBulkToolbar = false,
    selectionResetKey,
    filterDebounceMs = 250,
    stickyHeader = true
  }: Props = $props();

  // State
  let selected = $state<Set<any>>(new Set());
  let sortBy = $state<keyof T | null>(null);
  let sortOrder = $state<'asc' | 'desc'>('asc');
  let filters = $state<Record<keyof T, string>>({} as Record<keyof T, string>);
  let filterInputs = $state<Record<keyof T, string>>({} as Record<keyof T, string>);
  let editingRow = $state<any>(null);
  let editValues = $state<Partial<T>>({});
  let showBulkActions = $state(false);
  let lastResetKey = $state<number | undefined>(undefined);
  const filterTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Computed - filteredData must be declared before allSelected/someSelected
  let filteredData = $derived.by(() => {
    let result = [...data];

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((row) => {
          const cellValue = String(row[key] ?? '').toLowerCase();
          return cellValue.includes(value.toLowerCase());
        });
      }
    }

    // Apply sorting
    if (sortBy) {
      const currentSortBy = sortBy;
      result.sort((a, b) => {
        const aVal = a[currentSortBy];
        const bVal = b[currentSortBy];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  });

  let allSelected = $derived(selected.size > 0 && selected.size === filteredData.length);
  let someSelected = $derived(selected.size > 0 && selected.size < filteredData.length);

  let selectedRows = $derived.by(() => {
    return data.filter(row => selected.has(row[rowKey]));
  });

  $effect(() => {
    if (selectionResetKey === undefined) return;
    if (selectionResetKey !== lastResetKey) {
      lastResetKey = selectionResetKey;
      selected = new Set();
      onSelect?.([]);
    }
  });

  // Methods
  function toggleSelectAll() {
    let nextSelected: Set<any>;
    if (allSelected) {
      nextSelected = new Set();
    } else {
      nextSelected = new Set(selected);
      filteredData.forEach(row => nextSelected.add(row[rowKey]));
    }
    selected = nextSelected;
    onSelect?.(data.filter(row => nextSelected.has(row[rowKey])));
  }

  function toggleSelect(row: T) {
    const key = row[rowKey];
    const nextSelected = new Set(selected);
    if (nextSelected.has(key)) {
      nextSelected.delete(key);
    } else {
      nextSelected.add(key);
    }
    selected = nextSelected;
    onSelect?.(data.filter(currentRow => nextSelected.has(currentRow[rowKey])));
  }

  function handleSort(column: Column<T>) {
    if (!column.sortable) return;
    if (sortBy === column.key) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column.key;
      sortOrder = 'asc';
    }
  }

  function startEdit(row: T) {
    editingRow = row[rowKey];
    editValues = { ...row };
  }

  function cancelEdit() {
    editingRow = null;
    editValues = {};
  }

  async function saveEdit() {
    if (!editingRow || !onEdit) return;
    try {
      const row = data.find(r => r[rowKey] === editingRow);
      if (row) {
        await onEdit(row, editValues);
      }
      editingRow = null;
      editValues = {};
    } catch (err) {
      console.error('Save edit failed:', err);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0 || !onDelete) return;
    if (!confirm($_('common.confirmDelete'))) return;
    try {
      await onDelete(selectedRows);
      selected = new Set();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  }

  function updateEditValue(key: keyof T, value: any) {
    editValues = { ...editValues, [key]: value };
  }

  function updateFilter(key: keyof T, value: string) {
    filterInputs = { ...filterInputs, [key]: value };
    const timerKey = String(key);
    const existing = filterTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
    }
    filterTimers.set(
      timerKey,
      setTimeout(() => {
        filters = { ...filters, [key]: value };
        filterTimers.delete(timerKey);
      }, filterDebounceMs)
    );
  }

  function formatCellValue(value: unknown): string {
    if (value === undefined || value === null || value === '') return '-';

    if (Array.isArray(value)) {
      if (value.length === 0) return '-';
      return value.map((item) => formatCellValue(item)).join(', ');
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const preferredKeys = ['name', 'label', 'title', 'value', 'text', 'vi', 'en', 'code', 'id'];
      for (const key of preferredKeys) {
        const candidate = record[key];
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate;
        }
      }
      return JSON.stringify(record);
    }

    return String(value);
  }

  function normalizeRenderedValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return formatCellValue(value);
  }

  function renderColumnValue(column: Column<T>, row: T): string {
    if (!column.render) {
      return formatCellValue(row[column.key]);
    }

    try {
      const rendered = (column.render as (value: unknown, record: T) => unknown)(row[column.key], row);
      return normalizeRenderedValue(rendered);
    } catch {
      return '-';
    }
  }

  $effect(() => {
    return () => {
      filterTimers.forEach((timer) => clearTimeout(timer));
      filterTimers.clear();
    };
  });
</script>

<!-- Bulk Actions Toolbar -->
{#if selectable && selected.size > 0 && !hideBulkToolbar}
  <div class="mb-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
    <span class="text-sm font-medium text-primary">
      {selected.size} {$_('common.selected')}
    </span>
    {#if onDelete}
      <Button size="sm" variant="danger" onclick={handleBulkDelete}>
        {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
        {$_('common.delete')}
      </Button>
    {/if}
    {#if onBulkEdit}
      <Button size="sm" variant="primary" onclick={() => showBulkActions = !showBulkActions}>
        {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
        {$_('common.edit')}
      </Button>
    {/if}
    <Button size="sm" variant="ghost" onclick={() => { selected = new Set(); }}>
      {$_('common.clearSelection')}
    </Button>
  </div>
{/if}

<!-- Table -->
<Table>
  <TableHeader class={stickyHeader ? 'sticky top-0 z-10' : ''}>
    <tr>
      {#if selectable}
        <TableHeaderCell class="w-10">
          <input
            type="checkbox"
            class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
            checked={allSelected}
            indeterminate={someSelected}
            onclick={toggleSelectAll}
          />
        </TableHeaderCell>
      {/if}
      {#each columns as column}
        <TableHeaderCell class={column.width}>
          <div class="flex flex-col gap-1">
            <!-- Column Header -->
            <button
              type="button"
              class="flex items-center gap-1 font-semibold hover:text-primary"
              class:cursor-pointer={column.sortable}
              onclick={() => handleSort(column)}
            >
              {column.label}
              {#if column.sortable}
                {#if sortBy === column.key}
                  {#if sortOrder === 'asc'}
                    <ChevronUp class="h-3.5 w-3.5" />
                  {:else}
                    <ChevronDown class="h-3.5 w-3.5" />
                  {/if}
                {/if}
              {/if}
            </button>
            
            <!-- Column Filter -->
            {#if column.filterable}
              <div class="relative">
                <Search class="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  class="input-base h-7 w-full min-w-[8rem] pl-7 text-xs"
                  placeholder={$_('common.filter')}
                  value={filterInputs[column.key] ?? filters[column.key] ?? ''}
                  oninput={(e) => updateFilter(column.key, (e.currentTarget as HTMLInputElement).value)}
                />
              </div>
            {/if}
          </div>
        </TableHeaderCell>
      {/each}
      <TableHeaderCell class="w-20">{$_('common.actions')}</TableHeaderCell>
    </tr>
  </TableHeader>
  
  <tbody>
    {#if loading}
      <TableRow>
        <TableCell colspan={columns.length + (selectable ? 2 : 1)} class="py-8 text-center">
          <div class="flex items-center justify-center gap-2">
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span>{$_('common.loading')}</span>
          </div>
        </TableCell>
      </TableRow>
    {:else if filteredData.length === 0}
      <TableRow>
        <TableCell colspan={columns.length + (selectable ? 2 : 1)} class="py-8 text-center text-slate-500">
          {$_('common.noData')}
        </TableCell>
      </TableRow>
    {:else}
      {#each filteredData as row (row[rowKey])}
        {@const isEditing = editingRow === row[rowKey]}
        {@const isSelected = selected.has(row[rowKey])}
        <TableRow class="{isSelected ? 'bg-primary/5' : ''} {onRowClick ? 'cursor-pointer hover:bg-surface-3' : ''}" onclick={() => onRowClick?.(row)}>
          {#if selectable}
            <TableCell>
              <input
                type="checkbox"
                class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
                checked={isSelected}
                onclick={() => toggleSelect(row)}
              />
            </TableCell>
          {/if}
          
          {#each columns as column}
            <TableCell>
              {#if isEditing && column.editable}
                <input
                  type="text"
                  class="input-base h-7 text-xs"
                  value={editValues[column.key] ?? ''}
                  oninput={(e) => updateEditValue(column.key, (e.currentTarget as HTMLInputElement).value)}
                />
              {:else}
                {#if column.render}
                  {@html renderColumnValue(column, row)}
                {:else}
                  {formatCellValue(row[column.key])}
                {/if}
              {/if}
            </TableCell>
          {/each}
          
          <!-- Actions -->
          <TableCell>
            {#if isEditing}
              <div class="flex gap-1">
                <Button size="sm" variant="primary" onclick={saveEdit} data-testid="row-save" aria-label={$_('common.save')}>
                  <Check class="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onclick={cancelEdit} data-testid="row-cancel" aria-label={$_('common.cancel')}>
                  <X class="h-3 w-3" />
                </Button>
              </div>
            {:else}
              <div class="cell-actions">
                {#each customActions as action}
                  <Button size="sm" variant={action.color || 'primary'} onclick={() => action.onClick(row)} aria-label={action.label}>
                    {#if action.icon}
                      {@const Icon = action.icon}
                      <Icon class="h-3 w-3" />
                    {/if}
                    {#if action.label}
                      {action.label}
                    {/if}
                  </Button>
                {/each}
                {#if onEdit}
                  <Button size="sm" variant="secondary" onclick={() => startEdit(row)} aria-label={$_('common.edit')} data-testid="row-edit">
                    {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                    <span class="hidden sm:inline">{$_('common.edit')}</span>
                  </Button>
                {/if}
                {#if onDelete}
                  <Button 
                    size="sm" 
                    variant="danger"
                    aria-label={$_('common.delete')}
                    data-testid="row-delete"
                    onclick={async () => {
                      if (confirm($_('common.confirmDelete'))) {
                        await onDelete([row]);
                      }
                    }}
                  >
                    {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
                    <span class="hidden sm:inline">{$_('common.delete')}</span>
                  </Button>
                {/if}
              </div>
            {/if}
          </TableCell>
        </TableRow>
      {/each}
    {/if}
  </tbody>
</Table>

<!-- Summary -->
{#if !loading && filteredData.length > 0}
  <div class="mt-2 text-sm text-slate-500">
    {$_('common.showing')} {filteredData.length} / {data.length} {$_('common.rows')}
  </div>
{/if}

