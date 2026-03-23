# Architecture Guide - QLTB

Tai lieu nay mo ta kien truc thuc te cua QLTB theo goc nhin implementation.

## 1. System context

QLTB la he thong IT Asset Management gom 2 thanh phan runtime:

- Web UI SPA (`apps/web-ui`) cho nguoi dung cuoi
- API service (`apps/api`) cung cap REST cho UI, test, va automation

Data va integration layer:

- PostgreSQL 16: transactional source of truth
- Redis: cache va queue support

## 2. Monorepo topology

```text
apps/
  api/
  web-ui/
packages/
  contracts/
  domain/
  application/
  infra-postgres/
db/
  migrations/
  seed-*.sql
scripts/
tests/
```

Muc tieu cua topology:

- Tach ro boundary theo Clean Architecture
- Tai su dung contracts va domain logic giua app modules
- Co the build/test theo package dependency chain

## 3. Layering and dependency rules

Dependency flow:

```text
Routes (apps/api/src/routes/v1/**)
  -> Services (packages/application/**)
    -> Repositories (packages/infra-postgres/**)
      -> PostgreSQL
```

Shared contract flow:

```text
packages/contracts <- duoc dung boi tat ca layers
packages/domain    <- pure domain logic, khong import layer khac
```

Rules bat buoc:

- Route khong import truc tiep repository implementation.
- Domain khong phu thuoc vao application/infra.
- Contracts la nguon truth cho DTOs/interfaces.

## 4. API runtime flow

Request lifecycle (rui ro va diem can chu y):

1. Client goi `/api/v1/*` kem `Authorization: Bearer <jwt>`.
2. Fastify hooks chay theo thu tu:
   - request id hook
   - auth hook (bo qua auth routes)
   - context hook (attach db/user context)
   - request logging hook
3. Route validate input bang Zod.
4. Route goi service trong application layer.
5. Service goi repository layer, doc/ghi Postgres.
6. API tra ve response format chuan:
   - Success: `{ success: true, data, meta? }`
   - Error: `{ success: false, error: { code, message } }`

## 5. Authentication and session model

Login flow:

1. `POST /api/v1/auth/login` -> accessToken + refreshToken + user profile
2. Frontend luu token vao localStorage
3. Moi request API tu frontend gui access token
4. Khi access token het han:
   - `httpClient` goi `POST /api/v1/auth/refresh`
   - su dung singleton refresh promise de tranh refresh song song
5. Neu refresh fail:
   - clear stored session
   - redirect ve `/login`

## 6. Frontend architecture

Routing strategy:

- Shellless pages: `login`, `setup`, mot so print pages
- Main app pages: route group co sidebar/header layout

State strategy:

- Local component state su dung Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Global stores cho auth/theme/notification context

i18n strategy:

- Dung split-domain locales:
  - `apps/web-ui/src/lib/i18n/locales/vi/*.json`
  - `apps/web-ui/src/lib/i18n/locales/en/*.json`
- Khong dua key moi vao monolithic locale file neu file do khong duoc register.

Design system strategy:

- Uu tien design tokens trong `tokens.css`
- Uu tien semantic utility/classes thay vi hardcode hex

## 7. Warehouse and asset lifecycle

Phan tach trach nhiem nghiep vu:

- Stock document (nhap/xuat): quan ly vi tri vat ly va trang thai trong kho
- Assignment: quan ly ai dang su dung tai san

Asset lifecycle can ban:

1. Receipt line type `asset` -> tao asset record, status `in_stock`
2. Issue line type `asset` -> cap nhat status `in_use`, roi kho
3. Assignment duoc tao qua flow gan tai san rieng, khong tu dong tao trong posting stock document

## 8. Transaction boundary and repository contracts

Warehouse transactions su dung transaction context de dam bao dong bo cac repository lien quan.

Mau tu duy implementation:

- Repo constructors nen nhan `Queryable` thay vi concrete `PgClient`
- Cung mot repo co the dung voi pool client (ngoai transaction) va tx client (trong transaction)

Loi thuong gap can tranh:

- Goi API methods phu thuoc concrete client trong khi context chi expose `query()`.

## 9. Architecture checklist khi code review

- Dung layer chua? (route -> service -> repo)
- Dung contracts cho request/response va DTO mapping chua?
- Co vo tinh import nguoc dependency (infra -> route, domain -> app) khong?
- Co giu chuan response format API khong?
- Co cap nhat docs khi thay doi behavior quan trong khong?

## 10. Related docs

- `database.md`
- `api-reference.md`
- `testing.md`
- `deployment.md`
