/**
 * generate-docx-templates.mjs
 * Tạo tất cả 11 mẫu in .docx dùng docxtemplater syntax.
 *
 * Syntax trong Word template:
 *   {field}            – thay thế đơn giản
 *   {#items}...{/items} – lặp, thường bao hàng bảng:
 *     cell đầu: {#items}{field1}  |  cell cuối: {fieldN}{/items}
 *   {^items}...{/items} – hiển thị khi mảng rỗng
 *
 * Chạy: node scripts/generate-docx-templates.mjs
 * Output: apps/api/src/templates/docx/*.docx
 */

import {
  Document, Paragraph, Table, TableRow, TableCell, TextRun, Packer,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  convertMillimetersToTwip, VerticalAlign,
} from 'docx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'apps', 'api', 'src', 'templates', 'docx')

// ─── Typography constants ────────────────────────────────────────────────────
const FONT   = 'Times New Roman'
const SZ_SM  = 18  // 9pt
const SZ     = 20  // 10pt
const SZ_MD  = 22  // 11pt
const SZ_LG  = 26  // 13pt
const SZ_XL  = 28  // 14pt

// ─── Border helpers ──────────────────────────────────────────────────────────
const THIN  = { style: BorderStyle.SINGLE, size: 4,  color: '000000' }
const NONE  = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }
const ALL   = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const NOBDR = { top: NONE, bottom: NONE, left: NONE, right: NONE }

// ─── Low-level helpers ───────────────────────────────────────────────────────
function r(text, { bold, italic, size = SZ, underline } = {}) {
  return new TextRun({ text, font: FONT, size, bold, italics: italic, underline })
}

function p(children, { align = AlignmentType.LEFT, before = 0, after = 40 } = {}) {
  const runs = typeof children === 'string'
    ? [r(children)]
    : Array.isArray(children) ? children : [children]
  return new Paragraph({ children: runs, alignment: align, spacing: { before, after } })
}

/** Table cell with optional shade, border override, alignment, col span */
function tc(paragraphs, {
  w,                        // width % (integer)
  borders = ALL,
  shade = false,
  vAlign = VerticalAlign.CENTER,
  colSpan,
} = {}) {
  const paras = Array.isArray(paragraphs) ? paragraphs : [paragraphs]
  return new TableCell({
    children: paras,
    ...(colSpan ? { columnSpan: colSpan } : {}),
    width: w !== undefined ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    borders,
    verticalAlign: vAlign,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    shading: shade
      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }
      : undefined,
  })
}

/** Header cell: bold, centered, shaded */
function hc(text, w) {
  return tc(p([r(text, { bold: true, size: SZ })], { align: AlignmentType.CENTER }), { w, shade: true })
}

/** Data cell for a template row */
function dc(tag, w, align = AlignmentType.LEFT) {
  return tc(p([r(tag, { size: SZ })], { align }), { w })
}

/** Empty cell with no border (for signature section gaps) */
function nobc(w) {
  return tc(p(''), { w, borders: NOBDR })
}

// ─── Reusable blocks ─────────────────────────────────────────────────────────

function orgHeader() {
  return [
    p([r('{orgName}', { bold: true, size: SZ_LG })], { align: AlignmentType.CENTER, after: 0 }),
    p([r('Địa chỉ: {orgAddress}', { size: SZ_MD })], { align: AlignmentType.CENTER, after: 0 }),
    p([r('ĐT: {orgPhone}   |   MST: {orgTaxCode}', { size: SZ_MD })], { align: AlignmentType.CENTER, after: 0 }),
    p('', { after: 80 }),
  ]
}

function formTitle(title) {
  return [
    p([r(title, { bold: true, size: SZ_XL })], { align: AlignmentType.CENTER, before: 60, after: 20 }),
    p([r('Số: {code}   –   Ngày: {date}', { size: SZ_MD, italic: true })], { align: AlignmentType.CENTER, after: 80 }),
  ]
}

function infoRow(label, field) {
  return p([r(`${label}: `, { bold: true, size: SZ_MD }), r(`{${field}}`, { size: SZ_MD })])
}

function infoRowOptional(label, field) {
  // Dùng conditional block — nếu field rỗng thì không hiển thị dòng
  // Cách đơn giản: luôn hiển thị, user tự xoá nếu không muốn
  return p([r(`${label}: `, { bold: true, size: SZ_MD }), r(`{${field}}`, { size: SZ_MD })])
}

/** 5-column signature table */
function sigTable(signers) {
  const n   = signers.length
  const pct = Math.floor(100 / n)

  return new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideH: NONE, insideV: NONE },
    rows: [
      // Labels
      new TableRow({
        children: signers.map(s => tc(
          p([r(s.label, { bold: true, size: SZ })], { align: AlignmentType.CENTER }),
          { w: pct, borders: NOBDR }
        ))
      }),
      // Instruction
      new TableRow({
        children: signers.map(() => tc(
          p([r('(Ký, ghi rõ họ tên)', { italic: true, size: SZ_SM })], { align: AlignmentType.CENTER }),
          { w: pct, borders: NOBDR }
        ))
      }),
      // Space for signature
      new TableRow({
        children: signers.map(() => tc(p('', { before: 300 }), { w: pct, borders: NOBDR }))
      }),
      // Names
      new TableRow({
        children: signers.map(s => tc(
          p([r(s.field ? `{${s.field}}` : ' ', { size: SZ })], { align: AlignmentType.CENTER }),
          { w: pct, borders: NOBDR }
        ))
      }),
    ]
  })
}

function dateNoteLine() {
  return p([
    r('{sigDate}', { italic: true, size: SZ }),
  ], { align: AlignmentType.RIGHT, before: 80, after: 80 })
}

/** Base document with A4 margins */
function makeDoc(children) {
  return new Document({
    compatibility: { doNotExpandShiftReturn: true },
    sections: [{
      properties: {
        page: {
          size: {
            width:  convertMillimetersToTwip(210),
            height: convertMillimetersToTwip(297),
          },
          margin: {
            top:    convertMillimetersToTwip(20),
            right:  convertMillimetersToTwip(20),
            bottom: convertMillimetersToTwip(20),
            left:   convertMillimetersToTwip(25),
          },
        },
      },
      children,
    }],
  })
}

// ─── PHIẾU NHẬP KHO ──────────────────────────────────────────────────────────
function tplPhieuNhapKho() {
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 4), hc('Mã vật tư', 11), hc('Tên vật tư / Thiết bị', 25),
        hc('ĐVT', 7), hc('Số lượng', 8), hc('Đơn giá', 12),
        hc('Thành tiền', 12), hc('Số serial', 12), hc('Ghi chú', 9),
      ]}),
      // Loop row — {#lines}...{/lines}
      new TableRow({ children: [
        dc('{#lines}{i}',    4,  AlignmentType.CENTER),
        dc('{partCode}',    11),
        dc('{partName}',    25),
        dc('{uom}',          7,  AlignmentType.CENTER),
        dc('{qty}',          8,  AlignmentType.RIGHT),
        dc('{unitCost}',    12,  AlignmentType.RIGHT),
        dc('{total}',       12,  AlignmentType.RIGHT),
        dc('{serialNo}',    12),
        dc('{lineNote}{/lines}', 9),
      ]}),
      // Total row
      new TableRow({ children: [
        tc(p([r('Tổng cộng', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 47, colSpan: 4 }),
        tc(p([r('{totalQty}', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 8 }),
        tc(p(''), { w: 12 }),
        tc(p([r('{totalAmount}', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 12 }),
        tc(p(''), { w: 12 }),
        tc(p(''), { w: 9 }),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('PHIẾU NHẬP KHO'),
    infoRow('Kho nhập', 'warehouseName'),
    infoRowOptional('Nhà cung cấp / Nguồn nhập', 'supplier'),
    infoRowOptional('Chứng từ gốc', 'reference'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 60 }),
    table,
    p('', { after: 40 }),
    p([r('Tổng số lượng (bằng chữ): ', { bold: true, size: SZ_MD }),
       r('....................................................................................................', { size: SZ_MD })]),
    dateNoteLine(),
    sigTable([
      { label: 'Người lập phiếu', field: 'preparedBy' },
      { label: 'Người giao hàng', field: '' },
      { label: 'Thủ kho',         field: 'receivedBy' },
      { label: 'Kế toán',         field: '' },
      { label: 'Phê duyệt',       field: 'approvedBy' },
    ]),
  ])
}

// ─── PHIẾU XUẤT KHO ──────────────────────────────────────────────────────────
function tplPhieuXuatKho() {
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 4), hc('Mã vật tư', 11), hc('Tên vật tư / Thiết bị', 24),
        hc('ĐVT', 7), hc('Số lượng', 8), hc('Đơn giá', 12),
        hc('Thành tiền', 12), hc('Số serial', 12), hc('Ghi chú', 10),
      ]}),
      new TableRow({ children: [
        dc('{#lines}{i}',    4,  AlignmentType.CENTER),
        dc('{partCode}',    11),
        dc('{partName}',    24),
        dc('{uom}',          7,  AlignmentType.CENTER),
        dc('{qty}',          8,  AlignmentType.RIGHT),
        dc('{unitCost}',    12,  AlignmentType.RIGHT),
        dc('{total}',       12,  AlignmentType.RIGHT),
        dc('{serialNo}',    12),
        dc('{lineNote}{/lines}', 10),
      ]}),
      new TableRow({ children: [
        tc(p([r('Tổng cộng', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 46, colSpan: 4 }),
        tc(p([r('{totalQty}', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 8 }),
        tc(p(''), { w: 12 }),
        tc(p([r('{totalAmount}', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 12 }),
        tc(p(''), { w: 12 }),
        tc(p(''), { w: 10 }),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('PHIẾU XUẤT KHO'),
    infoRow('Kho xuất', 'warehouseName'),
    infoRowOptional('Người nhận', 'recipient'),
    infoRowOptional('Phòng ban / Bộ phận', 'department'),
    infoRowOptional('Mục đích sử dụng', 'purpose'),
    infoRowOptional('Chứng từ gốc', 'reference'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 60 }),
    table,
    p('', { after: 40 }),
    p([r('Tổng số lượng (bằng chữ): ', { bold: true, size: SZ_MD }),
       r('....................................................................................................', { size: SZ_MD })]),
    dateNoteLine(),
    sigTable([
      { label: 'Người lập phiếu', field: 'preparedBy' },
      { label: 'Thủ kho',         field: 'issuedBy' },
      { label: 'Người nhận',      field: 'receivedBy' },
      { label: 'Kế toán',         field: '' },
      { label: 'Phê duyệt',       field: 'approvedBy' },
    ]),
  ])
}

// ─── BIÊN BẢN BÀN GIAO ───────────────────────────────────────────────────────
function tplBienBanBanGiao() {
  const assetTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        hc('Thông tin thiết bị', 30),
        tc(p(''), { w: 70 }),
      ]}),
      ...([
        ['Mã tài sản',       'asset.code'],
        ['Tên thiết bị',     'asset.name'],
        ['Số serial',        'asset.serialNo'],
        ['Model / Hãng',     'asset.model'],
        ['Danh mục',         'asset.category'],
        ['Vị trí hiện tại',  'asset.location'],
        ['Ngày mua',         'asset.purchaseDate'],
        ['Bảo hành đến',     'asset.warrantyEnd'],
        ['Tình trạng',       'condition'],
      ].map(([label, field]) => new TableRow({ children: [
        tc(p([r(label, { bold: true, size: SZ })]), { w: 30, shade: true }),
        dc(`{${field}}`, 70),
      ]}))),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BIÊN BẢN BÀN GIAO THIẾT BỊ'),
    p('', { after: 60 }),
    assetTable,
    p('', { after: 60 }),
    infoRow('Bên giao', 'fromPerson'),
    infoRowOptional('Phòng ban bên giao', 'fromDepartment'),
    infoRow('Bên nhận', 'toPerson'),
    infoRowOptional('Phòng ban bên nhận', 'toDepartment'),
    infoRowOptional('Phụ kiện kèm theo', 'accessories'),
    infoRowOptional('Ghi chú', 'note'),
    dateNoteLine(),
    sigTable([
      { label: 'Bên giao',        field: 'fromPerson' },
      { label: 'Người chứng kiến', field: '' },
      { label: 'Bên nhận',        field: 'toPerson' },
    ]),
  ])
}

// ─── BIÊN BẢN LUÂN CHUYỂN ────────────────────────────────────────────────────
function tplBienBanLuanChuyen() {
  const assetTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...([
        ['Mã tài sản',   'asset.code'],
        ['Tên thiết bị', 'asset.name'],
        ['Số serial',    'asset.serialNo'],
        ['Model',        'asset.model'],
        ['Danh mục',     'asset.category'],
        ['Tình trạng',   'condition'],
      ].map(([label, field]) => new TableRow({ children: [
        tc(p([r(label, { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc(`{${field}}`, 65),
      ]}))),
    ],
  })

  const moveTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [ hc('', 35), hc('Từ', 30), hc('Đến', 35) ] }),
      new TableRow({ children: [
        tc(p([r('Vị trí / Kho', { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc('{fromLocation}', 30),
        dc('{toLocation}',   35),
      ]}),
      new TableRow({ children: [
        tc(p([r('Phòng ban', { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc('{fromDepartment}', 30),
        dc('{toDepartment}',   35),
      ]}),
      new TableRow({ children: [
        tc(p([r('Người chịu trách nhiệm', { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc('{fromPerson}', 30),
        dc('{toPerson}',   35),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BIÊN BẢN LUÂN CHUYỂN THIẾT BỊ'),
    p('', { after: 40 }),
    assetTable,
    p('', { after: 40 }),
    moveTable,
    p('', { after: 60 }),
    infoRow('Lý do luân chuyển', 'reason'),
    infoRowOptional('Ghi chú', 'note'),
    dateNoteLine(),
    sigTable([
      { label: 'Bên giao',    field: 'fromPerson' },
      { label: 'Phê duyệt',   field: '' },
      { label: 'Bên nhận',    field: 'toPerson' },
    ]),
  ])
}

// ─── BIÊN BẢN THU HỒI ────────────────────────────────────────────────────────
function tplBienBanThuHoi() {
  const assetTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...([
        ['Mã tài sản',   'asset.code'],
        ['Tên thiết bị', 'asset.name'],
        ['Số serial',    'asset.serialNo'],
        ['Model',        'asset.model'],
        ['Danh mục',     'asset.category'],
        ['Vị trí',       'asset.location'],
        ['Tình trạng',   'condition'],
      ].map(([label, field]) => new TableRow({ children: [
        tc(p([r(label, { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc(`{${field}}`, 65),
      ]}))),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BIÊN BẢN THU HỒI THIẾT BỊ'),
    p('', { after: 40 }),
    assetTable,
    p('', { after: 60 }),
    infoRow('Thu hồi từ (Người/Bộ phận)', 'fromPerson'),
    infoRowOptional('Phòng ban', 'fromDepartment'),
    infoRowOptional('Kho nhận về', 'toWarehouse'),
    infoRow('Lý do thu hồi', 'reason'),
    infoRowOptional('Phụ kiện kèm theo', 'accessories'),
    infoRowOptional('Ghi chú', 'note'),
    dateNoteLine(),
    sigTable([
      { label: 'Người giao',     field: 'fromPerson' },
      { label: 'Người chứng nhận', field: '' },
      { label: 'Người nhận',     field: 'toPerson' },
    ]),
  ])
}

// ─── LỆNH SỬA CHỮA ───────────────────────────────────────────────────────────
function tplLenhSuaChua() {
  const assetTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...([
        ['Mã tài sản',   'asset.code'],
        ['Tên thiết bị', 'asset.name'],
        ['Số serial',    'asset.serialNo'],
        ['Model',        'asset.model'],
        ['Vị trí',       'asset.location'],
        ['Mô tả sự cố',  'issueDescription'],
        ['Mức độ',       'severity'],
        ['Hình thức SC', 'repairType'],
        ['Đơn vị SC',    'vendorName'],
        ['Ngày mở lệnh', 'openedAt'],
        ['Ngày hoàn thành', 'closedAt'],
      ].map(([label, field]) => new TableRow({ children: [
        tc(p([r(label, { bold: true, size: SZ })]), { w: 35, shade: true }),
        dc(`{${field}}`, 65),
      ]}))),
    ],
  })

  const partsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 5), hc('Tên linh kiện / Vật tư', 35), hc('Thao tác', 15),
        hc('SL', 8), hc('Đơn giá', 15), hc('Thành tiền', 15), hc('Serial', 7),
      ]}),
      new TableRow({ children: [
        dc('{#parts}{i}',   5,  AlignmentType.CENTER),
        dc('{name}',       35),
        dc('{action}',     15),
        dc('{qty}',         8,  AlignmentType.RIGHT),
        dc('{unitCost}',   15,  AlignmentType.RIGHT),
        dc('{partTotal}',  15,  AlignmentType.RIGHT),
        dc('{serialNo}{/parts}', 7),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('LỆNH SỬA CHỮA / BẢO TRÌ THIẾT BỊ'),
    assetTable,
    p('', { after: 60 }),
    p([r('Chi tiết linh kiện / vật tư sử dụng:', { bold: true, size: SZ_MD })]),
    p('', { after: 20 }),
    partsTable,
    p('', { after: 60 }),
    infoRow('Chi phí nhân công', 'laborCost'),
    infoRow('Chi phí linh kiện', 'partsCost'),
    infoRowOptional('Chẩn đoán', 'diagnosis'),
    infoRowOptional('Cách xử lý', 'resolution'),
    infoRowOptional('Ghi chú', 'note'),
    dateNoteLine(),
    sigTable([
      { label: 'Người yêu cầu', field: '' },
      { label: 'Kỹ thuật viên', field: 'technicianName' },
      { label: 'Người nghiệm thu', field: '' },
      { label: 'Phê duyệt', field: '' },
    ]),
  ])
}

// ─── BIÊN BẢN KIỂM KÊ ────────────────────────────────────────────────────────
function tplBienBanKiemKe() {
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        hc('Tổng theo sổ sách', 20), hc('Thực tế kiểm kê', 20),
        hc('Khớp', 14), hc('Thiếu', 14), hc('Thừa', 14), hc('Tỷ lệ khớp', 18),
      ]}),
      new TableRow({ children: [
        dc('{totalExpected}',     20, AlignmentType.CENTER),
        dc('{totalFound}',        20, AlignmentType.CENTER),
        dc('{totalMatched}',      14, AlignmentType.CENTER),
        dc('{totalMissing}',      14, AlignmentType.CENTER),
        dc('{totalExtra}',        14, AlignmentType.CENTER),
        dc('{matchRate}',         18, AlignmentType.CENTER),
      ]}),
    ],
  })

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 4), hc('Mã TS', 10), hc('Tên tài sản', 22), hc('Serial', 12),
        hc('Vị trí', 14), hc('TT sổ sách', 12), hc('TT thực tế', 12),
        hc('Khớp', 6), hc('Ghi chú', 8),
      ]}),
      new TableRow({ children: [
        dc('{#items}{i}',       4,  AlignmentType.CENTER),
        dc('{assetCode}',      10),
        dc('{assetName}',      22),
        dc('{serialNo}',       12),
        dc('{location}',       14),
        dc('{statusExpected}', 12, AlignmentType.CENTER),
        dc('{statusFound}',    12, AlignmentType.CENTER),
        dc('{isMatched}',       6, AlignmentType.CENTER),
        dc('{itemNote}{/items}', 8),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BIÊN BẢN KIỂM KÊ TÀI SẢN'),
    infoRowOptional('Kỳ kiểm kê', 'period'),
    infoRowOptional('Địa điểm', 'location'),
    infoRowOptional('Phòng ban', 'department'),
    infoRow('Người kiểm kê', 'inspector'),
    infoRowOptional('Người chứng kiến', 'witness'),
    p('', { after: 40 }),
    p([r('Tổng hợp kết quả:', { bold: true, size: SZ_MD })]),
    summaryTable,
    p('', { after: 60 }),
    p([r('Chi tiết:', { bold: true, size: SZ_MD })]),
    p('', { after: 20 }),
    itemsTable,
    p('', { after: 40 }),
    infoRowOptional('Nhận xét / Ghi chú', 'note'),
    dateNoteLine(),
    sigTable([
      { label: 'Người kiểm kê',       field: 'inspector' },
      { label: 'Người chứng kiến',     field: 'witness' },
      { label: 'Kế toán tài sản',      field: '' },
      { label: 'Lãnh đạo phê duyệt',   field: '' },
    ]),
  ])
}

// ─── PHIẾU MƯỢN ──────────────────────────────────────────────────────────────
function tplPhieuMuon() {
  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 5), hc('Mã thiết bị', 14), hc('Tên thiết bị', 30),
        hc('Số serial', 18), hc('Tình trạng khi mượn', 22), hc('Ghi chú', 11),
      ]}),
      new TableRow({ children: [
        dc('{#items}{i}',      5,  AlignmentType.CENTER),
        dc('{assetCode}',     14),
        dc('{assetName}',     30),
        dc('{serialNo}',      18),
        dc('{condition}',     22),
        dc('{itemNote}{/items}', 11),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('PHIẾU MƯỢN THIẾT BỊ'),
    infoRow('Người mượn', 'borrower'),
    infoRowOptional('Mã nhân viên', 'borrowerId'),
    infoRowOptional('Phòng ban', 'department'),
    infoRow('Mục đích sử dụng', 'purpose'),
    infoRow('Ngày mượn', 'date'),
    infoRow('Dự kiến trả ngày', 'expectedReturnDate'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 60 }),
    itemsTable,
    dateNoteLine(),
    sigTable([
      { label: 'Người mượn',        field: 'borrower' },
      { label: 'Người cho mượn',    field: 'lenderName' },
      { label: 'Quản lý phê duyệt', field: '' },
    ]),
  ])
}

// ─── BIÊN BẢN THANH LÝ ───────────────────────────────────────────────────────
function tplBienBanThanhLy() {
  const assetsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 4), hc('Mã TS', 9), hc('Tên tài sản', 20), hc('Serial', 10),
        hc('Năm mua', 9), hc('Nguyên giá', 12), hc('GT còn lại', 12),
        hc('Tình trạng', 12), hc('Lý do TL', 12),
      ]}),
      new TableRow({ children: [
        dc('{#assets}{i}',       4,  AlignmentType.CENTER),
        dc('{code}',             9),
        dc('{name}',            20),
        dc('{serialNo}',        10),
        dc('{purchaseDate}',     9,  AlignmentType.CENTER),
        dc('{originalValue}',   12,  AlignmentType.RIGHT),
        dc('{residualValue}',   12,  AlignmentType.RIGHT),
        dc('{condition}',       12),
        dc('{reason}{/assets}', 12),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BIÊN BẢN THANH LÝ TÀI SẢN'),
    infoRow('Người đề xuất', 'proposedBy'),
    infoRowOptional('Phòng ban', 'department'),
    infoRow('Hình thức thanh lý', 'disposalMethod'),
    infoRowOptional('Số tiền thu hồi', 'proceedsAmount'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 60 }),
    assetsTable,
    dateNoteLine(),
    sigTable([
      { label: 'Người đề xuất',        field: 'proposedBy' },
      { label: 'Kế toán',              field: '' },
      { label: 'Trưởng HĐ / Phê duyệt', field: 'approvedBy' },
    ]),
  ])
}

// ─── PHIẾU YÊU CẦU MUA SẮM ───────────────────────────────────────────────────
function tplPhieuYeuCauMuaSam() {
  const urgencyMap = 'Thấp / Trung bình / Cao / Khẩn cấp'

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 4), hc('Tên hàng hóa / Thiết bị', 28), hc('Thông số kỹ thuật', 22),
        hc('SL', 6), hc('Đơn giá dự tính', 15), hc('Thành tiền', 14), hc('Ghi chú', 11),
      ]}),
      new TableRow({ children: [
        dc('{#items}{i}',      4,  AlignmentType.CENTER),
        dc('{name}',          28),
        dc('{specs}',         22),
        dc('{qty}',            6,  AlignmentType.RIGHT),
        dc('{unitPrice}',     15,  AlignmentType.RIGHT),
        dc('{total}',         14,  AlignmentType.RIGHT),
        dc('{itemNote}{/items}', 11),
      ]}),
      new TableRow({ children: [
        tc(p([r('Tổng dự toán', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 75, colSpan: 5 }),
        tc(p([r('{totalEstimate}', { bold: true, size: SZ })], { align: AlignmentType.RIGHT }), { w: 14 }),
        tc(p(''), { w: 11 }),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('PHIẾU YÊU CẦU MUA SẮM'),
    infoRow('Người đề xuất', 'requester'),
    infoRowOptional('Phòng ban', 'department'),
    infoRow('Mức độ ưu tiên', 'urgency'),
    infoRow('Mục đích', 'purpose'),
    infoRowOptional('Lý do / Căn cứ', 'justification'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 60 }),
    itemsTable,
    dateNoteLine(),
    sigTable([
      { label: 'Người đề xuất',    field: 'requester' },
      { label: 'Trưởng bộ phận',   field: '' },
      { label: 'Phòng kế toán',    field: '' },
      { label: 'Lãnh đạo phê duyệt', field: 'approvedBy' },
    ]),
  ])
}

// ─── BÁO CÁO TỔNG HỢP TÀI SẢN ───────────────────────────────────────────────
function tplBaoCaoTaiSan() {
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        hc('Tổng số tài sản', 18), hc('Tổng giá trị', 18), hc('Đang sử dụng', 16),
        hc('Trong kho', 16), hc('Đang sửa chữa', 16), hc('Đã nghỉ hưu', 16),
      ]}),
      new TableRow({ children: [
        dc('{totalAssets}',  18, AlignmentType.CENTER),
        dc('{totalValue}',   18, AlignmentType.RIGHT),
        dc('{inUse}',        16, AlignmentType.CENTER),
        dc('{inStock}',      16, AlignmentType.CENTER),
        dc('{inRepair}',     16, AlignmentType.CENTER),
        dc('{retired}',      16, AlignmentType.CENTER),
      ]}),
    ],
  })

  const catTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hc('STT', 5), hc('Danh mục', 35), hc('Tổng số', 14),
        hc('Đang dùng', 15), hc('Trong kho', 15), hc('Giá trị', 16),
      ]}),
      new TableRow({ children: [
        dc('{#byCategory}{i}', 5, AlignmentType.CENTER),
        dc('{categoryName}',  35),
        dc('{count}',         14, AlignmentType.CENTER),
        dc('{inUse}',         15, AlignmentType.CENTER),
        dc('{inStock}',       15, AlignmentType.CENTER),
        dc('{value}{/byCategory}', 16, AlignmentType.RIGHT),
      ]}),
    ],
  })

  return makeDoc([
    ...orgHeader(),
    ...formTitle('BÁO CÁO TỔNG HỢP TÀI SẢN'),
    infoRow('Kỳ báo cáo', 'reportPeriod'),
    infoRow('Người lập', 'preparedBy'),
    infoRowOptional('Ghi chú', 'note'),
    p('', { after: 40 }),
    p([r('I. Tổng quan:', { bold: true, size: SZ_MD })]),
    summaryTable,
    p('', { after: 60 }),
    p([r('II. Theo danh mục:', { bold: true, size: SZ_MD })]),
    p('', { after: 20 }),
    catTable,
    dateNoteLine(),
    sigTable([
      { label: 'Người lập báo cáo',  field: 'preparedBy' },
      { label: 'Kế toán trưởng',     field: '' },
      { label: 'Lãnh đạo xác nhận',  field: '' },
    ]),
  ])
}

// ─── Main ────────────────────────────────────────────────────────────────────
const TEMPLATES = {
  'phieu-nhap-kho':       tplPhieuNhapKho,
  'phieu-xuat-kho':       tplPhieuXuatKho,
  'bien-ban-ban-giao':    tplBienBanBanGiao,
  'bien-ban-luan-chuyen': tplBienBanLuanChuyen,
  'bien-ban-thu-hoi':     tplBienBanThuHoi,
  'lenh-sua-chua':        tplLenhSuaChua,
  'bien-ban-kiem-ke':     tplBienBanKiemKe,
  'phieu-muon':           tplPhieuMuon,
  'bien-ban-thanh-ly':    tplBienBanThanhLy,
  'yeu-cau-mua-sam':      tplPhieuYeuCauMuaSam,
  'bao-cao-tai-san':      tplBaoCaoTaiSan,
}

fs.mkdirSync(OUT_DIR, { recursive: true })

console.log(`Đang tạo template tại: ${OUT_DIR}\n`)
for (const [name, creator] of Object.entries(TEMPLATES)) {
  const doc    = creator()
  const buffer = await Packer.toBuffer(doc)
  const outPath = path.join(OUT_DIR, `${name}.docx`)
  fs.writeFileSync(outPath, buffer)
  const kb = (buffer.length / 1024).toFixed(1)
  console.log(`  ✓ ${name}.docx  (${kb} KB)`)
}

console.log(`\nHoàn tất! ${Object.keys(TEMPLATES).length} templates đã được tạo.`)
console.log('Mở các file trong Microsoft Word để chỉnh sửa định dạng.')
console.log('Syntax docxtemplater: {field}, {#array}...{/array}, {^array}...{/array}')
