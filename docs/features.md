# Tính năng & Giao diện

## Tổng quan

Hệ thống có **48 routes** chính, chia thành các module chức năng:

## Sơ đồ Module

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QUẢN LÝ THIẾT BỊ                           │
├─────────────┬──────────────┬──────────────┬────────────────────────┤
│  Auth       │  Assets      │  CMDB        │  Warehouse             │
│  ├ Login    │  ├ CRUD      │  ├ CIs       │  ├ Kho & Linh kiện    │
│  ├ Logout   │  ├ Catalogs  │  ├ Types     │  ├ Phiếu nhập/xuất    │
│  ├ Forbidden│  ├ Models    │  ├ Services  │  ├ Ledger & Stock      │
│  └ Setup    │  ├ Specs     │  ├ Changes   │  ├ Sửa chữa           │
│             │  └ Purchase  │  ├ Reports   │  ├ Đối chiếu           │
│             │     Plans    │  └ Topology  │  └ Báo cáo kho         │
├─────────────┼──────────────┼──────────────┼────────────────────────┤
│  Admin      │  Maintenance │  Inventory   │  Workflows             │
│  ├ Users    │  ├ Tickets   │  ├ Sessions  │  ├ Requests            │
│  ├ RBAC     │  └ Repairs   │  └ Scan/     │  ├ Approvals           │
│  └ Audit    │              │     Report   │  └ My Assets           │
├─────────────┼──────────────┼──────────────┼────────────────────────┤
│  Analytics  │  Automation  │  Security    │  Integrations          │
│  ├ Dashboard│  ├ Rules     │  ├ Perms     │  ├ Connectors          │
│  ├ Reports  │  ├ Tasks     │  ├ Audit     │  ├ Sync Rules          │
│  └ Costs    │  └ Notif.    │  └ Comply    │  └ Webhooks            │
└─────────────┴──────────────┴──────────────┴────────────────────────┘
```

---

## 1. Authentication & Setup

### Login (`/login`)
- Form đăng nhập: Email + Password
- Validation real-time
- Redirect về trang chính sau khi đăng nhập

### Logout (`/logout`)
- Xóa session/token khỏi localStorage
- Redirect về `/login`

### Forbidden (`/forbidden`)
- Trang hiển thị khi user không có quyền truy cập

### Setup (`/setup`)
- Wizard khởi tạo lần đầu: health check → migrate → seed → create admin → finalize

---

## 2. Assets — Quản lý Thiết bị

### Danh sách thiết bị (`/assets`)
- Bảng dữ liệu với phân trang, tìm kiếm, lọc
- Thống kê trạng thái (Mới, Đang sử dụng, Bảo trì, Hỏng...)
- Nút tạo mới, import, export

### Chi tiết thiết bị (`/assets/:id`)
- Thông tin cơ bản: tên, số serial, model, vendor
- Thông số kỹ thuật (specs)
- Lịch sử cấp phát, bảo trì, sự kiện
- Timeline hoạt động
- Nhãn/barcode

### Danh mục (`/assets/catalogs`)
- Tab: Loại thiết bị, Nhà cung cấp, Vị trí, Trạng thái
- CRUD cho từng danh mục
- Dialog tạo/sửa inline

### Kế hoạch mua sắm (`/assets/purchase-plans`, `/assets/purchase-plans/new`)
- Danh sách kế hoạch mua sắm
- Form tạo kế hoạch mới: chọn thiết bị, số lượng, dự toán
- Gợi ý mua sắm dựa trên tồn kho

### Tăng tài sản (`/assets/asset-increases/new`)
- Form ghi nhận tăng thiết bị mới
- Chọn từ danh mục: loại, model, vendor

---

## 3. CMDB — Configuration Management Database

### Trang chính (`/cmdb`)
- Tổng quan CMDB: số CI, loại, quan hệ

### Configuration Items (`/cmdb/cis`)
- Bảng danh sách CIs với filter theo type, status
- Tìm kiếm full-text

### Chi tiết CI (`/cmdb/cis/:id`)
- Thông tin cơ bản: tên, loại, trạng thái
- Attributes (theo schema của CI type version)
- Tab: Quan hệ, Tags, Lịch sử
- Topology graph (Cytoscape)

### CI Types (`/cmdb/types`)
- Quản lý loại CI: Server, Router, Switch, Firewall, Database, Application...
- Versioning: tạo version → define attributes → publish

### Services (`/cmdb/services`)
- Danh sách dịch vụ IT
- Quản lý CI members của service
- Phân tích ảnh hưởng (impact analysis)

### Changes (`/cmdb/changes`)
- Quản lý thay đổi cấu hình
- Workflow: Draft → Submit → Approve → Implement → Close/Cancel

### Reports (`/cmdb/reports`)
- Báo cáo CI inventory
- Phân tích quan hệ
- Audit trail
- Biểu đồ thống kê (ECharts)

### Relationship Import (`/cmdb/relationships/import`)
- Import quan hệ hàng loạt từ CSV/file

---

## 4. Warehouse — Quản lý Kho

### Tổng quan kho (`/warehouse`)
- Dashboard kho: tồn kho, nhập/xuất, cảnh báo

### Danh sách kho (`/warehouse/warehouses`)
- Quản lý các kho: tên, vị trí, người quản lý
- CRUD kho

### Linh kiện thay thế (`/warehouse/parts`)
- Danh sách linh kiện
- Tồn kho, giá, nhà cung cấp
- Import/Export CSV

### Tồn kho (`/warehouse/stock`)
- Xem tồn kho real-time
- Đặt trước, giải phóng, xác nhận

### Phiếu nhập/xuất (`/warehouse/documents`, `/warehouse/documents/:id`, `/warehouse/documents/new`)
- Tạo phiếu nhập kho / xuất kho
- Workflow: Draft → Submit → Approve → Post → Complete/Cancel
- Chi tiết phiếu: danh sách items, xác nhận

### Sổ kho (`/warehouse/ledger`)
- Lịch sử nhập/xuất theo thời gian
- Lọc theo kho, linh kiện, thời gian

### Đối chiếu (`/warehouse/reconciliation`)
- So sánh tồn kho thực tế vs hệ thống

### Sửa chữa (`/warehouse/repairs`, `/warehouse/repairs/:id`)
- Phiếu sửa chữa: thiết bị, nguyên nhân, linh kiện thay thế
- Workflow trạng thái: Open → In Progress → Completed
- Lịch sử sự kiện

### Kế hoạch mua (`/warehouse/purchase-plans`)
- Kế hoạch mua linh kiện/vật tư cho kho

### Báo cáo kho (`/warehouse/reports`)
- Báo cáo tồn kho, nhập/xuất, FEFO, định giá

---

## 5. Maintenance — Bảo trì

### Trang chính (`/maintenance`)
- Dashboard bảo trì: yêu cầu mới, đang xử lý, hoàn thành

### Sửa chữa (`/maintenance/repairs`, `/maintenance/repairs/:id`)
- Danh sách phiếu sửa chữa
- Tạo phiếu, cập nhật trạng thái
- Chi tiết: linh kiện sử dụng, chi phí, thời gian

---

## 6. Inventory — Kiểm kê

### Danh sách phiên (`/inventory`)
- Các phiên kiểm kê đã tạo
- Trạng thái: Draft, In Progress, Completed

### Chi tiết phiên (`/inventory/:id`)
- Quét barcode/QR
- So sánh thực tế vs hệ thống
- Báo cáo chênh lệch

---

## 7. Requests & Workflows

### Yêu cầu (`/requests`)
- Danh sách tất cả yêu cầu (admin view)
- Phê duyệt, từ chối

### Yêu cầu của tôi (`/me/requests`, `/me/requests/new`)
- User tạo yêu cầu mới: cấp phát thiết bị, mua sắm, sửa chữa
- Theo dõi trạng thái yêu cầu

### Thiết bị của tôi (`/me/assets`)
- Danh sách thiết bị được cấp phát cho user hiện tại

### Inbox (`/inbox`, `/inbox/:id`)
- Hộp thư đến: phê duyệt yêu cầu, thông báo cần hành động

### Notifications (`/notifications`)
- Trung tâm thông báo

---

## 8. Analytics & Reports

### Phân tích (`/analytics`)
- Dashboard với widget: biểu đồ tròn, cột, line
- Thống kê: số thiết bị, chi phí, sử dụng
- Nút refresh dữ liệu

### Báo cáo (`/reports`)
- Tổng hợp báo cáo hệ thống
- Báo cáo thiết bị (`/reports/assets`)

---

## 9. Admin & Security

### Quản trị (`/admin`)
- Quản lý tài khoản: tạo, sửa, xóa, reset mật khẩu
- RBAC: quản lý roles, permissions
- Danh sách audit logs

### Bảo mật (`/security`)
- Quản lý permissions chi tiết
- Compliance frameworks (ISO, NIST...)
- Đánh giá bảo mật

---

## 10. Automation & Integrations

### Tự động hóa (`/automation`)
- Tab: Rules, Tasks, Notifications
- Tạo rule tự động: trigger → condition → action
- Lịch trình tác vụ
- Quản lý thông báo tự động

### Tích hợp (`/integrations`)
- Connectors: kết nối hệ thống bên ngoài
- Sync rules: đồng bộ dữ liệu
- Webhooks: nhận/gửi events
- Test kết nối

---

## 11. Help

### Trợ giúp (`/help`)
- Hướng dẫn sử dụng hệ thống

---

## Route Map — Bản đồ Routes

```
# Auth & Setup
/login                          Đăng nhập
/logout                         Đăng xuất
/forbidden                      Không có quyền
/setup                          Khởi tạo lần đầu

# Assets
/assets                         Danh sách thiết bị
/assets/:id                     Chi tiết thiết bị
/assets/catalogs                Danh mục
/assets/purchase-plans          Kế hoạch mua sắm
/assets/purchase-plans/new      Tạo kế hoạch
/assets/asset-increases/new     Ghi tăng tài sản

# CMDB
/cmdb                           Tổng quan CMDB
/cmdb/cis                       Danh sách CIs
/cmdb/cis/:id                   Chi tiết CI
/cmdb/types                     Loại CI
/cmdb/services                  Dịch vụ
/cmdb/changes                   Thay đổi
/cmdb/reports                   Báo cáo CMDB
/cmdb/relationships/import      Import quan hệ

# Warehouse
/warehouse                      Dashboard kho
/warehouse/warehouses           Danh sách kho
/warehouse/parts                Linh kiện
/warehouse/stock                Tồn kho
/warehouse/documents            Phiếu nhập/xuất
/warehouse/documents/:id        Chi tiết phiếu
/warehouse/documents/new        Tạo phiếu
/warehouse/ledger               Sổ kho
/warehouse/reconciliation       Đối chiếu
/warehouse/repairs              Sửa chữa (kho)
/warehouse/repairs/:id          Chi tiết sửa chữa
/warehouse/purchase-plans       Kế hoạch mua kho
/warehouse/reports              Báo cáo kho

# Maintenance
/maintenance                    Dashboard bảo trì
/maintenance/repairs            Sửa chữa
/maintenance/repairs/:id        Chi tiết sửa chữa

# Inventory
/inventory                      Danh sách kiểm kê
/inventory/:id                  Chi tiết phiên

# Requests & Workflow
/requests                       Tất cả yêu cầu
/me/requests                    Yêu cầu của tôi
/me/requests/new                Tạo yêu cầu
/me/assets                      Thiết bị của tôi
/inbox                          Hộp thư đến
/inbox/:id                      Chi tiết inbox
/notifications                  Thông báo

# Analytics & Reports
/analytics                      Phân tích
/reports                        Báo cáo
/reports/assets                 Báo cáo thiết bị

# Admin & Security
/admin                          Quản trị
/security                       Bảo mật
/automation                     Tự động hóa
/integrations                   Tích hợp
/help                           Trợ giúp
```

---

## UI Components

Hệ thống sử dụng design system tùy chỉnh với các component chính:

| Component | Mô tả |
|-----------|-------|
| `DataTable` | Bảng dữ liệu với pagination, sort, filter |
| `Modal` | Dialog tạo/sửa/xóa |
| `ConfirmDialog` | Xác nhận hành động |
| `PageHeader` | Header trang với breadcrumbs |
| `AppSidebar` | Sidebar điều hướng |
| `Toolbar` | Thanh công cụ (search, filter, actions) |
| `EmptyState` | Hiển thị khi không có dữ liệu |
| `NotificationCenter` | Trung tâm thông báo |
| `BarcodeScanner` | Quét mã vạch/QR |
| `LanguageSwitcher` | Chuyển ngôn ngữ (vi/en) |
| `ChartCard` | Card chứa biểu đồ ECharts |
| `KpiCard` | Card KPI cho dashboard |
| `TopologyGraph` | Đồ thị topology (Cytoscape) |

### Data Testid Conventions

Các element sử dụng `data-testid` cho E2E testing:

| Testid | Mô tả |
|--------|-------|
| `btn-create` | Nút tạo mới |
| `btn-submit` | Nút gửi/submit |
| `btn-cancel` | Nút hủy |
| `btn-refresh` | Nút làm mới |
| `modal-create` | Dialog tạo mới |
| `modal-edit` | Dialog chỉnh sửa |
| `modal-delete` | Dialog xóa |
| `row-edit-{id}` | Nút sửa trên hàng |
| `row-delete-{id}` | Nút xóa trên hàng |
