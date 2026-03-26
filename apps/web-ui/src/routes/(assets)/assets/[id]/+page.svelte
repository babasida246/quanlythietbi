<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    Button, Table, TableHeader, TableHeaderCell, TableRow, TableCell,
    Tabs, TabsList, TabsTrigger
  } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { ArrowLeft, Download, Wrench, UserPlus, Undo2, ChevronDown, ChevronRight, PackageOpen } from 'lucide-svelte';
  import { _, isLoading } from '$lib/i18n';
  import { getCapabilities } from '$lib/auth/capabilities';
  import { allowedPerms } from '$lib/stores/effectivePermsStore';
  import AssetTimeline from '$lib/assets/components/AssetTimeline.svelte';
  import AssignModal from '$lib/assets/components/AssignModal.svelte';
  import MaintenanceModal from '$lib/assets/components/MaintenanceModal.svelte';
  import AttachmentList from '$lib/assets/components/AttachmentList.svelte';
  import AttachmentUploader from '$lib/assets/components/AttachmentUploader.svelte';
  import InventoryScanPanel from '$lib/assets/components/InventoryScanPanel.svelte';
  import AssetComponentsPanel from '$lib/assets/components/AssetComponentsPanel.svelte';
  import { downloadDriverFile, recommendDrivers, type DriverRecommendation } from '$lib/api/drivers';
  import { downloadDocumentFile, listDocuments, type Document as KnowledgeDocument } from '$lib/api/docs';
  import {
    assignAsset,
    getAssetDetail,
    getAssetTimeline,
    openMaintenanceTicket,
    returnAsset,
    updateAsset,
    type Asset,
    type AssetAssignment,
    type AssigneeType,
    type MaintenanceTicket,
    type MaintenanceSeverity,
    type AssetEvent
  } from '$lib/api/assets';
  import {
    closeInventorySession,
    createInventorySession,
    getInventorySessionDetail,
    listAttachments,
    listInventorySessions,
    listReminders,
    runWarrantyReminders,
    type Attachment,
    type InventoryItem,
    type InventorySession,
    type Reminder
  } from '$lib/api/assetMgmt';
  import { getAssetCatalogs, getCategorySpecDefs, type Catalogs, type CategorySpecDef } from '$lib/api/assetCatalogs';
  import { getAssetComponents, type ComponentAssignmentWithDetails } from '$lib/api/components';
  import { listRepairOrders, getRepairOrder, createRepairOrder, type RepairOrderRecord, type RepairOrderPartRecord } from '$lib/api/warehouse';
  import { getLicensesByAsset, type LicenseWithAssetSeat } from '$lib/api/licenses';
  let asset = $state<Asset | null>(null);
  let assignments = $state<AssetAssignment[]>([]);
  let maintenance = $state<MaintenanceTicket[]>([]);
  let timeline = $state<AssetEvent[]>([]);
  let attachments = $state<Attachment[]>([]);
  let reminders = $state<Reminder[]>([]);
  let inventorySessions = $state<InventorySession[]>([]);
  let inventoryItems = $state<InventoryItem[]>([]);
  let catalogs = $state<Catalogs | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab = $state('overview');
  let showAssignModal = $state(false);
  let showMaintenanceModal = $state(false);
  let showReturnModal = $state(false);
  let returning = $state(false);
  let returnNote = $state('');
  let remindersLoading = $state(false);
  let inventoryLoading = $state(false);
  let creatingSession = $state(false);
  let activeInventorySessionId = $state('');
  let newSessionName = $state('');
  let newSessionLocationId = $state('');
  let purchaseCost = $state('');
  let usefulLifeYears = $state('3');
  let overviewEditMode = $state(false);
  let specsEditMode = $state(false);
  let overviewSaving = $state(false);
  let specsSaving = $state(false);
  let formError = $state('');
  let overviewDraft = $state<{
    serialNo: string;
    macAddress: string;
    mgmtIp: string;
    hostname: string;
    vlanId: string;
    switchName: string;
    switchPort: string;
    locationId: string;
    vendorId: string;
    purchaseDate: string;
    warrantyEnd: string;
    notes: string;
  }>({
    serialNo: '',
    macAddress: '',
    mgmtIp: '',
    hostname: '',
    vlanId: '',
    switchName: '',
    switchPort: '',
    locationId: '',
    vendorId: '',
    purchaseDate: '',
    warrantyEnd: '',
    notes: ''
  });
  let specDraft = $state<Record<string, unknown>>({});

  let assetComponents = $state<ComponentAssignmentWithDetails[]>([]);
  let specDefs = $state<CategorySpecDef[]>([]);
  let specDefsLoading = $state(false);
  let repairOrders = $state<RepairOrderRecord[]>([]);
  let repairParts = $state<Record<string, RepairOrderPartRecord[]>>({});
  let repairOrdersLoading = $state(false);
  let expandedRepairOrder = $state<string | null>(null);
  let licenses = $state<LicenseWithAssetSeat[]>([]);
  let licensesLoading = $state(false);
  let driverRecommendations = $state<DriverRecommendation[]>([]);
  let relatedDocuments = $state<KnowledgeDocument[]>([]);
  let knowledgeLoading = $state(false);
  let knowledgeError = $state('');

  // Repair order creation modal
  let showRepairModal = $state(false);
  let repairTitle = $state('');
  let repairSeverity = $state<'low' | 'medium' | 'high' | 'critical'>('medium');
  let repairType = $state<'internal' | 'vendor'>('internal');
  let repairTechnician = $state('');
  let repairCreating = $state(false);
  let repairError = $state('');

  type TimelineDiffRow = {
    field: string;
    before: string;
    after: string;
  };

  function toComparableJson(value: unknown): string {
    const normalize = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map((item) => normalize(item));
      if (input && typeof input === 'object') {
        const entries = Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, val]) => [key, normalize(val)]);
        return Object.fromEntries(entries);
      }
      return input;
    };
    try {
      return JSON.stringify(normalize(value));
    } catch {
      return String(value);
    }
  }

  function formatDiffValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value || '-';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return String(value); }
  }
  function formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return String(value); }
  }

  let userRole = $state('');
  let ready = $state(false);
  const caps = $derived.by(() => {
    const perms = $allowedPerms;
    return getCapabilities(userRole, perms.length > 0 ? perms : undefined);
  });
  const backHref = $derived.by(() => (caps.canManageAssets ? '/assets' : '/me/assets'));

  const assetId = $derived(page.params.id);
  const locations = $derived(catalogs?.locations ?? []);
  const vendors = $derived(catalogs?.vendors ?? []);

  onMount(() => {
    if (typeof window === 'undefined') return;
    userRole = localStorage.getItem('userRole') || '';
    ready = true;
  });
  const warrantyDaysLeft = $derived.by(() => {
    if (!asset?.warrantyEnd) return null;
    const end = new Date(asset.warrantyEnd).getTime();
    const diff = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) ? diff : null;
  });
  const inventoryCounts = $derived.by(() => {
    return inventoryItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  });
  const openMaintenanceCount = $derived.by(() => maintenance.filter((ticket) => ticket.status !== 'closed').length);
  const healthScore = $derived.by(() => {
    let score = 100;
    if (asset?.status === 'retired' || asset?.status === 'disposed') {
      score -= 40;
    }
    if (openMaintenanceCount > 0) {
      score -= Math.min(30, openMaintenanceCount * 10);
    }
    if (warrantyDaysLeft !== null) {
      if (warrantyDaysLeft < 0) score -= 25;
      else if (warrantyDaysLeft < 30) score -= 15;
      else if (warrantyDaysLeft < 90) score -= 8;
    }
    return Math.max(20, score);
  });
  const depreciation = $derived.by(() => {
    const cost = Number(purchaseCost);
    const years = Number(usefulLifeYears);
    if (!cost || cost <= 0 || years <= 0) {
      return { annual: 0, monthly: 0 };
    }
    return {
      annual: cost / years,
      monthly: cost / years / 12
    };
  });
  const overviewDirty = $derived.by(() => {
    if (!asset || !overviewEditMode) return false;
    return toComparableJson({
      serialNo: asset.serialNo ?? '',
      macAddress: asset.macAddress ?? '',
      mgmtIp: asset.mgmtIp ?? '',
      hostname: asset.hostname ?? '',
      vlanId: asset.vlanId ? String(asset.vlanId) : '',
      switchName: asset.switchName ?? '',
      switchPort: asset.switchPort ?? '',
      locationId: asset.locationId ?? '',
      vendorId: asset.vendorId ?? '',
      purchaseDate: asset.purchaseDate ?? '',
      warrantyEnd: asset.warrantyEnd ?? '',
      notes: asset.notes ?? ''
    }) !== toComparableJson(overviewDraft);
  });
  const specsDirty = $derived.by(() => {
    if (!asset || !specsEditMode) return false;
    return toComparableJson(asset.spec ?? {}) !== toComparableJson(specDraft);
  });
  const hasPendingChanges = $derived.by(() => overviewDirty || specsDirty);
  const lifecycleDiffEvents = $derived.by(() => {
    const rows: Array<{ id: string; at: string; eventType: string; changes: TimelineDiffRow[] }> = [];
    for (const event of timeline) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const changes: TimelineDiffRow[] = [];

      const before = payload.before;
      const after = payload.after;
      if (before && after && typeof before === 'object' && typeof after === 'object') {
        const keySet = new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]);
        for (const key of keySet) {
          const prev = (before as Record<string, unknown>)[key];
          const next = (after as Record<string, unknown>)[key];
          if (toComparableJson(prev) !== toComparableJson(next)) {
            changes.push({ field: key, before: formatDiffValue(prev), after: formatDiffValue(next) });
          }
        }
      }

      const patch = payload.patch;
      if (changes.length === 0 && patch && typeof patch === 'object') {
        for (const [key, next] of Object.entries(patch as Record<string, unknown>)) {
          changes.push({ field: key, before: '-', after: formatDiffValue(next) });
        }
      }

      const genericChanges = payload.changes;
      if (changes.length === 0 && genericChanges && typeof genericChanges === 'object') {
        for (const [key, item] of Object.entries(genericChanges as Record<string, unknown>)) {
          if (item && typeof item === 'object' && 'before' in (item as Record<string, unknown>) && 'after' in (item as Record<string, unknown>)) {
            const val = item as Record<string, unknown>;
            changes.push({ field: key, before: formatDiffValue(val.before), after: formatDiffValue(val.after) });
          } else {
            changes.push({ field: key, before: '-', after: formatDiffValue(item) });
          }
        }
      }

      if (changes.length > 0 || /update|edit|patch/i.test(event.eventType)) {
        rows.push({
          id: event.id,
          at: event.createdAt,
          eventType: event.eventType,
          changes
        });
      }
    }
    return rows.slice(0, 10);
  });

  function requestTabChange(nextTab: string) {
    if (nextTab === activeTab) return;
    if (hasPendingChanges) {
      const ok = window.confirm('Bạn có thay đổi chưa lưu. Chuyển tab sẽ mất thay đổi. Tiếp tục?');
      if (!ok) return;
      overviewEditMode = false;
      specsEditMode = false;
      formError = '';
      initDrafts();
    }
    activeTab = nextTab;
  }
  async function loadDetail() {
    if (!assetId) return;
    try {
      loading = true;
      error = '';
      const detail = await getAssetDetail(assetId);
      asset = detail.data?.asset ?? null;
      assignments = detail.data?.assignments ?? [];
      maintenance = detail.data?.maintenance ?? [];
      const timelineResp = await getAssetTimeline(assetId);
      timeline = timelineResp.data ?? [];

      const attachmentResp = await listAttachments(assetId);
      attachments = attachmentResp.data ?? [];

      const reminderResp = await listReminders({ status: 'pending', page: 1, limit: 100 });
      reminders = (reminderResp.data ?? []).filter((item) => item.assetId === assetId);

      if (caps.canManageAssets) {
        const [sessionResp, catalogResp] = await Promise.all([
          listInventorySessions({ page: 1, limit: 100 }),
          getAssetCatalogs()
        ]);
        inventorySessions = sessionResp.data ?? [];
        catalogs = catalogResp.data ?? null;
      } else {
        inventorySessions = [];
        inventoryItems = [];
        catalogs = null;
        activeInventorySessionId = '';
      }

      const compResp = await getAssetComponents(assetId);
      assetComponents = compResp?.components ?? [];

      // Load spec defs, repair orders and licenses in parallel (non-blocking)
      const loadedAsset = detail.data?.asset ?? null;
      if (loadedAsset?.categoryId) void loadSpecDefs(loadedAsset.categoryId);
      void loadRepairOrders();
      void loadLicenses();

      void loadKnowledge();
      initDrafts();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.loadFailed');
    } finally {
      loading = false;
    }
  }

  function initDrafts() {
    if (!asset) return;
    overviewDraft = {
      serialNo: asset.serialNo ?? '',
      macAddress: asset.macAddress ?? '',
      mgmtIp: asset.mgmtIp ?? '',
      hostname: asset.hostname ?? '',
      vlanId: asset.vlanId ? String(asset.vlanId) : '',
      switchName: asset.switchName ?? '',
      switchPort: asset.switchPort ?? '',
      locationId: asset.locationId ?? '',
      vendorId: asset.vendorId ?? '',
      purchaseDate: asset.purchaseDate ?? '',
      warrantyEnd: asset.warrantyEnd ?? '',
      notes: asset.notes ?? ''
    };
    specDraft = { ...(asset.spec ?? {}) };
  }

  function validateOverviewDraft(): string {
    if (overviewDraft.mgmtIp && !/^[0-9a-fA-F:.]+$/.test(overviewDraft.mgmtIp)) {
      return 'Địa chỉ IP quản trị không hợp lệ';
    }
    if (overviewDraft.macAddress && !/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(overviewDraft.macAddress)) {
      return 'Địa chỉ MAC không hợp lệ';
    }
    if (overviewDraft.vlanId) {
      const vlan = Number(overviewDraft.vlanId);
      if (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094) {
        return 'VLAN ID phải nằm trong khoảng 1-4094';
      }
    }
    if (overviewDraft.purchaseDate && overviewDraft.warrantyEnd && overviewDraft.warrantyEnd < overviewDraft.purchaseDate) {
      return 'Ngày hết bảo hành phải lớn hơn hoặc bằng ngày mua';
    }
    return '';
  }

  async function saveOverview(): Promise<void> {
    if (!asset) return;
    const invalid = validateOverviewDraft();
    if (invalid) {
      formError = invalid;
      return;
    }

    formError = '';
    overviewSaving = true;
    try {
      const payload = {
        serialNo: overviewDraft.serialNo || undefined,
        macAddress: overviewDraft.macAddress || undefined,
        mgmtIp: overviewDraft.mgmtIp || undefined,
        hostname: overviewDraft.hostname || undefined,
        vlanId: overviewDraft.vlanId ? Number(overviewDraft.vlanId) : undefined,
        switchName: overviewDraft.switchName || undefined,
        switchPort: overviewDraft.switchPort || undefined,
        locationId: overviewDraft.locationId || undefined,
        vendorId: overviewDraft.vendorId || undefined,
        purchaseDate: overviewDraft.purchaseDate || undefined,
        warrantyEnd: overviewDraft.warrantyEnd || undefined,
        notes: overviewDraft.notes || undefined
      };
      await updateAsset(asset.id, payload);
      overviewEditMode = false;
      await loadDetail();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Không thể lưu thông tin tổng quan';
    } finally {
      overviewSaving = false;
    }
  }

  function startOverviewEdit() {
    initDrafts();
    formError = '';
    overviewEditMode = true;
  }

  function cancelOverviewEdit() {
    overviewEditMode = false;
    formError = '';
    initDrafts();
  }

  function startSpecsEdit() {
    initDrafts();
    formError = '';
    specsEditMode = true;
  }

  function cancelSpecsEdit() {
    specsEditMode = false;
    formError = '';
    initDrafts();
  }

  function parseSpecValue(raw: unknown, fieldType?: string): unknown {
    const text = String(raw ?? '').trim();
    if (!fieldType) return text;
    if (fieldType === 'number') {
      if (!text) return null;
      const value = Number(text);
      return Number.isFinite(value) ? value : null;
    }
    if (fieldType === 'boolean') {
      return text === 'true';
    }
    if (fieldType === 'json') {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  }

  async function saveSpecs(): Promise<void> {
    if (!asset) return;
    specsSaving = true;
    formError = '';
    try {
      const nextSpec: Record<string, unknown> = {};
      const defs = specDefs.length > 0 ? specDefs : Object.keys(specDraft).map((key) => ({ key, fieldType: 'string', required: false } as CategorySpecDef));
      for (const def of defs) {
        const value = parseSpecValue(specDraft[def.key], def.fieldType);
        if (def.required && (value === null || value === undefined || value === '')) {
          formError = `Thiếu trường bắt buộc: ${def.label}`;
          specsSaving = false;
          return;
        }
        if (value !== null && value !== undefined && value !== '') {
          nextSpec[def.key] = value;
        }
      }
      await updateAsset(asset.id, { spec: nextSpec });
      specsEditMode = false;
      await loadDetail();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Không thể lưu thông số kỹ thuật';
    } finally {
      specsSaving = false;
    }
  }

  function getSpecFieldType(key: string): string {
    return specDefs.find((item) => item.key === key)?.fieldType ?? 'string';
  }

  function getSpecEnumValues(key: string): string[] {
    return specDefs.find((item) => item.key === key)?.enumValues ?? [];
  }

  async function loadKnowledge() {
    if (!assetId) return;
    knowledgeLoading = true;
    knowledgeError = '';
    try {
      const [drivers, docs] = await Promise.all([
        recommendDrivers({ assetId }),
        listDocuments({ relatedAssetId: assetId, page: 1, pageSize: 10, sort: 'updatedAt' })
      ]);
      driverRecommendations = drivers ?? [];
      relatedDocuments = docs.data ?? [];
    } catch (err) {
      knowledgeError = err instanceof Error ? err.message : $_('assets.knowledge.loadFailed');
      driverRecommendations = [];
      relatedDocuments = [];
    } finally {
      knowledgeLoading = false;
    }
  }
  async function handleAssign(data: { assigneeType: AssigneeType; assigneeName: string; assigneeId: string; note?: string }) {
    if (!asset) return;
    try {
      await assignAsset(asset.id, data);
      showAssignModal = false;
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.assignFailed');
    }
  }
  async function handleReturn() {
    if (!asset) return;
    try {
      returning = true;
      await returnAsset(asset.id, returnNote || undefined);
      showReturnModal = false;
      returnNote = '';
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.returnFailed');
    } finally {
      returning = false;
    }
  }
  async function handleMaintenance(data: { title: string; severity: MaintenanceSeverity; diagnosis?: string; resolution?: string }) {
    if (!asset) return;
    try {
      await openMaintenanceTicket({ assetId: asset.id, ...data });
      showMaintenanceModal = false;
      await loadDetail();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.openMaintenanceFailed');
    }
  }

  async function handleRunWarrantyReminders() {
    try {
      remindersLoading = true;
      await runWarrantyReminders([30, 60, 90]);
      const reminderResp = await listReminders({ status: 'pending' });
      reminders = (reminderResp.data ?? []).filter((item) => item.assetId === assetId);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.reminderFailed');
    } finally {
      remindersLoading = false;
    }
  }

  async function loadInventorySessionDetail(sessionId: string) {
    if (!sessionId) return;
    try {
      inventoryLoading = true;
      const response = await getInventorySessionDetail(sessionId);
      inventoryItems = response.data?.items ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryLoadFailed');
    } finally {
      inventoryLoading = false;
    }
  }

  async function handleCreateSession() {
    if (!newSessionName) return;
    try {
      creatingSession = true;
      const response = await createInventorySession({
        name: newSessionName,
        locationId: newSessionLocationId || undefined
      });
      const session = response.data;
      inventorySessions = [session, ...inventorySessions];
      activeInventorySessionId = session.id;
      newSessionName = '';
      newSessionLocationId = '';
      await loadInventorySessionDetail(session.id);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryCreateFailed');
    } finally {
      creatingSession = false;
    }
  }

  async function handleCloseSession() {
    if (!activeInventorySessionId) return;
    try {
      await closeInventorySession(activeInventorySessionId);
      const response = await listInventorySessions({ page: 1, limit: 50 });
      inventorySessions = response.data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : $_('assets.errors.inventoryCloseFailed');
    }
  }

  async function loadSpecDefs(categoryId: string) {
    specDefsLoading = true;
    try {
      const res = await getCategorySpecDefs(categoryId);
      specDefs = res.data ?? [];
    } catch { specDefs = []; }
    finally { specDefsLoading = false; }
  }

  async function loadRepairOrders() {
    if (!assetId) return;
    repairOrdersLoading = true;
    try {
      const res = await listRepairOrders({ assetId });
      repairOrders = res.data ?? [];
    } catch { repairOrders = []; }
    finally { repairOrdersLoading = false; }
  }

  async function toggleRepairParts(orderId: string) {
    if (expandedRepairOrder === orderId) {
      expandedRepairOrder = null;
      return;
    }
    expandedRepairOrder = orderId;
    if (!repairParts[orderId]) {
      try {
        const detail = await getRepairOrder(orderId);
        repairParts = { ...repairParts, [orderId]: detail.data?.parts ?? [] };
      } catch { repairParts = { ...repairParts, [orderId]: [] }; }
    }
  }

  async function loadLicenses() {
    if (!assetId) return;
    licensesLoading = true;
    try {
      const res = await getLicensesByAsset(assetId);
      licenses = res.data ?? [];
    } catch { licenses = []; }
    finally { licensesLoading = false; }
  }

  async function handleCreateRepair() {
    if (!repairTitle || !assetId) return;
    repairCreating = true;
    repairError = '';
    try {
      const res = await createRepairOrder({
        assetId,
        title: repairTitle,
        severity: repairSeverity,
        repairType,
        technicianName: repairTechnician || undefined
      });
      repairOrders = [res.data, ...repairOrders];
      showRepairModal = false;
      repairTitle = '';
      repairTechnician = '';
    } catch (e) {
      repairError = e instanceof Error ? e.message : 'Lỗi tạo lệnh sửa chữa';
    } finally {
      repairCreating = false;
    }
  }

  function downloadEvidencePack() {
    const payload = {
      asset,
      assignments,
      maintenance,
      timeline,
      attachments,
      reminders
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset-${asset?.assetCode ?? 'unknown'}-evidence.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  $effect(() => {
    if (!ready) return;
    assetId;
    void loadDetail();
  });

  $effect(() => {
    if (caps.canManageAssets) return;
    if (activeTab === 'inventory') {
      activeTab = 'overview';
    }
  });

  $effect(() => {
    if (activeInventorySessionId) {
      void loadInventorySessionDetail(activeInventorySessionId);
    }
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  });
</script>
<div class="page-shell page-content">
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <a href={backHref} class="btn-sm btn-secondary inline-flex items-center gap-2 rounded-lg shrink-0">
      <ArrowLeft class="w-4 h-4" /> {$isLoading ? 'Back' : $_('common.back')}
    </a>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-2xl font-bold tracking-tight">{asset?.assetCode || ($isLoading ? 'Asset' : $_('assets.asset'))}</h1>
        {#if asset?.status}
          <span class={asset.status === 'in_use' ? 'badge-success' : asset.status === 'in_repair' ? 'badge-warning' : asset.status === 'retired' || asset.status === 'disposed' ? 'badge-error' : 'badge-primary'}>
            {$_(`assets.statusByCode.${asset.status}`)}
          </span>
        {/if}
      </div>
      {#if asset?.locationName || asset?.warehouseName}
        <p class="text-sm text-slate-400 mt-0.5">
          {#if asset.status === 'in_use' && asset.locationName}
            {$_('assets.statusByCode.in_use')} · {asset.locationName}
          {:else if asset.warehouseName}
            {asset.warehouseName}
          {:else if asset.locationName}
            {asset.locationName}
          {/if}
        </p>
      {/if}
    </div>
    {#if !loading && asset && caps.canManageAssets}
      <div class="flex flex-wrap gap-2 shrink-0">
        <Button size="sm" onclick={() => showAssignModal = true}>
          <UserPlus class="w-4 h-4 mr-1" /> {$isLoading ? 'Assign' : $_('assets.assign')}
        </Button>
        <Button size="sm" variant="secondary" onclick={() => showReturnModal = true}>
          <Undo2 class="w-4 h-4 mr-1" /> {$isLoading ? 'Return' : $_('assets.return')}
        </Button>
        <Button size="sm" variant="secondary" onclick={() => showMaintenanceModal = true}>
          <Wrench class="w-4 h-4 mr-1" /> {$isLoading ? 'Maintenance' : $_('maintenance.title')}
        </Button>
      </div>
    {/if}
  </div>
  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  {:else if asset}
    <Tabs>
      <TabsList>
        <TabsTrigger active={activeTab === 'overview'} onclick={() => requestTabChange('overview')}>{$isLoading ? 'Overview' : $_('assets.tabs.overview')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'specs'} onclick={() => requestTabChange('specs')}>{$isLoading ? 'Specs' : $_('assets.tabs.specs')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'lifecycle'} onclick={() => requestTabChange('lifecycle')}>{$isLoading ? 'Lifecycle' : $_('assets.tabs.lifecycle')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'repairs'} onclick={() => requestTabChange('repairs')}>{$isLoading ? 'Repairs' : $_('assets.tabs.repairs')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'maintenance'} onclick={() => requestTabChange('maintenance')}>{$isLoading ? 'Maintenance' : $_('assets.tabs.maintenance')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'software'} onclick={() => requestTabChange('software')}>{$isLoading ? 'Software' : $_('assets.tabs.software')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'components'} onclick={() => requestTabChange('components')}>{$isLoading ? 'Components' : $_('assets.tabs.components')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'warranty'} onclick={() => requestTabChange('warranty')}>{$isLoading ? 'Warranty' : $_('assets.tabs.warranty')}</TabsTrigger>
        {#if caps.canManageAssets}
          <TabsTrigger active={activeTab === 'inventory'} onclick={() => requestTabChange('inventory')}>{$isLoading ? 'Inventory' : $_('assets.tabs.inventory')}</TabsTrigger>
        {/if}
        <TabsTrigger active={activeTab === 'attachments'} onclick={() => requestTabChange('attachments')}>{$isLoading ? 'Attachments' : $_('assets.tabs.attachments')}</TabsTrigger>
        <TabsTrigger active={activeTab === 'compliance'} onclick={() => requestTabChange('compliance')}>{$isLoading ? 'Compliance' : $_('assets.tabs.compliance')}</TabsTrigger>
      </TabsList>
    </Tabs>

    {#if activeTab === 'overview'}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="card p-4 sm:p-5 lg:col-span-2">
            <div class="mb-4 pb-3 border-b border-border flex items-center justify-between gap-2">
              <h2 class="text-base font-semibold">{$isLoading ? 'Overview' : $_('assets.overview')}</h2>
              {#if caps.canManageAssets}
                {#if !overviewEditMode}
                  <Button size="sm" variant="secondary" onclick={startOverviewEdit}>{$_('assets.edit')}</Button>
                {:else}
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onclick={cancelOverviewEdit} disabled={overviewSaving}>{$_('common.cancel')}</Button>
                    <Button size="sm" onclick={saveOverview} disabled={overviewSaving}>{overviewSaving ? $_('common.loading') : $_('common.save')}</Button>
                  </div>
                {/if}
              {/if}
            </div>
            {#if formError && overviewEditMode}
              <div class="alert alert-error mb-3">{formError}</div>
            {/if}
            <div class="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Model' : $_('assets.model')}</p>
                <p class="font-medium">{asset.modelName || '-'}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Vendor' : $_('assets.vendor')}</p>
                {#if overviewEditMode}
                  <select class="select-base" bind:value={overviewDraft.vendorId}>
                    <option value="">{$_('assets.placeholders.selectVendor')}</option>
                    {#each vendors as vendor}
                      <option value={vendor.id}>{vendor.name}</option>
                    {/each}
                  </select>
                {:else}
                  <p class="font-medium">{asset.vendorName || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Location' : $_('assets.location')}</p>
                {#if overviewEditMode}
                  <select class="select-base" bind:value={overviewDraft.locationId}>
                    <option value="">{$_('assets.placeholders.selectLocation')}</option>
                    {#each locations as location}
                      <option value={location.id}>{location.name}</option>
                    {/each}
                  </select>
                {:else}
                  <p class="font-medium">{asset.locationName || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Serial' : $_('assets.serialNumber')}</p>
                {#if overviewEditMode}
                  <input class="input-base" bind:value={overviewDraft.serialNo} />
                {:else}
                  <p class="font-medium font-mono text-xs">{asset.serialNo || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Mgmt IP' : $_('assets.mgmtIp')}</p>
                {#if overviewEditMode}
                  <input class="input-base font-mono" bind:value={overviewDraft.mgmtIp} placeholder="10.10.10.10" />
                {:else}
                  <p class="font-medium font-mono text-xs">{asset.mgmtIp || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Hostname' : $_('assets.hostname')}</p>
                {#if overviewEditMode}
                  <input class="input-base" bind:value={overviewDraft.hostname} />
                {:else}
                  <p class="font-medium">{asset.hostname || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Purchase date' : $_('assets.purchaseDate')}</p>
                {#if overviewEditMode}
                  <input type="date" class="input-base" bind:value={overviewDraft.purchaseDate} />
                {:else}
                  <p class="font-medium">{formatDate(asset.purchaseDate)}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Warranty End' : $_('assets.warrantyEnd')}</p>
                {#if overviewEditMode}
                  <input type="date" class="input-base" bind:value={overviewDraft.warrantyEnd} />
                {:else}
                  <p class="font-medium">{formatDate(asset.warrantyEnd)}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">MAC</p>
                {#if overviewEditMode}
                  <input class="input-base font-mono" bind:value={overviewDraft.macAddress} placeholder="AA:BB:CC:DD:EE:FF" />
                {:else}
                  <p class="font-medium font-mono text-xs">{asset.macAddress || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">VLAN</p>
                {#if overviewEditMode}
                  <input class="input-base" bind:value={overviewDraft.vlanId} placeholder="10" />
                {:else}
                  <p class="font-medium">{asset.vlanId ?? '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Switch</p>
                {#if overviewEditMode}
                  <input class="input-base" bind:value={overviewDraft.switchName} placeholder="SW-Core-01" />
                {:else}
                  <p class="font-medium">{asset.switchName || '-'}</p>
                {/if}
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Switch Port</p>
                {#if overviewEditMode}
                  <input class="input-base" bind:value={overviewDraft.switchPort} placeholder="Gi1/0/24" />
                {:else}
                  <p class="font-medium">{asset.switchPort || '-'}</p>
                {/if}
              </div>
              {#if asset.warehouseName}
              <div>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Warehouse' : $_('assets.warehouse')}</p>
                <p class="font-medium">{asset.warehouseName}</p>
              </div>
              {/if}
              <div class={asset.warehouseName ? '' : 'col-span-2'}>
                <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{$isLoading ? 'Notes' : $_('assets.notes')}</p>
                {#if overviewEditMode}
                  <textarea rows="3" class="input-base" bind:value={overviewDraft.notes}></textarea>
                {:else}
                  <p class="font-medium">{asset.notes || '-'}</p>
                {/if}
              </div>
            </div>
          </div>
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4 pb-3 border-b border-border">{$isLoading ? 'Asset health' : $_('assets.health.title')}</h2>
            <div class="flex items-center justify-between py-2">
              <span class="text-sm text-slate-500">{$_('assets.health.score')}</span>
              <span class={healthScore > 80 ? 'badge-success' : healthScore > 60 ? 'badge-warning' : 'badge-error'}>{healthScore}</span>
            </div>
            <div class="divide-y divide-border text-sm">
              <div class="flex items-center justify-between py-2.5">
                <span class="text-slate-500">{$_('assets.health.maintenanceOpen')}</span>
                <span class="font-semibold">{openMaintenanceCount}</span>
              </div>
              <div class="flex items-center justify-between py-2.5">
                <span class="text-slate-500">{$_('assets.health.warrantyDays')}</span>
                <span class="font-semibold">{warrantyDaysLeft ?? '-'}</span>
              </div>
              <div class="flex items-center justify-between py-2.5">
                <span class="text-slate-500">{$_('assets.health.assignments')}</span>
                <span class="font-semibold">{assignments.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-base font-semibold">{$isLoading ? 'Recommended drivers' : $_('assets.knowledge.recommendedDrivers')}</h2>
              {#if driverRecommendations.length > 0}
                <span class="badge-primary">{driverRecommendations.length}</span>
              {/if}
            </div>

            {#if knowledgeLoading}
              <div class="flex items-center justify-center py-6">
                <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            {:else if knowledgeError}
              <div class="alert alert-error">{knowledgeError}</div>
            {:else if driverRecommendations.length === 0}
              <p class="text-sm text-slate-500">{$isLoading ? 'No recommendations.' : $_('assets.knowledge.emptyDrivers')}</p>
            {:else}
              <div class="divide-y divide-border">
                {#each driverRecommendations as rec (rec.driver.id)}
                  <div class="py-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-semibold truncate">
                        {rec.driver.vendor} · {rec.driver.model}
                      </div>
                      <div class="text-xs text-slate-500">
                        {rec.driver.component} · {rec.driver.os}/{rec.driver.arch} · <span class="font-mono">{rec.driver.version}</span>
                      </div>
                      {#if rec.explain?.length}
                        <div class="text-[11px] text-slate-400 mt-1 truncate">{rec.explain.join(' · ')}</div>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class={(rec.driver.riskLevel === 'high' || rec.driver.riskLevel === 'critical') ? 'badge-error capitalize' : rec.driver.riskLevel === 'medium' ? 'badge-warning capitalize' : 'badge-success capitalize'}>
                        {rec.driver.riskLevel}
                      </span>
                      {#if rec.driver.file?.storageKey && rec.driver.approval.status === 'approved' && rec.driver.supportStatus !== 'blocked'}
                        <Button size="sm" variant="secondary" onclick={() => void downloadDriverFile(rec.driver.id)} aria-label="Download driver">
                          <Download class="w-4 h-4" />
                        </Button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-base font-semibold">{$isLoading ? 'Related documents' : $_('assets.knowledge.relatedDocs')}</h2>
              {#if relatedDocuments.length > 0}
                <span class="badge-primary">{relatedDocuments.length}</span>
              {/if}
            </div>

            {#if knowledgeLoading}
              <div class="flex items-center justify-center py-6">
                <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            {:else if knowledgeError}
              <div class="alert alert-error">{knowledgeError}</div>
            {:else if relatedDocuments.length === 0}
              <p class="text-sm text-slate-500">{$isLoading ? 'No related docs.' : $_('assets.knowledge.emptyDocs')}</p>
            {:else}
              <div class="divide-y divide-border">
                {#each relatedDocuments as doc (doc.id)}
                  <div class="py-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-semibold truncate">{doc.title}</div>
                      <div class="text-xs text-slate-500 flex flex-wrap gap-2 items-center">
                        <span class="badge-primary capitalize">{doc.type}</span>
                        <span class="badge-info capitalize">{doc.visibility}</span>
                      </div>
                      {#if doc.summary}
                        <div class="text-[11px] text-slate-400 mt-1 truncate">{doc.summary}</div>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      {#if doc.contentType === 'link' && doc.externalUrl}
                        <a
                          class="text-xs font-semibold text-blue-600 hover:underline"
                          href={doc.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {$_('docs.openLink')}
                        </a>
                      {:else if doc.contentType === 'file' && doc.files?.length}
                        <Button
                          size="sm"
                          variant="secondary"
                          onclick={() => void downloadDocumentFile(doc.id, doc.files[0].id)}
                          aria-label="Download document"
                        >
                          <Download class="w-4 h-4" />
                        </Button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
    {:else if activeTab === 'specs'}
      <!-- ─── Specs tab ─── -->
      <div class="card p-4 sm:p-5">
        <div class="mb-4 pb-3 border-b border-border flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold">{$isLoading ? 'Technical Specifications' : $_('assets.specifications')}</h2>
          {#if caps.canManageAssets}
            {#if !specsEditMode}
              <Button size="sm" variant="secondary" onclick={startSpecsEdit}>{$_('assets.edit')}</Button>
            {:else}
              <div class="flex items-center gap-2">
                <Button size="sm" variant="secondary" onclick={cancelSpecsEdit} disabled={specsSaving}>{$_('common.cancel')}</Button>
                <Button size="sm" onclick={saveSpecs} disabled={specsSaving}>{specsSaving ? $_('common.loading') : $_('common.save')}</Button>
              </div>
            {/if}
          {/if}
        </div>
        {#if formError && specsEditMode}
          <div class="alert alert-error mb-3">{formError}</div>
        {/if}
        {#if specDefsLoading}
          <div class="flex items-center justify-center py-10">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if !asset?.spec || Object.keys(asset.spec).length === 0}
          <p class="text-sm text-slate-500">{$isLoading ? 'No specifications recorded.' : $_('assets.noSpecsDefined')}</p>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {#each specDefs.length > 0 ? specDefs.filter(d => asset?.spec && d.key in asset.spec) : Object.keys(asset.spec).map(k => ({ key: k, label: k, unit: null })) as def}
              <div class="flex flex-col gap-0.5">
                <span class="text-slate-500 capitalize">{def.label}{def.unit ? ` (${def.unit})` : ''}</span>
                {#if specsEditMode}
                  {#if getSpecFieldType(def.key) === 'boolean'}
                    <select class="select-base" bind:value={specDraft[def.key]}>
                      <option value={true}>true</option>
                      <option value={false}>false</option>
                    </select>
                  {:else if getSpecFieldType(def.key) === 'enum' && getSpecEnumValues(def.key).length}
                    <select class="select-base" bind:value={specDraft[def.key]}>
                      <option value="">-</option>
                      {#each getSpecEnumValues(def.key) as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  {:else if getSpecFieldType(def.key) === 'number'}
                    <input class="input-base" type="number" bind:value={specDraft[def.key]} />
                  {:else}
                    <input class="input-base" bind:value={specDraft[def.key]} />
                  {/if}
                {:else}
                  <span class="font-medium text-slate-100 break-all">{String(asset.spec[def.key] ?? '-')}</span>
                {/if}
              </div>
            {/each}
            {#if specDefs.length > 0}
              {#each Object.keys(asset.spec).filter(k => !specDefs.some(d => d.key === k)) as extraKey}
                <div class="flex flex-col gap-0.5">
                  <span class="text-slate-500 capitalize">{extraKey}</span>
                  <span class="font-medium text-slate-100 break-all">{String(asset.spec[extraKey] ?? '-')}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'lifecycle'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-base font-semibold">{$isLoading ? 'Assignments' : $_('assets.assignments')}</h2>
              {#if caps.canManageAssets}
                <div class="flex gap-2">
                  <Button size="sm" onclick={() => showAssignModal = true}>
                    <UserPlus class="w-3.5 h-3.5 mr-1" /> {$isLoading ? 'Assign' : $_('assets.assign')}
                  </Button>
                  <Button size="sm" variant="secondary" onclick={() => showReturnModal = true}>
                    <Undo2 class="w-3.5 h-3.5 mr-1" /> {$isLoading ? 'Return' : $_('assets.return')}
                  </Button>
                </div>
              {/if}
            </div>
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>{$isLoading ? 'Assignee' : $_('assets.assignee')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Type' : $_('assets.assigneeType')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Assigned' : $_('assets.assignedAt')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Returned' : $_('assets.returnedAt')}</TableHeaderCell>
                </tr>
              </TableHeader>
              <tbody>
                {#each assignments as item}
                  <TableRow>
                    <TableCell>{item.assigneeName}</TableCell>
                    <TableCell>{item.assigneeType}</TableCell>
                    <TableCell>{formatDate(item.assignedAt)}</TableCell>
                    <TableCell>{item.returnedAt ? formatDate(item.returnedAt) : '-'}</TableCell>
                  </TableRow>
                {/each}
              </tbody>
            </Table>
          </div>
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4">{$isLoading ? 'Timeline' : $_('assets.timeline')}</h2>
            <AssetTimeline events={timeline} />
            <div class="mt-5 border-t border-border pt-4">
              <h3 class="text-sm font-semibold mb-3">{$isLoading ? 'Quick Change History' : $_('assets.lifecycleDiff.title')}</h3>
              {#if lifecycleDiffEvents.length === 0}
                <p class="text-xs text-slate-500">{$isLoading ? 'No detailed change payload available yet.' : $_('assets.lifecycleDiff.empty')}</p>
              {:else}
                <div class="space-y-3">
                  {#each lifecycleDiffEvents as event (event.id)}
                    <div class="rounded-md border border-border p-2.5">
                      <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xs font-semibold uppercase text-slate-400">{event.eventType}</span>
                        <span class="text-xs text-slate-500">{formatDateTime(event.at)}</span>
                      </div>
                      {#if event.changes.length === 0}
                        <div class="text-xs text-slate-500">{$isLoading ? 'No before/after payload in this event.' : $_('assets.lifecycleDiff.noPayload')}</div>
                      {:else}
                        <div class="space-y-1.5">
                          {#each event.changes.slice(0, 6) as item}
                            <div class="text-xs grid grid-cols-1 gap-0.5">
                              <span class="text-slate-400">{item.field}</span>
                              <span class="text-slate-500">{item.before} → <span class="text-slate-200">{item.after}</span></span>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
    {:else if activeTab === 'repairs'}
      <!-- ─── Repairs tab ─── -->
      <div class="space-y-3">
        {#if caps.canManageAssets}
          <div class="flex justify-end">
            <Button size="sm" onclick={() => { showRepairModal = true; repairError = ''; }}>
              <Wrench class="w-3.5 h-3.5 mr-1" /> {$isLoading ? 'Create Repair Order' : $_('assets.repairOrders.createBtn')}
            </Button>
          </div>
        {/if}
        {#if repairOrdersLoading}
          <div class="flex items-center justify-center py-10">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if repairOrders.length === 0}
          <div class="card p-8 text-center">
            <PackageOpen class="h-10 w-10 mx-auto mb-3 text-slate-600" />
            <p class="text-sm text-slate-500">{$isLoading ? 'No repair orders.' : $_('assets.repairOrders.empty')}</p>
          </div>
        {:else}
          {#each repairOrders as order (order.id)}
            <div class="card p-3 sm:p-4">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 text-left"
                onclick={() => toggleRepairParts(order.id)}
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class={order.status === 'closed' ? 'badge-success' : order.status === 'canceled' ? 'badge-error' : 'badge-warning'}>
                    {order.status}
                  </span>
                  <span class="font-medium text-slate-100 truncate">{order.title}</span>
                  <span class="text-xs text-slate-500 shrink-0">{formatDate(order.openedAt)}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0 text-slate-400">
                  {#if order.laborCost || order.partsCost}
                    <span class="text-xs">{((order.laborCost ?? 0) + (order.partsCost ?? 0)).toLocaleString()} đ</span>
                  {/if}
                  {#if expandedRepairOrder === order.id}
                    <ChevronDown class="h-4 w-4" />
                  {:else}
                    <ChevronRight class="h-4 w-4" />
                  {/if}
                </div>
              </button>

              {#if expandedRepairOrder === order.id}
                <div class="mt-4 pt-4 border-t border-border space-y-3 text-sm">
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-400">
                    <div><span class="block text-xs text-slate-500">{$isLoading ? 'Type' : $_('assets.repairOrders.type')}</span>{order.repairType}</div>
                    <div><span class="block text-xs text-slate-500">{$isLoading ? 'Technician' : $_('assets.repairOrders.technician')}</span>{order.technicianName || '-'}</div>
                    <div><span class="block text-xs text-slate-500">{$isLoading ? 'Downtime' : $_('assets.repairOrders.downtime')}</span>{order.downtimeMinutes ? `${order.downtimeMinutes} min` : '-'}</div>
                  </div>
                  {#if order.diagnosis}
                    <div><span class="text-xs text-slate-500 block">{$isLoading ? 'Diagnosis' : $_('assets.repairOrders.diagnosis')}</span><p class="text-slate-300">{order.diagnosis}</p></div>
                  {/if}
                  {#if order.resolution}
                    <div><span class="text-xs text-slate-500 block">{$isLoading ? 'Resolution' : $_('assets.repairOrders.resolution')}</span><p class="text-slate-300">{order.resolution}</p></div>
                  {/if}
                  {#if repairParts[order.id]}
                    {#if repairParts[order.id].length === 0}
                      <p class="text-xs text-slate-500 italic">{$isLoading ? 'No parts used.' : $_('assets.repairOrders.noParts')}</p>
                    {:else}
                      <div>
                        <span class="text-xs text-slate-500 font-semibold block mb-2">{$isLoading ? 'Parts used' : $_('assets.repairOrders.parts')}</span>
                        <Table>
                          <TableHeader>
                            <tr>
                              <TableHeaderCell>{$isLoading ? 'Part' : $_('assets.repairOrders.partName')}</TableHeaderCell>
                              <TableHeaderCell>{$isLoading ? 'Action' : $_('assets.repairOrders.partAction')}</TableHeaderCell>
                              <TableHeaderCell>{$isLoading ? 'Qty' : $_('assets.repairOrders.partQty')}</TableHeaderCell>
                              <TableHeaderCell>{$isLoading ? 'Serial' : $_('assets.serialNumber')}</TableHeaderCell>
                              <TableHeaderCell>{$isLoading ? 'Cost' : $_('assets.repairOrders.partCost')}</TableHeaderCell>
                            </tr>
                          </TableHeader>
                          <tbody>
                            {#each repairParts[order.id] as part}
                              <TableRow>
                                <TableCell>{part.partName || part.partId || '-'}</TableCell>
                                <TableCell><span class="badge-primary capitalize">{part.action}</span></TableCell>
                                <TableCell>{part.qty}</TableCell>
                                <TableCell>{part.serialNo || '-'}</TableCell>
                                <TableCell>{part.unitCost ? `${part.unitCost.toLocaleString()} đ` : '-'}</TableCell>
                              </TableRow>
                            {/each}
                          </tbody>
                        </Table>
                      </div>
                    {/if}
                  {:else}
                    <button type="button" class="text-xs text-primary hover:underline" onclick={() => toggleRepairParts(order.id)}>
                      {$isLoading ? 'Load parts...' : $_('assets.repairOrders.loadParts')}
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {:else if activeTab === 'maintenance'}
        <div class="card p-4 sm:p-5">
          <div class="flex items-center justify-between gap-2 mb-4">
            <h2 class="text-base font-semibold">{$isLoading ? 'Maintenance' : $_('maintenance.title')}</h2>
            {#if caps.canManageAssets}
              <Button size="sm" onclick={() => showMaintenanceModal = true}>
                <Wrench class="w-3.5 h-3.5 mr-1" /> {$isLoading ? 'New Ticket' : $_('maintenance.openMaintenance', { values: { assetCode: '' } }).replace('()', '').trim()}
              </Button>
            {/if}
          </div>
          {#if maintenance.length === 0}
            <div class="alert alert-info">{$isLoading ? 'No maintenance records yet.' : $_('assets.maintenanceEmpty')}</div>
          {:else}
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>{$isLoading ? 'Title' : $_('maintenance.titleLabel')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Severity' : $_('maintenance.severity')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
                  <TableHeaderCell>{$isLoading ? 'Opened' : $_('maintenance.openedAt')}</TableHeaderCell>
                </tr>
              </TableHeader>
              <tbody>
                {#each maintenance as item}
                  <TableRow>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.severity}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{formatDate(item.openedAt)}</TableCell>
                  </TableRow>
                {/each}
              </tbody>
            </Table>
          {/if}
        </div>
    {:else if activeTab === 'warranty'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4 pb-3 border-b border-border">{$isLoading ? 'Warranty' : $_('assets.warranty')}</h2>
            <div class="space-y-2 text-sm text-slate-400">
              <div class="flex items-center justify-between">
                <span>{$_('assets.purchaseDate')}</span>
                <span class="font-medium">{formatDate(asset.purchaseDate)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.warrantyEnd')}</span>
                <span class="font-medium">{formatDate(asset.warrantyEnd)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.warrantyRemaining')}</span>
                <span class="font-medium">{warrantyDaysLeft ?? '-'}</span>
              </div>
            </div>
            {#if caps.isAdmin}
              <div class="mt-4 flex items-center gap-2">
                <Button size="sm" onclick={handleRunWarrantyReminders} disabled={remindersLoading}>
                  {remindersLoading ? $_('common.loading') : $_('assets.runWarrantyReminders')}
                </Button>
              </div>
            {/if}
            <div class="mt-4 space-y-2">
              {#if reminders.length === 0}
                <p class="text-sm text-slate-500">{$_('assets.remindersEmpty')}</p>
              {:else}
                {#each reminders as reminder}
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-slate-400">{reminder.reminderType}</span>
                    <span class="font-medium">{formatDate(reminder.dueAt)}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4 pb-3 border-b border-border">{$isLoading ? 'Depreciation' : $_('assets.depreciation.title')}</h2>
            <div class="grid grid-cols-1 gap-3 text-sm">
              <div>
                <label class="label-base mb-2" for="depr-cost">{$_('assets.depreciation.cost')}</label>
                <input id="depr-cost" class="input-base" bind:value={purchaseCost} placeholder="12000000" />
              </div>
              <div>
                <label class="label-base mb-2" for="depr-years">{$_('assets.depreciation.years')}</label>
                <select id="depr-years" class="select-base" bind:value={usefulLifeYears}>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.depreciation.annual')}</span>
                <span class="font-medium">{depreciation.annual.toFixed(0)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>{$_('assets.depreciation.monthly')}</span>
                <span class="font-medium">{depreciation.monthly.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

    {:else if activeTab === 'inventory' && caps.canManageAssets}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4">{$isLoading ? 'Sessions' : $_('assets.inventory.sessions')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="md:col-span-2">
                <label class="label-base mb-2" for="inv-session-name">{$_('assets.inventory.sessionName')}</label>
                <input id="inv-session-name" class="input-base" bind:value={newSessionName} placeholder={$_('assets.inventory.sessionNamePlaceholder')} />
              </div>
              <div>
                <label class="label-base mb-2" for="inv-session-location">{$_('assets.inventory.sessionLocation')}</label>
                <select id="inv-session-location" class="select-base" bind:value={newSessionLocationId}>
                  <option value="">{$_('assets.placeholders.selectLocation')}</option>
                  {#each locations as location}
                    <option value={location.id}>{location.name}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <Button size="sm" onclick={handleCreateSession} disabled={!newSessionName || creatingSession}>
                {creatingSession ? $_('common.loading') : $_('assets.inventory.createSession')}
              </Button>
              <Button size="sm" variant="secondary" onclick={handleCloseSession} disabled={!activeInventorySessionId}>
                {$_('assets.inventory.closeSession')}
              </Button>
            </div>
            <div class="mt-4">
              <label class="label-base mb-2" for="inv-session-select">{$_('assets.inventory.sessionSelect')}</label>
              <select id="inv-session-select" class="select-base" bind:value={activeInventorySessionId}>
                <option value="">{$_('assets.inventory.selectSession')}</option>
                {#each inventorySessions as session}
                  <option value={session.id}>{session.name} - {session.status}</option>
                {/each}
              </select>
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
              {#each Object.entries(inventoryCounts) as [status, count]}
                <span class="badge-primary">{status}: {count}</span>
              {/each}
            </div>
          </div>
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4">{$isLoading ? 'Quick scan' : $_('assets.inventory.quickScan')}</h2>
            <InventoryScanPanel
              sessionId={activeInventorySessionId}
              {locations}
              onscanned={() => loadInventorySessionDetail(activeInventorySessionId)}
            />
          </div>
        </div>
        <div class="mt-6">
          <div class="card p-4 sm:p-5">
            <h2 class="text-base font-semibold mb-4">{$isLoading ? 'Inventory items' : $_('assets.inventory.items')}</h2>
            {#if inventoryLoading}
              <div class="flex items-center justify-center p-8"><div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
            {:else if inventoryItems.length === 0}
              <p class="text-sm text-slate-500">{$_('assets.inventory.empty')}</p>
            {:else}
              <Table>
                <TableHeader>
                  <tr>
                    <TableHeaderCell>{$isLoading ? 'Asset ID' : $_('assets.assetId')}</TableHeaderCell>
                    <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
                    <TableHeaderCell>{$isLoading ? 'Scanned At' : $_('assets.inventory.scannedAt')}</TableHeaderCell>
                  </tr>
                </TableHeader>
                <tbody>
                  {#each inventoryItems as item}
                    <TableRow>
                      <TableCell>{item.assetId || '-'}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{formatDateTime(item.scannedAt)}</TableCell>
                    </TableRow>
                  {/each}
                </tbody>
              </Table>
            {/if}
          </div>
        </div>
    {:else if activeTab === 'software'}
      <!-- ─── Software / Licenses tab ─── -->
      <div class="card p-4 sm:p-5">
        <div class="flex items-center justify-between gap-2 mb-4">
          <h2 class="text-base font-semibold">{$isLoading ? 'Software & Licenses' : $_('assets.tabs.software')}</h2>
          <a href="/licenses" class="btn-sm btn-secondary inline-flex items-center gap-1 text-xs">
            {$isLoading ? 'Manage Licenses →' : $_('assets.software.manageLink')}
          </a>
        </div>
        {#if licensesLoading}
          <div class="flex items-center justify-center py-10">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        {:else if licenses.length === 0}
          <p class="text-sm text-slate-500">{$isLoading ? 'No software licenses assigned.' : $_('assets.software.empty')}</p>
        {:else}
          <Table>
            <TableHeader>
              <tr>
                <TableHeaderCell>{$isLoading ? 'Software' : $_('assets.software.name')}</TableHeaderCell>
                <TableHeaderCell>{$isLoading ? 'License Code' : $_('assets.software.licenseCode')}</TableHeaderCell>
                <TableHeaderCell>{$isLoading ? 'Type' : $_('assets.software.type')}</TableHeaderCell>
                <TableHeaderCell>{$isLoading ? 'Status' : $_('assets.status')}</TableHeaderCell>
                <TableHeaderCell>{$isLoading ? 'Expiry' : $_('assets.software.expiry')}</TableHeaderCell>
                <TableHeaderCell>{$isLoading ? 'Assigned' : $_('assets.assignedAt')}</TableHeaderCell>
              </tr>
            </TableHeader>
            <tbody>
              {#each licenses as lic (lic.seatId)}
                <TableRow>
                  <TableCell><span class="font-medium text-slate-100">{lic.softwareName}</span></TableCell>
                  <TableCell><code class="text-xs font-mono text-slate-300">{lic.licenseCode}</code></TableCell>
                  <TableCell>{lic.licenseType.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <span class={lic.status === 'active' ? 'badge-success' : lic.status === 'expired' ? 'badge-error' : 'badge-primary'}>
                      {lic.status}
                    </span>
                  </TableCell>
                  <TableCell>{lic.expiryDate ? formatDate(lic.expiryDate) : '—'}</TableCell>
                  <TableCell>{formatDate(lic.assignedAt)}</TableCell>
                </TableRow>
              {/each}
            </tbody>
          </Table>
        {/if}
      </div>
    {:else if activeTab === 'components'}
        <AssetComponentsPanel
          assetId={asset.id}
          bind:components={assetComponents}
          canManage={caps.canManageAssets}
        />
    {:else if activeTab === 'attachments'}
        <div class="card p-4 sm:p-5">
          <h2 class="text-base font-semibold mb-4 pb-3 border-b border-border">{$isLoading ? 'Attachments' : $_('assets.attachments')}</h2>
          {#if caps.canManageAssets}
            <AttachmentUploader assetId={asset.id} onuploaded={loadDetail} />
          {/if}
          <div class="mt-4">
            <AttachmentList assetId={asset.id} attachments={attachments} />
          </div>
        </div>
    {:else if activeTab === 'compliance'}
        <div class="card p-4 sm:p-5">
          <h2 class="text-base font-semibold mb-4 pb-3 border-b border-border">{$isLoading ? 'Evidence pack' : $_('assets.compliance.title')}</h2>
          <p class="text-sm text-slate-500 mb-4">{$isLoading ? 'Download audit evidence for this asset.' : $_('assets.compliance.subtitle')}</p>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>{$_('assets.compliance.attachments')}: {attachments.length}</span>
            <span>{$_('assets.compliance.timeline')}: {timeline.length}</span>
            <span>{$_('assets.compliance.maintenance')}: {maintenance.length}</span>
          </div>
          <Button class="mt-4" onclick={downloadEvidencePack}>
            <Download class="w-4 h-4 mr-2" /> {$isLoading ? 'Download' : $_('assets.compliance.download')}
          </Button>
        </div>
    {/if}
  {/if}
</div>
{#if caps.canManageAssets}
  <AssignModal bind:open={showAssignModal} assetCode={asset?.assetCode || ''} onassign={handleAssign} />
  <MaintenanceModal bind:open={showMaintenanceModal} assetCode={asset?.assetCode || ''} onsubmit={handleMaintenance} />
  <!-- Repair Order Creation Modal -->
  <Modal bind:open={showRepairModal} title={$isLoading ? 'Create Repair Order' : $_('assets.repairOrders.createBtn')}>
    <div class="space-y-4">
      {#if repairError}
        <div class="alert alert-error">{repairError}</div>
      {/if}
      <div>
        <label class="label-base mb-2" for="repair-title">{$isLoading ? 'Title' : $_('assets.repairOrders.title')}</label>
        <input id="repair-title" class="input-base" bind:value={repairTitle} placeholder={$isLoading ? 'Repair summary...' : $_('assets.repairOrders.titlePlaceholder')} />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label-base mb-2" for="repair-severity">{$isLoading ? 'Severity' : $_('assets.repairOrders.severity')}</label>
          <select id="repair-severity" class="select-base" bind:value={repairSeverity}>
            <option value="low">{$isLoading ? 'Low' : $_('maintenance.low')}</option>
            <option value="medium">{$isLoading ? 'Medium' : $_('maintenance.medium')}</option>
            <option value="high">{$isLoading ? 'High' : $_('maintenance.high')}</option>
            <option value="critical">{$isLoading ? 'Critical' : $_('maintenance.critical')}</option>
          </select>
        </div>
        <div>
          <label class="label-base mb-2" for="repair-type">{$isLoading ? 'Type' : $_('assets.repairOrders.type')}</label>
          <select id="repair-type" class="select-base" bind:value={repairType}>
            <option value="internal">{$isLoading ? 'Internal' : $_('assets.repairOrders.internal')}</option>
            <option value="vendor">{$isLoading ? 'Vendor' : $_('assets.repairOrders.vendor')}</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label-base mb-2" for="repair-technician">{$isLoading ? 'Technician' : $_('assets.repairOrders.technician')}</label>
        <input id="repair-technician" class="input-base" bind:value={repairTechnician} placeholder={$isLoading ? 'Technician name (optional)' : $_('assets.repairOrders.technicianPlaceholder')} />
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <Button variant="secondary" onclick={() => showRepairModal = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button disabled={repairCreating || !repairTitle} onclick={handleCreateRepair}>
        {repairCreating ? ($isLoading ? 'Creating...' : $_('common.loading')) : ($isLoading ? 'Create' : $_('common.save'))}
      </Button>
    </div>
  </Modal>
  <Modal bind:open={showReturnModal} title={$isLoading ? 'Return Asset' : $_('assets.returnAsset')}>
    <div class="space-y-4">
      <div>
        <label class="label-base mb-2" for="return-note">{$isLoading ? 'Return Note' : $_('assets.returnNote')}</label>
        <input id="return-note" class="input-base" bind:value={returnNote} placeholder={$isLoading ? 'Optional note' : $_('assets.placeholders.returnNote')} />
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <Button variant="secondary" onclick={() => showReturnModal = false}>{$isLoading ? 'Cancel' : $_('common.cancel')}</Button>
      <Button onclick={handleReturn} disabled={returning}>
        {returning ? ($isLoading ? 'Returning...' : $_('assets.returning')) : ($isLoading ? 'Return' : $_('assets.return'))}
      </Button>
    </div>
  </Modal>
{/if}

