# Database – Migrations & Seeds

Thư mục này chứa toàn bộ SQL migration và seed data cho dự án.

---

## Hai hệ thống migration

Dự án có **hai hệ thống migration** tách biệt với mục đích khác nhau:

### 1. Setup Wizard (tự động)

- **Đường dẫn**: `packages/infra-postgres/src/migrations/`
- **Kích hoạt bởi**: Trang `/setup` (setup wizard lần đầu)
- **Quản lý**: Tự động — không cần can thiệp thủ công
- **Ghi chú**: Hệ thống này theo dõi trạng thái migration qua bảng `setup_meta`. Sau khi `setup.initialized = true`, trang `/setup` sẽ bị chặn.

### 2. Manual Migration (psql)

- **Đường dẫn**: `db/migrations/` (thư mục này)
- **Kích hoạt bởi**: Script `pnpm db:migrate`
- **Dùng khi**: Restore DB thủ công, CI/CD pipeline, hoặc môi trường không có setup wizard
- **Yêu cầu**: Biến môi trường `DATABASE_URL` phải được set

---

## Danh sách migration files (23 files)

| File | Mô tả |
|------|-------|
| `004_add_performance_indexes.sql` | Performance indexes cho các bảng core |
| `007_cmdb_core.sql` | CMDB — bảng CI, relationships, CI types |
| `025_add_asset_spec.sql` | Thêm cột spec cho assets |
| `026_phase1_workflow_foundation.sql` | Nền tảng workflow (status transitions) |
| `030_licenses_module.sql` | Module quản lý license phần mềm |
| `031_accessories_module.sql` | Module phụ kiện thiết bị |
| `032_consumables_module.sql` | Module vật tư tiêu hao |
| `033_components_module.sql` | Module linh kiện thay thế |
| `034_checkout_module.sql` | Module mượn/trả thiết bị |
| `035_requests_module.sql` | Module yêu cầu mua sắm/sửa chữa |
| `036_audit_module.sql` | Module kiểm kê định kỳ |
| `037_labels_module.sql` | Module nhãn/tag cho assets |
| `038_depreciation_module.sql` | Module khấu hao tài sản |
| `039_reports_alerts_module.sql` | Module báo cáo và cảnh báo |
| `040_messaging_hub.sql` | Hub thông báo nội bộ |
| `041_asset_status_catalog.sql` | Danh mục trạng thái tài sản |
| `042_workflow_automation.sql` | Tự động hóa workflow |
| `043_analytics_dashboard.sql` | Dashboard phân tích dữ liệu |
| `044_cmdb_enhancement.sql` | Cải tiến CMDB (relationships, impact) |
| `045_integration_hub.sql` | Hub tích hợp bên ngoài |
| `046_security_compliance.sql` | Bảo mật và tuân thủ |
| `047_documents_module.sql` | Module tài liệu đính kèm |
| `048_rename_spec_defs_table.sql` | Đổi tên bảng spec_defs |
| `049_warehouse_improvements.sql` | Cải tiến kho hàng (phase 1) |

---

## Seed Data

| File | Mô tả |
|------|-------|
| `seed-data.sql` | Dữ liệu cơ bản: user admin, danh mục, phòng ban |
| `seed-assets-management.sql` | Dữ liệu mẫu quản lý thiết bị |
| `seed-qlts-demo.sql` | Dữ liệu demo toàn diện (QLTS scenario) |

> **Admin mặc định**: `admin@example.com` / `Benhvien@121`

---

## Các lệnh thường dùng

```bash
# Chạy toàn bộ migration (theo thứ tự)
pnpm db:migrate

# Seed dữ liệu demo
pnpm db:seed

# Reset hoàn toàn: migrate + seed
pnpm db:reset

# Kiểm tra trạng thái setup wizard
pnpm setup:status
```

### Reset DB hoàn toàn (Docker)

```bash
# Xóa toàn bộ volume và tạo lại
docker compose down -v
docker compose up -d db
# Chờ DB sẵn sàng, sau đó chạy setup wizard tại http://localhost:5173/setup
```

---

## Quy tắc đặt tên migration file

```
NNN_ten_module.sql
```

- `NNN`: số thứ tự 3 chữ số, **không** được trùng
- `ten_module`: snake_case, mô tả ngắn gọn mục đích
- Không xóa hoặc sửa file đã chạy — chỉ **thêm** file mới

### Số tiếp theo cần dùng: `050_...`

---

## Lịch sử dọn dẹp

- **2025-01**: Xóa 4 file `.deprecated` (003–006) — các bảng này không còn dùng
- **2025-01**: Đổi `039_asset_status_catalog.sql` từ số bị trùng (duplicate 039) → `041_asset_status_catalog.sql`
- **2025-01**: Xóa `db:seed:legacy` và `db:seed:docker` — hợp nhất vào `db:seed` dùng SQL files trực tiếp
