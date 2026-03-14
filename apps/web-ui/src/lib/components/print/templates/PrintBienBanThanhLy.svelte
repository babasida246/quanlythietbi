<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BienBanThanhLyData = {
    date: string
    disposalNo?: string
    assets: Array<{
      stt: number
      code: string
      name: string
      serialNo?: string
      model?: string
      purchaseDate?: string
      originalValue?: number
      residualValue?: number
      condition: string
      reason: string
    }>
    proposedBy: string
    department?: string
    approvedBy?: string
    disposalMethod: string
    proceedsAmount?: number
    committeeMembers?: string[]
    note?: string
  }

  type Props = { data: BienBanThanhLyData; org?: OrgInfo }
  let { data, org }: Props = $props()

  function fmtCurrency(n?: number) {
    if (!n) return ''
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
  }

  const totalOriginal = $derived(data.assets.reduce((s, a) => s + (a.originalValue ?? 0), 0))
  const totalResidual = $derived(data.assets.reduce((s, a) => s + (a.residualValue ?? 0), 0))
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BIÊN BẢN THANH LÝ TÀI SẢN"
    formNo={data.disposalNo}
    formDate={data.date}
  />

  <p class="print-preamble">
    Hôm nay, ngày {new Date(data.date).getDate()} tháng {new Date(data.date).getMonth() + 1} năm {new Date(data.date).getFullYear()},
    Hội đồng thanh lý tài sản gồm các thành viên dưới đây tiến hành thanh lý tài sản theo quy định:
  </p>

  {#if data.committeeMembers && data.committeeMembers.length > 0}
    <div class="print-section">
      <h3 class="print-section-title">I. THÀNH PHẦN HỘI ĐỒNG THANH LÝ</h3>
      <ul class="print-list">
        {#each data.committeeMembers as m}
          <li>{m}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="print-section">
    <h3 class="print-section-title">II. DANH SÁCH TÀI SẢN THANH LÝ</h3>
    <table class="print-table">
      <thead>
        <tr>
          <th style="width:3%">STT</th>
          <th style="width:12%">Mã TS</th>
          <th>Tên tài sản</th>
          <th style="width:8%">Serial</th>
          <th style="width:10%">Năm mua</th>
          <th style="width:13%">Nguyên giá</th>
          <th style="width:12%">Giá trị còn lại</th>
          <th style="width:12%">Tình trạng</th>
          <th style="width:12%">Lý do TL</th>
        </tr>
      </thead>
      <tbody>
        {#each data.assets as a}
          <tr>
            <td class="text-center">{a.stt}</td>
            <td>{a.code}</td>
            <td>{a.name}{a.model ? ` (${a.model})` : ''}</td>
            <td>{a.serialNo ?? ''}</td>
            <td class="text-center">{a.purchaseDate ? new Date(a.purchaseDate).getFullYear() : ''}</td>
            <td class="text-right">{fmtCurrency(a.originalValue)}</td>
            <td class="text-right">{fmtCurrency(a.residualValue)}</td>
            <td>{a.condition}</td>
            <td>{a.reason}</td>
          </tr>
        {/each}
        <tr class="print-table-total">
          <td colspan="5" class="text-right"><strong>Tổng cộng</strong></td>
          <td class="text-right"><strong>{fmtCurrency(totalOriginal)}</strong></td>
          <td class="text-right"><strong>{fmtCurrency(totalResidual)}</strong></td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">III. PHƯƠNG ÁN THANH LÝ</h3>
    <div class="print-info-grid">
      <div class="print-info-row"><span class="print-label">Hình thức thanh lý:</span> <span>{data.disposalMethod}</span></div>
      <div class="print-info-row"><span class="print-label">Đề xuất bởi:</span> <span>{data.proposedBy}{data.department ? ` — ${data.department}` : ''}</span></div>
      {#if data.proceedsAmount}
        <div class="print-info-row"><span class="print-label">Thu hồi được:</span> <span><strong>{fmtCurrency(data.proceedsAmount)}</strong></span></div>
      {/if}
    </div>
  </div>

  {#if data.note}
    <div class="print-info-row mt-2"><span class="print-label">Ghi chú:</span> <span>{data.note}</span></div>
  {/if}

  <PrintSignatures
    signers={[
      { label: 'Người đề xuất', name: data.proposedBy },
      { label: 'Kế toán', title: '(Ký, ghi rõ họ tên)' },
      { label: 'Trưởng hội đồng / Phê duyệt', name: data.approvedBy },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
