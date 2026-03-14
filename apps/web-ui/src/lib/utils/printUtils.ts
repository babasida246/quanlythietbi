/**
 * Utility functions for printing and PDF export.
 *
 * Usage (from any page that has the data loaded):
 *   import { openPrintPage } from '$lib/utils/printUtils'
 *   openPrintPage('phieu-nhap-kho', docId, formattedData)
 */

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

export const PRINT_LABELS: Record<PrintType, string> = {
    'phieu-nhap-kho': 'Phiếu nhập kho',
    'phieu-xuat-kho': 'Phiếu xuất kho',
    'bien-ban-ban-giao': 'Biên bản bàn giao thiết bị',
    'bien-ban-luan-chuyen': 'Biên bản luân chuyển thiết bị',
    'bien-ban-thu-hoi': 'Biên bản thu hồi thiết bị',
    'lenh-sua-chua': 'Lệnh sửa chữa',
    'bien-ban-kiem-ke': 'Biên bản kiểm kê',
    'phieu-muon': 'Phiếu mượn thiết bị',
    'bien-ban-thanh-ly': 'Biên bản thanh lý',
    'yeu-cau-mua-sam': 'Phiếu yêu cầu mua sắm',
    'bao-cao-tai-san': 'Báo cáo tổng hợp tài sản',
}

/**
 * Open the print page in a new browser tab, passing data as base64-encoded JSON.
 * The print page will decode and render the template.
 */
export function openPrintPage(type: PrintType, id: string, data: unknown): void {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    const url = `/print/${type}/${encodeURIComponent(id)}?data=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Decode the `data` query param passed to a print page.
 */
export function decodePrintData<T>(searchParams: URLSearchParams): T | null {
    const raw = searchParams.get('data')
    if (!raw) return null
    try {
        return JSON.parse(decodeURIComponent(escape(atob(raw)))) as T
    } catch {
        return null
    }
}

/**
 * Format a date string to Vietnamese format dd/MM/yyyy.
 */
export function fmtDateVi(dateStr?: string | null): string {
    if (!dateStr) return ''
    try {
        const d = new Date(dateStr)
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    } catch {
        return dateStr
    }
}

/**
 * Format number as VND currency string.
 */
export function fmtVnd(n?: number | null): string {
    if (n == null) return ''
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
}
