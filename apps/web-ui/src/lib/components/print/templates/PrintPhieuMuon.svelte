<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type PhieuMuonData = {
    date: string
    loanNo?: string
    borrower: string
    department?: string
    borrowerId?: string
    purpose: string
    expectedReturnDate: string
    items: Array<{
      stt: number
      assetCode: string
      assetName: string
      serialNo?: string
      condition?: string
      note?: string
    }>
    lenderName?: string
    note?: string
  }

  type Props = { data: PhieuMuonData; org?: OrgInfo }
  let { data, org }: Props = $props()
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="PHIẾU MƯỢN THIẾT BỊ"
    formNo={data.loanNo}
    formDate={data.date}
  />

  <div class="print-info-grid">
    <div class="print-info-row">
      <span class="print-label">Người mượn:</span>
      <span>{data.borrower}{data.department ? ` — ${data.department}` : ''}</span>
    </div>
    {#if data.borrowerId}
      <div class="print-info-row"><span class="print-label">Mã NV / MSSV:</span> <span>{data.borrowerId}</span></div>
    {/if}
    <div class="print-info-row"><span class="print-label">Mục đích mượn:</span> <span>{data.purpose}</span></div>
    <div class="print-info-row"><span class="print-label">Dự kiến trả trước ngày:</span> <span><strong>{data.expectedReturnDate}</strong></span></div>
    {#if data.lenderName}
      <div class="print-info-row"><span class="print-label">Người cho mượn (IT):</span> <span>{data.lenderName}</span></div>
    {/if}
  </div>

  <table class="print-table mt-3">
    <thead>
      <tr>
        <th style="width:5%">STT</th>
        <th style="width:15%">Mã thiết bị</th>
        <th>Tên thiết bị</th>
        <th style="width:15%">Số serial</th>
        <th style="width:15%">Tình trạng khi mượn</th>
        <th style="width:15%">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      {#each data.items as item}
        <tr>
          <td class="text-center">{item.stt}</td>
          <td>{item.assetCode}</td>
          <td>{item.assetName}</td>
          <td>{item.serialNo ?? ''}</td>
          <td>{item.condition ?? 'Tốt'}</td>
          <td>{item.note ?? ''}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if data.note}
    <div class="print-info-row mt-2"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <div class="mt-4 print-note-box">
    <p><strong>Lưu ý:</strong> Người mượn có trách nhiệm bảo quản thiết bị và hoàn trả đúng hạn và tình trạng như khi mượn.
    Mọi hư hỏng do lỗi chủ quan sẽ do người mượn chịu trách nhiệm bồi thường.</p>
  </div>

  <PrintSignatures
    signers={[
      { label: 'Người mượn', name: data.borrower },
      { label: 'Người cho mượn', name: data.lenderName },
      { label: 'Quản lý phê duyệt', title: '(Ký, ghi rõ họ tên)' },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
