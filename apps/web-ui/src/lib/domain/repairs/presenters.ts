/**
 * Repair domain presenters — single source of truth for labels, badge mappings,
 * and formatting utilities. Import these in all repair-related pages/components.
 * Never hardcode labels or colours in the UI layer.
 */

// ── Status ─────────────────────────────────────────────────────────────────

export const repairStatusLabel: Record<string, string> = {
    open: 'Mở',
    diagnosing: 'Đang chẩn đoán',
    waiting_parts: 'Chờ linh kiện',
    repaired: 'Đã sửa xong',
    closed: 'Đã đóng',
    canceled: 'Đã hủy',
};

/** Maps status → existing global badge-* CSS class */
export const repairStatusBadge: Record<string, string> = {
    open: 'badge-blue',
    diagnosing: 'badge-purple',
    waiting_parts: 'badge-yellow',
    repaired: 'badge-green',
    closed: 'badge-gray',
    canceled: 'badge-red',
};

// ── Severity ────────────────────────────────────────────────────────────────

export const repairSeverityLabel: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng',
};

export const repairSeverityBadge: Record<string, string> = {
    low: 'badge-gray',
    medium: 'badge-yellow',
    high: 'badge-yellow',   // re-uses yellow; override inline if orange needed
    critical: 'badge-red',
};

// ── Repair Type ─────────────────────────────────────────────────────────────

export const repairTypeLabel: Record<string, string> = {
    internal: 'Nội bộ',
    vendor: 'Nhà thầu',
};

// ── Part Action ─────────────────────────────────────────────────────────────

export const repairActionLabel: Record<string, string> = {
    replace: 'Thay thế',
    add: 'Thêm mới',
    remove: 'Tháo ra',
    upgrade: 'Nâng cấp',
};

// ── Tone (for StatsCard / BreakdownCard) ────────────────────────────────────

/** Status breakdown items colour key → BreakdownCard tone */
export const repairStatusTone: Record<string, string> = {
    open: 'blue',
    diagnosing: 'purple',
    waiting_parts: 'yellow',
    repaired: 'green',
    closed: 'gray',
    canceled: 'red',
};

export const repairSeverityTone: Record<string, string> = {
    low: 'gray',
    medium: 'yellow',
    high: 'yellow',
    critical: 'red',
};

// ── Formatters ──────────────────────────────────────────────────────────────

export function formatCurrencyVND(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
    }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatDuration(minutes: number | null | undefined): string {
    if (minutes == null || minutes === 0) return '0 phút';
    if (minutes < 60) return `${minutes} phút`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}g ${m}p` : `${h} giờ`;
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN');
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}
