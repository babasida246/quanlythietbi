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

import { writable, get } from 'svelte/store'

const STORAGE_KEY = 'qltb_effective_perms_v1'

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

    /** Xóa khi logout */
    clear(): void {
        _store.set(null)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEY)
        }
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
        // Cache hết hạn sau 5 phút
        return Date.now() - data.cachedAt < 5 * 60 * 1000
    },
}
