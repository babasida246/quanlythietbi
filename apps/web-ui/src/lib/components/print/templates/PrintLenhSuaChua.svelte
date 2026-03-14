<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type LenhSuaChuaData = {
    code: string
    date: string
    asset: {
      code: string
      name: string
      serialNo?: string
      model?: string
      brand?: string
      category?: string
      location?: string
    }
    issueDescription: string
    severity: string
    diagnosis?: string
    resolution?: string
    technicianName?: string
    repairType: 'internal' | 'vendor'
    vendorName?: string
    status: string
    laborCost?: number
    partsCost?: number
    parts: Array<{
      name: string
      action: string
      qty: number
      unitCost?: number
      serialNo?: string
      note?: string
    }>
    openedAt: string
    closedAt?: string
    downtime?: number
    note?: string
  }

  type Props = { data: LenhSuaChuaData; org?: OrgInfo }
  let { data, org }: Props = $props()

  const severityLabel: Record<string, string> = {
    low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Khẩn cấp'
  }
  const repairTypeLabel: Record<string, string> = {
    internal: 'Tự sửa (nội bộ)', vendor: 'Gửi nhà cung cấp / bên ngoài'
  }
  const statusLabel: Record<string, string> = {
    open: 'Đang mở', diagnosing: 'Đang chuẩn đoán', waiting_parts: 'Chờ linh kiện',
    repaired: 'Đã sửa', closed: 'Đã đóng', canceled: 'Đã hủy'
  }

  function fmtCurrency(n?: number) {
    if (!n) return ''
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
  }

  const totalCost = $derived((data.laborCost ?? 0) + (data.partsCost ?? 0))
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="LỆNH SỬA CHỮA / BẢO TRÌ THIẾT BỊ"
    formCode={data.code}
    formDate={data.date}
  />

  <div class="print-section">
    <h3 class="print-section-title">I. THÔNG TIN THIẾT BỊ</h3>
    <table class="print-table">
      <tbody>
        <tr><td class="print-label-cell" style="width:35%">Mã thiết bị</td><td>{data.asset.code}</td></tr>
        <tr><td class="print-label-cell">Tên thiết bị</td><td>{data.asset.name}</td></tr>
        {#if data.asset.model}<tr><td class="print-label-cell">Model / Hãng</td><td>{data.asset.model}{data.asset.brand ? ` — ${data.asset.brand}` : ''}</td></tr>{/if}
        {#if data.asset.serialNo}<tr><td class="print-label-cell">Số serial</td><td>{data.asset.serialNo}</td></tr>{/if}
        {#if data.asset.location}<tr><td class="print-label-cell">Vị trí</td><td>{data.asset.location}</td></tr>{/if}
      </tbody>
    </table>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">II. THÔNG TIN SỰ CỐ</h3>
    <div class="print-info-grid">
      <div class="print-info-row"><span class="print-label">Mức độ:</span> <span>{severityLabel[data.severity] ?? data.severity}</span></div>
      <div class="print-info-row"><span class="print-label">Ngày phát sinh:</span> <span>{data.openedAt}</span></div>
      <div class="print-info-row"><span class="print-label">Loại sửa chữa:</span> <span>{repairTypeLabel[data.repairType] ?? data.repairType}</span></div>
      {#if data.vendorName}<div class="print-info-row"><span class="print-label">Nhà cung cấp dịch vụ:</span> <span>{data.vendorName}</span></div>{/if}
      {#if data.technicianName}<div class="print-info-row"><span class="print-label">Kỹ thuật viên:</span> <span>{data.technicianName}</span></div>{/if}
      <div class="print-info-row"><span class="print-label">Trạng thái:</span> <span><strong>{statusLabel[data.status] ?? data.status}</strong></span></div>
    </div>
    <div class="print-field mt-2">
      <div class="print-label">Mô tả sự cố:</div>
      <div class="print-field-value">{data.issueDescription}</div>
    </div>
    {#if data.diagnosis}
      <div class="print-field mt-2">
        <div class="print-label">Chuẩn đoán:</div>
        <div class="print-field-value">{data.diagnosis}</div>
      </div>
    {/if}
    {#if data.resolution}
      <div class="print-field mt-2">
        <div class="print-label">Phương án sửa chữa / Kết quả:</div>
        <div class="print-field-value">{data.resolution}</div>
      </div>
    {/if}
  </div>

  {#if data.parts.length > 0}
    <div class="print-section">
      <h3 class="print-section-title">III. LINH KIỆN / VẬT TƯ SỬ DỤNG</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th style="width:3%">STT</th>
            <th>Tên linh kiện / vật tư</th>
            <th style="width:15%">Thao tác</th>
            <th style="width:8%">SL</th>
            <th style="width:12%">Đơn giá</th>
            <th style="width:13%">Thành tiền</th>
            <th style="width:14%">Serial</th>
          </tr>
        </thead>
        <tbody>
          {#each data.parts as p, i}
            <tr>
              <td class="text-center">{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.action}</td>
              <td class="text-right">{p.qty}</td>
              <td class="text-right">{fmtCurrency(p.unitCost)}</td>
              <td class="text-right">{fmtCurrency(p.unitCost && p.qty ? p.unitCost * p.qty : undefined)}</td>
              <td>{p.serialNo ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="print-section">
    <h3 class="print-section-title">IV. CHI PHÍ SỬA CHỮA</h3>
    <div class="print-info-grid">
      <div class="print-info-row"><span class="print-label">Chi phí nhân công:</span> <span>{fmtCurrency(data.laborCost) || '—'}</span></div>
      <div class="print-info-row"><span class="print-label">Chi phí linh kiện:</span> <span>{fmtCurrency(data.partsCost) || '—'}</span></div>
      <div class="print-info-row"><span class="print-label"><strong>Tổng chi phí:</strong></span> <span><strong>{fmtCurrency(totalCost) || '—'}</strong></span></div>
      {#if data.downtime}
        <div class="print-info-row"><span class="print-label">Thời gian ngừng hoạt động:</span> <span>{data.downtime} phút</span></div>
      {/if}
      {#if data.closedAt}
        <div class="print-info-row"><span class="print-label">Ngày hoàn thành:</span> <span>{data.closedAt}</span></div>
      {/if}
    </div>
  </div>

  {#if data.note}
    <div class="print-info-row"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người yêu cầu', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Kỹ thuật viên', name: data.technicianName },
      { label: 'Người nghiệm thu', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Phê duyệt', title: '(Ký, ghi rõ họ tên)' },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
