/**
 * patch-final-i18n.mjs
 * Adds all remaining missing i18n keys for ~420 hardcoded Vietnamese strings
 * across reports, catalogs, warehouse, inventory, requests, admin, cmdb,
 * stockDoc, wfRequest, specField, and common namespaces.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../apps/web-ui/src/lib/i18n/locales');

function readJson(file) {
    let raw = readFileSync(resolve(localesDir, file), 'utf8');
    // Strip literal \n at end
    while (raw.endsWith('\\n')) raw = raw.slice(0, -2);
    return JSON.parse(raw);
}

function writeJson(file, obj) {
    writeFileSync(resolve(localesDir, file), JSON.stringify(obj, null, 2) + '\n');
}

function set(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] === 'string') cur[parts[i]] = {};
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (cur[last] === undefined) cur[last] = value;
}

const en = readJson('en.json');
const vi = readJson('vi.json');

// =========================================
// COMMON
// =========================================
const commonKeys = {
    'common.unknownError': ['Unknown error', 'Lỗi không xác định'],
    'common.retry': ['Retry', 'Thử lại'],
    'common.records': ['records', 'bản ghi'],
    'common.create': ['Create', 'Tạo mới'],
    'common.refresh': ['Refresh', 'Làm mới'],
    'common.name': ['Name', 'Tên'],
    'common.actions': ['Actions', 'Thao tác'],
    'common.noData': ['No data', 'Không có dữ liệu'],
    'common.edit': ['Edit', 'Sửa'],
    'common.delete': ['Delete', 'Xóa'],
    'common.createSuccess': ['Created successfully', 'Tạo mới thành công'],
    'common.updateSuccess': ['Updated successfully', 'Cập nhật thành công'],
    'common.deleteSuccess': ['Deleted successfully', 'Xóa thành công'],
    'common.yes': ['Yes', 'Có'],
    'common.no': ['No', 'Không'],
    'common.close': ['Close', 'Đóng'],
    'common.cancel': ['Cancel', 'Hủy'],
    'common.saving': ['Saving...', 'Đang lưu...'],
    'common.sending': ['Sending...', 'Đang gửi...'],
    'common.allTypes': ['All types', 'Tất cả loại'],
    'common.allStatuses': ['All statuses', 'Tất cả trạng thái'],
    'common.dateFrom': ['From date', 'Từ ngày'],
    'common.dateTo': ['To date', 'Đến ngày'],
    'common.detail': ['Detail', 'Chi tiết'],
    'common.previous': ['Previous', 'Trước'],
    'common.next': ['Next', 'Sau'],
    'common.print': ['Print', 'In'],
    'common.reset': ['Reset', 'Đặt lại'],
    'common.apply': ['Apply', 'Áp dụng'],
    'common.notePlaceholder': ['Note...', 'Ghi chú...'],
    'common.note': ['Note', 'Ghi chú'],
    'common.total': ['Total:', 'Tổng:'],
    'common.page': ['Page', 'Trang'],
    'common.loading': ['Loading...', 'Đang tải...'],
};

// =========================================
// REPORTS
// =========================================
const reportsKeys = {
    'reports.appliedView': ['Applied view: ', 'Đã áp dụng view: '],
    'reports.sidebar.heading': ['Reports', 'Báo cáo'],
    'reports.sidebar.saved': ['Saved', 'Đã lưu'],
    'reports.title': ['Reports', 'Báo cáo'],
    'reports.refreshData': ['Refresh data', 'Làm mới dữ liệu'],
    'reports.detailData': ['Detail Data', 'Dữ liệu chi tiết'],
    'reports.results': ['results', 'kết quả'],
    'reports.updatedAt': ['Updated at', 'Cập nhật lúc'],

    // Column labels
    'reports.col.assetCode': ['Asset Code', 'Mã tài sản'],
    'reports.col.category': ['Category', 'Danh mục'],
    'reports.col.location': ['Location', 'Vị trí'],
    'reports.col.status': ['Status', 'Trạng thái'],
    'reports.col.createdAt': ['Created Date', 'Ngày tạo'],
    'reports.col.month': ['Month', 'Tháng'],
    'reports.col.created': ['Created', 'Tạo mới'],
    'reports.col.retired': ['Retired', 'Thanh lý'],
    'reports.col.assetCodeShort': ['Asset Code', 'Mã TS'],
    'reports.col.name': ['Name', 'Tên'],
    'reports.col.warrantyEnd': ['Warranty Expiry', 'Hết hạn BH'],
    'reports.col.total': ['Total', 'Tổng'],
    'reports.col.inUse': ['In Use', 'Đang dùng'],
    'reports.col.inStock': ['In Stock', 'Trong kho'],
    'reports.col.code': ['Code', 'Mã'],
    'reports.col.partName': ['Item Name', 'Tên mặt hàng'],
    'reports.col.warehouse': ['Warehouse', 'Kho'],
    'reports.col.onHand': ['On Hand', 'Tồn kho'],
    'reports.col.reserved': ['Reserved', 'Đặt trước'],
    'reports.col.receipts': ['Receipts', 'Nhập'],
    'reports.col.issues': ['Issues', 'Xuất'],
    'reports.col.minLevel': ['Min Level', 'Tối thiểu'],
    'reports.col.shortfall': ['Shortfall', 'Thiếu'],
    'reports.col.severity': ['Severity', 'Mức độ'],
    'reports.col.closed': ['Closed', 'Đã đóng'],
    'reports.col.avgHours': ['Avg (hours)', 'TB (giờ)'],
    'reports.col.title': ['Title', 'Tiêu đề'],
    'reports.col.openedAt': ['Opened Date', 'Ngày mở'],
    'reports.col.asset': ['Asset', 'Tài sản'],
    'reports.col.requestType': ['Request Type', 'Loại yêu cầu'],
    'reports.col.ciType': ['CI Type', 'Loại CI'],
    'reports.col.totalCis': ['Total CIs', 'Tổng CI'],
    'reports.col.active': ['Active', 'Đang hoạt động'],
    'reports.col.ciName': ['CI Name', 'Tên CI'],
    'reports.col.type': ['Type', 'Loại'],
    'reports.col.attrCount': ['Attribute Count', 'Số thuộc tính'],

    // Chart titles
    'reports.chart.byStatus': ['By Status', 'Theo trạng thái'],
    'reports.chart.byCategoryTop10': ['By Category (Top 10)', 'Theo danh mục (Top 10)'],
    'reports.chart.byLocationTop10': ['By Location (Top 10)', 'Theo vị trí (Top 10)'],
    'reports.chart.monthlyTrend': ['Monthly Trend', 'Biến động theo tháng'],
    'reports.chart.warrantyExpiring': ['Warranty Expiring', 'Sắp hết hạn bảo hành'],
    'reports.chart.assetsByLocation': ['Assets by Location', 'Tài sản theo vị trí'],
    'reports.chart.topStockItems': ['Top 10 Stock Items', 'Top 10 mặt hàng tồn kho'],
    'reports.chart.monthlyMovement': ['Monthly Receipts / Issues', 'Nhập / Xuất kho theo tháng'],
    'reports.chart.lowStockTop10': ['Low Stock Items (Top 10)', 'Mặt hàng thiếu hụt (Top 10)'],
    'reports.chart.bySeverity': ['Tickets by Severity', 'Phiếu theo mức độ'],
    'reports.chart.avgProcessingHours': ['Avg Processing Time (hours)', 'Thời gian xử lý TB (giờ)'],
    'reports.chart.maintenanceStatus': ['Maintenance Ticket Status', 'Trạng thái phiếu bảo trì'],
    'reports.chart.requestsByStatus': ['Requests by Status', 'Yêu cầu theo trạng thái'],
    'reports.chart.byRequestType': ['By Request Type', 'Theo loại yêu cầu'],
    'reports.chart.cisByType': ['CIs by Type', 'CI theo loại'],
    'reports.chart.activeVsOther': ['Active vs Other', 'Hoạt động vs Khác'],

    // Filter bar
    'reports.filter.savedFilter': ['Saved filter: ', 'Đã lưu bộ lọc: '],
    'reports.filter.title': ['Filters', 'Bộ lọc'],
    'reports.filter.category': ['Category', 'Danh mục'],
    'reports.filter.location': ['Location', 'Vị trí'],
    'reports.filter.warehouse': ['Warehouse', 'Kho'],
    'reports.filter.status': ['Status', 'Trạng thái'],
    'reports.filter.statusPlaceholder': ['Status...', 'Trạng thái...'],
    'reports.filter.saveFilter': ['Save filter', 'Lưu bộ lọc'],
};

// =========================================
// CATALOGS
// =========================================
const catalogsKeys = {
    'catalogs.pageTitle': ['Asset Catalogs', 'Danh mục tài sản'],
    'catalogs.tab.categories': ['Categories', 'Danh mục'],
    'catalogs.tab.vendors': ['Vendors', 'Nhà cung cấp'],
    'catalogs.tab.models': ['Models', 'Mẫu mã'],
    'catalogs.tab.locations': ['Locations', 'Vị trí'],
    'catalogs.tab.statuses': ['Statuses', 'Trạng thái'],

    'catalogs.validation.categoryNameRequired': ['Category name is required', 'Tên danh mục là bắt buộc'],
    'catalogs.validation.vendorNameRequired': ['Vendor name is required', 'Tên nhà cung cấp là bắt buộc'],
    'catalogs.validation.modelNameRequired': ['Model name is required', 'Tên mẫu mã là bắt buộc'],
    'catalogs.validation.categoryRequired': ['Category is required', 'Danh mục là bắt buộc'],
    'catalogs.validation.locationNameRequired': ['Location name is required', 'Tên vị trí là bắt buộc'],
    'catalogs.validation.statusNameRequired': ['Status name is required', 'Tên trạng thái là bắt buộc'],
    'catalogs.validation.codeRequired': ['Code is required', 'Code là bắt buộc'],

    'catalogs.createTitle': ['Create {entity}', 'Tạo mới {entity}'],
    'catalogs.editTitle': ['Edit {entity}', 'Chỉnh sửa {entity}'],

    'catalogs.header.categoryName': ['Category Name', 'Tên danh mục'],
    'catalogs.header.locationName': ['Location Name', 'Tên vị trí'],

    'catalogs.field.categoryName': ['Category Name', 'Tên danh mục'],
    'catalogs.field.parentCategory': ['Parent Category', 'Danh mục cha'],
    'catalogs.placeholder.noParentCategory': ['No parent category', 'Không có danh mục cha'],
    'catalogs.field.vendorName': ['Vendor Name', 'Tên nhà cung cấp'],
    'catalogs.field.modelName': ['Model Name', 'Tên mẫu mã'],
    'catalogs.field.category': ['Category', 'Danh mục'],
    'catalogs.placeholder.selectCategory': ['Select category', 'Chọn danh mục'],
    'catalogs.field.vendor': ['Vendor', 'Nhà cung cấp'],
    'catalogs.placeholder.selectVendor': ['Select vendor', 'Chọn nhà cung cấp'],
    'catalogs.field.locationName': ['Location Name', 'Tên vị trí'],
    'catalogs.field.parentLocation': ['Parent Location', 'Vị trí cha'],
    'catalogs.placeholder.noParentLocation': ['No parent location', 'Không có vị trí cha'],
    'catalogs.field.statusName': ['Status Name', 'Tên trạng thái'],
    'catalogs.field.statusCode': ['Status Code', 'Mã trạng thái'],
    'catalogs.field.isTerminal': ['Terminal status', 'Trạng thái kết thúc'],
    'catalogs.field.color': ['Color', 'Màu sắc'],
};

// =========================================
// WAREHOUSE
// =========================================
const warehouseKeys = {
    'warehouse.docType.receipt': ['Receipt', 'Nhập kho'],
    'warehouse.docType.issue': ['Issue', 'Xuất kho'],
    'warehouse.docType.transfer': ['Transfer', 'Điều chuyển'],
    'warehouse.docType.adjust': ['Adjustment', 'Điều chỉnh'],
    'warehouse.docType.adjustStock': ['Stock Adjustment', 'Điều chỉnh tồn'],
    'warehouse.docType.interWarehouse': ['Inter-warehouse Transfer', 'Chuyển kho'],

    'warehouse.docStatus.draft': ['Draft', 'Nháp'],
    'warehouse.docStatus.submitted': ['Pending Approval', 'Chờ duyệt'],
    'warehouse.docStatus.approved': ['Approved', 'Đã duyệt'],
    'warehouse.docStatus.posted': ['Posted', 'Đã ghi sổ'],
    'warehouse.docStatus.canceled': ['Canceled', 'Đã hủy'],

    'warehouse.errors.loadDocuments': ['Failed to load documents', 'Lỗi tải danh sách chứng từ'],
    'warehouse.toast.submitted': ['Submitted {code}', 'Đã trình duyệt {code}'],
    'warehouse.toast.submitFailed': ['Submit failed', 'Trình duyệt thất bại'],
    'warehouse.toast.approved': ['Approved {code}', 'Đã duyệt {code}'],
    'warehouse.toast.approveFailed': ['Approve failed', 'Duyệt thất bại'],
    'warehouse.toast.posted': ['Posted {code}', 'Đã ghi sổ {code}'],
    'warehouse.toast.postFailed': ['Post failed', 'Ghi sổ thất bại'],
    'warehouse.toast.canceled': ['Canceled {code}', 'Đã hủy {code}'],
    'warehouse.toast.cancelFailed': ['Cancel failed', 'Hủy thất bại'],
    'warehouse.toast.postSuccess': ['Document {code} posted successfully', 'Phiếu {code} đã ghi sổ thành công'],
    'warehouse.toast.cancelSuccess': ['Document {code} canceled', 'Phiếu {code} đã hủy'],
    'warehouse.toast.submitSuccess': ['Document {code} submitted', 'Phiếu {code} đã trình duyệt'],
    'warehouse.toast.approveSuccess': ['Document {code} approved', 'Phiếu {code} đã duyệt'],
    'warehouse.toast.postFailedDetail': ['Failed to post document: {error}', 'Ghi sổ phiếu thất bại: {error}'],
    'warehouse.toast.cancelFailedDetail': ['Failed to cancel document: {error}', 'Hủy phiếu thất bại: {error}'],
    'warehouse.toast.submitFailedDetail': ['Failed to submit document: {error}', 'Trình duyệt phiếu thất bại: {error}'],
    'warehouse.toast.approveFailedDetail': ['Failed to approve document: {error}', 'Duyệt phiếu thất bại: {error}'],

    'warehouse.pageTitle': ['Receipts / Issues', 'Nhập / Xuất kho'],
    'warehouse.documents': ['documents', 'chứng từ'],
    'warehouse.createDocument': ['Create Document', 'Tạo chứng từ'],
    'warehouse.allWarehouses': ['All warehouses', 'Tất cả kho'],
    'warehouse.emptyState': ['No documents yet. Click "Create Document" to start.', 'Không có chứng từ nào. Nhấn "Tạo chứng từ" để bắt đầu.'],
    'warehouse.newDocument': ['Create New Stock Document', 'Lập phiếu nhập / xuất kho mới'],
    'warehouse.newDocumentHint': ['Fill in complete information then click "Save Document"', 'Điền đầy đủ thông tin rồi nhấn "Lưu phiếu"'],
    'warehouse.saveDocument': ['Save Document', 'Lưu phiếu'],

    // Table headers
    'warehouse.header.docCode': ['Doc No.', 'Số CT'],
    'warehouse.header.type': ['Type', 'Loại'],
    'warehouse.header.status': ['Status', 'Trạng thái'],
    'warehouse.header.sourceWarehouse': ['Source Warehouse', 'Kho nguồn'],
    'warehouse.header.targetWarehouse': ['Target Warehouse', 'Kho đích'],
    'warehouse.header.docDate': ['Document Date', 'Ngày CT'],
    'warehouse.header.note': ['Note', 'Ghi chú'],
    'warehouse.header.actions': ['ACTIONS', 'THAO TÁC'],

    // Action buttons
    'warehouse.action.submit': ['Submit', 'Gửi duyệt'],
    'warehouse.action.approve': ['Approve', 'Duyệt'],
    'warehouse.action.post': ['Post', 'Ghi sổ'],
    'warehouse.action.cancelDoc': ['Cancel', 'Hủy'],
    'warehouse.action.submitting': ['Submitting...', 'Đang gửi...'],
    'warehouse.action.approving': ['Approving...', 'Đang duyệt...'],
    'warehouse.action.posting': ['Posting...', 'Đang ghi sổ...'],
    'warehouse.action.cancelingDoc': ['Canceling...', 'Đang hủy...'],
    'warehouse.action.savingDraft': ['Saving...', 'Đang lưu...'],
    'warehouse.action.saveDraft': ['Save Draft', 'Lưu nháp'],

    // Form fields
    'warehouse.field.docType': ['Document Type', 'Loại phiếu'],
    'warehouse.field.status': ['Status', 'Trạng thái'],
    'warehouse.field.docDate': ['Document Date', 'Ngày lập'],
    'warehouse.field.warehouseIssue': ['Issue Warehouse', 'Kho xuất'],
    'warehouse.field.warehouseSource': ['Source Warehouse', 'Kho nguồn'],
    'warehouse.field.warehouseReceipt': ['Receipt Warehouse', 'Kho nhập'],
    'warehouse.field.targetWarehouse': ['Target Warehouse', 'Kho đích'],
    'warehouse.placeholder.selectWarehouse': ['-- Select warehouse --', '-- Chọn kho --'],
    'warehouse.placeholder.selectTargetWarehouse': ['-- Select target warehouse --', '-- Chọn kho đích --'],
    'warehouse.field.supplier': ['Supplier', 'Nhà cung cấp'],
    'warehouse.placeholder.supplier': ['Supplier name...', 'Tên nhà cung cấp...'],
    'warehouse.field.submitter': ['Submitter', 'Người nhập hàng'],
    'warehouse.placeholder.submitter': ['Submitter name...', 'Họ tên người nhập...'],
    'warehouse.field.receiver': ['Receiver', 'Người nhận'],
    'warehouse.placeholder.receiver': ['Receiver name...', 'Họ tên người nhận...'],
    'warehouse.field.department': ['Department / Division', 'Phòng ban / Bộ phận'],
    'warehouse.placeholder.department': ['Receiving department...', 'Phòng ban nhận hàng...'],
    'warehouse.field.section': ['Section', 'Bộ phận'],
    'warehouse.placeholder.section': ['Related section...', 'Bộ phận liên quan...'],
    'warehouse.field.performer': ['Performer', 'Người thực hiện'],
    'warehouse.placeholder.performer': ['Performer name...', 'Họ tên người thực hiện...'],
    'warehouse.field.note': ['Note', 'Ghi chú'],
    'warehouse.field.generalNote': ['General Note', 'Ghi chú chung'],
    'warehouse.placeholder.note': ['Content / description...', 'Nội dung / diễn giải...'],
    'warehouse.placeholder.generalNote': ['Content / description for the document...', 'Nội dung / diễn giải cho phiếu...'],
    'warehouse.linesHeading': ['Goods / Material Details', 'Chi tiết hàng hóa / vật tư'],
    'warehouse.createdAtLabel': ['Created:', 'Tạo:'],
    'warehouse.action.cancelDocument': ['Cancel Document', 'Hủy phiếu'],

    // Pagination
    'warehouse.pagination': ['Page {page} / {totalPages} · {total} documents', 'Trang {page} / {totalPages} · {total} chứng từ'],
};

// =========================================
// INVENTORY
// =========================================
const inventoryKeys = {
    'inventory.status.draft': ['Draft', 'Nháp'],
    'inventory.status.in_progress': ['In Progress', 'Đang kiểm kê'],
    'inventory.status.closed': ['Closed', 'Đã đóng'],
    'inventory.status.canceled': ['Canceled', 'Đã hủy'],

    'inventory.itemStatus.found': ['Found', 'Đúng vị trí'],
    'inventory.itemStatus.moved': ['Moved', 'Di chuyển'],
    'inventory.itemStatus.unknown': ['Unknown', 'Không xác định'],
    'inventory.itemStatus.missing': ['Missing', 'Thiếu'],

    'inventory.sessionNotFound': ['Session not found', 'Không tìm thấy phiên'],
    'inventory.loadFailed': ['Failed to load session', 'Không thể tải phiên'],
    'inventory.scanSuccess': ['✓ Scanned: {code}', '✓ Đã quét: {code}'],
    'inventory.scanFailed': ['Scan failed', 'Quét thất bại'],
    'inventory.confirmStart': ['Start inventory session? Status will change to "In Progress".', 'Bắt đầu phiên kiểm kê? Trạng thái sẽ chuyển sang "Đang kiểm kê".'],
    'inventory.startFailed': ['Failed to start session', 'Không thể bắt đầu phiên'],
    'inventory.confirmClose': ['Close inventory session? This action cannot be undone.', 'Đóng phiên kiểm kê? Thao tác này không thể hoàn tác.'],
    'inventory.closeFailed': ['Failed to close session', 'Không thể đóng phiên'],
    'inventory.confirmUndoScan': ['Undo this scan?', 'Hủy lần quét này?'],
    'inventory.undoSuccess': ['Scan undone', 'Đã hủy lần quét'],
    'inventory.undoFailed': ['Failed to undo scan', 'Không thể hủy quét'],

    'inventory.sessionList': ['Session list', 'Danh sách phiên'],
    'inventory.createdAt': ['Created at', 'Tạo lúc'],
    'inventory.startedAt': ['Started:', 'Bắt đầu:'],
    'inventory.closedAt': ['Closed at:', 'Đóng lúc:'],
    'inventory.startInventory': ['Start Inventory', 'Bắt đầu kiểm kê'],
    'inventory.closeSession': ['Close Session', 'Kết thúc & Đóng phiên'],

    'inventory.kpi.scanned': ['Scanned', 'Đã quét'],
    'inventory.kpi.found': ['Found', 'Đúng vị trí'],
    'inventory.kpi.moved': ['Moved', 'Di chuyển'],
    'inventory.kpi.unknown': ['Unknown', 'Không xác định'],

    'inventory.scanDevice': ['Scan Device', 'Quét thiết bị'],
    'inventory.deviceCode': ['Device Code', 'Mã thiết bị'],
    'inventory.scanPlaceholder': ['Enter or scan barcode...', 'Nhập hoặc quét mã vạch...'],
    'inventory.scannedLocation': ['Scanned Location', 'Vị trí quét được'],
    'inventory.noSelection': ['— No selection —', '— Không chọn —'],
    'inventory.noteOptional': ['Note (optional)', 'Ghi chú (tùy chọn)'],
    'inventory.scanning': ['Scanning...', 'Đang quét...'],
    'inventory.scan': ['Scan', 'Quét'],
    'inventory.scannedList': ['Scanned List', 'Danh sách đã quét'],
    'inventory.emptyState': ['No devices scanned yet. Use the scan input above to start.', 'Chưa có thiết bị nào được quét. Dùng ô quét phía trên để bắt đầu.'],

    'inventory.header.deviceId': ['Device ID', 'ID thiết bị'],
    'inventory.header.status': ['Status', 'Trạng thái'],
    'inventory.header.expectedLocation': ['Expected Location', 'Vị trí kỳ vọng'],
    'inventory.header.scannedLocation': ['Scanned Location', 'Vị trí quét'],
    'inventory.header.scanTime': ['Scan Time', 'Thời gian quét'],
    'inventory.header.note': ['Note', 'Ghi chú'],
    'inventory.undoScanTitle': ['Undo this scan', 'Hủy lần quét này'],
    'inventory.sessionNotFoundError': ['Inventory session not found', 'Không tìm thấy phiên kiểm kê'],
};

// =========================================
// REQUESTS
// =========================================
const requestsKeys = {
    'requests.loadFailed': ['Failed to load requests', 'Không tải được danh sách yêu cầu'],
    'requests.toast.submitted': ['Request submitted for approval', 'Đã gửi yêu cầu để phê duyệt'],
    'requests.toast.submitFailed': ['Submit request failed', 'Gửi yêu cầu thất bại'],
    'requests.toast.canceled': ['Request canceled', 'Đã hủy yêu cầu'],
    'requests.toast.cancelFailed': ['Cancel request failed', 'Hủy yêu cầu thất bại'],
    'requests.toast.withdrawn': ['Request withdrawn to draft', 'Đã rút lại yêu cầu về nháp'],
    'requests.toast.withdrawFailed': ['Withdraw failed', 'Rút lại thất bại'],
    'requests.toast.createSuccess': ['Request created successfully', 'Tạo yêu cầu thành công'],
    'requests.toast.createFailed': ['Create request failed', 'Tạo yêu cầu thất bại'],

    'requests.myRequests': ['My Requests', 'Yêu cầu của tôi'],
    'requests.myRequestsSubtitle': ['Track and manage requests you have submitted.', 'Theo dõi và quản lý yêu cầu bạn đã gửi.'],
    'requests.createRequest': ['Create Request', 'Tạo yêu cầu'],
    'requests.emptyState': ['No requests yet. Click "Create Request" to start.', 'Chưa có yêu cầu nào. Nhấn "Tạo yêu cầu" để bắt đầu.'],
    'requests.workflowTitle': ['Workflow Requests', 'Yêu cầu Workflow'],
    'requests.workflowSubtitle': ['All requests in the system.', 'Tất cả yêu cầu trong hệ thống.'],
    'requests.workflowEmpty': ['No requests yet.', 'Chưa có yêu cầu nào.'],

    // Table headers
    'requests.header.codeTitle': ['Code / Title', 'Mã / Tiêu đề'],
    'requests.header.type': ['Type', 'Loại'],
    'requests.header.priority': ['Priority', 'Ưu tiên'],
    'requests.header.status': ['Status', 'Trạng thái'],
    'requests.header.createdAt': ['Created Date', 'Ngày tạo'],
    'requests.header.actions': ['Actions', 'Thao tác'],
    'requests.header.sender': ['Sender', 'Người gửi'],

    // Detail modal
    'requests.loadingDetail': ['Loading detail...', 'Đang tải chi tiết...'],
    'requests.linesList': ['Request Lines ({count} lines)', 'Danh sách yêu cầu ({count} dòng)'],
    'requests.lineItem': ['Line {n}', 'Dòng {n}'],
    'requests.fulfillment.fulfilled': ['Fulfilled', 'Hoàn thành'],
    'requests.fulfillment.partial': ['Partial', 'Một phần'],
    'requests.fulfillment.cancelled': ['Cancelled', 'Hủy'],
    'requests.fulfillment.pending': ['Pending', 'Chờ'],

    'requests.submitHint': ['Submit request to start the approval process.', 'Gửi yêu cầu để bắt đầu quy trình phê duyệt.'],
    'requests.submitting': ['Submitting...', 'Đang gửi...'],
    'requests.submit': ['Submit Request', 'Gửi yêu cầu'],
    'requests.withdrawHint': ['Withdraw request (move to draft):', 'Rút lại yêu cầu (chuyển về nháp):'],
    'requests.withdrawReasonPlaceholder': ['Withdraw reason (optional)', 'Lý do rút lại (tuỳ chọn)'],
    'requests.processing': ['Processing...', 'Đang xử lý...'],
    'requests.withdraw': ['Withdraw', 'Rút lại'],
    'requests.cancelHint': ['Cancel request:', 'Hủy yêu cầu:'],
    'requests.cancelReasonPlaceholder': ['Cancel reason (optional)', 'Lý do hủy (tuỳ chọn)'],
    'requests.canceling': ['Canceling...', 'Đang hủy...'],
    'requests.cancelRequest': ['Cancel Request', 'Hủy yêu cầu'],

    'requests.actionBusy.submitting': ['Submitting...', 'Đang gửi...'],
    'requests.actionBusy.withdrawing': ['Processing...', 'Đang xử lý...'],
    'requests.actionBusy.canceling': ['Canceling...', 'Đang hủy...'],

    // Detail labels
    'requests.detail.title': ['Title', 'Tiêu đề'],
    'requests.detail.status': ['Status', 'Trạng thái'],
    'requests.detail.type': ['Type', 'Loại'],
    'requests.detail.priority': ['Priority', 'Ưu tiên'],
    'requests.detail.createdAt': ['Created Date', 'Ngày tạo'],
    'requests.detail.submittedAt': ['Submitted at', 'Đã gửi lúc'],
    'requests.detail.currentStep': ['Current Step', 'Đang ở bước'],
    'requests.detail.info': ['Request Information', 'Thông tin yêu cầu'],

    // New request form
    'requests.newRequest': ['Create New Request', 'Tạo yêu cầu mới'],
    'requests.newRequestHint': ['Fill in information then click "Save Draft" or "Create & Submit"', 'Điền thông tin rồi nhấn "Lưu nháp" hoặc "Tạo & Gửi ngay"'],
    'requests.saveDraft': ['Save Draft', 'Lưu nháp'],
    'requests.createAndSubmit': ['Create & Submit', 'Tạo & Gửi ngay'],
    'requests.validation.titleRequired': ['Please enter request title', 'Vui lòng nhập tiêu đề yêu cầu'],

    'requests.field.title': ['Title', 'Tiêu đề'],
    'requests.placeholder.title': ['Brief description of the request...', 'Mô tả ngắn gọn nội dung yêu cầu...'],
    'requests.field.requestType': ['Request Type', 'Loại yêu cầu'],
    'requests.field.priority': ['Priority', 'Ưu tiên'],
    'requests.field.dueDate': ['Due Date', 'Hạn xử lý'],
    'requests.field.assignModel': ['Device model to assign', 'Model thiết bị cần cấp'],
    'requests.field.returnDevice': ['Device code/name to return', 'Mã / tên thiết bị thu hồi'],
    'requests.field.noteReason': ['Note / Reason', 'Ghi chú / Lý do'],
    'requests.placeholder.note': ['Describe the purpose and reason for this request...', 'Mô tả chi tiết lý do, mục đích yêu cầu...'],
    'requests.linesSection': ['Requested Items', 'Danh sách vật tư / thiết bị yêu cầu'],
    'requests.linesHint': ['Optional — leave empty if only title/note description is needed', 'Tuỳ chọn — để trống nếu chỉ cần mô tả bằng tiêu đề/ghi chú'],
    'requests.loadingCatalogs': ['Loading catalogs...', 'Đang tải danh mục...'],
};

// =========================================
// ADMIN
// =========================================
const adminKeys = {
    'admin.tab.users': ['Users', 'Người dùng'],
    'admin.tab.rbac': ['Permissions', 'Phân quyền'],
    'admin.tab.logs': ['Audit Logs', 'Nhật ký'],
};

// =========================================
// CMDB
// =========================================
const cmdbKeys = {
    'cmdb.impactLoadFailed': ['Failed to load impact data', 'Không thể tải dữ liệu tác động'],
    'cmdb.changesLoadFailed': ['Failed to load change history', 'Không thể tải lịch sử thay đổi'],
    'cmdb.backToCmdb': ['Back to CMDB', 'Quay lại CMDB'],
    'cmdb.changeCi': ['Change this CI', 'Thay đổi CI này'],
    'cmdb.importRelationship': ['Import Relationship', 'Import quan hệ'],

    'cmdb.tab.overview': ['Overview', 'Tổng quan'],
    'cmdb.tab.relationships': ['Relationships', 'Quan hệ'],
    'cmdb.tab.impactAnalysis': ['Impact Analysis', 'Phân tích tác động'],
    'cmdb.tab.changes': ['Changes', 'Thay đổi'],

    'cmdb.impact.title': ['Impact Analysis', 'Phân tích tác động'],
    'cmdb.impact.description': ['CIs affected when {name} has an incident (depth {depth})', 'CI bị ảnh hưởng khi {name} gặp sự cố (độ sâu {depth})'],
    'cmdb.impact.noDependencies': ['No CIs depend on this CI.', 'Không có CI nào phụ thuộc vào CI này.'],
    'cmdb.impact.prompt': ['Click "Load Impact Analysis" to load information.', 'Nhấn "Phân tích tác động" để tải thông tin.'],
    'cmdb.impact.load': ['Load Impact Analysis', 'Tải phân tích tác động'],

    'cmdb.impact.header.ciName': ['CI Name', 'Tên CI'],
    'cmdb.impact.header.ciCode': ['CI Code', 'Mã CI'],
    'cmdb.impact.header.environment': ['Environment', 'Môi trường'],
    'cmdb.impact.header.status': ['Status', 'Trạng thái'],
    'cmdb.impact.header.actions': ['Actions', 'Thao tác'],
    'cmdb.impact.viewDetail': ['View Detail', 'Xem chi tiết'],

    'cmdb.changes.title': ['Change History', 'Lịch sử thay đổi'],
    'cmdb.changes.viewAll': ['View All Changes', 'Xem tất cả thay đổi'],
    'cmdb.changes.empty': ['No changes for this CI.', 'Không có thay đổi nào cho CI này.'],
    'cmdb.changes.create': ['Create New Change', 'Tạo thay đổi mới'],

    'cmdb.changes.header.title': ['Title', 'Tiêu đề'],
    'cmdb.changes.header.riskLevel': ['Risk Level', 'Mức độ rủi ro'],
    'cmdb.changes.header.status': ['Status', 'Trạng thái'],
    'cmdb.changes.header.createdAt': ['Created Date', 'Ngày tạo'],
    'cmdb.changes.header.actions': ['Actions', 'Thao tác'],
    'cmdb.changes.view': ['View', 'Xem'],
};

// =========================================
// SPEC FIELD / DEFS TABLE
// =========================================
const specKeys = {
    'specField.columnLabel': ['Label', 'Nhãn'],
    'specField.columnDataType': ['Data Type', 'Kiểu dữ liệu'],
    'specField.columnRequired': ['Required', 'Bắt buộc'],
    'specField.placeholder.label': ['Memory Size', 'Kích thước bộ nhớ'],
    'specField.normalizeNone': ['None', 'Không'],
    'specField.placeholder.defaultValue': ['Default value (optional)', 'Giá trị mặc định (tùy chọn)'],
    'specField.placeholder.helpText': ['Describe how to fill this field', 'Mô tả cách điền trường này'],
};

// =========================================
// STOCK DOCUMENT LINES
// =========================================
const stockDocKeys = {
    'stockDoc.addLine': ['+ Add line', '+ Thêm dòng'],
    'stockDoc.header.item': ['Item / Material', 'Vật tư / Hàng hóa'],
    'stockDoc.header.unit': ['Unit', 'ĐVT'],
    'stockDoc.header.direction': ['Direction', 'Hướng'],
    'stockDoc.header.quantity': ['Quantity', 'Số lượng'],
    'stockDoc.header.unitPrice': ['Unit Price (₫)', 'Đơn giá (₫)'],
    'stockDoc.header.amount': ['Amount (₫)', 'Thành tiền (₫)'],
    'stockDoc.emptyState': ['No items yet.', 'Chưa có dòng hàng hóa nào.'],
    'stockDoc.emptyHint': ['Click "+ Add line" to start.', 'Nhấn "+ Thêm dòng" để bắt đầu.'],
    'stockDoc.selectPart': ['-- Select item --', '-- Chọn vật tư --'],
    'stockDoc.available': ['Available:', 'Khả dụng:'],
    'stockDoc.overStock': ['Exceeds stock!', 'Vượt tồn kho!'],
    'stockDoc.checking': ['Checking...', 'Đang kiểm tra...'],
    'stockDoc.hideSpecs': ['▲ Hide specs', '▲ Ẩn thông số'],
    'stockDoc.showSpecs': ['▼ Specifications', '▼ Thông số kỹ thuật'],
    'stockDoc.adjustPlus': ['+ Increase', '+ Tăng'],
    'stockDoc.adjustMinus': ['− Decrease', '− Giảm'],
    'stockDoc.specFromCatalog': ['Specifications (from catalog)', 'Thông số kỹ thuật (từ danh mục)'],
    'stockDoc.total': ['Total ({count} lines):', 'Tổng cộng ({count} dòng):'],
};

// =========================================
// WF REQUEST LINE EDITOR
// =========================================
const wfRequestKeys = {
    'wfRequest.service': ['(service)', '(dịch vụ)'],
    'wfRequest.addLine': ['+ Add line', '+ Thêm dòng'],
    'wfRequest.header.type': ['Type', 'Loại'],
    'wfRequest.header.item': ['Material / Device / Service', 'Vật tư / Thiết bị / Dịch vụ'],
    'wfRequest.header.quantity': ['Quantity', 'Số lượng'],
    'wfRequest.header.note': ['Note', 'Ghi chú'],
    'wfRequest.emptyState': ['No lines yet.', 'Chưa có dòng nào.'],
    'wfRequest.emptyHint': ['Click "+ Add line" to add material, device or service.', 'Nhấn "+ Thêm dòng" để thêm vật tư, thiết bị hoặc dịch vụ.'],
    'wfRequest.part': ['Material', 'Vật tư'],
    'wfRequest.asset': ['Device', 'Thiết bị'],
    'wfRequest.serviceType': ['Service', 'Dịch vụ'],
    'wfRequest.selectPart': ['-- Select material --', '-- Chọn vật tư --'],
    'wfRequest.selectAsset': ['-- Select device --', '-- Chọn thiết bị --'],
    'wfRequest.serviceNote': ['Describe in note column →', 'Mô tả trong cột ghi chú →'],
};

// =========================================
// SETUP WIZARD (routes/setup/+page.svelte)
// =========================================
const setupWizardKeys = {
    'setup.wizard.pageTitle': ['System Setup - QuanLyThietBi', 'Khởi tạo hệ thống - QuanLyThietBi'],
    'setup.wizard.title': ['First-time system setup', 'Khởi tạo hệ thống lần đầu'],
    'setup.wizard.subtitleWizard': ['Follow the steps below to complete the initial configuration.', 'Làm theo các bước bên dưới để hoàn tất cài đặt.'],
    'setup.wizard.subtitleFallback': ['Setup wizard is not enabled on the backend. You can still setup manually.', 'Setup wizard chưa được bật trên backend. Bạn vẫn có thể setup thủ công theo hướng dẫn.'],
    'setup.wizard.checking': ['Checking system status...', 'Đang kiểm tra trạng thái hệ thống...'],
    'setup.wizard.alreadyInitialized': ['System already initialized. Redirecting to login...', 'Hệ thống đã được khởi tạo. Đang chuyển đến trang đăng nhập...'],
    'setup.wizard.step1Title': ['Step 1 — Check Services', 'Bước 1 — Kiểm tra dịch vụ'],
    'setup.wizard.step2Title': ['Step 2 — Migration & Seed Data', 'Bước 2 — Migration & Seed dữ liệu'],
    'setup.wizard.step3Title': ['Step 3 — Create First Admin Account', 'Bước 3 — Tạo tài khoản Admin đầu tiên'],
    'setup.wizard.finalizeTitle': ['Step 4 — Complete', 'Bước 4 — Hoàn tất'],
    'setup.wizard.runMigration': ['Run Migration', 'Chạy Migration'],
    'setup.wizard.runSeed': ['Run Seed Sample Data', 'Chạy Seed dữ liệu mẫu'],
    'setup.wizard.recheck': ['Recheck', 'Kiểm tra lại'],
    'setup.wizard.viewLogs': ['View Logs', 'Xem log'],
    'setup.wizard.hideLogs': ['Hide Logs', 'Ẩn log'],
    'setup.wizard.createAdmin': ['Create Admin', 'Tạo Admin'],
    'setup.wizard.finalize': ['Finalize Setup', 'Hoàn tất khởi tạo'],
    'setup.wizard.loginRedirect': ['Go to Login', 'Chuyển đến đăng nhập'],
    'setup.wizard.fullName': ['Full Name', 'Họ và tên'],
    'setup.wizard.password': ['Password', 'Mật khẩu'],
    'setup.wizard.confirmPassword': ['Confirm Password', 'Xác nhận mật khẩu'],
    'setup.wizard.locale': ['Language', 'Ngôn ngữ'],
    'setup.wizard.commandDocker': ['Docker compose start command', 'Lệnh khởi động docker compose'],
    'setup.wizard.commandManual': ['Manual migrate + seed commands', 'Lệnh migrate + seed thủ công'],
    'setup.wizard.linkLogin': ['Login Page', 'Trang đăng nhập'],
    'setup.wizard.copy': ['Copy', 'Sao chép'],
    'setup.wizard.copied': ['Copied', 'Đã sao chép'],
    'setup.wizard.successFinalize': ['System setup complete! Redirecting...', 'Khởi tạo hệ thống thành công! Đang chuyển hướng...'],
    'setup.wizard.refreshing': ['Reloading status...', 'Đang tải lại trạng thái...'],
    'setup.wizard.wizardUnavailableTitle': ['Setup wizard unavailable', 'Setup wizard không khả dụng'],
    'setup.wizard.wizardUnavailableHint': ['You can use the commands below to setup manually.', 'Bạn có thể dùng các lệnh bên dưới để setup thủ công.'],
    'setup.wizard.adminExistsHint': ['An active admin account already exists in the system.', 'Đã có tài khoản admin hoạt động trong hệ thống.'],
    'setup.wizard.credentialsReady': ['Admin account created successfully', 'Tài khoản admin đã tạo thành công'],
    'setup.wizard.stepServices': ['Services', 'Dịch vụ'],
    'setup.wizard.stepFinalize': ['Complete', 'Hoàn tất'],
    'setup.wizard.username': ['Username (optional)', 'Username (tùy chọn)'],
};

// =========================================
// ASSETS (extra keys for AddAssetModal)
// =========================================
const assetsKeys = {
    'assets.specifications': ['Specifications', 'Thông số kỹ thuật'],
    'assets.noSpecsDefined': ['No specifications defined', 'Chưa có thông số kỹ thuật'],
};

// =========================================
// SETUP ADMIN SETUP (extra)
// =========================================
const setupAdminKeys = {
    'setup.adminSetup.namePlaceholder': ['John Admin', 'Nguyễn Văn Admin'],
};

// =========================================
// DATABASE SETUP (extra)
// =========================================
const setupDatabaseKeys = {
    'setup.database.checkingBtn': ['Checking...', 'Đang kiểm tra...'],
    'setup.database.retryBtn': ['Retry', 'Thử lại'],
};

// =========================================
// APPLY ALL KEYS
// =========================================
const allKeyGroups = [
    commonKeys,
    reportsKeys,
    catalogsKeys,
    warehouseKeys,
    inventoryKeys,
    requestsKeys,
    adminKeys,
    cmdbKeys,
    specKeys,
    stockDocKeys,
    wfRequestKeys,
    setupWizardKeys,
    assetsKeys,
    setupAdminKeys,
    setupDatabaseKeys,
];

let added = 0;
for (const group of allKeyGroups) {
    for (const [key, [enVal, viVal]] of Object.entries(group)) {
        const prevEn = JSON.stringify(en);
        set(en, key, enVal);
        if (JSON.stringify(en) !== prevEn) added++;
        set(vi, key, viVal);
    }
}

writeJson('en.json', en);
writeJson('vi.json', vi);

// Count leaf keys
function countLeaves(obj) {
    let n = 0;
    for (const v of Object.values(obj)) {
        if (typeof v === 'object' && v !== null) n += countLeaves(v);
        else n++;
    }
    return n;
}

const enCount = countLeaves(en);
const viCount = countLeaves(vi);

console.log(`Added ${added} new keys`);
console.log(`EN: ${enCount} keys | VI: ${viCount} keys | Parity: ${enCount === viCount ? 'YES' : 'NO'}`);
