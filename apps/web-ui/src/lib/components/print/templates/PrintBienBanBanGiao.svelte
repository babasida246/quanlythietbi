<script lang="ts">
  import PrintOrgHeader from '../PrintOrgHeader.svelte'
  import PrintSignatures from '../PrintSignatures.svelte'
  import type { OrgInfo } from '$lib/stores/orgStore'

  export type BienBanBanGiaoData = {
    date: string
    handoverNo?: string
    asset: {
      code: string
      name: string
      serialNo?: string
      model?: string
      brand?: string
      category?: string
      location?: string
      purchaseDate?: string
      warrantyEnd?: string
      notes?: string
    }
    fromPerson?: string
    fromDepartment?: string
    toPerson: string
    toDepartment?: string
    accessories?: string[]
    condition?: string
    note?: string
    witnesses?: string[]
  }

  type Props = { data: BienBanBanGiaoData; org?: OrgInfo }
  let { data, org }: Props = $props()
</script>

<div class="print-page">
  <PrintOrgHeader
    orgName={org?.name}
    orgAddress={org?.address}
    orgPhone={org?.phone}
    orgTaxCode={org?.taxCode}
    formTitle="BIÊN BẢN BÀN GIAO THIẾT BỊ"
    formNo={data.handoverNo}
    formDate={data.date}
  />

  <p class="print-preamble">
    Hôm nay, ngày {new Date(data.date).getDate()} tháng {new Date(data.date).getMonth() + 1} năm {new Date(data.date).getFullYear()},
    chúng tôi gồm các bên dưới đây cùng lập biên bản bàn giao thiết bị như sau:
  </p>

  <div class="print-section">
    <h3 class="print-section-title">I. CÁC BÊN LIÊN QUAN</h3>
    <div class="print-info-grid">
      <div class="print-info-row">
        <span class="print-label">Bên giao:</span>
        <span>{data.fromPerson ?? '...................................................'}</span>
        {#if data.fromDepartment}&nbsp;—&nbsp;Bộ phận: {data.fromDepartment}{/if}
      </div>
      <div class="print-info-row">
        <span class="print-label">Bên nhận:</span>
        <span>{data.toPerson}</span>
        {#if data.toDepartment}&nbsp;—&nbsp;Bộ phận: {data.toDepartment}{/if}
      </div>
    </div>
  </div>

  <div class="print-section">
    <h3 class="print-section-title">II. THÔNG TIN THIẾT BỊ BÀN GIAO</h3>
    <table class="print-table">
      <tbody>
        <tr><td class="print-label-cell" style="width:35%">Mã thiết bị</td><td>{data.asset.code}</td></tr>
        <tr><td class="print-label-cell">Tên thiết bị</td><td>{data.asset.name}</td></tr>
        {#if data.asset.model}<tr><td class="print-label-cell">Model</td><td>{data.asset.model}{data.asset.brand ? ` — ${data.asset.brand}` : ''}</td></tr>{/if}
        {#if data.asset.serialNo}<tr><td class="print-label-cell">Số serial</td><td>{data.asset.serialNo}</td></tr>{/if}
        {#if data.asset.category}<tr><td class="print-label-cell">Danh mục</td><td>{data.asset.category}</td></tr>{/if}
        {#if data.asset.location}<tr><td class="print-label-cell">Vị trí</td><td>{data.asset.location}</td></tr>{/if}
        {#if data.asset.purchaseDate}<tr><td class="print-label-cell">Ngày mua</td><td>{data.asset.purchaseDate}</td></tr>{/if}
        {#if data.asset.warrantyEnd}<tr><td class="print-label-cell">Bảo hành đến</td><td>{data.asset.warrantyEnd}</td></tr>{/if}
        <tr>
          <td class="print-label-cell">Tình trạng thiết bị</td>
          <td>{data.condition ?? 'Bình thường, hoạt động tốt'}</td>
        </tr>
      </tbody>
    </table>
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

  {#if data.note}
    <div class="print-section">
      <h3 class="print-section-title">GHI CHÚ</h3>
      <p>{data.note}</p>
    </div>
  {/if}

  <p class="print-preamble">
    Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.
  </p>

  <PrintSignatures
    signers={[
      { label: 'Bên giao', name: data.fromPerson },
      ...(data.witnesses?.map((w) => ({ label: 'Người chứng kiến', name: w })) ?? []),
      { label: 'Bên nhận', name: data.toPerson },
    ]}
    date={`Ngày ${new Date(data.date).getDate()} tháng ${new Date(data.date).getMonth() + 1} năm ${new Date(data.date).getFullYear()}`}
  />
</div>
