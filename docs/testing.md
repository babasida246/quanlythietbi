# Hướng dẫn Testing

## Tổng quan

| Framework | Mục đích | Cấu hình |
|-----------|----------|----------|
| **Playwright** | E2E testing (API + UI) | `playwright.config.ts` |
| **Vitest** | Unit testing | `vitest.config.ts` |

### Thống kê Test

| Loại | Files | Tests |
|------|-------|-------|
| UI E2E (Playwright) | 27 | ~335 |
| API E2E (Playwright) | 7 | ~30 |
| Unit tests (Vitest) | — | — |
| **Tổng** | **34+** | **365+** |

---

## Cách chạy Tests

### E2E Tests (Playwright)

```bash
# Chạy tất cả E2E tests
pnpm test:e2e

# Chạy chỉ UI tests
pnpm test:ui

# Chạy chỉ API tests
pnpm test:api

# Chạy test cụ thể
npx playwright test tests/ui/asset-crud.spec.ts

# Chạy tests có keyword
npx playwright test --grep "login"

# Chạy với reporter
npx playwright test --reporter=list

# Chạy với debug
npx playwright test --debug

# Xem HTML report
npx playwright show-report
```

### Unit Tests (Vitest)

```bash
# Chạy tất cả unit tests
pnpm test

# Chạy unit tests cho API
pnpm --filter @qltb/api test

# Chạy unit tests cho Web UI
pnpm --filter @qltb/web-ui test
```

### Test Pipeline đầy đủ

```bash
# Lint → typecheck → unit → build → docker up → playwright → docker down
pnpm test:all
```

---

## Playwright Configuration

File: `playwright.config.ts`

```
testDir: './tests'
fullyParallel: true
retries: CI ? 2 : 0
timeout: 60_000
expect.timeout: 10_000

projects:
  - name: 'api'       → testDir: './tests/api'    → baseURL: :4010
  - name: 'chromium'   → testDir: './tests/ui'     → baseURL: :4011

webServer:
  - API:  pnpm --filter @qltb/api dev    → :4010/health
  - Web:  vite dev --port 4011           → :4011/login
```

### Global Setup/Teardown

- `tests/global.setup.ts` — Chờ servers sẵn sàng, đảm bảo DB migrated + seeded
- `tests/global.teardown.ts` — Cleanup

---

## Viết Test Mới

### Cấu trúc thư mục

```
tests/
├── global.setup.ts          # Setup chung
├── global.teardown.ts       # Teardown chung
├── helpers.ts               # Utility functions
├── seed/
│   └── seed.ts              # Test-specific seed data
├── api/
│   ├── health.spec.ts
│   ├── assets.spec.ts
│   ├── catalogs.spec.ts
│   ├── cmdb-p4.spec.ts
│   ├── communications.spec.ts
│   ├── warehouse-inventory.spec.ts
│   └── workflow-authz.spec.ts
└── ui/
    ├── auth-flow.spec.ts
    ├── admin-user-management.spec.ts
    ├── analytics-dashboard.spec.ts
    ├── asset-crud.spec.ts
    ├── asset-increase-catalogs.spec.ts
    ├── automation-crud.spec.ts
    ├── catalog-vendor-crud.spec.ts
    ├── cmdb-p4-flow.spec.ts
    ├── cmdb-services.spec.ts
    ├── comprehensive.spec.ts
    ├── help-page.spec.ts
    ├── inbox-notifications.spec.ts
    ├── integrations-crud.spec.ts
    ├── legacy-redirects.spec.ts
    ├── maintenance-full-flow.spec.ts
    ├── my-assets-requests.spec.ts
    ├── navigation.spec.ts
    ├── purchase-plan-flow.spec.ts
    ├── repair-order-flow.spec.ts
    ├── request-approval-flow.spec.ts
    ├── role-based-access.spec.ts
    ├── security-compliance.spec.ts
    ├── setup-wizard.spec.ts
    ├── smoke-empty-state.spec.ts
    ├── ui-design-audit.spec.ts
    ├── warehouse-crud.spec.ts
    └── warehouse-document-flow.spec.ts
```

### Template UI Test

```typescript
import { test, expect, type Page } from '@playwright/test'
import { applyUiAuth, goto, assertNoObjectObject } from '../helpers'

test.describe('Feature Name', () => {
    test.beforeEach(async ({ page }) => {
        await applyUiAuth(page, 'admin')
    })

    test('should load page', async ({ page }) => {
        await goto(page, '/path')
        
        // Verify page loaded (not error)
        const body = await page.textContent('body')
        expect(body!.length).toBeGreaterThan(100)
        
        // Check no i18n errors
        await assertNoObjectObject(page, 'Page name')
    })

    test('should show data', async ({ page }) => {
        await goto(page, '/path')
        
        // Wait for content
        const heading = page.locator('h1, h2, h3').first()
        await expect(heading).toBeVisible({ timeout: 10000 })
    })
})
```

### Helper Functions

| Function | Mô tả |
|----------|-------|
| `applyUiAuth(page, role)` | Inject JWT vào localStorage cho role ('admin' or 'user') |
| `goto(page, path)` | Navigate tới path với `domcontentloaded` + wait 1500ms |
| `assertNoObjectObject(page, context)` | Kiểm tra không có `[object Object]` trên trang (i18n regression) |

### Authentication trong Tests

```typescript
// Admin role
await applyUiAuth(page, 'admin')

// Regular user role
await applyUiAuth(page, 'user')
```

JWT được ký với `dev-access-secret-key` và inject trực tiếp vào localStorage. Không cần login qua UI.

---

## Best Practices

### 1. Navigation — Dùng `domcontentloaded`

```typescript
// ✅ ĐÚNG — Dùng domcontentloaded + waitForTimeout
await goto(page, '/assets')

// ❌ SAI — networkidle gây timeout trên các trang có API polling
await page.goto('/assets', { waitUntil: 'networkidle' })
```

### 2. Selectors — Ưu tiên data-testid

```typescript
// ✅ Ưu tiên
page.locator('[data-testid="btn-create"]')
page.getByRole('heading', { name: /text/i })
page.getByText(/text/i)

// ✅ OK cho elements không có testid
page.locator('table tbody tr')
page.locator('button:has-text("Create")')
page.locator('select:visible')

// ❌ Tránh — brittle selectors
page.locator('.css-class-name')
page.locator('#specific-id')
```

### 3. Visible Selector cho Tabs

```typescript
// ✅ ĐÚNG — Dùng :visible khi có nhiều elements trùng tên
const tab = page.locator('button:has-text("Rules"):visible')
await tab.click()

// ❌ SAI — Click vào element ẩn
const tab = page.locator('button:has-text("Rules")')
await tab.click()  // Có thể click element hidden
```

### 4. No RBAC on Frontend

```typescript
// ✅ ĐÚNG — Tất cả users đều access được tất cả routes
test('user can access admin page', async ({ page }) => {
    await applyUiAuth(page, 'user')
    await goto(page, '/admin')
    expect(body!.length).toBeGreaterThan(100) // Page loads fine
})

// ❌ SAI — App KHÔNG enforce RBAC ở frontend
test('user is forbidden from admin', async ({ page }) => {
    // Sẽ FAIL vì user vẫn access được!
})
```

> **Lưu ý:** RBAC chỉ được enforce ở API level, không ở frontend. Tất cả authenticated users có thể navigate tới mọi route.

### 5. Assertions — Kiểm tra nội dung

```typescript
// ✅ Verify page loaded với nội dung thực
const body = await page.textContent('body')
expect(body!.length).toBeGreaterThan(100)

// ✅ Kiểm tra heading readable (không phải translation key)
const heading = await page.locator('h1, h2, h3').first().textContent()
expect(heading!.length).toBeGreaterThan(2)
expect(heading).not.toContain('.')  // Not a translation key like "admin.title"

// ✅ Check i18n
await assertNoObjectObject(page, 'feature name')
```

---

## Test Coverage Matrix

| Module | Test File | Tests | Coverage |
|--------|-----------|-------|----------|
| Auth | `auth-flow.spec.ts` | 8 | Login, forbidden, logout, 404, redirect |
| Admin | `admin-user-management.spec.ts` | 3 | Page load, user list, access control |
| Assets | `asset-crud.spec.ts` | ~10 | CRUD, list, detail |
| Assets | `asset-increase-catalogs.spec.ts` | 7 | Increase form, catalogs, inventory |
| Catalogs | `catalog-vendor-crud.spec.ts` | ~8 | Vendor/category CRUD |
| CMDB | `cmdb-p4-flow.spec.ts` | ~10 | CI CRUD, types, relationships |
| CMDB | `cmdb-services.spec.ts` | 9 | Services, reports, changes, topology |
| Warehouse | `warehouse-crud.spec.ts` | ~12 | Warehouse CRUD |
| Warehouse | `warehouse-document-flow.spec.ts` | 12 | Documents, ledger, stock, reconciliation |
| Maintenance | `maintenance-full-flow.spec.ts` | 7 | Repairs list, create, detail, filter |
| Purchase | `purchase-plan-flow.spec.ts` | 5 | List, form, submit |
| Inventory | `asset-increase-catalogs.spec.ts` | 2 | Inventory list/detail |
| Requests | `request-approval-flow.spec.ts` | 9 | User request, admin review, inbox |
| Analytics | `analytics-dashboard.spec.ts` | 8 | Analytics, reports |
| Automation | `automation-crud.spec.ts` | 4 | Rules, tabs, access |
| Integrations | `integrations-crud.spec.ts` | 5 | Connectors, tabs, access |
| Security | `security-compliance.spec.ts` | 5 | Permissions, compliance, access |
| Navigation | `navigation.spec.ts` | ~10 | Sidebar, breadcrumbs |
| RBAC | `role-based-access.spec.ts` | ~42 | All routes for all roles |
| Help | `help-page.spec.ts` | 3 | Page load, heading |
| Smoke | `comprehensive.spec.ts` | ~15 | Smoke tests across features |
| Design | `ui-design-audit.spec.ts` | ~5 | UI consistency |

---

## Troubleshooting

### Test timeout

Nguyên nhân phổ biến:
1. Server chưa sẵn sàng → Kiểm tra `pnpm dev:all`
2. Dùng `networkidle` → Đổi sang `domcontentloaded`
3. Database chưa seed → Chạy `pnpm db:reset`

### ERR_CONNECTION_FAILED

Server restart do SQL error. Kiểm tra server logs:
```bash
# Xem logs API
pnpm --filter @qltb/api dev 2>&1 | head -50
```

### Element not found

1. Kiểm tra selector bằng Playwright Inspector: `npx playwright test --debug`
2. Tăng timeout: `await expect(element).toBeVisible({ timeout: 15000 })`
3. Dùng `:visible` cho elements có thể bị hidden

### i18n Keys hiển thị thay vì text

Kiểm tra `assertNoObjectObject()` trong test. Nếu thấy `[object Object]` → lỗi i18n format.
