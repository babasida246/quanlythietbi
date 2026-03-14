<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BienBanLuanChuyenData = {
    date: string
    transferNo?: string
    asset: {
      code: string
      name: string
      serialNo?: string
      model?: string
      brand?: string
      category?: string
    }
    fromLocation: string
    fromDepartment?: string
    fromPerson?: string
    toLocation: string
    toDepartment?: string
    toPerson?: string
    reason: string
    condition?: string
    note?: string
  }

  type Props = { data: BienBanLuanChuyenData; org?: OrgInfo }
  let { data, org }: Props = $props()
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BIÊN BẢN LUÂN CHUYỂN THIẾT BỊ"
    formNo={data.transferNo}
    formDate={data.date}
  />

  <p class="print-preamble">
    Hôm nay, ngày {new Date(data.date).getDate()} tháng {new Date(data.date).getMonth() + 1} năm {new Date(data.date).getFullYear()},
    chúng tôi lập biên bản luân chuyển thiết bị như sau:
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
        <tr><td class="print-label-cell">Tình trạng</td><td>{data.condition ?? 'Bình thường'}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">II. THÔNG TIN LUÂN CHUYỂN</h3>
    <table class="print-table">
      <tbody>
        <tr>
          <td class="print-label-cell" style="width:35%">Từ vị trí / bộ phận</td>
          <td>{data.fromLocation}{data.fromDepartment ? ` — ${data.fromDepartment}` : ''}{data.fromPerson ? ` (${data.fromPerson})` : ''}</td>
        </tr>
        <tr>
          <td class="print-label-cell">Đến vị trí / bộ phận</td>
          <td>{data.toLocation}{data.toDepartment ? ` — ${data.toDepartment}` : ''}{data.toPerson ? ` (${data.toPerson})` : ''}</td>
        </tr>
        <tr><td class="print-label-cell">Lý do luân chuyển</td><td>{data.reason}</td></tr>
        {#if data.note}<tr><td class="print-label-cell">Ghi chú</td><td>{data.note}</td></tr>{/if}
      </tbody>
    </table>
  </div>

  <p class="print-preamble">
    Biên bản này được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.
  </p>

  <PrintSignatures
    signers={[
      { label: 'Bên giao', name: data.fromPerson },
      { label: 'Người phê duyệt', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Bên nhận', name: data.toPerson },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
