# Testing Guide - QLTB

Tai lieu nay tong hop chien luoc va quy trinh test cho QLTB.

## 1. Testing goals

- Bao ve luong nghiep vu cot loi (asset lifecycle, warehouse, auth, workflow)
- Phat hien regression som truoc merge/release
- Tao confidence cho thay doi schema/API/UI

## 2. Test stack

- Unit tests: Vitest
- API/UI E2E: Playwright
- Additional smoke flows: Playwright grep tags va script test

## 3. Test layers

### Unit tests (Vitest)

Phu hop cho:

- Utility functions
- Pure business rules
- Mapping/parsing logic

Command:

```bash
pnpm test
```

### API tests (Playwright project `api`)

Phu hop cho:

- Endpoint behavior
- Auth, validation, response contract
- Error handling

Command:

```bash
pnpm test:api
```

### UI tests (Playwright project `chromium`)

Phu hop cho:

- Critical user journeys
- RBAC visibility and guard
- Form actions + table workflows

Command:

```bash
pnpm test:ui
```

### Full E2E / smoke

```bash
pnpm test:e2e
pnpm test:smoke
```

## 4. Local test workflow khuyen nghi

1. Chuan bi data:

```bash
pnpm dev:infra
pnpm db:reset
```

2. Chay nhanh bo test lien quan truoc:

```bash
pnpm test:api
pnpm test:ui
```

3. Truoc merge:

```bash
pnpm test:e2e
pnpm typecheck
pnpm build
```

## 5. Playwright conventions

- Tach ro API tests (`tests/api`) va UI tests (`tests/ui`)
- Uu tien selector on dinh (`data-testid`) cho UI assertions
- Moi test case nen doc lap ve data setup/expectation
- Tranh coupling test order

Khi can debug:

```bash
pnpm test:headed
pnpm test:debug
pnpm test:report
```

## 6. API test conventions

- Assert status code, payload shape, business fields quan trong
- Validate ca success va failure paths
- Khong assert qua chat vao message text de tranh flaky

## 7. UI test conventions

- Cover critical paths theo role: admin, manager, requester...
- Assert behavior thay vi chi assert visual text
- Co retry strategy phu hop cho async UI states

## 8. Data management cho test

Nguon du lieu:

- `db/seed-*.sql`
- test fixtures trong `tests/fixtures` va `tests/seed`

Nguyen tac:

- Test phai co expectation ro ve precondition data
- Neu test can data dac thu, setup trong fixture/test setup
- Cleanup neu test tao du lieu lam anh huong test khac

## 9. Flaky test playbook

Khi test flaky:

1. Kiem tra race condition (UI loading, network idle)
2. Kiem tra selector khong on dinh
3. Kiem tra phu thuoc data chia se
4. Kiem tra timeout qua thap
5. Thu run test rieng de isolate

## 10. Minimum quality gate de merge

Khuyen nghi toi thieu:

- `pnpm typecheck` pass
- `pnpm build` pass
- API tests lien quan pass
- UI tests lien quan pass

Neu thay doi rong/nhay cam:

- Chay full `pnpm test:e2e`

## 11. CI/CD testing strategy (recommended)

- PR pipeline:
  - Typecheck + build + targeted API/UI tests
- Nightly pipeline:
  - Full E2E + smoke + reporting

## 12. Testing checklist trong code review

- Co test cho behavior moi hoac bug fix khong?
- Assertions co tap trung vao business outcome khong?
- Test co doc lap, khong order-dependent khong?
- Co bo sung/doi fixture du de tai hien bug khong?
