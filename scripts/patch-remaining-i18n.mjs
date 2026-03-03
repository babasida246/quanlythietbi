import fs from 'fs';

const enP = 'apps/web-ui/src/lib/i18n/locales/en.json';
const viP = 'apps/web-ui/src/lib/i18n/locales/vi.json';

function readJson(p) {
    let raw = fs.readFileSync(p, 'utf8');
    while (raw.endsWith('\\n')) raw = raw.slice(0, -2);
    raw = raw.trim();
    return JSON.parse(raw);
}

const en = readJson(enP);
const vi = readJson(viP);

function set(obj, path, val) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] === 'string') cur[parts[i]] = {};
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (!cur[parts[parts.length - 1]]) cur[parts[parts.length - 1]] = val;
}

const keys = {
    // === crud ===
    'crud.createNew': ['Create', 'Tạo mới'],
    'crud.update': ['Update', 'Cập nhật'],
    'crud.cancel': ['Cancel', 'Hủy'],
    'crud.operationFailed': ['Operation failed', 'Thao tác thất bại'],
    'crud.confirmDelete': ['Confirm delete', 'Xác nhận xóa'],
    'crud.deletePrompt': ['Are you sure you want to delete this item? This action cannot be undone.', 'Bạn có chắc muốn xóa mục này? Hành động này không thể hoàn tác.'],
    'crud.delete': ['Delete', 'Xóa'],

    // === formActions ===
    'formActions.save': ['Save', 'Lưu'],
    'formActions.cancel': ['Cancel', 'Hủy'],
    'formActions.saving': ['Saving...', 'Đang lưu...'],

    // === confirmDialog ===
    'confirmDialog.confirm': ['Confirm', 'Xác nhận'],
    'confirmDialog.cancel': ['Cancel', 'Hủy'],
    'confirmDialog.failed': ['Operation failed', 'Thao tác thất bại'],
    'confirmDialog.processing': ['Processing...', 'Đang xử lý...'],

    // === notifications ===
    'notifications.justNow': ['Just now', 'Vừa xong'],
    'notifications.minutesAgo': ['{count} min ago', '{count} phút trước'],
    'notifications.hoursAgo': ['{count} hr ago', '{count} giờ trước'],
    'notifications.title': ['Notifications', 'Thông báo'],
    'notifications.markAllRead': ['Mark all read', 'Đọc tất cả'],
    'notifications.clearAll': ['Clear all', 'Xóa tất cả'],
    'notifications.empty': ['No notifications', 'Không có thông báo'],

    // === reports ===
    'reports.noData': ['No data', 'Không có dữ liệu'],
    'reports.unknownError': ['Unknown error', 'Lỗi không xác định'],
    'reports.results': ['{count} results', '{count} kết quả'],
    'reports.exportCsv': ['Export CSV', 'Export CSV'],
    'reports.showAll': ['Show all', 'Hiển thị tất cả'],

    // === specField ===
    'specField.label': ['Label', 'Nhãn'],
    'specField.key': ['Key', 'Key'],
    'specField.dataType': ['Data type', 'Kiểu dữ liệu'],
    'specField.unit': ['Unit', 'Đơn vị'],
    'specField.displayOrder': ['Display order', 'Thứ tự hiển thị'],
    'specField.required': ['Required', 'Bắt buộc'],
    'specField.readOnly': ['Read only', 'Chỉ đọc'],
    'specField.searchable': ['Searchable', 'Có thể tìm kiếm'],
    'specField.filterable': ['Filterable', 'Có thể lọc'],
    'specField.enumValues': ['Enum values', 'Danh sách giá trị Enum'],
    'specField.commaSeparated': ['Comma separated', 'Phân cách bằng dấu phẩy'],
    'specField.min': ['Min', 'Min'],
    'specField.max': ['Max', 'Max'],
    'specField.step': ['Step', 'Bước'],
    'specField.precision': ['Precision', 'Độ chính xác'],
    'specField.minLength': ['Min length', 'Độ dài tối thiểu'],
    'specField.maxLength': ['Max length', 'Độ dài tối đa'],
    'specField.normalize': ['Normalize', 'Chuẩn hóa'],
    'specField.uppercase': ['Uppercase', 'Viết hoa'],
    'specField.lowercase': ['Lowercase', 'Viết thường'],
    'specField.defaultValue': ['Default value', 'Giá trị mặc định'],
    'specField.hint': ['Hint', 'Hướng dẫn'],
    'specField.computeExpression': ['Compute expression', 'Biểu thức tính toán'],
    'specField.autoExtractHint': ['Auto-extract hint', 'Gợi ý tự động trích xuất'],

    // === categorySpec ===
    'categorySpec.title': ['Manage Spec Fields', 'Quản lý trường Spec'],
    'categorySpec.readOnlyNote': ['This version is read-only', 'Phiên bản này chỉ đọc'],
    'categorySpec.close': ['Close', 'Đóng'],
    'categorySpec.loadVersionsFailed': ['Failed to load spec versions', 'Tải phiên bản thất bại'],
    'categorySpec.loadFieldsFailed': ['Failed to load spec fields', 'Tải trường spec thất bại'],
    'categorySpec.createDraftFailed': ['Failed to create draft', 'Tạo bản nháp thất bại'],
    'categorySpec.publishFailed': ['Failed to publish version', 'Xuất bản thất bại'],

    // === inventoryLabel ===
    'inventoryLabel.title': ['Print Inventory Labels', 'In tem kiểm kê'],
    'inventoryLabel.assetsSelected': ['{count} assets selected', '{count} tài sản được chọn'],
    'inventoryLabel.print': ['Print labels', 'In tem'],
    'inventoryLabel.close': ['Close', 'Đóng'],
    'inventoryLabel.code': ['Code:', 'Mã:'],
    'inventoryLabel.location': ['Location:', 'Vị trí:'],
    'inventoryLabel.status': ['Status:', 'TT:'],
    'inventoryLabel.statusInStock': ['In stock', 'Trong kho'],
    'inventoryLabel.statusInUse': ['In use', 'Đang dùng'],
    'inventoryLabel.statusRepairing': ['Repairing', 'Đang sửa'],
    'inventoryLabel.statusRetired': ['Retired', 'Đã nghỉ hưu'],
    'inventoryLabel.statusDisposed': ['Disposed', 'Đã thanh lý'],
    'inventoryLabel.statusLost': ['Lost', 'Đã mất'],

    // === cmdb page ===
    'cmdb.ciType': ['CI Type', 'Loại CI'],
    'cmdb.relationship': ['Relationship', 'Quan hệ'],
    'cmdb.service': ['Service', 'Dịch vụ'],
    'cmdb.diagram': ['Diagram', 'Sơ đồ'],
    'cmdb.ciNameRequired': ['CI type name is required', 'Tên loại CI là bắt buộc'],
    'cmdb.createSuccess': ['Created successfully', 'Tạo mới thành công'],
    'cmdb.updateSuccess': ['Updated successfully', 'Cập nhật thành công'],
    'cmdb.deleteSuccess': ['Deleted successfully', 'Xóa thành công'],
    'cmdb.changes': ['Changes', 'Thay đổi CI'],
    'cmdb.report': ['Report', 'Báo cáo'],
    'cmdb.importRelation': ['Import relationships', 'Import quan hệ'],
    'cmdb.noData': ['No data', 'Không có dữ liệu'],
    'cmdb.edit': ['Edit', 'Sửa'],
    'cmdb.environment': ['Environment', 'Môi trường'],
    'cmdb.criticality': ['Criticality', 'Mức độ quan trọng'],
    'cmdb.low': ['Low', 'Thấp'],
    'cmdb.medium': ['Medium', 'Trung bình'],
    'cmdb.high': ['High', 'Cao'],

    // === assets page ===
    'assets.title': ['Assets', 'Tài sản'],
    'assets.printLabel': ['Print labels', 'In tem'],
    'assets.exportCsv': ['Export CSV', 'Xuất CSV'],
    'assets.importCsv': ['Import CSV', 'Nhập CSV'],
    'assets.createNew': ['Create new', 'Tạo mới'],
    'assets.reload': ['Reload', 'Tải lại'],
    'assets.search': ['Search', 'Tìm kiếm'],
    'assets.status': ['Status', 'Trạng thái'],
    'assets.category': ['Category', 'Danh mục'],
    'assets.locationFilter': ['Location', 'Vị trí'],
    'assets.supplier': ['Supplier', 'Nhà cung cấp'],
    'assets.warranty': ['Warranty', 'Bảo hành'],
    'assets.clearFilters': ['Clear filters', 'Xóa bộ lọc'],
    'assets.noAssets': ['No assets found', 'Không có tài sản nào'],
    'assets.assetName': ['Asset name', 'Tên tài sản'],
    'assets.assetCode': ['Asset code', 'Mã tài sản'],
    'assets.template': ['Template', 'Mẫu mã'],
    'assets.statusLabels.inStock': ['In stock', 'Trong kho'],
    'assets.statusLabels.inUse': ['In use', 'Đang dùng'],
    'assets.statusLabels.repairing': ['Repairing', 'Đang sửa'],
    'assets.statusLabels.retired': ['Retired', 'Đã nghỉ hưu'],
    'assets.statusLabels.disposed': ['Disposed', 'Đã thanh lý'],
    'assets.statusLabels.lost': ['Lost', 'Đã mất'],

    // === maintenance page ===
    'maintenance.title': ['Maintenance', 'Bảo trì'],
    'maintenance.titleRequired': ['Title is required', 'Tiêu đề là bắt buộc'],
    'maintenance.loadFailed': ['Failed to load maintenance list', 'Không thể tải danh sách bảo trì'],
    'maintenance.createSuccess': ['Maintenance ticket created', 'Tạo ticket bảo trì thành công'],
    'maintenance.noTickets': ['No maintenance tickets', 'Không có ticket bảo trì'],
    'maintenance.createTicket': ['Create ticket', 'Tạo ticket'],
    'maintenance.ticketTitle': ['Title', 'Tiêu đề'],
    'maintenance.asset': ['Asset', 'Tài sản'],
    'maintenance.priority': ['Priority', 'Mức độ'],
    'maintenance.statusCol': ['Status', 'Trạng thái'],
    'maintenance.priorityLow': ['Low', 'Thấp'],
    'maintenance.priorityMedium': ['Medium', 'Trung bình'],
    'maintenance.priorityHigh': ['High', 'Cao'],
    'maintenance.priorityCritical': ['Critical', 'Nghiêm trọng'],
    'maintenance.statusOpen': ['Open', 'Mở'],
    'maintenance.statusInProgress': ['In Progress', 'Đang xử lý'],
    'maintenance.statusClosed': ['Closed', 'Đóng'],
    'maintenance.statusCancelled': ['Cancelled', 'Hủy'],

    // === warehouse page ===
    'warehouse.title': ['Warehouse', 'Kho hàng'],
    'warehouse.parts': ['Parts', 'Linh kiện'],
    'warehouse.documents': ['Documents', 'Chứng từ'],
    'warehouse.repairs': ['Repairs', 'Sửa chữa'],
    'warehouse.belowMinimum': ['Below minimum', 'Dưới mức tối thiểu'],
    'warehouse.overview': ['Warehouse overview', 'Tổng quan kho hàng'],
    'warehouse.lowStockAlert': ['Low stock alerts', 'Cảnh báo tồn kho thấp'],
    'warehouse.inStock': ['In stock', 'Tồn kho'],
    'warehouse.minLevel': ['Min level', 'Mức tối thiểu'],
    'warehouse.needed': ['Needed', 'Cần nhập'],
    'warehouse.viewAllAlerts': ['View all alerts', 'Xem tất cả cảnh báo'],

    // === inventory page ===
    'inventory.title': ['Inventory Check', 'Kiểm kê thiết bị'],
    'inventory.subtitle': ['Manage inventory check sessions', 'Quản lý các phiên kiểm kê'],
    'inventory.createSession': ['Create session', 'Tạo phiên kiểm kê'],
    'inventory.sessionName': ['Session name', 'Tên phiên kiểm kê'],
    'inventory.areaLocation': ['Area / Location', 'Khu vực / Vị trí'],
    'inventory.allAreas': ['All areas', 'Tất cả khu vực'],
    'inventory.creating': ['Creating...', 'Đang tạo...'],
    'inventory.create': ['Create session', 'Tạo phiên'],
    'inventory.cancel': ['Cancel', 'Hủy'],
    'inventory.noSessions': ['No inventory sessions yet', 'Chưa có phiên kiểm kê nào'],
    'inventory.createFirst': ['Create first session', 'Tạo phiên đầu tiên'],
    'inventory.allAreasLabel': ['All areas', 'Toàn bộ khu vực'],
    'inventory.createdAt': ['Created at', 'Tạo lúc'],
    'inventory.startedAt': ['Started:', 'Bắt đầu:'],
    'inventory.closedAt': ['Closed at:', 'Đóng lúc:'],
    'inventory.statusDraft': ['Draft', 'Nháp'],
    'inventory.statusInProgress': ['In progress', 'Đang kiểm kê'],
    'inventory.statusClosed': ['Closed', 'Đã đóng'],
    'inventory.statusCancelled': ['Cancelled', 'Đã hủy'],

    // === inbox page ===
    'inbox.title': ['Approval Inbox', 'Hộp phê duyệt'],
    'inbox.subtitle': ['Pending requests', 'Các yêu cầu đang chờ'],
    'inbox.refresh': ['Refresh', 'Làm mới'],
    'inbox.pendingApproval': ['Pending', 'Chờ duyệt'],
    'inbox.urgent': ['Urgent', 'Khẩn cấp'],
    'inbox.overdue': ['Overdue', 'Quá hạn'],
    'inbox.unassigned': ['Unassigned', 'Chưa nhận'],
    'inbox.request': ['Request', 'Yêu cầu'],
    'inbox.type': ['Type', 'Loại'],
    'inbox.priorityCol': ['Priority', 'Ưu tiên'],
    'inbox.step': ['Step', 'Bước'],
    'inbox.dateSent': ['Date sent', 'Ngày gửi'],
    'inbox.details': ['Details', 'Chi tiết'],
    'inbox.noAssignee': ['No assignee', 'Chưa có người nhận'],
    'inbox.deadline': ['Deadline:', 'Hạn:'],
    'inbox.total': ['Total:', 'Tổng:'],
    'inbox.page': ['Page', 'Trang'],
    'inbox.prev': ['Prev', 'Trước'],
    'inbox.next': ['Next', 'Sau'],
    'inbox.approve': ['Approve', 'Phê duyệt'],
    'inbox.reject': ['Reject', 'Từ chối'],
    'inbox.processing': ['Processing...', 'Đang xử lý...'],
    'inbox.approvedSuccess': ['Approved successfully', 'Phê duyệt thành công'],
    'inbox.rejectedSuccess': ['Rejected successfully', 'Từ chối thành công'],
};

let count = 0;
for (const [path, [enV, viV]] of Object.entries(keys)) {
    set(en, path, enV);
    set(vi, path, viV);
    count++;
}

fs.writeFileSync(enP, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(viP, JSON.stringify(vi, null, 2) + '\n');
console.log(`✅ Added ${count} remaining i18n keys`);
