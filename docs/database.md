# Database

## 1. Công cụ quản lý

| Script | Lệnh | Mô tả |
| --- | --- | --- |
| db-empty.mjs | `pnpm db:empty` | DROP SCHEMA public + recreate |
| db-migrate.mjs | `pnpm db:migrate` | Chạy migrations theo thứ tự |
| db-seed.mjs | `pnpm db:seed` | Chạy 16 seed files |
| — | `pnpm db:reset` | empty → migrate → seed (full reset) |

## 2. Thứ tự migration

`db-migrate.mjs` chạy theo danh sách cố định, có bảng tracking `schema_migrations` để bỏ qua file đã apply:

1. `packages/infra-postgres/src/schema.sql` — **Squashed baseline** chứa toàn bộ DDL từ migrations 007–20260326
2. `db/migrations/065_equipment_groups.sql` — migration mới sau squash

Migration mới luôn thêm vào cuối danh sách `MIGRATIONS` trong `scripts/db-migrate.mjs`, đặt file tại `db/migrations/<số tiếp theo>_<tên>.sql`.

## 3. Thứ tự seed

`db-seed.mjs` chạy 16 file theo thứ tự phụ thuộc:

| # | File | Nội dung |
| --- | --- | --- |
| 1 | `seed-data.sql` | Foundation: users, locations, vendors, statuses |
| 2 | `seed-rbac-classic.sql` | Classic RBAC: roles, permissions, role_permissions |
| 3 | `seed-rbac-policies.sql` | Policy Library: policies + policy_permissions |
| 4 | `seed-assets-management.sql` | Asset catalog: models, warehouses, spare parts, categories |
| 5 | `seed-assets.sql` | 50 assets + assignments + repair orders |
| 6 | `seed-accessories.sql` | Accessories, consumables, components, licenses |
| 7 | `seed-warehouse.sql` | Stock, stock documents, purchase plans |
| 8 | `seed-analytics.sql` | Reports, dashboards |
| 9 | `seed-chat-ai.sql` | AI providers, models, channels |
| 10 | `seed-ops.sql` | Alerts, notifications, RBAC ops |
| 11 | `seed-ad-rbac-resources.sql` | AD RBAC resource directives + role mapping |
| 12 | `seed-qlts-demo.sql` | CMDB CIs, wf_definitions |
| 13 | `seed-workflows.sql` | wf_requests + automation rules |
| 14 | `seed-inventory-audit.sql` | Inventory sessions, depreciation, documents |
| 15 | `seed-depreciation-2026.sql` | Depreciation schedules + 2026 runs/entries |
| 16 | `seed-new-features.sql` | Organizations hierarchy, spare part stock, notifications |
| 17 | `seed-cmdb-config-files.sql` | CMDB config files & version history |
| 18 | `seed-my-pages.sql` | OU→org mappings, wf_requests for admin user |
| 19 | `seed-pc001.sql` | PC-001 complete data: repairs, components, documents |

## 4. Quy tắc migration

- **Chỉ DDL** — không đặt INSERT/seed trong migration.
- **Idempotent** — dùng `IF NOT EXISTS` / `IF EXISTS` để có thể re-run an toàn.
- **Không sửa file cũ** — luôn thêm migration mới để sửa.
- **Đánh số tiếp** — xem file cuối trong `db/migrations/` để đặt đúng số.
- **Patch tức thời** — dùng tên dated: `db/migrations/20260410_001_desc.sql`.
- **Đăng ký** — thêm entry vào mảng `MIGRATIONS` trong `scripts/db-migrate.mjs`.

## 5. UUID patterns (seed)

| Entity | UUID prefix |
| --- | --- |
| Users | `00000000-0000-0000-0000-00000000000X` |
| Assets | `a1000000-0000-0000-0000-00000000000X` |
| Statuses | `c0100000-0000-0000-0000-00000000000X` |
| Locations | `a0000000-0000-0000-0000-00000000000X` |
| Vendors | `b0000000-0000-0000-0000-00000000000X` |
| Organizations | `d0000000-0000-0000-0000-00000000000X` |
| Warehouses | `d1000000-0000-0000-0000-00000000000X` |
| Spare parts | `c1000000-0000-0000-0000-00000000000X` |
| Components | `b3000000-0000-0000-0000-00000000000X` |
| Repair orders | `a3000000-0000-0000-0000-00000000000X` |

## 6. Tài khoản mặc định

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@example.com` | `Benhvien@121` |
| IT Manager | `it_manager@example.com` | `Benhvien@121` |
| User | `user@example.com` | `Benhvien@121` |

## 7. Biến môi trường database

DB scripts đọc từ `.env` / `.env.local`:

- `DATABASE_URL` — connection string đầy đủ, hoặc
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — API tự build URL

## 8. Schema baseline (squash 2026-04-07)

File `packages/infra-postgres/src/schema.sql` là squashed baseline chứa toàn bộ DDL từ 61 migrations gốc (007–20260326). Migration cũ được archive tại:

- `db/migrations/archive/`
- `packages/infra-postgres/src/migrations/archive/`
