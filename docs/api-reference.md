# API Reference

## Tổng quan

- **Base URL API:** `http://localhost:3000/api` (dev) | `http://localhost:4010/api` (test)
- **Base URL API v1:** `http://localhost:3000/api/v1` (dev) | `http://localhost:4010/api/v1` (test)
- **Format:** JSON
- **Authentication:** Bearer JWT Token
- **Validation:** Zod schemas
- **Documentation:** Swagger UI tại `http://localhost:3000/docs`
- **Tổng số endpoints:** ~221 routes

### Prefix chuẩn

- Auth: `/api/v1/auth/*`
- Setup: `/api/setup/*`
- Business APIs: `/api/v1/*`

## Authentication

### Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/v1/auth/login` | Đăng nhập, trả về JWT token |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Đăng xuất |
| GET | `/api/v1/auth/me` | Thông tin user hiện tại |

### JWT Token

```
Authorization: Bearer <access_token>
```

Token được ký bằng secret key `JWT_SECRET` (dev: `dev-access-secret-key`). Token chứa:
- `sub` — User UUID
- `email` — Email
- `role` — Vai trò (admin, user, ...)
- `iat`, `exp` — Issue/Expiry time

### Tắt Auth (Development)

Đặt `DISABLE_AUTH=true` trong `.env` để bỏ qua xác thực.

---

## Setup (First-time)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/setup/status` | Kiểm tra trạng thái hệ thống |
| POST | `/api/setup/migrate` | Chạy migrations |
| POST | `/api/setup/seed` | Chạy seed data |
| POST | `/api/setup/create-admin` | Tạo tài khoản admin đầu tiên |
| POST | `/api/setup/finalize` | Hoàn tất setup |
| GET | `/health` | Health check |

---

## Assets — Quản lý Thiết bị

### Core CRUD

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets` | Danh sách thiết bị (pagination, filter) |
| POST | `/assets` | Tạo thiết bị mới |
| GET | `/assets/:id` | Chi tiết thiết bị |
| PUT | `/assets/:id` | Cập nhật thiết bị |
| DELETE | `/assets/:id` | Xóa thiết bị |

### Actions

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/assets/:id/assign` | Cấp phát thiết bị cho user |
| POST | `/assets/:id/return` | Thu hồi thiết bị |
| POST | `/assets/:id/move` | Di chuyển thiết bị |
| POST | `/assets/:id/status` | Cập nhật trạng thái |
| GET | `/assets/:id/timeline` | Lịch sử hoạt động |

### Other

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets/status-counts` | Thống kê theo trạng thái |
| GET | `/assets/export` | Xuất danh sách (CSV/Excel) |

---

## Catalogs — Danh mục

### Categories

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets/catalogs` | Tổng hợp danh mục |
| GET | `/assets/catalogs/categories` | Danh sách loại thiết bị |
| POST | `/assets/catalogs/categories` | Tạo loại thiết bị |
| PUT | `/assets/catalogs/categories/:id` | Cập nhật loại |
| DELETE | `/assets/catalogs/categories/:id` | Xóa loại |

### Vendors

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets/catalogs/vendors` | Danh sách nhà cung cấp |
| POST | `/assets/catalogs/vendors` | Tạo nhà cung cấp |
| PUT | `/assets/catalogs/vendors/:id` | Cập nhật |
| DELETE | `/assets/catalogs/vendors/:id` | Xóa |

### Models

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/asset-models` | Danh sách mẫu thiết bị |
| POST | `/assets/catalogs/models` | Tạo mẫu thiết bị |
| PUT | `/assets/catalogs/models/:id` | Cập nhật |
| DELETE | `/assets/catalogs/models/:id` | Xóa |

### Locations

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets/catalogs/locations` | Danh sách vị trí |
| POST | `/assets/catalogs/locations` | Tạo vị trí |
| PUT | `/assets/catalogs/locations/:id` | Cập nhật |
| DELETE | `/assets/catalogs/locations/:id` | Xóa |

### Statuses

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assets/catalogs/statuses` | Danh sách trạng thái |
| POST | `/assets/catalogs/statuses` | Tạo trạng thái |
| PUT | `/assets/catalogs/statuses/:id` | Cập nhật |
| DELETE | `/assets/catalogs/statuses/:id` | Xóa |

---

## Admin — Quản trị

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/users` | Danh sách users |
| POST | `/users` | Tạo user |
| PATCH | `/users/:id` | Cập nhật user |
| DELETE | `/users/:id` | Xóa user |
| POST | `/users/:id/reset-password` | Reset mật khẩu |
| GET | `/rbac/roles` | Danh sách roles |
| GET | `/rbac/permissions` | Danh sách permissions |
| GET | `/rbac/roles/:slug/permissions` | Permissions của role |
| PUT | `/rbac/roles/:slug/permissions` | Gán permissions cho role |
| GET | `/audit-logs` | Nhật ký kiểm toán |

---

## CMDB — Quản lý Cấu hình

### CI Types (Loại CI)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/types` | Danh sách CI types |
| POST | `/cmdb/types` | Tạo CI type |
| PUT | `/cmdb/types/:id` | Cập nhật |
| DELETE | `/cmdb/types/:id` | Xóa |
| GET | `/cmdb/types/:id/versions` | Danh sách versions |
| POST | `/cmdb/types/:id/versions` | Tạo version |
| POST | `/cmdb/versions/:versionId/publish` | Publish version |

### CI Attribute Definitions

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/versions/:versionId/attr-defs` | Danh sách attribute definitions |
| POST | `/cmdb/versions/:versionId/attr-defs` | Tạo attribute definition |
| PUT | `/cmdb/attr-defs/:id` | Cập nhật |
| DELETE | `/cmdb/attr-defs/:id` | Xóa |

### CIs (Configuration Items)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/cis` | Danh sách CIs |
| POST | `/cmdb/cis` | Tạo CI |
| GET | `/cmdb/cis/:id` | Chi tiết CI |
| PUT | `/cmdb/cis/:id` | Cập nhật |
| DELETE | `/cmdb/cis/:id` | Xóa |
| GET | `/cmdb/cis/:id/graph` | Đồ thị quan hệ |
| GET | `/cmdb/cis/:id/dependency-path` | Đường phụ thuộc |
| GET | `/cmdb/cis/:id/impact` | Phân tích ảnh hưởng |
| GET | `/cmdb/graph` | Đồ thị toàn bộ CMDB |

### Relationships

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/relationship-types` | Danh sách loại quan hệ |
| POST | `/cmdb/relationship-types` | Tạo loại quan hệ |
| PUT | `/cmdb/relationship-types/:id` | Cập nhật |
| DELETE | `/cmdb/relationship-types/:id` | Xóa |
| GET | `/cmdb/cis/:id/relationships` | Quan hệ của CI |
| POST | `/cmdb/cis/:id/relationships` | Tạo quan hệ cho CI |
| POST | `/cmdb/relationships` | Tạo quan hệ |
| POST | `/cmdb/relationships/import` | Import quan hệ hàng loạt |
| DELETE | `/cmdb/relationships/:id` | Xóa quan hệ |

### Changes (Thay đổi)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/changes` | Danh sách changes |
| POST | `/cmdb/changes` | Tạo change request |
| GET | `/cmdb/changes/:id` | Chi tiết |
| PUT | `/cmdb/changes/:id` | Cập nhật |
| POST | `/cmdb/changes/:id/submit` | Submit để review |
| POST | `/cmdb/changes/:id/approve` | Phê duyệt |
| POST | `/cmdb/changes/:id/implement` | Triển khai |
| POST | `/cmdb/changes/:id/close` | Đóng |
| POST | `/cmdb/changes/:id/cancel` | Hủy |

### Services (Dịch vụ)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/services` | Danh sách dịch vụ |
| POST | `/cmdb/services` | Tạo dịch vụ |
| GET | `/cmdb/services/:id` | Chi tiết |
| PUT | `/cmdb/services/:id` | Cập nhật |
| DELETE | `/cmdb/services/:id` | Xóa |
| POST | `/cmdb/services/:id/members` | Thêm CI vào service |
| DELETE | `/cmdb/services/:id/members/:memberId` | Xóa CI khỏi service |
| GET | `/cmdb/services/:id/impact` | Phân tích ảnh hưởng |

### CMDB Reports

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/cmdb/reports/ci-inventory` | Báo cáo tồn kho CI |
| GET | `/cmdb/reports/relationship-analytics` | Phân tích quan hệ |
| GET | `/cmdb/reports/audit-trail` | Nhật ký thay đổi |
| GET | `/cmdb/reports/export/:reportType` | Xuất báo cáo |

### Discovery & Smart Tags

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/cmdb/discovery/rules` | Tạo discovery rule |
| GET | `/cmdb/discovery/rules` | Danh sách rules |
| GET | `/cmdb/discovery/rules/:id` | Chi tiết rule |
| DELETE | `/cmdb/discovery/rules/:id` | Xóa rule |
| GET | `/cmdb/discovery/rules/:id/results` | Kết quả discovery |
| POST | `/cmdb/discovery/results/:id/review` | Review kết quả |
| POST | `/cmdb/tags` | Tạo smart tag |
| GET | `/cmdb/tags` | Danh sách tags |
| DELETE | `/cmdb/tags/:id` | Xóa tag |
| POST | `/cmdb/cis/:ciId/tags/:tagId` | Gán tag cho CI |
| DELETE | `/cmdb/cis/:ciId/tags/:tagId` | Gỡ tag |
| GET | `/cmdb/cis/:ciId/tags` | Tags của CI |

### Change Assessments

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/cmdb/change-assessments` | Tạo đánh giá |
| GET | `/cmdb/change-assessments` | Danh sách |
| GET | `/cmdb/change-assessments/:id` | Chi tiết |
| POST | `/cmdb/change-assessments/:id/status` | Cập nhật trạng thái |

---

## Warehouse — Kho

### Warehouses

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/warehouses` | Danh sách kho |
| POST | `/warehouses` | Tạo kho |
| PUT | `/warehouses/:id` | Cập nhật |
| DELETE | `/warehouses/:id` | Xóa |
| GET | `/warehouses/:id/assets` | Thiết bị trong kho |

### Spare Parts (Linh kiện thay thế)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/spare-parts` | Danh sách linh kiện |
| POST | `/spare-parts` | Tạo linh kiện |
| PUT | `/spare-parts/:id` | Cập nhật |
| DELETE | `/spare-parts/:id` | Xóa |
| GET | `/spare-parts/export/csv` | Xuất CSV |
| POST | `/spare-parts/import/csv` | Import CSV |

### Stock

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/stock/view` | Xem tồn kho |
| POST | `/stock/reserve` | Đặt trước |
| POST | `/stock/release` | Giải phóng |
| POST | `/stock/commit` | Xác nhận |
| GET | `/stock/ledger` | Sổ kho |
| GET | `/stock/check` | Đối chiếu tồn kho |

### Stock Documents (Phiếu nhập/xuất)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/stock-documents` | Danh sách phiếu |
| GET | `/stock-documents/:id` | Chi tiết phiếu |
| POST | `/stock-documents` | Tạo phiếu |
| PUT | `/stock-documents/:id` | Cập nhật phiếu |
| POST | `/stock-documents/:id/submit` | Gửi phê duyệt |
| POST | `/stock-documents/:id/approve` | Phê duyệt |
| POST | `/stock-documents/:id/post` | Ghi sổ |
| POST | `/stock-documents/:id/cancel` | Hủy phiếu |

### Repair Orders (Phiếu sửa chữa)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/repair-orders` | Danh sách phiếu sửa chữa |
| GET | `/repair-orders/summary` | Tổng hợp |
| GET | `/repair-orders/:id` | Chi tiết |
| POST | `/repair-orders` | Tạo phiếu |
| PUT | `/repair-orders/:id` | Cập nhật |
| POST | `/repair-orders/:id/status` | Cập nhật trạng thái |
| POST | `/repair-orders/:id/parts` | Thêm linh kiện |
| GET | `/repair-orders/:id/events` | Lịch sử sự kiện |

---

## Maintenance — Bảo trì

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/maintenance` | Danh sách yêu cầu bảo trì |
| POST | `/maintenance` | Tạo yêu cầu |
| PUT | `/maintenance/:id/status` | Cập nhật trạng thái |
| DELETE | `/maintenance/:id` | Xóa |

---

## Inventory — Kiểm kê

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/inventory/sessions` | Tạo phiên kiểm kê |
| GET | `/inventory/sessions` | Danh sách phiên |
| GET | `/inventory/sessions/:id` | Chi tiết phiên |
| POST | `/inventory/sessions/:id/scan` | Quét thiết bị |
| POST | `/inventory/sessions/:id/start` | Bắt đầu kiểm kê |
| POST | `/inventory/sessions/:id/close` | Đóng phiên |
| DELETE | `/inventory/sessions/:id/scans/:itemId` | Xóa item đã quét |
| GET | `/inventory/sessions/:id/report` | Báo cáo kiểm kê |

---

## Reports — Báo cáo

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/reports/stock-on-hand` | Tồn kho hiện tại |
| GET | `/reports/stock-available` | Tồn kho khả dụng |
| GET | `/reports/reorder-alerts` | Cảnh báo đặt hàng lại |
| GET | `/reports/fefo-lots` | Báo cáo FEFO (First Expired First Out) |
| GET | `/reports/valuation` | Định giá tồn kho |

---

## Analytics — Phân tích

### Summary & Snapshots

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/analytics/summary` | Tổng hợp phân tích |
| POST | `/analytics/snapshots` | Tạo snapshot |
| GET | `/analytics/snapshots/latest` | Snapshot mới nhất |
| GET | `/analytics/snapshots/history` | Lịch sử snapshots |

### Cost Analysis

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/analytics/costs` | Ghi nhận chi phí |
| GET | `/analytics/costs/asset/:assetId` | Chi phí theo thiết bị |
| GET | `/analytics/costs/asset/:assetId/summary` | Tổng hợp chi phí |
| GET | `/analytics/costs/overview` | Tổng quan chi phí |

### Performance Metrics

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/analytics/metrics` | Ghi nhận metric |
| GET | `/analytics/metrics/asset/:assetId` | Metrics theo thiết bị |
| GET | `/analytics/metrics/asset/:assetId/:metricType/history` | Lịch sử metric |
| GET | `/analytics/insights/asset/:assetId` | Insights |
| GET | `/analytics/anomalies` | Phát hiện bất thường |

### Dashboard

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/analytics/dashboard` | Lấy dashboard config |
| PUT | `/analytics/dashboard` | Cập nhật dashboard |

---

## Automation — Tự động hóa

### Rules

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/automation/rules` | Danh sách rules |
| POST | `/automation/rules` | Tạo rule |
| GET | `/automation/rules/:id` | Chi tiết |
| PUT | `/automation/rules/:id` | Cập nhật |
| DELETE | `/automation/rules/:id` | Xóa |
| POST | `/automation/trigger` | Trigger thủ công |
| GET | `/automation/rules/:id/logs` | Logs |

### Notifications

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/automation/notifications` | Danh sách thông báo |
| POST | `/automation/notifications` | Tạo thông báo |
| POST | `/automation/notifications/:id/read` | Đánh dấu đã đọc |
| POST | `/automation/notifications/read-all` | Đọc tất cả |

### Scheduled Tasks

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/automation/tasks` | Danh sách tác vụ |
| POST | `/automation/tasks` | Tạo tác vụ |
| DELETE | `/automation/tasks/:id` | Xóa |

---

## Integrations — Tích hợp

### Connectors

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/integrations/connectors` | Danh sách connectors |
| POST | `/integrations/connectors` | Tạo connector |
| GET | `/integrations/connectors/:id` | Chi tiết |
| PUT | `/integrations/connectors/:id` | Cập nhật |
| DELETE | `/integrations/connectors/:id` | Xóa |
| POST | `/integrations/connectors/:id/test` | Test kết nối |

### Sync Rules

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/integrations/connectors/:connectorId/sync-rules` | Danh sách sync rules |
| POST | `/integrations/connectors/:connectorId/sync-rules` | Tạo sync rule |
| DELETE | `/integrations/sync-rules/:id` | Xóa |

### Webhooks

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/integrations/webhooks` | Danh sách webhooks |
| POST | `/integrations/webhooks` | Tạo webhook |
| DELETE | `/integrations/webhooks/:id` | Xóa |
| GET | `/integrations/providers` | Danh sách providers |

---

## Security — Bảo mật & Tuân thủ

### Permissions

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/security/permissions` | Danh sách permissions |
| POST | `/security/permissions` | Tạo permission |
| GET | `/security/roles/:roleId/permissions` | Permissions theo role |
| POST | `/security/roles/:roleId/permissions` | Gán permission |
| DELETE | `/security/roles/:roleId/permissions/:permissionId` | Gỡ permission |
| POST | `/security/check-permission` | Kiểm tra quyền |

### Audit Logs

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/security/audit-logs` | Nhật ký bảo mật |
| POST | `/security/audit-logs` | Ghi log |

### Compliance

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/security/compliance/frameworks` | Danh sách frameworks |
| POST | `/security/compliance/frameworks` | Tạo framework |
| GET | `/security/compliance/frameworks/:id/controls` | Controls theo framework |
| POST | `/security/compliance/frameworks/:id/controls` | Tạo control |
| GET | `/security/compliance/assessments` | Danh sách đánh giá |
| POST | `/security/compliance/assessments` | Tạo đánh giá |
| GET | `/security/compliance/summary` | Tổng hợp compliance |

---

## Pagination & Filtering

Hầu hết các GET endpoints hỗ trợ:

```
GET /api/v1/assets?page=1&limit=20&search=laptop&sort=created_at&order=desc
```

| Parameter | Mô tả | Default |
|-----------|-------|---------|
| `page` | Trang hiện tại | 1 |
| `limit` | Số item/trang | 20 |
| `search` | Tìm kiếm full-text | — |
| `sort` | Field sắp xếp | `created_at` |
| `order` | Thứ tự (`asc`/`desc`) | `desc` |

## Error Responses

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Asset not found"
}
```

| Status | Mô tả |
|--------|-------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Validation error |
| 401 | Chưa đăng nhập |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 409 | Conflict |
| 500 | Lỗi server |
