# Tài liệu dự án — Quản Lý Thiết Bị (QLTB)

> Hệ thống Quản lý Thiết bị / IT Asset Management System

## Mục lục

| # | Tài liệu | Mô tả |
|---|----------|-------|
| 1 | [Kiến trúc hệ thống](architecture.md) | Tổng quan kiến trúc, stack công nghệ, cấu trúc monorepo |
| 2 | [Cơ sở dữ liệu](database.md) | Schema, migrations, seed data, quy ước đặt tên |
| 3 | [API Reference](api-reference.md) | RESTful API endpoints, xác thực, phân quyền |
| 4 | [Tính năng & Giao diện](features.md) | Danh sách đầy đủ 48 routes, mô tả từng module |
| 5 | [Hướng dẫn Testing](testing.md) | E2E tests, unit tests, cách chạy, viết test mới |
| 6 | [Triển khai & Vận hành](deployment.md) | Docker, biến môi trường, lệnh build, CI/CD |

## Nhanh — Bắt đầu

```bash
# 1. Cài dependencies
pnpm install

# 2. Khởi tạo infrastructure (PostgreSQL + pgAdmin)
pnpm dev:infra

# 3. Reset DB (empty → migrate → seed)
pnpm db:reset

# 4. Chạy toàn bộ (API + Web + packages watch)
pnpm dev:all
```

- **API:** http://localhost:3000 (Swagger UI: http://localhost:3000/docs)
- **Web UI:** http://localhost:5173
- **pgAdmin:** http://localhost:8080

## Tài khoản mặc định

| Vai trò | Email | Mật khẩu |
|---------|-------|-----------|
| Admin | admin@example.com | Benhvien@121 |
| IT Asset Manager | it_manager@example.com | Benhvien@121 |
| User | user@example.com | Benhvien@121 |
