# Tài liệu dự án — Quản Lý Thiết Bị (QLTB)

> Trung tâm tài liệu cho hệ thống IT Asset Management (SvelteKit + Fastify + PostgreSQL).

## Tài liệu theo mục đích

| Nhóm | Tài liệu | Khi nào dùng |
|---|---|---|
| Khởi động nhanh | [Hướng dẫn đầy đủ](huong-dan-day-du.md) | Onboarding nhanh cho người mới: cài đặt, chạy hệ thống, luồng nghiệp vụ chính |
| Bản đồ chức năng | [Inventory chức năng đầy đủ](feature-inventory.md) | Tra cứu tất cả chức năng hiện có theo module, route frontend, route API |
| Kiến trúc | [Kiến trúc hệ thống](architecture.md) | Hiểu clean architecture, luồng dữ liệu, tổ chức monorepo |
| CSDL | [Cơ sở dữ liệu](database.md) | Làm migration, seed, thiết kế schema, dữ liệu mẫu |
| API | [API Reference](api-reference.md) | Tra cứu endpoint, auth, lỗi thường gặp, quy ước request/response |
| UI/Modules | [Tính năng & Giao diện](features.md) | Nắm các màn hình và khả năng chính của từng module |
| Kiểm thử | [Hướng dẫn Testing](testing.md) | Chạy Playwright/Vitest, chuẩn viết test, troubleshoot test failures |
| Vận hành | [Triển khai & Vận hành](deployment.md) | Build/release, Docker, biến môi trường, production checklist |
| Chất lượng nghiệp vụ | [Business Integrity Audit](business-integrity-audit.md) | Kiểm tra tính toàn vẹn nghiệp vụ và tuân thủ quy tắc dữ liệu |
| Báo cáo kiểm thử | [Chương 4 - Kiểm thử](chuong4-kiem-thu.md) | Báo cáo test, ma trận test case, kết quả pass/fail |

## Trạng thái tài liệu (Cập nhật 2026-03-14)

- Đã đồng bộ theo hiện trạng codebase: `59` trang Svelte (`+page.svelte`) và các route API theo module.
- Đã bổ sung inventory chức năng theo cả frontend, backend và package layer.
- Đã bổ sung hướng dẫn vận hành theo vai trò: Admin, IT Asset Manager, Warehouse Keeper, Technician, Requester.

## Nhanh — Bắt đầu

```bash
# 1. Cài dependencies
pnpm install

# 2. Khởi tạo infrastructure (PostgreSQL + pgAdmin)
pnpm dev:infra

# 3. Reset DB (empty -> migrate -> seed)
pnpm db:reset

# 4. Chạy toàn bộ (API + Web UI + packages watch)
pnpm dev:all
```

- API: `http://localhost:3000` (Swagger UI: `http://localhost:3000/docs`)
- Web UI: `http://localhost:5173`
- pgAdmin: `http://localhost:8080`

## Tài khoản mặc định sau seed

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@example.com` | `Benhvien@121` |
| IT Asset Manager | `it_manager@example.com` | `Benhvien@121` |
| User | `user@example.com` | `Benhvien@121` |

## Đề xuất thứ tự đọc

1. `huong-dan-day-du.md` để nắm toàn cảnh.
2. `feature-inventory.md` để biết đầy đủ phạm vi chức năng.
3. `architecture.md` + `database.md` trước khi sửa backend.
4. `features.md` + `api-reference.md` trước khi sửa frontend/API.
5. `testing.md` + `deployment.md` trước khi merge và release.
