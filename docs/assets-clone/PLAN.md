# Assets Clone — Kế hoạch triển khai

## Mục tiêu
Clone toàn bộ phân hệ "Assets" từ project nguồn sang QuanLyThietBi để chạy độc lập.

## Checklist

- [x] **Step A** — Tạo thư mục docs/assets-clone/, chuẩn bị workspace
- [x] **Step B** — Copy code assets từ nguồn
  - [x] API routes (assets, maintenance, inventory, workflow, reports, warehouse, cmdb)
  - [x] API modules (qlts)
  - [x] DB migrations & seeds
  - [x] Web UI routes (assets)
  - [x] Web UI lib (components, api clients, i18n, auth, stores)
- [x] **Step C** — Copy packages phụ thuộc
  - [x] @qltb/domain (từ @domain/core)
  - [x] @qltb/contracts (từ @contracts/shared)
  - [x] @qltb/application (từ @application/core)
  - [x] @qltb/infra-postgres (từ @infra/postgres)
- [x] **Step D** — Fix build configuration
  - [x] tsconfig paths & references
  - [x] package.json workspace deps
  - [x] pnpm-workspace.yaml
- [x] **Step E** — Wire API endpoints
  - [x] Đăng ký asset module routes
  - [x] Health check endpoints (/health, /health/ready)
  - [x] Auth: sử dụng x-user-id/x-user-role headers (TODO: RBAC đầy đủ)
- [x] **Step F** — DB migrations/seeds
  - [x] Migrations SQL idempotent
  - [x] Seed data mẫu
- [x] **Step G** — Web UI wiring
  - [x] Assets list, detail, create/edit pages
  - [x] Catalogs, CMDB, Inventory, Maintenance, Warehouse pages
  - [x] Navigation sidebar
- [x] **Step H** — Tests & Smoke
  - [x] Smoke test script (scripts/smoke-assets.mjs)
  - [x] .env.example
  - [x] Docker compose

## Namespace mapping

| Source workspace    | QuanLyThietBi      |
|---------------------|---------------------|
| @domain/core        | @qltb/domain        |
| @contracts/shared   | @qltb/contracts     |
| @application/core   | @qltb/application   |
| @infra/postgres     | @qltb/infra-postgres|
| @apps/api           | @qltb/api           |
| @apps/web-ui        | @qltb/web-ui        |

## Lưu ý
- Không import hoặc symlink từ nguồn
- Auth hiện tại dùng x-user-id header (TODO: JWT)
- Email/ChatOps không clone (chỉ assets core)
