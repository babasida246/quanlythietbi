# UI/UX Audit – Playwright Screenshot Suite

Bộ test tự động quét **tất cả các trang** của ứng dụng QuanLyThietBi tại `http://localhost:3001/`, đăng nhập bằng tài khoản admin, duyệt từng module và **chụp screenshot chi tiết** để phục vụ phân tích nâng cấp UI/UX.

## Cấu trúc thư mục

```
tests/ui-audit/
├── playwright.config.ts       # Config riêng cho audit (Full HD + Tablet)
├── fixtures.ts                # Auto-login fixture + snap() helper
├── README.md                  # File này
├── pages/
│   ├── 00-login.spec.ts       # Trang đăng nhập
│   ├── 01-dashboard-navigation.spec.ts  # Dashboard + sidebar
│   ├── 02-me-pages.spec.ts    # Tài sản/Yêu cầu của tôi
│   ├── 03-assets.spec.ts      # Module Quản lý Tài sản
│   ├── 04-cmdb.spec.ts        # Module CMDB
│   ├── 05-inventory.spec.ts   # Module Kiểm kê
│   ├── 06-warehouse.spec.ts   # Module Kho
│   ├── 07-maintenance.spec.ts # Module Bảo trì
│   ├── 08-requests.spec.ts    # Module Yêu cầu
│   ├── 09-reports.spec.ts     # Module Báo cáo
│   ├── 10-notifications-inbox.spec.ts # Thông báo & Hộp thư
│   ├── 11-admin-setup.spec.ts # Admin & Setup
│   ├── 12-ui-interactions.spec.ts     # Tương tác UI (search, filter, pagination, responsive)
│   ├── 13-full-page-crawl.spec.ts     # Crawl tự động mọi link
│   └── 14-error-pages.spec.ts # Trang lỗi (404, forbidden, logout)
└── screenshots/               # ← Output: screenshot được lưu tại đây
    ├── Desktop_Chrome___Full_HD/
    └── Tablet_Landscape/
```

## Cách chạy

### Yêu cầu
- App đang chạy tại `http://localhost:3001/`
- Tài khoản `admin@example.com` / `Benhvien@121` có thể đăng nhập

### Chạy toàn bộ bộ test
```bash
npx playwright test --config tests/ui-audit/playwright.config.ts
```

### Chỉ chạy Desktop Chrome
```bash
npx playwright test --config tests/ui-audit/playwright.config.ts --project "Desktop Chrome – Full HD"
```

### Chỉ chạy một file cụ thể
```bash
npx playwright test --config tests/ui-audit/playwright.config.ts tests/ui-audit/pages/03-assets.spec.ts
```

### Xem report HTML
```bash
npx playwright show-report tests/ui-audit/report
```

## Output

- **Screenshots**: `tests/ui-audit/screenshots/<Project>/` – mỗi ảnh PNG tương ứng 1 trạng thái trang
- **HTML Report**: `tests/ui-audit/report/` – report tương tác với screenshot, trace, video đính kèm
- **Test Results**: `tests/ui-audit/test-results/` – trace & video

## Tài khoản test

| Email | Password | Role |
|---|---|---|
| admin@example.com | Benhvien@121 | admin |

## Các trang được quét

| # | Module | Route | Mô tả |
|---|---|---|---|
| 1 | Login | `/login` | Form đăng nhập |
| 2 | Dashboard | `/` | Trang chính |
| 3 | My Assets | `/me/assets` | Tài sản của tôi |
| 4 | My Requests | `/me/requests` | Yêu cầu của tôi |
| 5 | Assets List | `/assets` | Danh sách tài sản |
| 6 | Asset Detail | `/assets/[id]` | Chi tiết tài sản |
| 7 | Catalogs | `/assets/catalogs` | Danh mục tài sản |
| 8 | Purchase Plans | `/assets/purchase-plans` | Kế hoạch mua sắm |
| 9 | New Purchase Plan | `/assets/purchase-plans/new` | Tạo KH mua sắm |
| 10 | Asset Increase | `/assets/asset-increases/new` | Tăng tài sản |
| 11 | CMDB | `/cmdb` | Trang chính CMDB |
| 12 | CMDB CIs | `/cmdb/cis` | Configuration Items |
| 13 | CMDB Services | `/cmdb/services` | Dịch vụ |
| 14 | CMDB Types | `/cmdb/types` | Loại CI |
| 15 | CMDB Changes | `/cmdb/changes` | Quản lý thay đổi |
| 16 | CMDB Relationships | `/cmdb/relationships/import` | Import quan hệ |
| 17 | CMDB Reports | `/cmdb/reports` | Báo cáo CMDB |
| 18 | Inventory | `/inventory` | Kiểm kê |
| 19 | Warehouse | `/warehouse` | Trang kho chính |
| 20 | Stock | `/warehouse/stock` | Tồn kho |
| 21 | Warehouses | `/warehouse/warehouses` | Danh sách kho |
| 22 | Documents | `/warehouse/documents` | Chứng từ kho |
| 23 | Parts | `/warehouse/parts` | Vật tư/Phụ tùng |
| 24 | Repairs | `/warehouse/repairs` | Sửa chữa |
| 25 | Ledger | `/warehouse/ledger` | Sổ kho |
| 26 | Warehouse Reports | `/warehouse/reports` | Báo cáo kho |
| 27 | Maintenance | `/maintenance` | Bảo trì |
| 28 | Requests | `/requests` | Danh sách yêu cầu |
| 29 | New Request | `/requests/new` | Tạo yêu cầu mới |
| 30 | Asset Reports | `/reports/assets` | Báo cáo tài sản |
| 31 | Notifications | `/notifications` | Thông báo |
| 32 | Inbox | `/inbox` | Hộp thư đến |
| 33 | Admin | `/admin` | Quản trị |
| 34 | Setup | `/setup` | Thiết lập hệ thống |
| 35 | 404 | `/non-existent-page` | Trang lỗi 404 |
| 36 | Forbidden | `/forbidden` | Trang từ chối |
| 37 | Logout | `/logout` | Đăng xuất |
