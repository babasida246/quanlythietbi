<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type PhieuYeuCauMuaSamData = {
    date: string
    requestNo?: string
    requester: string
    department?: string
    urgency: 'low' | 'medium' | 'high' | 'critical'
    purpose: string
    items: Array<{
      stt: number
      name: string
      specs?: string
      qty: number
      unitPrice?: number
      total?: number
      note?: string
    }>
    totalEstimate?: number
    justification?: string
    approvedBy?: string
    note?: string
  }

  type Props = { data: PhieuYeuCauMuaSamData; org?: OrgInfo }
  let { data, org }: Props = $props()

  const urgencyLabel: Record<string, string> = {
    low: 'Thấp', medium: 'Bình thường', high: 'Khẩn', critical: 'Rất khẩn'
  }

  function fmtCurrency(n?: number) {
    if (!n) return ''
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
  }

  const totalEstimate = $derived(
    data.totalEstimate ?? data.items.reduce((s, i) => s + (i.total ?? 0), 0)
  )
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="PHIẾU YÊU CẦU MUA SẮM"
    formNo={data.requestNo}
    formDate={data.date}
  />

  <div class="print-info-grid">
    <div class="print-info-row"><span class="print-label">Người đề xuất:</span> <span>{data.requester}{data.department ? ` — ${data.department}` : ''}</span></div>
    <div class="print-info-row"><span class="print-label">Mức độ ưu tiên:</span> <span><strong>{urgencyLabel[data.urgency] ?? data.urgency}</strong></span></div>
    <div class="print-info-row"><span class="print-label">Mục đích:</span> <span>{data.purpose}</span></div>
    {#if data.justification}
      <div class="print-info-row"><span class="print-label">Lý do / Căn cứ:</span> <span>{data.justification}</span></div>
    {/if}
  </div>

  <table class="print-table mt-3">
    <thead>
      <tr>
        <th style="width:4%">STT</th>
        <th>Tên hàng hóa / thiết bị</th>
        <th style="width:18%">Thông số kỹ thuật</th>
        <th style="width:8%">SL</th>
        <th style="width:12%">Đơn giá dự tính</th>
        <th style="width:13%">Thành tiền</th>
        <th style="width:12%">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      {#each data.items as item}
        <tr>
          <td class="text-center">{item.stt}</td>
          <td>{item.name}</td>
          <td>{item.specs ?? ''}</td>
          <td class="text-right">{item.qty}</td>
          <td class="text-right">{fmtCurrency(item.unitPrice)}</td>
          <td class="text-right">{fmtCurrency(item.total)}</td>
          <td>{item.note ?? ''}</td>
        </tr>
      {/each}
      <tr class="print-table-total">
        <td colspan="5" class="text-right"><strong>Tổng dự toán</strong></td>
        <td class="text-right"><strong>{fmtCurrency(totalEstimate) || '—'}</strong></td>
        <td></td>
      </tr>
    </tbody>
  </table>

  {#if data.note}
    <div class="print-info-row mt-2"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người đề xuất', name: data.requester },
      { label: 'Trưởng bộ phận', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Phòng kế toán', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Lãnh đạo phê duyệt', name: data.approvedBy },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
