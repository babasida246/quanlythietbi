/**
 * effectivePermsStore — Svelte store cho unified effective permissions
 *
 * Lifecycle:
 *  1. Sau login: root layout gọi loadEffectivePerms(userId)
 *  2. Mọi component dùng getCapabilities() sẽ tự động nhận perms từ store thay vì hardcode
 *  3. Logout: clearEffectivePerms()
 *
 * Storage strategy:
 *  - sessionStorage('qltb_effective_perms_v1') → persist qua page refresh trong cùng tab
 *  - Không dùng localStorage vì perms có thể thay đổi khi admin chỉnh sửa
 */

import { writable, get, derived } from 'svelte/store'

const STORAGE_KEY = 'qltb_effective_perms_v1'

// Callback để layout trigger re-fetch khi store bị clear từ nơi khác
let _refreshCallback: (() => void) | null = null

export interface CachedEffectivePerms {
    userId: string
    allowed: string[]  // merged classic + directory, DENY đã loại
    denied: string[]
    cachedAt: number   // timestamp ms
}

function loadFromSession(): CachedEffectivePerms | null {
    if (typeof sessionStorage === 'undefined') return null
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as CachedEffectivePerms
    } catch {
        return null
    }
}

function saveToSession(data: CachedEffectivePerms): void {
    if (typeof sessionStorage === 'undefined') return
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* quota exceeded — ignore */ }
}

// ── Store ─────────────────────────────────────────────────────────────────────
const _store = writable<CachedEffectivePerms | null>(
    typeof window !== 'undefined' ? loadFromSession() : null
)

export const effectivePermsStore = {
    subscribe: _store.subscribe,

    /** Ghi unified perms vào store + sessionStorage */
    set(data: CachedEffectivePerms): void {
        _store.set(data)
        saveToSession(data)
    },

    /** Xóa khi logout hoặc sau khi thay đổi policy */
    clear(): void {
        _store.set(null)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEY)
        }
    },

    /** Đăng ký callback để layout tự re-fetch sau khi store bị clear */
    onRefreshNeeded(cb: () => void): void {
        _refreshCallback = cb
    },

    /**
     * Xóa cache sessionStorage và yêu cầu layout re-fetch.
     * Gọi sau khi thay đổi policy/assignment để UI phản ánh ngay.
     * Giữ nguyên in-memory store trong khi đang re-fetch (stale-while-revalidate)
     * để tránh fallback về wildcard SYSTEM_ROLE_PERMISSIONS trong khoảng thời gian fetch.
     */
    invalidate(): void {
        // Chỉ xóa sessionStorage — store trong memory vẫn giữ để tránh wildcard fallback
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEY)
        }
        _refreshCallback?.()
    },

    /** Lấy allowed Set — dùng trong getCapabilities */
    getAllowedSet(): Set<string> {
        const data = get(_store)
        if (!data) return new Set()
        return new Set(data.allowed)
    },

    /** Lấy allowed array — tiện để log / debug */
    getAllowed(): string[] {
        return get(_store)?.allowed ?? []
    },

    /** Kiểm tra có perms được cache chưa (tránh re-fetch) */
    hasCache(userId: string): boolean {
        const data = get(_store)
        if (!data || data.userId !== userId) return false
        // Cache hết hạn sau 1 phút — đủ ngắn để phản ánh thay đổi policy kịp thời
        return Date.now() - data.cachedAt < 60 * 1000
    },
}

/**
 * Reactive store trả về mảng allowed permissions.
 * Dùng trong components: `const caps = $derived(getCapabilities(role, $allowedPerms))`
 * Tự động cập nhật khi effectivePermsStore thay đổi (bao gồm sau khi invalidate()).
 */
export const allowedPerms = derived(_store, ($s) => $s?.allowed ?? [])
