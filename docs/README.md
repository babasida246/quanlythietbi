# QLTB Documentation Hub

Tai lieu trong thu muc `docs/` duoc sap xep theo 3 nhu cau:

- Onboarding: hieu nhanh de chay duoc he thong
- Development: sua dung layer, dung convention
- Operations: test, release, van hanh

## 1. Bat dau o day

Neu ban moi vao du an, doc theo thu tu:

1. `../README.md`
2. `architecture.md`
3. `database.md`
4. `testing.md`

## 2. Ban do tai lieu

| File | Muc dich | Nguoi nen doc |
|---|---|---|
| `architecture.md` | Kien truc tong the, data flow, auth flow, i18n strategy, clean architecture boundaries | Tat ca dev |
| `database.md` | Migration strategy, seed strategy, schema conventions, checklist khi doi DB | Backend dev, DBA |
| `api-reference.md` | API conventions, auth model, module endpoint prefixes | Backend dev, frontend dev |
| `features.md` | Tong quan nghiep vu va man hinh theo module | Product, QA, frontend dev |
| `testing.md` | Chien luoc test, huong dan chay Playwright/Vitest, test conventions | QA, dev |
| `deployment.md` | Bien moi truong, Docker/Compose, release checklist | DevOps, backend dev |
| `feature-inventory.md` | Danh muc tinh nang chi tiet theo module | PM, BA, QA |
| `huong-dan-day-du.md` | Huong dan su dung nghiep vu end-to-end | End-user, QA |

## 3. Tinh huong thuong gap

### Them tinh nang moi

1. Doc `architecture.md` de xac dinh dung layer.
2. Doc `database.md` neu can them bang/column/index.
3. Cap nhat API theo `api-reference.md` conventions.
4. Bo sung test theo `testing.md`.

### Sua loi lien quan kho va tai san

1. Kiem tra luong Asset lifecycle trong `architecture.md`.
2. Kiem tra migration/seed lien quan trong `database.md`.
3. Chay test API/UI lien quan theo `testing.md`.

### Chuan bi release

1. Chay checklist trong `deployment.md`.
2. Chay regression tests theo `testing.md`.
3. Kiem tra lai env vars va health checks.

## 4. Quy tac cap nhat tai lieu

- Khi doi architecture, cap nhat `architecture.md` truoc.
- Khi doi schema, cap nhat `database.md` trong cung PR voi migration.
- Khi doi script test/deploy, cap nhat `testing.md` hoac `deployment.md`.
- Khong de docs mo ta hanh vi khong con ton tai trong code.

## 5. Nhanh de chay local

```bash
pnpm install
pnpm dev:infra
pnpm db:reset
pnpm dev:all
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Web UI: http://localhost:5173

## 6. Ghi chu ve ngon ngu va i18n

- UI su dung i18n split-domain tai `apps/web-ui/src/lib/i18n/locales/vi/*.json` va `apps/web-ui/src/lib/i18n/locales/en/*.json`.
- Khong cap nhat cac file monolithic `vi.json`/`en.json` neu khong duoc register.
