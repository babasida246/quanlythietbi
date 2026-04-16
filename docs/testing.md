# Testing

## 1. Test stack

| Tool | Dùng cho |
| --- | --- |
| Playwright | E2E tests: API (HTTP) + UI (browser) |
| Vitest | Unit tests trong packages và apps |

Config files:

- [playwright.config.ts](../playwright.config.ts)
- [vitest.config.ts](../vitest.config.ts)

## 2. Playwright projects

```text
playwright.config.ts:
  projects:
    - api      → tests/api/    → baseURL: http://localhost:4010
    - chromium → tests/ui/     → baseURL: http://localhost:4011
  webServer (auto-start):
    - API:    pnpm --filter @qltb/api dev    → port 4010
    - Web UI: vite dev --port 4011           → port 4011
```

## 3. Commands

```bash
pnpm test               # Vitest unit tests
pnpm test:e2e           # Playwright tất cả (API + UI)
pnpm test:api           # Playwright — chỉ API tests (port 4010)
pnpm test:ui            # Playwright — chỉ UI tests (port 4011)
pnpm test:smoke         # Chỉ tests có @smoke tag
pnpm test:report        # Mở Playwright HTML report
pnpm test:lint          # Lint toàn bộ
pnpm test:typecheck     # tsc --build
```

## 4. Reporters

Playwright reporters đang cấu hình:

- `list` — terminal output
- `html` → `playwright-report/`
- `json` → `playwright-report/results.json`

## 5. Quy tắc viết test

**UI tests** (`tests/ui/`):

```typescript
test.describe('Tên module', () => {
    test('tên test cụ thể', async ({ page }) => {
        await page.goto('/login')
        await page.fill('[data-testid="email"]', 'admin@example.com')
        // ...
    })
})
```

**API tests** (`tests/api/`):

```typescript
test('GET /api/v1/assets returns list', async ({ request }) => {
    const res = await request.get('/api/v1/assets', {
        headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.status()).toBe(200)
})
```

- Dùng `request` fixture (không dùng `page`) cho API tests.
- Dùng `data-testid` attribute cho các element cần assert trong UI tests.
- Login helper: dùng `tests/fixtures/` hoặc `page.goto('/login')` rồi fill form.
- Smoke tests: đánh tag `@smoke` để chạy riêng.

## 6. Test environment

File `.env.test` ở root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qltb_test
PORT=4010
VITE_API_BASE=http://localhost:4010/api
```

- API test: port 4010
- Web test: port 4011
- DB: `qltb_test` (tách biệt với DB dev `qltb`)

## 7. Workflow thường dùng

```bash
# Kiểm tra nhanh trước khi commit
pnpm test:lint
pnpm test:typecheck
pnpm test

# Full E2E
pnpm test:e2e

# Xem HTML report sau khi chạy E2E
npx playwright show-report

# Chỉ smoke tests
npx playwright test --grep "@smoke"
```
