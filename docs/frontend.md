# Frontend

## 1. Stack

- SvelteKit 2 + **Svelte 5 runes** (SPA mode, adapter-node)
- TailwindCSS 3.4 + CSS custom properties (design tokens)
- svelte-i18n 4.0 — split domain locale files
- ECharts 6 (charts), Cytoscape 3.30 (CMDB topology), XYFlow

Config files:

- [apps/web-ui/svelte.config.js](../apps/web-ui/svelte.config.js)
- [apps/web-ui/vite.config.ts](../apps/web-ui/vite.config.ts)
- [apps/web-ui/tailwind.config.js](../apps/web-ui/tailwind.config.js)

## 2. Svelte 5 runes

Dự án dùng **Svelte 5 runes** — không dùng Svelte 4 reactive syntax cho local state:

```svelte
<!-- ✅ Svelte 5 runes -->
let count = $state(0)
let doubled = $derived(count * 2)
$effect(() => { localStorage.setItem('x', count) })
let { children } = $props()
let { value = $bindable() } = $props()

<!-- ❌ Svelte 4 syntax — không dùng -->
let count = 0; $: doubled = count * 2;
export let prop;
```

- `onMount` — side effects cần DOM hoặc load data một lần khi mount
- `$effect` — react với state changes (không phải khởi tạo một lần)
- `$derived.by(() => ...)` — khi logic derive phức tạp hơn một expression

## 3. Routing shell

Root layout: [apps/web-ui/src/routes/+layout.svelte](../apps/web-ui/src/routes/+layout.svelte)

- **Auth gate đồng bộ**: kiểm tra `localStorage.getItem('authToken')` trước render đầu tiên — tránh flash nội dung khi chưa login.
- **Sidebar shell** cho tất cả routes trong `(assets)/`
- **Shell-less** cho `login/`, `setup/`, `logout/`, `print/`
- Permissions load qua `effectivePermsStore` (RBAC Classic + Policy)
- Theme, locale, toast host

Route structure:

```text
routes/
├── +layout.svelte          # Auth guard + sidebar shell
├── (assets)/               # Layout group chính
│   ├── assets/             # Quản lý tài sản
│   ├── admin/              # Quản trị users, roles
│   ├── analytics/          # Dashboard, báo cáo
│   ├── cmdb/               # CMDB topology
│   ├── depreciation/       # Khấu hao
│   ├── inventory/          # Kiểm kê
│   ├── maintenance/        # Bảo trì, sửa chữa
│   ├── me/                 # Tài sản của tôi, yêu cầu của tôi
│   ├── requests/           # Quản lý yêu cầu (manager view)
│   ├── security/           # Bảo mật, compliance
│   ├── settings/           # Cài đặt
│   └── warehouse/          # Kho hàng
├── chat/
├── inbox/                  # Inbox phê duyệt
├── login/
├── logout/
├── notifications/
├── print/
└── setup/
```

## 4. HTTP client

[apps/web-ui/src/lib/api/httpClient.ts](../apps/web-ui/src/lib/api/httpClient.ts):

- `getStoredTokens()` / `setStoredTokens()` — quản lý localStorage
- `refreshAccessToken()` — singleton refresh (dedup concurrent calls)
- `scheduleTokenRefresh()` — proactive timer 90s trước khi hết hạn
- `visibilitychange` handler — refresh ngay nếu token < 2 phút khi tab active lại
- `authorizedFetch()` — tự động inject Bearer + retry sau 401
- `apiJson<T>()` / `apiJsonData<T>()` — typed helpers với error parsing
- `apiJsonCached<T>()` — GET cache 5s (tránh duplicate calls khi mount)

Frontend API call pattern:

```typescript
// apps/web-ui/src/lib/api/module.ts
import { API_BASE, apiJson } from './httpClient'

export async function listItems(params?: Record<string, unknown>) {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return apiJson<ListResponse>(`${API_BASE}/v1/module${qs ? '?' + qs : ''}`)
}
```

## 5. i18n — QUAN TRỌNG

**Không** sửa `locales/vi.json` hoặc `locales/en.json` (monolithic — không load).

Locale files tách theo domain:

```text
apps/web-ui/src/lib/i18n/locales/
├── vi/
│   ├── common.json      # nav.*, common.*, auth.*, table.*, form.*
│   ├── assets.json      # assets.*
│   ├── warehouse.json   # warehouse.*, stockDoc.*
│   ├── requests.json    # requests.*
│   └── ...
└── en/
    ├── common.json
    └── ...
```

Khi thêm key mới:

1. Xác định domain → tìm đúng file (vd: `requests.field.xxx` → `vi/requests.json`)
2. Thêm vào **cả hai** `vi/<domain>.json` VÀ `en/<domain>.json`
3. Dùng trong component — luôn có fallback khi `$isLoading`:

```svelte
<script>
  import { _, isLoading } from '$lib/i18n'
</script>

{$isLoading ? 'Fallback text' : $_('module.key')}
{$isLoading ? `Total (${n}):` : $_('module.total', { values: { count: n } })}
```

## 6. CSS / Design System

**Không** hardcode hex color — dùng CSS custom properties hoặc semantic Tailwind:

```svelte
<!-- ✅ Đúng -->
<p class="text-slate-400">...</p>
<div class="bg-surface-2">...</div>

<!-- ❌ Tránh -->
<p style="color: #64748b">...</p>
```

Design token source: [apps/web-ui/src/lib/styles/tokens.css](../apps/web-ui/src/lib/styles/tokens.css)

- `:root` → dark mode defaults
- `html:not(.dark)` → light mode overrides

Tailwind custom colors (`tailwind.config.js`):

- `surface-bg / surface-1 / surface-2 / surface-3` — layered surfaces
- `primary / success / warning / error / info` — semantic colors
- `border / border-strong` — semantic borders

Component classes (`app.css`): `.card`, `.btn`, `.btn-primary`, `.badge-*`, `.data-table`, `.input-base`, `.select-base`, `.modal-panel`, `.alert-*`, v.v.

## 7. RBAC client-side

```typescript
import { getCapabilities, isRouteAllowed } from '$lib/auth/capabilities'

const caps = getCapabilities(userRole, permissionsOverride)
// permissionsOverride từ effectivePermsStore (server-returned allowed list)

// Kiểm tra trước khi hiển thị action nhạy cảm
{#if caps.assets.create}
  <Button>Tạo tài sản</Button>
{/if}
```

Roles: `root`, `admin`, `super_admin`, `it_asset_manager`, `warehouse_keeper`, `technician`, `requester`, `user`, `viewer`.

## 8. Svelte page pattern

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { _, isLoading } from '$lib/i18n'
  import { listItems } from '$lib/api/module'

  let items = $state<Item[]>([])
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    try {
      const res = await listItems()
      items = res.data ?? []
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })
</script>

{#if loading}
  <div class="flex justify-center py-12">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
{:else if error}
  <div class="alert alert-error">{error}</div>
{:else}
  <!-- content -->
{/if}
```

## 9. Build

```bash
pnpm build:web
```

Output: `apps/web-ui/build/` (SvelteKit adapter-node).

`VITE_API_BASE` là build-time variable — nếu đổi domain API cần rebuild web bundle.
