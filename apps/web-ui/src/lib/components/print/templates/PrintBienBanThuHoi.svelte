<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BienBanThuHoiData = {
    date: string
    recallNo?: string
    asset: {
      code: string
      name: string
      serialNo?: string
      model?: string
      brand?: string
      category?: string
      location?: string
    }
    fromPerson: string
    fromDepartment?: string
    toPerson?: string
    toWarehouse?: string
    reason: string
    condition?: string
    accessories?: string[]
    note?: string
  }

  type Props = { data: BienBanThuHoiData; org?: OrgInfo }
  let { data, org }: Props = $props()
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BIÊN BẢN THU HỒI THIẾT BỊ"
    formNo={data.recallNo}
    formDate={data.date}
  />

  <p class="print-preamble">
    Hôm nay, ngày {new Date(data.date).getDate()} tháng {new Date(data.date).getMonth() + 1} năm {new Date(data.date).getFullYear()},
    chúng tôi lập biên bản thu hồi thiết bị như sau:
  </p>

  <div class="print-section">
    <h3 class="print-section-title">I. THÔNG TIN THIẾT BỊ</h3>
    <table class="print-table">
      <tbody>
        <tr><td class="print-label-cell" style="width:35%">Mã thiết bị</td><td>{data.asset.code}</td></tr>
        <tr><td class="print-label-cell">Tên thiết bị</td><td>{data.asset.name}</td></tr>
        {#if data.asset.model}<tr><td class="print-label-cell">Model</td><td>{data.asset.model}{data.asset.brand ? ` — ${data.asset.brand}` : ''}</td></tr>{/if}
        {#if data.asset.serialNo}<tr><td class="print-label-cell">Số serial</td><td>{data.asset.serialNo}</td></tr>{/if}
        {#if data.asset.category}<tr><td class="print-label-cell">Danh mục</td><td>{data.asset.category}</td></tr>{/if}
        <tr><td class="print-label-cell">Tình trạng</td><td>{data.condition ?? '...................................................'}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">II. THÔNG TIN THU HỒI</h3>
    <div class="print-info-grid">
      <div class="print-info-row">
        <span class="print-label">Bên giao (người sử dụng):</span>
        <span>{data.fromPerson}{data.fromDepartment ? ` — ${data.fromDepartment}` : ''}</span>
      </div>
      <div class="print-info-row">
        <span class="print-label">Bên nhận:</span>
        <span>{data.toPerson ?? data.toWarehouse ?? 'Phòng IT / Kho'}</span>
      </div>
      <div class="print-info-row">
        <span class="print-label">Lý do thu hồi:</span>
        <span>{data.reason}</span>
      </div>
      {#if data.note}
        <div class="print-info-row"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
      {/if}
    </div>
  </div>

  {#if data.accessories && data.accessories.length > 0}
    <div class="print-section">
      <h3 class="print-section-title">III. PHỤ KIỆN KÈM THEO</h3>
      <ul class="print-list">
        {#each data.accessories as item}
          <li>{item}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người giao', name: data.fromPerson },
      { label: 'Người chứng nhận', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Người nhận', name: data.toPerson },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
