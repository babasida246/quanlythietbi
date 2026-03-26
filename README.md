# Quan Ly Thiet Bi (QLTB)

He thong Quan Ly Thiet Bi (IT Asset Management) duoc xay dung theo Clean Architecture tren monorepo pnpm.

## 1. Tong quan

QLTB giai quyet bai toan quan ly toan bo vong doi tai san CNTT:

- Danh muc va cau hinh tai san
- Nhap/xuat kho va ton kho
- Gan tai san cho nguoi dung/phong ban
- Bao tri, sua chua, kiem ke
- CMDB, workflow phe duyet, bao cao va analytics
- Quan tri nguoi dung, RBAC, audit

## 2. Kien truc nhanh

```text
Frontend (SvelteKit 2 + Svelte 5 runes)
		-> API (Fastify 5)
				-> Application services (@qltb/application)
						-> Repositories (@qltb/infra-postgres)
								-> PostgreSQL 16
```

Monorepo gom 2 app va 4 package chinh:

- `apps/api`: Backend Fastify
- `apps/web-ui`: Frontend SvelteKit SPA
- `packages/contracts`: DTOs, interfaces, enums dung chung
- `packages/domain`: Domain entities va value objects
- `packages/application`: Use cases, business services
- `packages/infra-postgres`: Postgres repositories, schema, migrations

## 3. Cong nghe

- Frontend: SvelteKit 2, Svelte 5, TailwindCSS 3.4, svelte-i18n
- Backend: Fastify 5, Node.js 20+, Zod, JWT
- Data: PostgreSQL 16, Redis
- Test: Playwright (E2E + API), Vitest (unit)
- Build/Tooling: pnpm workspaces, Vite, tsup, Docker Compose

## 4. Yeu cau he thong

- Node.js >= 20
- pnpm >= 8
- Docker + Docker Compose (khuyen nghi cho local infra)

## 5. Quick Start

```bash
pnpm install
pnpm dev:infra
pnpm db:reset
pnpm dev:all
```

Sau khi chay:

- Web UI: http://localhost:5173
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- pgAdmin: http://localhost:8080

## 6. Bien moi truong quan trong

Sao chep `.env.example` thanh `.env` va cap nhat gia tri:

- `DATABASE_URL`: ket noi PostgreSQL
- `JWT_SECRET`: khoa ky access token
- `JWT_REFRESH_SECRET`: khoa ky refresh token
- `PORT`: cong API (mac dinh 3000)
- `VITE_API_BASE`: base URL frontend goi API
- `DISABLE_AUTH`: bat/tat bypass auth (chi dung local dev)
- `REDIS_URL`: ket noi Redis

## 7. Tai khoan mac dinh sau seed

- Admin: `admin@example.com` / `Benhvien@121`
- IT Manager: `it_manager@example.com` / `Benhvien@121`
- User: `user@example.com` / `Benhvien@121`

## 8. Scripts thuong dung

```bash
# Development
pnpm dev:all
pnpm dev
pnpm dev:web
pnpm dev:infra

# Database
pnpm db:empty
pnpm db:migrate
pnpm db:seed
pnpm db:reset

# Build
pnpm build
pnpm build:api
pnpm build:web

# Tests
pnpm test
pnpm test:e2e
pnpm test:api
pnpm test:ui
pnpm test:smoke
```

## 8.1 Docker HTTPS nhanh (Nginx + Certbot)

1. Copy `.env.production.example` thanh `.env` va dien:
  - `QLTB_DOMAIN`
  - `LETSENCRYPT_EMAIL`
  - `LETSENCRYPT_STAGING=false`
2. Dam bao DNS domain tro dung server va mo port `80/443`.
3. Chay:

```bash
docker-compose -f docker-compose.app.yml up -d --build
```

Nginx se phuc vu HTTP challenge, certbot cap/renew cert, sau do HTTP tu dong redirect sang HTTPS.

## 9. Cau truc thu muc

```text
QuanLyThietBi/
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
	docs/
	scripts/
	tests/
```

## 10. Quy uoc quan trong khi phat trien

- Khong sua migration cu. Luon them migration moi.
- Migration chi chua DDL, seed data dat trong `db/seed-*.sql`.
- Frontend phai dung i18n split-domain (`locales/vi/*.json`, `locales/en/*.json`).
- API response theo format:
	- Success: `{ success: true, data, meta? }`
	- Error: `{ success: false, error: { code, message } }`

## 11. Tai lieu chi tiet

- [docs/README.md](docs/README.md): trung tam tai lieu
- [docs/architecture.md](docs/architecture.md): kien truc va data flow
- [docs/database.md](docs/database.md): schema, migration, seed
- [docs/api-reference.md](docs/api-reference.md): quy uoc API va endpoint map
- [docs/testing.md](docs/testing.md): strategy va huong dan test
- [docs/deployment.md](docs/deployment.md): trien khai va van hanh

## 12. De xuat onboarding 30 phut

1. Chay `pnpm dev:infra`, `pnpm db:reset`, `pnpm dev:all`.
2. Dang nhap bang tai khoan `admin@example.com`.
3. Mo Swagger tai `/docs`, goi thu endpoint auth + assets.
4. Doc 3 file: `docs/architecture.md`, `docs/database.md`, `docs/testing.md`.
5. Chay 1 bo smoke: `pnpm test:smoke`.
