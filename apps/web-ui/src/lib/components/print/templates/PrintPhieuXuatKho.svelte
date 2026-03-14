<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type PhieuXuatKhoData = {
    code: string
    date: string
    warehouseName: string
    recipient?: string
    department?: string
    purpose?: string
    reference?: string
    note?: string
    lines: Array<{
      stt: number
      partCode: string
      partName: string
      uom?: string
      qty: number
      unitCost?: number
      total?: number
      serialNo?: string
      note?: string
    }>
    preparedBy?: string
    approvedBy?: string
    issuedBy?: string
    receivedBy?: string
  }

  type Props = { data: PhieuXuatKhoData; org?: OrgInfo }
  let { data, org }: Props = $props()

  const totalQty = $derived(data.lines.reduce((s, l) => s + l.qty, 0))
  const totalAmount = $derived(data.lines.reduce((s, l) => s + (l.total ?? 0), 0))

  function fmtCurrency(n?: number) {
    if (!n) return ''
    return new Intl.NumberFormat('vi-VN', { style: 'decimal' }).format(n) + ' đ'
  }
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="PHIẾU XUẤT KHO"
    formCode={data.code}
    formDate={data.date}
  />

  <div class="print-info-grid">
    <div class="print-info-row"><span class="print-label">Kho xuất:</span> <span>{data.warehouseName}</span></div>
    {#if data.recipient}
      <div class="print-info-row"><span class="print-label">Người nhận:</span> <span>{data.recipient}</span></div>
    {/if}
    {#if data.department}
      <div class="print-info-row"><span class="print-label">Bộ phận / Phòng ban:</span> <span>{data.department}</span></div>
    {/if}
    {#if data.purpose}
      <div class="print-info-row"><span class="print-label">Mục đích sử dụng:</span> <span>{data.purpose}</span></div>
    {/if}
    {#if data.reference}
      <div class="print-info-row"><span class="print-label">Yêu cầu / Phiếu đề nghị số:</span> <span>{data.reference}</span></div>
    {/if}
    {#if data.note}
      <div class="print-info-row"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
    {/if}
  </div>

  <table class="print-table">
    <thead>
      <tr>
        <th style="width:3%">STT</th>
        <th style="width:12%">Mã vật tư</th>
        <th>Tên vật tư / thiết bị</th>
        <th style="width:8%">ĐVT</th>
        <th style="width:8%">Số lượng</th>
        <th style="width:12%">Đơn giá</th>
        <th style="width:13%">Thành tiền</th>
        <th style="width:14%">Số serial</th>
        <th style="width:13%">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      {#each data.lines as line}
        <tr>
          <td class="text-center">{line.stt}</td>
          <td>{line.partCode}</td>
          <td>{line.partName}</td>
          <td class="text-center">{line.uom ?? ''}</td>
          <td class="text-right">{line.qty}</td>
          <td class="text-right">{fmtCurrency(line.unitCost)}</td>
          <td class="text-right">{fmtCurrency(line.total)}</td>
          <td>{line.serialNo ?? ''}</td>
          <td>{line.note ?? ''}</td>
        </tr>
      {/each}
      <tr class="print-table-total">
        <td colspan="4" class="text-right"><strong>Tổng cộng</strong></td>
        <td class="text-right"><strong>{totalQty}</strong></td>
        <td></td>
        <td class="text-right"><strong>{fmtCurrency(totalAmount) || ''}</strong></td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <div class="print-info-row mt-2">
    <span class="print-label">Tổng số lượng (bằng chữ):</span>
    <span class="print-dotted-line"></span>
  </div>

  <PrintSignatures
    signers={[
      { label: 'Người lập phiếu', name: data.preparedBy },
      { label: 'Thủ kho', name: data.issuedBy, title: '(Xuất kho)' },
      { label: 'Người nhận', name: data.receivedBy },
      { label: 'Kế toán', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Phê duyệt', name: data.approvedBy },
    ]}
    date={data.date ? `Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}` : undefined}
  />
</div>
