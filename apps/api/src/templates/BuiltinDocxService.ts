/**
 * BuiltinDocxService
 *
 * Đọc template .docx từ thư mục templates/docx/ và render bằng docxtemplater.
 *
 * Tạo lại templates bằng cách chạy:
 *   node scripts/generate-docx-templates.mjs
 *
 * Chỉnh sửa templates trong Microsoft Word sau khi generate, rồi lưu lại là xong.
 * Syntax trong Word:
 *   {field}             – thay thế đơn giản
 *   {#items}...{/items} – lặp theo array (dùng cho hàng bảng)
 *   {^items}...{/items} – hiển thị khi array rỗng
 */

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Resolve thư mục templates tương đối với file này
// - Dev: src/templates/BuiltinDocxService.ts → src/templates/docx/
// - Prod (sau tsup): dist/templates/BuiltinDocxService.js → dist/templates/docx/
const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, 'docx')

export type PrintType =
  | 'phieu-nhap-kho'
  | 'phieu-xuat-kho'
  | 'bien-ban-ban-giao'
  | 'bien-ban-luan-chuyen'
  | 'bien-ban-thu-hoi'
  | 'lenh-sua-chua'
  | 'bien-ban-kiem-ke'
  | 'phieu-muon'
  | 'bien-ban-thanh-ly'
  | 'yeu-cau-mua-sam'
  | 'bao-cao-tai-san'

export const BUILTIN_PRINT_TYPES: PrintType[] = [
  'phieu-nhap-kho',
  'phieu-xuat-kho',
  'bien-ban-ban-giao',
  'bien-ban-luan-chuyen',
  'bien-ban-thu-hoi',
  'lenh-sua-chua',
  'bien-ban-kiem-ke',
  'phieu-muon',
  'bien-ban-thanh-ly',
  'yeu-cau-mua-sam',
  'bao-cao-tai-san',
]

export class BuiltinDocxService {
  /**
   * Render một template có sẵn với dữ liệu.
   *
   * @param printType  – tên template (vd: 'phieu-nhap-kho')
   * @param data       – object với các key tương ứng {placeholder} trong template
   * @returns Buffer chứa file .docx đã được render
   */
  async render(printType: string, data: Record<string, unknown>): Promise<Buffer> {
    if (!BUILTIN_PRINT_TYPES.includes(printType as PrintType)) {
      throw new Error(`Unknown print type: "${printType}". Valid types: ${BUILTIN_PRINT_TYPES.join(', ')}`)
    }

    const templatePath = join(TEMPLATES_DIR, `${printType}.docx`)
    let templateBuffer: Buffer
    try {
      templateBuffer = await readFile(templatePath)
    } catch {
      throw new Error(
        `Template file not found: ${templatePath}. ` +
        `Run: node scripts/generate-docx-templates.mjs`
      )
    }

    const [{ default: Docxtemplater }, { default: PizZip }] = await Promise.all([
      import('docxtemplater'),
      import('pizzip'),
    ])

    const zip = new PizZip(templateBuffer)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })

    doc.render(data)

    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
  }
}
