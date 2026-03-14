<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BienBanKiemKeData = {
    date: string
    auditNo?: string
    location?: string
    department?: string
    period?: string
    items: Array<{
      stt: number
      assetCode: string
      assetName: string
      serialNo?: string
      category?: string
      location?: string
      statusExpected: string
      statusFound?: string
      isMatched: boolean
      note?: string
    }>
    totalExpected: number
    totalFound: number
    totalMatched: number
    totalMissing: number
    totalExtra: number
    inspector: string
    witness?: string
    note?: string
  }

  type Props = { data: BienBanKiemKeData; org?: OrgInfo }
  let { data, org }: Props = $props()
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BIÊN BẢN KIỂM KÊ TÀI SẢN"
    formNo={data.auditNo}
    formDate={data.date}
  />

  <div class="print-info-grid">
    {#if data.location}<div class="print-info-row"><span class="print-label">Địa điểm kiểm kê:</span> <span>{data.location}</span></div>{/if}
    {#if data.department}<div class="print-info-row"><span class="print-label">Bộ phận / Phòng ban:</span> <span>{data.department}</span></div>{/if}
    {#if data.period}<div class="print-info-row"><span class="print-label">Kỳ kiểm kê:</span> <span>{data.period}</span></div>{/if}
    <div class="print-info-row"><span class="print-label">Người kiểm kê:</span> <span>{data.inspector}</span></div>
    {#if data.witness}<div class="print-info-row"><span class="print-label">Người chứng kiến:</span> <span>{data.witness}</span></div>{/if}
  </div>

  <table class="print-table mt-3">
    <thead>
      <tr>
        <th style="width:3%">STT</th>
        <th style="width:12%">Mã TS</th>
        <th>Tên tài sản</th>
        <th style="width:10%">Serial</th>
        <th style="width:12%">Vị trí</th>
        <th style="width:10%">TT sổ sách</th>
        <th style="width:10%">TT thực tế</th>
        <th style="width:8%">Khớp</th>
        <th style="width:12%">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      {#each data.items as item}
        <tr class={item.isMatched ? '' : 'print-row-mismatch'}>
          <td class="text-center">{item.stt}</td>
          <td>{item.assetCode}</td>
          <td>{item.assetName}</td>
          <td>{item.serialNo ?? ''}</td>
          <td>{item.location ?? ''}</td>
          <td>{item.statusExpected}</td>
          <td>{item.statusFound ?? '—'}</td>
          <td class="text-center">{item.isMatched ? '✓' : '✗'}</td>
          <td>{item.note ?? ''}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="print-section mt-3">
    <h3 class="print-section-title">TỔNG HỢP KẾT QUẢ KIỂM KÊ</h3>
    <table class="print-table" style="max-width: 50%">
      <tbody>
        <tr><td class="print-label-cell">Tổng số tài sản theo sổ sách</td><td class="text-right"><strong>{data.totalExpected}</strong></td></tr>
        <tr><td class="print-label-cell">Tổng số tài sản thực tế</td><td class="text-right"><strong>{data.totalFound}</strong></td></tr>
        <tr><td class="print-label-cell">Số tài sản khớp</td><td class="text-right">{data.totalMatched}</td></tr>
        <tr><td class="print-label-cell" style="color:#c00">Số tài sản không tìm thấy</td><td class="text-right" style="color:#c00">{data.totalMissing}</td></tr>
        <tr><td class="print-label-cell" style="color:#c60">Số tài sản phát sinh thêm</td><td class="text-right" style="color:#c60">{data.totalExtra}</td></tr>
      </tbody>
    </table>
  </div>

  {#if data.note}
    <div class="print-info-row mt-2"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người kiểm kê', name: data.inspector },
      { label: 'Người chứng kiến', name: data.witness },
      { label: 'Kế toán tài sản', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Lãnh đạo phê duyệt', title: '(Ký, đóng dấu)' },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
