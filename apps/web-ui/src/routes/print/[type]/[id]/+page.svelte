<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { orgStore } from '$lib/stores/orgStore'
  import { getCapabilities } from '$lib/auth/capabilities'
  import { printTemplate, buildPrintCssVariables } from '$lib/stores/printTemplateStore'
  import { decodePrintData, PRINT_LABELS, type PrintType } from '$lib/utils/printUtils'
  import { getStockDocument } from '$lib/api/warehouse'
  import { getAssetDetail } from '$lib/api/assets'

  import PrintPhieuNhapKho from '$lib/components/print/templates/PrintPhieuNhapKho.svelte'
  import PrintPhieuXuatKho from '$lib/components/print/templates/PrintPhieuXuatKho.svelte'
  import PrintBienBanBanGiao from '$lib/components/print/templates/PrintBienBanBanGiao.svelte'
  import PrintBienBanLuanChuyen from '$lib/components/print/templates/PrintBienBanLuanChuyen.svelte'
  import PrintBienBanThuHoi from '$lib/components/print/templates/PrintBienBanThuHoi.svelte'
  import PrintLenhSuaChua from '$lib/components/print/templates/PrintLenhSuaChua.svelte'
  import PrintBienBanKiemKe from '$lib/components/print/templates/PrintBienBanKiemKe.svelte'
  import PrintPhieuMuon from '$lib/components/print/templates/PrintPhieuMuon.svelte'
  import PrintBienBanThanhLy from '$lib/components/print/templates/PrintBienBanThanhLy.svelte'
  import PrintPhieuYeuCauMuaSam from '$lib/components/print/templates/PrintPhieuYeuCauMuaSam.svelte'
  import PrintBaoCaoTaiSan from '$lib/components/print/templates/PrintBaoCaoTaiSan.svelte'

  import type { PhieuNhapKhoData } from '$lib/components/print/templates/PrintPhieuNhapKho.svelte'
  import type { PhieuXuatKhoData } from '$lib/components/print/templates/PrintPhieuXuatKho.svelte'
  import type { BienBanBanGiaoData } from '$lib/components/print/templates/PrintBienBanBanGiao.svelte'
  import type { BienBanLuanChuyenData } from '$lib/components/print/templates/PrintBienBanLuanChuyen.svelte'
  import type { BienBanThuHoiData } from '$lib/components/print/templates/PrintBienBanThuHoi.svelte'
  import type { LenhSuaChuaData } from '$lib/components/print/templates/PrintLenhSuaChua.svelte'
  import type { BienBanKiemKeData } from '$lib/components/print/templates/PrintBienBanKiemKe.svelte'
  import type { PhieuMuonData } from '$lib/components/print/templates/PrintPhieuMuon.svelte'
  import type { BienBanThanhLyData } from '$lib/components/print/templates/PrintBienBanThanhLy.svelte'
  import type { PhieuYeuCauMuaSamData } from '$lib/components/print/templates/PrintPhieuYeuCauMuaSam.svelte'
  import type { BaoCaoTaiSanData } from '$lib/components/print/templates/PrintBaoCaoTaiSan.svelte'

  type AnyData =
    | PhieuNhapKhoData
    | PhieuXuatKhoData
    | BienBanBanGiaoData
    | BienBanLuanChuyenData
    | BienBanThuHoiData
    | LenhSuaChuaData
    | BienBanKiemKeData
    | PhieuMuonData
    | BienBanThanhLyData
    | PhieuYeuCauMuaSamData
    | BaoCaoTaiSanData

  const type = $derived(page.params.type as PrintType)
  const id = $derived(page.params.id ?? '')

  let loading = $state(true)
  let error = $state<string | null>(null)
  let printData = $state<AnyData | null>(null)
  let role = $state('')

  const org = $derived($orgStore)
  const template = $derived($printTemplate)
  const printStyleVars = $derived(buildPrintCssVariables(template))
  const capabilities = $derived(getCapabilities(role))

  const formTitle = $derived(PRINT_LABELS[type] ?? type)

  onMount(async () => {
    // Load org info
    orgStore.loadFromStorage()
    printTemplate.init()
    role = localStorage.getItem('userRole') ?? ''

    // Try to decode data from URL first
    const decoded = decodePrintData<AnyData>(page.url.searchParams)
    if (decoded) {
      printData = decoded
      loading = false
      return
    }

    // Otherwise fetch from API based on type
    try {
      if (type === 'phieu-nhap-kho' || type === 'phieu-xuat-kho') {
        const res = await getStockDocument(id)
        if (res.data) {
          const doc = res.data.document
          const lines = res.data.lines.map((l, i) => ({
            stt: i + 1,
            partCode: l.partId,
            partName: `(part ${l.partId})`,
            qty: l.qty,
            unitCost: l.unitCost ?? undefined,
            total: l.unitCost ? l.qty * l.unitCost : undefined,
            serialNo: l.serialNo ?? undefined,
            note: l.note ?? undefined,
          }))
          if (type === 'phieu-nhap-kho') {
            printData = {
              code: doc.code,
              date: doc.docDate,
              warehouseName: doc.warehouseId ?? 'Kho',
              supplier: doc.supplier ?? undefined,
              note: doc.note ?? undefined,
              lines,
              preparedBy: doc.submitterName ?? undefined,
              approvedBy: doc.approvedBy ?? undefined,
              receivedBy: doc.receiverName ?? undefined,
            } satisfies PhieuNhapKhoData
          } else {
            printData = {
              code: doc.code,
              date: doc.docDate,
              warehouseName: doc.warehouseId ?? 'Kho',
              recipient: doc.receiverName ?? undefined,
              department: doc.department ?? undefined,
              note: doc.note ?? undefined,
              lines,
              preparedBy: doc.submitterName ?? undefined,
              approvedBy: doc.approvedBy ?? undefined,
            } satisfies PhieuXuatKhoData
          }
        }
      } else if (type === 'bien-ban-ban-giao' || type === 'bien-ban-thu-hoi') {
        const res = await getAssetDetail(id)
        if (res.data) {
          const asset = res.data.asset
          const lastAssignment = res.data.assignments?.slice(-1)[0]
          const today = new Date().toISOString().slice(0, 10)
          if (type === 'bien-ban-ban-giao') {
            printData = {
              date: lastAssignment?.assignedAt?.slice(0, 10) ?? today,
              asset: {
                code: asset.assetCode,
                name: asset.modelName ?? asset.assetCode,
                serialNo: asset.serialNo ?? undefined,
                model: asset.modelName ?? undefined,
                brand: asset.modelBrand ?? undefined,
                category: asset.categoryName ?? undefined,
                location: asset.locationName ?? undefined,
              },
              toPerson: lastAssignment?.assigneeName ?? '',
            } satisfies BienBanBanGiaoData
          } else {
            printData = {
              date: lastAssignment?.returnedAt?.slice(0, 10) ?? today,
              asset: {
                code: asset.assetCode,
                name: asset.modelName ?? asset.assetCode,
                serialNo: asset.serialNo ?? undefined,
                model: asset.modelName ?? undefined,
                brand: asset.modelBrand ?? undefined,
                category: asset.categoryName ?? undefined,
              },
              fromPerson: lastAssignment?.assigneeName ?? '',
              reason: lastAssignment?.note ?? 'Thu hồi thiết bị',
            } satisfies BienBanThuHoiData
          }
        }
      } else {
        error = `Không thể tự động tải dữ liệu cho loại phiếu "${type}". Vui lòng truyền data=... qua URL.`
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <title>{formTitle}</title>
</svelte:head>

<div class="print-wrapper">
  <!-- Toolbar — hidden in actual print via .no-print -->
  <div class="print-toolbar no-print">
    <div class="print-toolbar-inner">
      <span class="print-toolbar-title">{formTitle}</span>
      <div class="print-toolbar-actions">
        {#if capabilities.reports.read}
          <a class="print-btn-secondary" href="/settings/print">Tuy chinh mau in</a>
        {/if}
        <button class="print-btn-print" onclick={() => window.print()}>🖨️ In / Xuất PDF</button>
        <button class="print-btn-close" onclick={() => window.close()}>✕ Đóng</button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="print-loading">Đang tải dữ liệu...</div>
  {:else if error}
    <div class="print-error">
      <strong>Lỗi:</strong> {error}
    </div>
  {:else if !printData}
    <div class="print-error">Không có dữ liệu để in. Vui lòng kiểm tra lại đường dẫn.</div>
  {:else}
    <div style={printStyleVars}>
      {#if type === 'phieu-nhap-kho'}
        <PrintPhieuNhapKho data={printData as PhieuNhapKhoData} {org} />
      {:else if type === 'phieu-xuat-kho'}
        <PrintPhieuXuatKho data={printData as PhieuXuatKhoData} {org} />
      {:else if type === 'bien-ban-ban-giao'}
        <PrintBienBanBanGiao data={printData as BienBanBanGiaoData} {org} />
      {:else if type === 'bien-ban-luan-chuyen'}
        <PrintBienBanLuanChuyen data={printData as BienBanLuanChuyenData} {org} />
      {:else if type === 'bien-ban-thu-hoi'}
        <PrintBienBanThuHoi data={printData as BienBanThuHoiData} {org} />
      {:else if type === 'lenh-sua-chua'}
        <PrintLenhSuaChua data={printData as LenhSuaChuaData} {org} />
      {:else if type === 'bien-ban-kiem-ke'}
        <PrintBienBanKiemKe data={printData as BienBanKiemKeData} {org} />
      {:else if type === 'phieu-muon'}
        <PrintPhieuMuon data={printData as PhieuMuonData} {org} />
      {:else if type === 'bien-ban-thanh-ly'}
        <PrintBienBanThanhLy data={printData as BienBanThanhLyData} {org} />
      {:else if type === 'yeu-cau-mua-sam'}
        <PrintPhieuYeuCauMuaSam data={printData as PhieuYeuCauMuaSamData} {org} />
      {:else if type === 'bao-cao-tai-san'}
        <PrintBaoCaoTaiSan data={printData as BaoCaoTaiSanData} {org} />
      {:else}
        <div class="print-error">Loại phiếu "<strong>{type}</strong>" không được hỗ trợ.</div>
      {/if}

      {#if template.footer.note.trim()}
        <div class="print-footer-note">{template.footer.note}</div>
      {/if}
    </div>
  {/if}
</div>
