<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading } from '$lib/i18n';
  import {
    Plus, ChevronRight, ChevronDown, Edit, Trash2,
    FolderOpen, Folder, X, Check, AlertCircle, Layers
  } from 'lucide-svelte';
  import { toast } from '$lib/components/toast';
  import {
    getEquipmentGroupTree,
    createEquipmentGroup,
    updateEquipmentGroup,
    deleteEquipmentGroup,
    listEquipmentGroupFields,
    createEquipmentGroupField,
    updateEquipmentGroupField,
    deleteEquipmentGroupField,
    type EquipmentGroup,
    type EquipmentGroupTreeNode,
    type EquipmentGroupField,
    type EquipmentGroupFieldType
  } from '$lib/api/equipmentGroups';
  import { Button } from '$lib/components/ui';
  import TextField from '$lib/components/TextField.svelte';
  import SelectField from '$lib/components/SelectField.svelte';
  import TextareaField from '$lib/components/TextareaField.svelte';

  // ── State ──────────────────────────────────────────────────
  let tree = $state<EquipmentGroupTreeNode[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Cây: theo dõi node nào đang mở
  let expandedIds = $state(new Set<string>());
  let selectedGroup = $state<EquipmentGroup | null>(null);

  // Form nhóm
  let showGroupForm = $state(false);
  let editingGroup = $state<EquipmentGroup | null>(null);
  let parentForNew = $state<string | null>(null); // null = thêm nhóm gốc
  let groupForm = $state({ name: '', code: '', description: '', inheritParentFields: true });
  let groupSaving = $state(false);
  let groupError = $state('');
  let showDeleteGroup = $state(false);
  let deletingGroup = $state<EquipmentGroup | null>(null);

  // Fields
  let fields = $state<EquipmentGroupField[]>([]);
  let fieldsLoading = $state(false);
  let showFieldForm = $state(false);
  let editingField = $state<EquipmentGroupField | null>(null);
  let fieldForm = $state<{
    key: string; label: string; fieldType: EquipmentGroupFieldType;
    required: boolean; enumValues: string; defaultValue: string; helpText: string; sortOrder: number;
  }>({ key: '', label: '', fieldType: 'string', required: false, enumValues: '', defaultValue: '', helpText: '', sortOrder: 0 });
  let fieldSaving = $state(false);
  let fieldError = $state('');
  let showDeleteField = $state(false);
  let deletingField = $state<EquipmentGroupField | null>(null);

  // ── Helpers ────────────────────────────────────────────────
  const t = (key: string, vals?: Record<string, string | number | boolean | null | undefined>) =>
    $isLoading ? key.split('.').pop()! : $_(key, vals ? { values: vals } : undefined);

  function flattenTree(nodes: EquipmentGroupTreeNode[], depth = 0): Array<EquipmentGroupTreeNode & { depth: number }> {
    const result: Array<EquipmentGroupTreeNode & { depth: number }> = [];
    for (const node of nodes) {
      result.push({ ...node, depth });
      if (expandedIds.has(node.id) && node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  const flatRows = $derived(flattenTree(tree));

  const groupOptions = $derived.by(() => {
    const opts: Array<{ value: string; label: string }> = [];
    function walk(nodes: EquipmentGroupTreeNode[], prefix = '') {
      for (const n of nodes) {
        opts.push({ value: n.id, label: prefix + n.name });
        walk(n.children, prefix + '  ');
      }
    }
    walk(tree);
    return opts;
  });

  const FIELD_TYPE_OPTIONS: Array<{ value: EquipmentGroupFieldType; label: string }> = [
    { value: 'string',  label: t('catalogs.equipmentGroup.fieldType.string') },
    { value: 'number',  label: t('catalogs.equipmentGroup.fieldType.number') },
    { value: 'boolean', label: t('catalogs.equipmentGroup.fieldType.boolean') },
    { value: 'enum',    label: t('catalogs.equipmentGroup.fieldType.enum') },
    { value: 'date',    label: t('catalogs.equipmentGroup.fieldType.date') },
  ];

  // ── Load ───────────────────────────────────────────────────
  async function loadTree() {
    try {
      loading = true;
      error = '';
      tree = await getEquipmentGroupTree();
      // Mở rộng tất cả nhóm gốc mặc định
      for (const n of tree) expandedIds.add(n.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Lỗi tải dữ liệu';
    } finally {
      loading = false;
    }
  }

  async function loadFields(groupId: string) {
    try {
      fieldsLoading = true;
      fields = await listEquipmentGroupFields(groupId);
    } catch {
      fields = [];
    } finally {
      fieldsLoading = false;
    }
  }

  onMount(() => { void loadTree(); });

  // ── Select group ───────────────────────────────────────────
  function selectGroup(group: EquipmentGroup) {
    selectedGroup = group;
    showGroupForm = false;
    showFieldForm = false;
    void loadFields(group.id);
  }

  function toggleExpand(id: string) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    expandedIds = new Set(expandedIds); // trigger reactivity
  }

  // ── Group CRUD ─────────────────────────────────────────────
  function openCreateGroup(parentId: string | null = null) {
    editingGroup = null;
    parentForNew = parentId;
    groupForm = { name: '', code: '', description: '', inheritParentFields: true };
    groupError = '';
    showGroupForm = true;
    showFieldForm = false;
  }

  function openEditGroup(group: EquipmentGroup) {
    editingGroup = group;
    parentForNew = group.parentId;
    groupForm = {
      name: group.name,
      code: group.code ?? '',
      description: group.description ?? '',
      inheritParentFields: group.inheritParentFields,
    };
    groupError = '';
    showGroupForm = true;
    showFieldForm = false;
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) {
      groupError = t('catalogs.validation.groupNameRequired');
      return;
    }
    try {
      groupSaving = true;
      groupError = '';
      const payload = {
        name: groupForm.name.trim(),
        code: groupForm.code.trim() || null,
        description: groupForm.description.trim() || null,
        inheritParentFields: groupForm.inheritParentFields,
        parentId: parentForNew,
      };
      if (editingGroup) {
        await updateEquipmentGroup(editingGroup.id, payload);
        toast.success(t('common.updateSuccess'));
      } else {
        await createEquipmentGroup(payload);
        toast.success(t('common.createSuccess'));
      }
      showGroupForm = false;
      await loadTree();
    } catch (e) {
      groupError = e instanceof Error ? e.message : 'Lỗi lưu dữ liệu';
    } finally {
      groupSaving = false;
    }
  }

  async function confirmDeleteGroup() {
    if (!deletingGroup) return;
    try {
      await deleteEquipmentGroup(deletingGroup.id);
      toast.success(t('common.deleteSuccess'));
      if (selectedGroup?.id === deletingGroup.id) selectedGroup = null;
      showDeleteGroup = false;
      deletingGroup = null;
      await loadTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xóa nhóm');
    }
  }

  // ── Field CRUD ─────────────────────────────────────────────
  function openCreateField() {
    if (!selectedGroup) return;
    editingField = null;
    fieldForm = { key: '', label: '', fieldType: 'string', required: false, enumValues: '', defaultValue: '', helpText: '', sortOrder: 0 };
    fieldError = '';
    showFieldForm = true;
    showGroupForm = false;
  }

  function openEditField(field: EquipmentGroupField) {
    editingField = field;
    fieldForm = {
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      enumValues: (field.enumValues ?? []).join('\n'),
      defaultValue: field.defaultValue ?? '',
      helpText: field.helpText ?? '',
      sortOrder: field.sortOrder,
    };
    fieldError = '';
    showFieldForm = true;
    showGroupForm = false;
  }

  async function saveField() {
    if (!selectedGroup) return;
    if (!fieldForm.key.trim()) { fieldError = t('catalogs.validation.fieldKeyRequired'); return; }
    if (!fieldForm.label.trim()) { fieldError = t('catalogs.validation.fieldLabelRequired'); return; }
    if (fieldForm.fieldType === 'enum') {
      const vals = fieldForm.enumValues.split('\n').map(s => s.trim()).filter(Boolean);
      if (vals.length === 0) { fieldError = t('catalogs.validation.enumValuesRequired'); return; }
    }
    try {
      fieldSaving = true;
      fieldError = '';
      const enumValues = fieldForm.fieldType === 'enum'
        ? fieldForm.enumValues.split('\n').map(s => s.trim()).filter(Boolean)
        : null;
      const payload = {
        label: fieldForm.label.trim(),
        fieldType: fieldForm.fieldType,
        required: fieldForm.required,
        enumValues,
        defaultValue: fieldForm.defaultValue.trim() || null,
        helpText: fieldForm.helpText.trim() || null,
        sortOrder: fieldForm.sortOrder,
      };
      if (editingField) {
        await updateEquipmentGroupField(editingField.id, payload);
        toast.success(t('common.updateSuccess'));
      } else {
        await createEquipmentGroupField(selectedGroup.id, { key: fieldForm.key.trim(), ...payload });
        toast.success(t('common.createSuccess'));
      }
      showFieldForm = false;
      await loadFields(selectedGroup.id);
    } catch (e) {
      fieldError = e instanceof Error ? e.message : 'Lỗi lưu trường';
    } finally {
      fieldSaving = false;
    }
  }

  async function confirmDeleteField() {
    if (!deletingField || !selectedGroup) return;
    try {
      await deleteEquipmentGroupField(deletingField.id);
      toast.success(t('common.deleteSuccess'));
      showDeleteField = false;
      deletingField = null;
      await loadFields(selectedGroup.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xóa trường');
    }
  }

  function fieldTypeLabel(type: EquipmentGroupFieldType): string {
    const map: Record<EquipmentGroupFieldType, string> = {
      string: t('catalogs.equipmentGroup.fieldType.string'),
      number: t('catalogs.equipmentGroup.fieldType.number'),
      boolean: t('catalogs.equipmentGroup.fieldType.boolean'),
      enum: t('catalogs.equipmentGroup.fieldType.enum'),
      date: t('catalogs.equipmentGroup.fieldType.date'),
    };
    return map[type] ?? type;
  }
</script>

<div class="mt-4 grid grid-cols-[280px_1fr] gap-4 min-h-[480px]">
  <!-- ── CÂY NHÓM (trái) ──────────────────────────────────── -->
  <div class="card p-0 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700">
      <span class="text-sm font-medium text-slate-300">{t('catalogs.equipmentGroup.title')}</span>
      <Button size="sm" variant="primary" onclick={() => openCreateGroup(null)}>
        {#snippet leftIcon()}<Plus class="h-3 w-3" />{/snippet}
        {t('catalogs.equipmentGroup.addGroup')}
      </Button>
    </div>

    <!-- Tree body -->
    <div class="flex-1 overflow-y-auto p-1">
      {#if loading}
        <div class="p-4 text-center text-slate-500 text-sm">Đang tải...</div>
      {:else if error}
        <div class="p-3 text-error text-sm flex gap-2"><AlertCircle class="h-4 w-4 mt-0.5 shrink-0" />{error}</div>
      {:else if flatRows.length === 0}
        <div class="p-4 text-center text-slate-500 text-sm">{t('catalogs.equipmentGroup.noGroups')}</div>
      {:else}
        {#each flatRows as row}
          {@const isSelected = selectedGroup?.id === row.id}
          {@const hasChildren = row.children.length > 0}
          {@const isExpanded = expandedIds.has(row.id)}
          <div
            class="flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm group
                   {isSelected ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-surface-3'}"
            style="padding-left: {row.depth * 16 + 8}px"
            onclick={() => selectGroup(row)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectGroup(row)}
          >
            <!-- Expand toggle -->
            <button
              class="w-4 h-4 shrink-0 flex items-center justify-center text-slate-500 hover:text-slate-300"
              onclick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(row.id); }}
            >
              {#if hasChildren}
                {#if isExpanded}
                  <ChevronDown class="h-3 w-3" />
                {:else}
                  <ChevronRight class="h-3 w-3" />
                {/if}
              {:else}
                <span class="w-3"></span>
              {/if}
            </button>

            <!-- Icon -->
            {#if hasChildren && isExpanded}
              <FolderOpen class="h-4 w-4 shrink-0 text-amber-400" />
            {:else if hasChildren}
              <Folder class="h-4 w-4 shrink-0 text-amber-400" />
            {:else}
              <Layers class="h-4 w-4 shrink-0 text-slate-500" />
            {/if}

            <!-- Name -->
            <span class="flex-1 truncate ml-1">{row.name}</span>

            <!-- Field count badge -->
            {#if (row.fieldCount ?? 0) > 0}
              <span class="text-xs text-slate-500 bg-surface-3 px-1.5 rounded-full shrink-0">{row.fieldCount}</span>
            {/if}

            <!-- Actions (hiện khi hover) -->
            <div class="hidden group-hover:flex gap-0.5 ml-1 shrink-0">
              <button
                class="p-0.5 rounded hover:bg-surface-1 text-slate-400 hover:text-primary"
                title={t('catalogs.equipmentGroup.addSubGroup')}
                onclick={(e) => { e.stopPropagation(); openCreateGroup(row.id); }}
              >
                <Plus class="h-3 w-3" />
              </button>
              <button
                class="p-0.5 rounded hover:bg-surface-1 text-slate-400 hover:text-primary"
                title={t('catalogs.equipmentGroup.editGroup')}
                onclick={(e) => { e.stopPropagation(); openEditGroup(row); }}
              >
                <Edit class="h-3 w-3" />
              </button>
              {#if row.code !== 'UNCATEGORIZED'}
                <button
                  class="p-0.5 rounded hover:bg-surface-1 text-slate-400 hover:text-error"
                  title={t('catalogs.equipmentGroup.deleteGroup')}
                  onclick={(e) => { e.stopPropagation(); deletingGroup = row; showDeleteGroup = true; }}
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ── PANEL PHẢI ────────────────────────────────────────── -->
  <div class="card p-0 flex flex-col overflow-hidden">
    {#if !selectedGroup}
      <!-- Placeholder chưa chọn nhóm -->
      <div class="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Layers class="h-12 w-12 opacity-30" />
        <p class="text-sm">{t('catalogs.equipmentGroup.description')}</p>
      </div>

    {:else if showGroupForm}
      <!-- ── Form nhóm ── -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 class="text-sm font-semibold text-slate-200">
          {editingGroup ? t('catalogs.equipmentGroup.editGroup') : t('catalogs.equipmentGroup.addGroup')}
        </h3>
        <button onclick={() => { showGroupForm = false; }} class="text-slate-400 hover:text-slate-200">
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="p-4 space-y-4 overflow-y-auto flex-1">
        {#if groupError}
          <div class="alert alert-error text-sm py-2">{groupError}</div>
        {/if}
        <TextField
          id="grp-name"
          label={t('catalogs.equipmentGroup.field.name')}
          required
          value={groupForm.name}
          onValueChange={(v) => groupForm.name = v}
          disabled={groupSaving}
        />
        <TextField
          id="grp-code"
          label={t('catalogs.equipmentGroup.field.code')}
          value={groupForm.code}
          onValueChange={(v) => groupForm.code = v}
          disabled={groupSaving}
        />
        <TextareaField
          id="grp-desc"
          label={t('catalogs.equipmentGroup.field.description')}
          value={groupForm.description}
          onValueChange={(v) => groupForm.description = v}
          disabled={groupSaving}
        />
        <SelectField
          id="grp-parent"
          label={t('catalogs.equipmentGroup.field.parentGroup')}
          value={parentForNew ?? ''}
          options={groupOptions.filter(o => o.value !== editingGroup?.id)}
          placeholder={t('catalogs.placeholder.noParentGroup')}
          onValueChange={(v) => parentForNew = v || null}
          disabled={groupSaving}
        />
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
            bind:checked={groupForm.inheritParentFields}
            disabled={groupSaving}
          />
          {t('catalogs.equipmentGroup.field.inheritParentFields')}
        </label>
        <div class="flex gap-2 pt-2">
          <Button variant="primary" onclick={saveGroup} disabled={groupSaving}>
            {groupSaving ? '...' : t('common.save')}
          </Button>
          <Button variant="secondary" onclick={() => { showGroupForm = false; }} disabled={groupSaving}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

    {:else if showFieldForm}
      <!-- ── Form trường ── -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 class="text-sm font-semibold text-slate-200">
          {editingField ? t('catalogs.equipmentGroup.editField') : t('catalogs.equipmentGroup.addField')}
        </h3>
        <button onclick={() => { showFieldForm = false; }} class="text-slate-400 hover:text-slate-200">
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="p-4 space-y-4 overflow-y-auto flex-1">
        {#if fieldError}
          <div class="alert alert-error text-sm py-2">{fieldError}</div>
        {/if}
        {#if !editingField}
          <TextField
            id="fld-key"
            label={t('catalogs.equipmentGroup.field.fieldKey')}
            required
            value={fieldForm.key}
            onValueChange={(v) => fieldForm.key = v}
            disabled={fieldSaving}
          />
        {/if}
        <TextField
          id="fld-label"
          label={t('catalogs.equipmentGroup.field.fieldLabel')}
          required
          value={fieldForm.label}
          onValueChange={(v) => fieldForm.label = v}
          disabled={fieldSaving}
        />
        <SelectField
          id="fld-type"
          label={t('catalogs.equipmentGroup.field.fieldType')}
          required
          value={fieldForm.fieldType}
          options={FIELD_TYPE_OPTIONS}
          onValueChange={(v) => fieldForm.fieldType = v as EquipmentGroupFieldType}
          disabled={fieldSaving}
        />
        {#if fieldForm.fieldType === 'enum'}
          <TextareaField
            id="fld-enum"
            label={t('catalogs.equipmentGroup.field.enumValues')}
            value={fieldForm.enumValues}
            onValueChange={(v) => fieldForm.enumValues = v}
            disabled={fieldSaving}
          />
          <p class="text-xs text-slate-500 -mt-2">Mỗi giá trị trên một dòng</p>
        {/if}
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            class="rounded border-slate-600 bg-surface-3 text-primary focus:ring-primary/50"
            bind:checked={fieldForm.required}
            disabled={fieldSaving}
          />
          {t('catalogs.equipmentGroup.field.required')}
        </label>
        <TextField
          id="fld-default"
          label={t('catalogs.equipmentGroup.field.defaultValue')}
          value={fieldForm.defaultValue}
          onValueChange={(v) => fieldForm.defaultValue = v}
          disabled={fieldSaving}
        />
        <TextField
          id="fld-help"
          label={t('catalogs.equipmentGroup.field.helpText')}
          value={fieldForm.helpText}
          onValueChange={(v) => fieldForm.helpText = v}
          disabled={fieldSaving}
        />
        <div class="flex gap-2 pt-2">
          <Button variant="primary" onclick={saveField} disabled={fieldSaving}>
            {fieldSaving ? '...' : t('common.save')}
          </Button>
          <Button variant="secondary" onclick={() => { showFieldForm = false; }} disabled={fieldSaving}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

    {:else}
      <!-- ── Panel chi tiết nhóm + danh sách fields ── -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <h3 class="text-sm font-semibold text-slate-200">{selectedGroup.name}</h3>
          {#if selectedGroup.description}
            <p class="text-xs text-slate-500 mt-0.5">{selectedGroup.description}</p>
          {/if}
        </div>
        <div class="flex gap-2">
          <Button size="sm" variant="primary" onclick={openCreateField}>
            {#snippet leftIcon()}<Plus class="h-3 w-3" />{/snippet}
            {t('catalogs.equipmentGroup.addField')}
          </Button>
          <Button size="sm" variant="secondary" onclick={() => openEditGroup(selectedGroup!)}>
            {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
            {t('common.edit')}
          </Button>
        </div>
      </div>

      <!-- Info badges -->
      <div class="px-4 py-2 flex gap-3 flex-wrap text-xs text-slate-500 border-b border-slate-700/50">
        {#if selectedGroup.code}
          <span class="font-mono bg-surface-3 px-2 py-0.5 rounded">{selectedGroup.code}</span>
        {/if}
        {#if selectedGroup.parentName}
          <span>{t('catalogs.equipmentGroup.field.parentGroup')}: <span class="text-slate-400">{selectedGroup.parentName}</span></span>
        {/if}
        <span>
          {t('catalogs.equipmentGroup.field.inheritParentFields')}:
          <span class={selectedGroup.inheritParentFields ? 'text-success' : 'text-slate-400'}>
            {selectedGroup.inheritParentFields ? t('common.yes') : t('common.no')}
          </span>
        </span>
      </div>

      <!-- Fields list -->
      <div class="flex-1 overflow-y-auto">
        {#if fieldsLoading}
          <div class="p-4 text-center text-slate-500 text-sm">Đang tải trường...</div>
        {:else if fields.length === 0}
          <div class="p-6 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <AlertCircle class="h-8 w-8 opacity-30" />
            {t('catalogs.equipmentGroup.noFields')}
          </div>
        {:else}
          <table class="data-table w-full">
            <thead>
              <tr>
                <th class="text-left px-4 py-2 text-xs text-slate-500">{t('catalogs.equipmentGroup.field.fieldLabel')}</th>
                <th class="text-left px-4 py-2 text-xs text-slate-500">{t('catalogs.equipmentGroup.field.fieldKey')}</th>
                <th class="text-left px-4 py-2 text-xs text-slate-500">{t('catalogs.equipmentGroup.field.fieldType')}</th>
                <th class="text-center px-4 py-2 text-xs text-slate-500">{t('catalogs.equipmentGroup.field.required')}</th>
                <th class="text-right px-4 py-2 text-xs text-slate-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {#each fields as field}
                <tr class="border-t border-slate-700/50 hover:bg-surface-3/50">
                  <td class="px-4 py-2 text-sm text-slate-200">{field.label}</td>
                  <td class="px-4 py-2 text-xs font-mono text-slate-400">{field.key}</td>
                  <td class="px-4 py-2">
                    <span class="badge-info text-xs">{fieldTypeLabel(field.fieldType)}</span>
                  </td>
                  <td class="px-4 py-2 text-center">
                    {#if field.required}
                      <Check class="h-4 w-4 text-success mx-auto" />
                    {:else}
                      <span class="text-slate-600">—</span>
                    {/if}
                  </td>
                  <td class="px-4 py-2">
                    <div class="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onclick={() => openEditField(field)}>
                        {#snippet leftIcon()}<Edit class="h-3 w-3" />{/snippet}
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="danger" onclick={() => { deletingField = field; showDeleteField = true; }}>
                        {#snippet leftIcon()}<Trash2 class="h-3 w-3" />{/snippet}
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- ── Modal xác nhận xóa nhóm ────────────────────────────── -->
{#if showDeleteGroup && deletingGroup}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
    <div class="modal-panel w-full max-w-sm p-6 space-y-4">
      <h3 class="text-base font-semibold text-slate-100">{t('catalogs.equipmentGroup.deleteGroup')}</h3>
      <p class="text-sm text-slate-400">
        {t('catalogs.equipmentGroup.confirmDelete', { name: deletingGroup.name })}
      </p>
      <p class="text-xs text-warning">{t('catalogs.equipmentGroup.deleteWarning')}</p>
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onclick={() => { showDeleteGroup = false; deletingGroup = null; }}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onclick={confirmDeleteGroup}>
          {t('common.delete')}
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Modal xác nhận xóa trường ──────────────────────────── -->
{#if showDeleteField && deletingField}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
    <div class="modal-panel w-full max-w-sm p-6 space-y-4">
      <h3 class="text-base font-semibold text-slate-100">{t('catalogs.equipmentGroup.deleteField')}</h3>
      <p class="text-sm text-slate-400">
        {t('catalogs.equipmentGroup.confirmDeleteField', { label: deletingField.label })}
      </p>
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onclick={() => { showDeleteField = false; deletingField = null; }}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onclick={confirmDeleteField}>
          {t('common.delete')}
        </Button>
      </div>
    </div>
  </div>
{/if}
