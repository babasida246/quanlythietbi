<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BaoCaoTaiSanData = {
    date: string
    reportPeriod: string
    preparedBy?: string
    summary: {
      totalAssets: number
      totalValue?: number
      inUse: number
      inStock: number
      inRepair: number
      retired: number
    }
    byCategory: Array<{
      categoryName: string
      count: number
      inUse: number
      inStock: number
      value?: number
    }>
    note?: string
  }

  type Props = { data: BaoCaoTaiSanData; org?: OrgInfo }
  let { data, org }: Props = $props()

  function fmtCurrency(n?: number) {
    if (!n) return ''
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
  }
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BÁO CÁO TỔNG HỢP TÀI SẢN"
    formDate={data.date}
  />

  <div class="print-info-grid">
    <div class="print-info-row"><span class="print-label">Kỳ báo cáo:</span> <span>{data.reportPeriod}</span></div>
    {#if data.preparedBy}<div class="print-info-row"><span class="print-label">Người lập:</span> <span>{data.preparedBy}</span></div>{/if}
  </div>

  <div class="print-section">
    <h3 class="print-section-title">I. TỔNG QUAN</h3>
    <table class="print-table" style="max-width:60%">
      <tbody>
        <tr><td class="print-label-cell">Tổng số tài sản</td><td class="text-right"><strong>{data.summary.totalAssets}</strong></td></tr>
        {#if data.summary.totalValue}<tr><td class="print-label-cell">Tổng giá trị</td><td class="text-right"><strong>{fmtCurrency(data.summary.totalValue)}</strong></td></tr>{/if}
        <tr><td class="print-label-cell">Đang sử dụng</td><td class="text-right">{data.summary.inUse}</td></tr>
        <tr><td class="print-label-cell">Trong kho</td><td class="text-right">{data.summary.inStock}</td></tr>
        <tr><td class="print-label-cell">Đang sửa chữa</td><td class="text-right">{data.summary.inRepair}</td></tr>
        <tr><td class="print-label-cell">Đã nghỉ hưu</td><td class="text-right">{data.summary.retired}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">II. PHÂN LOẠI THEO DANH MỤC</h3>
    <table class="print-table">
      <thead>
        <tr>
          <th>Danh mục</th>
          <th style="width:12%">Tổng số</th>
          <th style="width:12%">Đang dùng</th>
          <th style="width:12%">Trong kho</th>
          <th style="width:18%">Giá trị ước tính</th>
        </tr>
      </thead>
      <tbody>
        {#each data.byCategory as row}
          <tr>
            <td>{row.categoryName}</td>
            <td class="text-right">{row.count}</td>
            <td class="text-right">{row.inUse}</td>
            <td class="text-right">{row.inStock}</td>
            <td class="text-right">{fmtCurrency(row.value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if data.note}
    <div class="print-info-row mt-3"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người lập báo cáo', name: data.preparedBy },
      { label: 'Kế toán trưởng', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Lãnh đạo xác nhận', title: '(Ký, đóng dấu)' },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
