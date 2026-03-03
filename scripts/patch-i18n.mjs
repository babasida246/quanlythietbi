/**
 * Patch i18n: add all missing keys to en.json and vi.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../apps/web-ui/src/lib/i18n/locales');

const enPath = resolve(localesDir, 'en.json');
const viPath = resolve(localesDir, 'vi.json');

const en = JSON.parse(readFileSync(enPath, 'utf-8'));
const vi = JSON.parse(readFileSync(viPath, 'utf-8'));

function setDeep(obj, path, val) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (cur[parts[parts.length - 1]] === undefined) {
        cur[parts[parts.length - 1]] = val;
    }
}

// ─── common additions ───
const commonNew = {
    'common.retry': ['Retry', 'Thử lại'],
    'common.confirmDeleteDesc': ['Are you sure you want to delete {name}?', 'Bạn có chắc muốn xóa {name}?'],
    'common.created': ['Created', 'Đã tạo'],
    'common.updated': ['Updated', 'Đã cập nhật'],
    'common.processing': ['Processing...', 'Đang xử lý...'],
    'common.selectAll': ['Select all', 'Chọn tất cả'],
    'common.selectedCount': ['{count} selected', 'Đã chọn {count}'],
    'common.saveAll': ['Save all', 'Lưu tất cả'],
    'common.none': ['None', 'Không'],
    'common.unknown': ['Unknown', 'Không xác định'],
    'common.comingSoon': ['Coming soon', 'Sắp ra mắt'],
};

// ─── cmdb.topology additions ───
const cmdbTopology = {
    'cmdb.topology.title': ['Topology', 'Sơ đồ'],
    'cmdb.topology.loading': ['Loading topology…', 'Đang tải sơ đồ…'],
    'cmdb.topology.failedToLoad': ['Failed to load graph', 'Không thể tải sơ đồ'],
    'cmdb.topology.failedDependency': ['Failed to load dependency path', 'Không thể tải đường phụ thuộc'],
    'cmdb.topology.failedImpact': ['Failed to load impact analysis', 'Không thể tải phân tích ảnh hưởng'],
    'cmdb.topology.noMatchingCis': ['No CIs match the current filters.', 'Không có CI nào khớp bộ lọc.'],
    'cmdb.topology.resetFilters': ['Reset filters', 'Đặt lại bộ lọc'],
    'cmdb.topology.cisCount': ['{count} CIs', '{count} CI'],
    'cmdb.topology.relCount': ['{count} Relationships', '{count} quan hệ'],
    'cmdb.topology.perfMode': ['Perf mode', 'Chế độ hiệu suất'],
    'cmdb.topology.searchPlaceholder': ['Search… (/)', 'Tìm kiếm… (/)'],
    'cmdb.topology.labels': ['Labels', 'Nhãn'],
    'cmdb.topology.legend': ['Legend', 'Chú giải'],
    'cmdb.topology.impactZone': ['Impact zone', 'Vùng ảnh hưởng'],
    'cmdb.topology.dependencyPath': ['Dependency path', 'Đường phụ thuộc'],
    'cmdb.topology.highlighted': ['highlighted', 'được đánh dấu'],
    'cmdb.topology.filters': ['Filters', 'Bộ lọc'],
    'cmdb.topology.hideFilters': ['Hide filters', 'Ẩn bộ lọc'],
    'cmdb.topology.showFilters': ['Show filters', 'Hiện bộ lọc'],
    'cmdb.topology.resetCount': ['Reset ({count})', 'Đặt lại ({count})'],
    'cmdb.topology.ciType': ['CI Type', 'Loại CI'],
    'cmdb.topology.options': ['Options', 'Tùy chọn'],
    'cmdb.topology.hideIsolated': ['Hide isolated nodes', 'Ẩn nút đơn lẻ'],
    'cmdb.topology.depthLimit': ['Depth limit', 'Giới hạn độ sâu'],
    'cmdb.topology.focus': ['Focus', 'Tập trung'],
    'cmdb.topology.pin': ['Pin', 'Ghim'],
    'cmdb.topology.unpin': ['Unpin', 'Bỏ ghim'],
    'cmdb.topology.hop1': ['+1 hop', '+1 bước'],
    'cmdb.topology.hop2': ['+2 hops', '+2 bước'],
    'cmdb.topology.upstream': ['Upstream', 'Ngược dòng'],
    'cmdb.topology.downstream': ['Downstream', 'Xuôi dòng'],
    'cmdb.topology.impactAnalysis': ['Impact Analysis', 'Phân tích ảnh hưởng'],
    'cmdb.topology.copyId': ['Copy ID', 'Sao chép ID'],
    'cmdb.topology.openDetail': ['Open Detail', 'Mở chi tiết'],
    'cmdb.topology.ctxFocus': ['Focus', 'Tập trung'],
    'cmdb.topology.ctxExpand1': ['Expand +1 hop', 'Mở rộng +1 bước'],
    'cmdb.topology.ctxExpand2': ['Expand +2 hops', 'Mở rộng +2 bước'],
    'cmdb.topology.ctxPin': ['Pin / Unpin', 'Ghim / Bỏ ghim'],
    'cmdb.topology.ctxUpstream': ['Upstream path', 'Đường ngược dòng'],
    'cmdb.topology.ctxDownstream': ['Downstream path', 'Đường xuôi dòng'],
    'cmdb.topology.ctxImpact': ['Impact analysis', 'Phân tích ảnh hưởng'],
    'cmdb.topology.ctxOpenDetail': ['Open detail', 'Mở chi tiết'],
    'cmdb.topology.tabOverview': ['Overview', 'Tổng quan'],
    'cmdb.topology.tabRelations': ['Relations', 'Quan hệ'],
    'cmdb.topology.tabHistory': ['History', 'Lịch sử'],
    'cmdb.topology.since': ['Since', 'Từ ngày'],
    'cmdb.topology.selectEdgeHint': ['Select an edge to view relationship details.', 'Chọn một cạnh để xem chi tiết quan hệ.'],
    'cmdb.topology.historyComingSoon': ['Change history coming soon.', 'Lịch sử thay đổi sắp ra mắt.'],
    'cmdb.topology.nodeType': ['Node type', 'Loại nút'],
    'cmdb.topology.edges': ['Edges', 'Cạnh'],
    'cmdb.topology.directedRel': ['Directed relationship', 'Quan hệ có hướng'],
    'cmdb.topology.highlightedPath': ['Highlighted path', 'Đường đánh dấu'],
    'cmdb.topology.dimmed': ['Dimmed', 'Mờ'],
    'cmdb.topology.layoutCose': ['Force-directed', 'Lực hướng'],
    'cmdb.topology.layoutBreadthfirst': ['Hierarchical', 'Phân cấp'],
    'cmdb.topology.layoutCircle': ['Circle', 'Vòng tròn'],
    'cmdb.topology.layoutGrid': ['Grid', 'Lưới'],
    // Legend status labels
    'cmdb.topology.statusActive': ['Active / Online', 'Hoạt động / Online'],
    'cmdb.topology.statusWarning': ['Warning', 'Cảnh báo'],
    'cmdb.topology.statusCritical': ['Critical / Down', 'Nghiêm trọng / Down'],
    'cmdb.topology.statusInactive': ['Inactive', 'Không hoạt động'],
    // Legend type labels
    'cmdb.topology.typeServer': ['Server / VM', 'Máy chủ / VM'],
    'cmdb.topology.typeDb': ['Database', 'Cơ sở dữ liệu'],
    'cmdb.topology.typeNetwork': ['Network device', 'Thiết bị mạng'],
    'cmdb.topology.typeStorage': ['Storage', 'Lưu trữ'],
    'cmdb.topology.typeApp': ['Application', 'Ứng dụng'],
    'cmdb.topology.typeOther': ['Other', 'Khác'],
};

// ─── cmdb page additions ───
const cmdbPage = {
    'cmdb.tabs.ciTypes': ['CI Types', 'Loại CI'],
    'cmdb.tabs.ci': ['CIs', 'CI'],
    'cmdb.tabs.rel': ['Relationships', 'Quan hệ'],
    'cmdb.tabs.svc': ['Services', 'Dịch vụ'],
    'cmdb.tabs.topology': ['Topology', 'Sơ đồ'],
    'cmdb.changes': ['CI Changes', 'Thay đổi CI'],
    'cmdb.importRel': ['Import Relationships', 'Import quan hệ'],
    'cmdb.errors.loadFailed': ['Failed to load CMDB data', 'Không thể tải dữ liệu CMDB'],
    'cmdb.errors.typeNameRequired': ['CI type name is required', 'Tên loại CI là bắt buộc'],
    'cmdb.errors.codeRequired': ['Code is required', 'Code là bắt buộc'],
    'cmdb.errors.ciNameRequired': ['CI name is required', 'Tên CI là bắt buộc'],
    'cmdb.errors.ciTypeRequired': ['CI type is required', 'Loại CI là bắt buộc'],
    'cmdb.errors.fromRequired': ['Source CI is required', 'CI nguồn là bắt buộc'],
    'cmdb.errors.toRequired': ['Target CI is required', 'CI đích là bắt buộc'],
    'cmdb.errors.relTypeRequired': ['Relationship type is required', 'Loại quan hệ là bắt buộc'],
    'cmdb.selectType': ['Select CI type', 'Chọn loại CI'],
    'cmdb.criticality': ['Criticality', 'Mức độ quan trọng'],
    'cmdb.tags': ['Tags', 'Tags'],
    'cmdb.low': ['Low', 'Thấp'],
    'cmdb.medium': ['Medium', 'Trung bình'],
    'cmdb.high': ['High', 'Cao'],
    'cmdb.sourceCi': ['Source CI', 'CI nguồn'],
    'cmdb.targetCi': ['Target CI', 'CI đích'],
    'cmdb.relType': ['Relationship type', 'Loại quan hệ'],
    'cmdb.createTitle': ['Create {tab}', 'Tạo mới {tab}'],
    'cmdb.editTitle': ['Edit {tab}', 'Chỉnh sửa {tab}'],
};

// ─── setup ───
const setup = {
    'setup.pageTitle': ['First Time Setup', 'Thiết lập lần đầu'],
    'setup.title': ['First Time Setup', 'Thiết lập lần đầu'],
    'setup.appName': ['NetOpsAI Gateway', 'NetOpsAI Gateway'],
    'setup.checkingStatus': ['Checking system status...', 'Đang kiểm tra trạng thái hệ thống...'],
    'setup.pleaseWait': ['Please wait a moment', 'Vui lòng chờ trong giây lát'],
    'setup.connectionError': ['Connection error', 'Lỗi kết nối'],
    'setup.version': ['Version:', 'Phiên bản:'],
    'setup.environment': ['Environment:', 'Môi trường:'],
    'setup.database': ['Database:', 'Database:'],
    'setup.stepN': ['Step {n}: {title}', 'Bước {n}: {title}'],
    'setup.stepProgress': ['Step {current} / {total}', 'Bước {current} / {total}'],
    'setup.errors.loadFailed': ['Failed to load setup status', 'Không thể tải trạng thái thiết lập'],
    'setup.steps.database': ['Database', 'Cơ sở dữ liệu'],
    'setup.steps.databaseDesc': ['Check and initialize database', 'Kiểm tra và khởi tạo database'],
    'setup.steps.admin': ['Admin Account', 'Tài khoản Admin'],
    'setup.steps.adminDesc': ['Create the first admin account', 'Tạo tài khoản quản trị viên đầu tiên'],
    'setup.steps.system': ['System Config', 'Cấu hình hệ thống'],
    'setup.steps.systemDesc': ['Configure company and system settings', 'Thiết lập thông tin công ty và hệ thống'],
    'setup.steps.aiProviders': ['AI Providers', 'Nhà cung cấp AI'],
    'setup.steps.aiProvidersDesc': ['Configure AI providers', 'Cấu hình các nhà cung cấp AI'],
    'setup.steps.seedData': ['Sample Data', 'Dữ liệu mẫu'],
    'setup.steps.seedDataDesc': ['Load initial sample data', 'Tải dữ liệu mẫu ban đầu'],
    'setup.steps.complete': ['Complete', 'Hoàn thành'],
    'setup.steps.completeDesc': ['Finish the setup process', 'Kết thúc quá trình thiết lập'],
    'setup.seed.title': ['Load Sample Data', 'Tải dữ liệu mẫu'],
    'setup.seed.subtitle': ['Load demo data to explore the system quickly.', 'Tải dữ liệu demo để trải nghiệm hệ thống nhanh chóng.'],
    'setup.seed.includes': ['Demo data includes:', 'Dữ liệu demo bao gồm:'],
    'setup.seed.items.users': ['10 users with different roles', '10 người dùng với các vai trò khác nhau'],
    'setup.seed.items.locations': ['Location structure (buildings, floors, rooms)', 'Cấu trúc vị trí (tòa nhà, tầng, phòng)'],
    'setup.seed.items.assets': ['Network devices, servers, workstations', 'Thiết bị mạng, máy chủ, trạm làm việc'],
    'setup.seed.items.warehouses': ['Warehouses and spare parts', 'Kho hàng và linh kiện dự phòng'],
    'setup.seed.items.tickets': ['Sample maintenance tickets', 'Ticket bảo trì mẫu'],
    'setup.seed.items.cmdb': ['CMDB with services and relationships', 'CMDB với dịch vụ và quan hệ'],
    'setup.seed.benefits.quickStart': ['Quick start — explore workflows immediately', 'Khởi động nhanh — khám phá workflow ngay'],
    'setup.seed.benefits.understand': ['Understand the system with real examples', 'Hiểu workflow qua ví dụ thực tế'],
    'setup.seed.benefits.safe': ['Safe to delete or edit later', 'An toàn — xóa hoặc chỉnh sửa sau'],
    'setup.seed.warning': ['You can delete or edit this data later. This is safe for evaluation.', 'Bạn có thể xóa hoặc chỉnh sửa sau này. Dữ liệu mẫu an toàn để trải nghiệm.'],
    'setup.seed.loadButton': ['Load sample data', 'Tải dữ liệu mẫu'],
    'setup.seed.skip': ['Skip', 'Bỏ qua'],
    'setup.seed.loading': ['Loading sample data...', 'Đang tải dữ liệu mẫu...'],
};

// ─── adminRbac old panel additions ───
const adminRbacOld = {
    'adminRbac.panelTitle': ['Role-based Access Control (RBAC)', 'Quản lý phân quyền (RBAC)'],
    'adminRbac.panelSubtitle': ['{roleCount} roles · {permCount} permissions', '{roleCount} vai trò · {permCount} quyền hạn'],
    'adminRbac.unsavedRoles': ['{count} unsaved roles', '{count} vai trò chưa lưu'],
    'adminRbac.loading': ['Loading permission tree...', 'Đang tải cây phân quyền...'],
    'adminRbac.roles': ['Roles', 'Vai trò'],
    'adminRbac.userCount': ['{count} users', '{count} người'],
    'adminRbac.systemRoles': ['System roles', 'Vai trò hệ thống'],
    'adminRbac.unsaved': ['Unsaved', 'Chưa lưu'],
    'adminRbac.synced': ['Synced', 'Đã đồng bộ'],
    'adminRbac.granted': ['Granted:', 'Đã cấp:'],
    'adminRbac.notGranted': ['Not granted:', 'Chưa cấp:'],
    'adminRbac.pendingChanges': ['{count} unsaved changes', '{count} thay đổi chưa lưu'],
    'adminRbac.saveRole': ['Save role', 'Lưu vai trò'],
    'adminRbac.revert': ['Revert', 'Hoàn tác'],
    'adminRbac.searchPermissions': ['Search permissions...', 'Tìm quyền hạn...'],
    'adminRbac.grantAll': ['Grant all', 'Cấp hết'],
    'adminRbac.revokeAll': ['Revoke all', 'Thu hồi hết'],
    'adminRbac.expandAll': ['Expand all', 'Mở tất cả'],
    'adminRbac.collapseAll': ['Collapse all', 'Thu tất cả'],
    'adminRbac.onlyChanges': ['Only changes', 'Chỉ thay đổi'],
    'adminRbac.noResults': ['No results for "{query}"', 'Không tìm thấy kết quả cho "{query}"'],
    'adminRbac.noChanges': ['No changes', 'Không có thay đổi nào'],
    'adminRbac.noPermissions': ['No permissions', 'Không có quyền hạn nào'],
    'adminRbac.justGranted': ['Just granted', 'Vừa cấp'],
    'adminRbac.justRevoked': ['Just revoked', 'Vừa thu hồi'],
    'adminRbac.legendFullGrant': ['Full group grant', 'Cấp toàn nhóm'],
    'adminRbac.legendPartialGrant': ['Partial grant', 'Cấp một phần'],
    'adminRbac.legendNotGranted': ['Not granted', 'Chưa cấp'],
    'adminRbac.legendUnsaved': ['Unsaved changes', 'Thay đổi chưa lưu'],
    'adminRbac.helpTip': ['Click group to expand/collapse · Click group checkbox to toggle all', 'Click nhóm để mở/đóng · Click checkbox nhóm để bật/tắt toàn bộ'],
    'adminRbac.selectRoleHint': ['Select a role on the left to view the permission tree', 'Chọn một vai trò bên trái để xem cây phân quyền'],
    'adminRbac.errors.loadFailed': ['Failed to load RBAC data', 'Không thể tải dữ liệu RBAC'],
    'adminRbac.errors.saveFailed': ['Failed to save permissions', 'Lỗi khi lưu phân quyền'],
    'adminRbac.savedSuccess': ['Saved permissions for role "{role}"', 'Đã lưu phân quyền cho vai trò "{role}"'],
    'adminRbac.resources.assets': ['Assets', 'Tài sản'],
    'adminRbac.resources.categories': ['Categories', 'Danh mục'],
    'adminRbac.resources.warehouses': ['Warehouses', 'Kho hàng'],
    'adminRbac.resources.inventory': ['Inventory', 'Kiểm kê'],
    'adminRbac.resources.licenses': ['Licenses', 'Giấy phép'],
    'adminRbac.resources.accessories': ['Accessories', 'Phụ kiện'],
    'adminRbac.resources.consumables': ['Consumables', 'Vật tư tiêu hao'],
    'adminRbac.resources.components': ['Components', 'Linh kiện'],
    'adminRbac.resources.checkouts': ['Check-out / Return', 'Mượn / Trả'],
    'adminRbac.resources.requests': ['Requests', 'Yêu cầu'],
    'adminRbac.resources.maintenance': ['Maintenance', 'Bảo trì'],
    'adminRbac.resources.reports': ['Reports', 'Báo cáo'],
    'adminRbac.resources.analytics': ['Analytics', 'Phân tích'],
    'adminRbac.resources.depreciation': ['Depreciation', 'Khấu hao'],
    'adminRbac.resources.labels': ['Labels', 'Nhãn'],
    'adminRbac.resources.documents': ['Documents', 'Tài liệu'],
    'adminRbac.resources.automation': ['Automation', 'Tự động hóa'],
    'adminRbac.resources.integrations': ['Integrations', 'Tích hợp'],
    'adminRbac.resources.security': ['Security', 'Bảo mật'],
    'adminRbac.resources.admin': ['Administration', 'Quản trị'],
    'adminRbac.actions.view': ['View', 'Xem'],
    'adminRbac.actions.create': ['Create', 'Tạo'],
    'adminRbac.actions.edit': ['Edit', 'Sửa'],
    'adminRbac.actions.delete': ['Delete', 'Xóa'],
    'adminRbac.actions.manage': ['Manage', 'Quản lý'],
    'adminRbac.actions.approve': ['Approve', 'Duyệt'],
    'adminRbac.actions.export': ['Export', 'Xuất'],
    'adminRbac.actions.import': ['Import', 'Nhập'],
    'adminRbac.actions.assign': ['Assign', 'Gán'],
    'adminRbac.actions.upload': ['Upload', 'Tải lên'],
    'adminRbac.actions.configure': ['Configure', 'Cấu hình'],
    'adminRbac.roleLabels.user': ['User', 'Người dùng'],
    'adminRbac.roleLabels.viewer': ['Viewer', 'Chỉ xem'],
    'adminRbac.roleLabels.technician': ['Technician', 'Kỹ thuật viên'],
    'adminRbac.roleLabels.storekeeper': ['Storekeeper', 'Thủ kho'],
    'adminRbac.roleLabels.itManager': ['IT Manager', 'Quản lý CNTT'],
    'adminRbac.roleLabels.admin': ['Admin', 'Quản trị viên'],
};

// ─── admin / user management ───
const adminUser = {
    'admin.userManagement': ['User Management', 'Quản lý người dùng'],
    'admin.userSubtitle': ['Manage accounts, roles, and access status.', 'Quản lý tài khoản, vai trò và trạng thái truy cập.'],
    'admin.addUser': ['Add user', 'Thêm người dùng'],
    'admin.searchPlaceholder': ['Search user', 'Tìm người dùng'],
    'admin.allRoles': ['All roles', 'Tất cả vai trò'],
    'admin.allStatus': ['All status', 'Tất cả trạng thái'],
    'admin.loadingUsers': ['Loading users...', 'Đang tải danh sách...'],
    'admin.noUsers': ['No users found.', 'Không tìm thấy người dùng.'],
    'admin.lock': ['Lock', 'Khóa'],
    'admin.unlock': ['Unlock', 'Mở khóa'],
    'admin.applyRole': ['Apply Role', 'Áp dụng vai trò'],
    'admin.resetPassword': ['Reset password', 'Đặt lại mật khẩu'],
    'admin.lastLogin': ['Last login:', 'Đăng nhập cuối:'],
    'admin.roles.user': ['User (requester)', 'Người dùng (requester)'],
    'admin.roles.viewer': ['Viewer', 'Chỉ xem (viewer)'],
    'admin.roles.technician': ['Technician', 'Kỹ thuật viên'],
    'admin.roles.storekeeper': ['Storekeeper', 'Thủ kho'],
    'admin.roles.itManager': ['IT Manager', 'Quản lý CNTT'],
    'admin.roles.admin': ['Admin', 'Quản trị viên'],
};

// ─── notifications ───
const notif = {
    'notifications.justNow': ['Just now', 'Vừa xong'],
    'notifications.minutesAgo': ['{count} minutes ago', '{count} phút trước'],
    'notifications.hoursAgo': ['{count} hours ago', '{count} giờ trước'],
    'notifications.clearAll': ['Clear all', 'Xóa tất cả'],
};

// ─── inbox ───
const inboxNew = {
    'inbox.approvedSuccess': ['Approved successfully', 'Phê duyệt thành công'],
    'inbox.approvedFailed': ['Approval failed', 'Phê duyệt thất bại'],
    'inbox.rejectedSuccess': ['Rejected', 'Đã từ chối'],
    'inbox.rejectedFailed': ['Rejection failed', 'Từ chối thất bại'],
    'inbox.claimedSuccess': ['Claimed', 'Đã nhận việc'],
    'inbox.claimedFailed': ['Failed to claim', 'Không thể nhận việc'],
    'inbox.pending': ['Pending', 'Chờ duyệt'],
    'inbox.urgent': ['Urgent', 'Khẩn cấp'],
    'inbox.overdue': ['Overdue', 'Quá hạn'],
    'inbox.unassigned': ['Unassigned', 'Chưa nhận'],
    'inbox.stepNo': ['Step {n}', 'Bước {n}'],
    'inbox.unassignedNote': ['No assignee yet', 'Chưa có người nhận'],
    'inbox.dueDate': ['Due: {date}', 'Hạn: {date}'],
    'inbox.pagination': ['Total: {total} | Page {page}', 'Tổng: {total} | Trang {page}'],
    'inbox.approvalTitle': ['Approval: {code}', 'Phê duyệt: {code}'],
    'inbox.detail.title': ['Title', 'Tiêu đề'],
    'inbox.detail.type': ['Type', 'Loại'],
    'inbox.detail.requester': ['Requester', 'Người yêu cầu'],
    'inbox.detail.priority': ['Priority', 'Ưu tiên'],
    'inbox.detail.approvalStep': ['Approval step', 'Bước duyệt'],
    'inbox.detail.deadline': ['Deadline', 'Hạn xử lý'],
    'inbox.detail.attachments': ['Attachments', 'Thông tin đính kèm'],
    'inbox.detail.noteOptional': ['Note (optional)', 'Ghi chú (tùy chọn)'],
    'inbox.tableHeaders.request': ['Request', 'Yêu cầu'],
    'inbox.tableHeaders.type': ['Type', 'Loại'],
    'inbox.tableHeaders.priority': ['Priority', 'Ưu tiên'],
    'inbox.tableHeaders.status': ['Status', 'Trạng thái'],
    'inbox.tableHeaders.step': ['Step', 'Bước'],
    'inbox.tableHeaders.submitted': ['Submitted', 'Ngày gửi'],
    'inbox.tableHeaders.actions': ['Actions', 'Thao tác'],
    'inbox.approve': ['Approve', 'Phê duyệt'],
    'inbox.reject': ['Reject', 'Từ chối'],
    'inbox.claim': ['Claim', 'Nhận việc'],
};

// ─── inventory page additions ───
const invPage = {
    'inventory.createTitle': ['Create inventory session', 'Tạo phiên kiểm kê mới'],
    'inventory.sessionName': ['Session name', 'Tên phiên kiểm kê'],
    'inventory.locationLabel': ['Area / Location', 'Khu vực / Vị trí'],
    'inventory.allLocations': ['— All areas —', '— Tất cả khu vực —'],
    'inventory.creating': ['Creating...', 'Đang tạo...'],
    'inventory.createSession': ['Create session', 'Tạo phiên'],
    'inventory.allAreas': ['All areas', 'Toàn bộ khu vực'],
    'inventory.startedAt': ['Started: {date}', 'Bắt đầu: {date}'],
    'inventory.filterAll': ['All ({count})', 'Tất cả ({count})'],
    'inventory.filterDraft': ['Draft ({count})', 'Nháp ({count})'],
    'inventory.filterInProgress': ['In progress ({count})', 'Đang kiểm kê ({count})'],
    'inventory.filterClosed': ['Closed ({count})', 'Đã đóng ({count})'],
    'inventory.printLabels': ['Print labels', 'In tem'],
    'inventory.assetsSelected': ['{count} assets selected', '{count} tài sản được chọn'],
    'inventory.labelCode': ['Code:', 'Mã:'],
};

// ─── maintenance page additions ───
const maintPage = {
    'maintenance.errors.loadFailed': ['Failed to load maintenance list', 'Không thể tải danh sách bảo trì'],
    'maintenance.errors.noAsset': ['Must select a valid asset or CI', 'Cần chọn tài sản hoặc CI hợp lệ'],
    'maintenance.createdSuccess': ['Maintenance ticket created', 'Tạo ticket bảo trì thành công'],
    'maintenance.updatedSuccess': ['Maintenance ticket updated', 'Cập nhật ticket bảo trì thành công'],
    'maintenance.deletedSuccess': ['Maintenance ticket deleted', 'Xóa ticket bảo trì thành công'],
    'maintenance.ticketCount': ['{count} tickets', '{count} ticket'],
    'maintenance.emptyTitle': ['No maintenance tickets', 'Không có ticket bảo trì'],
    'maintenance.emptySubtitle': ['Create a new maintenance ticket to get started.', 'Bắt đầu bằng cách tạo ticket bảo trì mới.'],
    'maintenance.createTicketBtn': ['Create ticket', 'Tạo ticket'],
    'maintenance.fields.title': ['Title', 'Tiêu đề'],
    'maintenance.fields.asset': ['Asset', 'Tài sản'],
    'maintenance.fields.ci': ['CI', 'CI'],
    'maintenance.fields.priority': ['Priority', 'Mức độ'],
    'maintenance.fields.status': ['Status', 'Trạng thái'],
    'maintenance.fields.assignee': ['Assignee', 'Người thực hiện'],
    'maintenance.fields.dueDate': ['Due date', 'Ngày hết hạn'],
    'maintenance.fields.description': ['Description', 'Mô tả'],
    'maintenance.priority.low': ['Low', 'Thấp'],
    'maintenance.priority.medium': ['Medium', 'Trung bình'],
    'maintenance.priority.high': ['High', 'Cao'],
    'maintenance.priority.critical': ['Critical', 'Nghiêm trọng'],
    'maintenance.status.open': ['Open', 'Mở'],
    'maintenance.status.inProgress': ['In progress', 'Đang xử lý'],
    'maintenance.status.closed': ['Closed', 'Đóng'],
    'maintenance.status.canceled': ['Canceled', 'Hủy'],
    'maintenance.tableHeaders.title': ['Title', 'Tiêu đề'],
    'maintenance.tableHeaders.asset': ['Asset', 'Tài sản'],
    'maintenance.tableHeaders.priority': ['Priority', 'Mức độ'],
    'maintenance.tableHeaders.status': ['Status', 'Trạng thái'],
    'maintenance.tableHeaders.actions': ['Actions', 'Thao tác'],
};

// ─── assets page additions ───
const assetsPage = {
    'assets.noAssets': ['No assets', 'Không có tài sản nào'],
    'assets.noResults': ['No matching results. Try different keywords.', 'Không tìm thấy kết quả phù hợp. Thử từ khóa khác.'],
    'assets.emptyHint': ['Start by creating a new asset.', 'Bắt đầu bằng cách tạo tài sản mới.'],
    'assets.searchPlaceholder': ['Asset code, name, serial...', 'Mã tài sản, tên, serial...'],
    'assets.statusLabels.inStock': ['In stock', 'Trong kho'],
    'assets.statusLabels.inUse': ['In use', 'Đang dùng'],
    'assets.statusLabels.maintenance': ['Under repair', 'Đang sửa'],
    'assets.statusLabels.retired': ['Retired', 'Đã nghỉ hưu'],
    'assets.statusLabels.disposed': ['Disposed', 'Đã thanh lý'],
    'assets.statusLabels.lost': ['Lost', 'Đã mất'],
    'assets.warranty': ['Warranty', 'Bảo hành'],
    'assets.warrantyExpiring30': ['Expiring in 30 days', 'Hết trong 30 ngày'],
    'assets.warrantyExpiring60': ['Expiring in 60 days', 'Hết trong 60 ngày'],
    'assets.warrantyExpiring90': ['Expiring in 90 days', 'Hết trong 90 ngày'],
    'assets.tableHeaders.name': ['Name', 'Tên'],
    'assets.tableHeaders.assetCode': ['Asset Code', 'Mã tài sản'],
    'assets.tableHeaders.model': ['Model', 'Model'],
    'assets.tableHeaders.status': ['Status', 'Trạng thái'],
    'assets.tableHeaders.location': ['Location', 'Vị trí'],
    'assets.tableHeaders.actions': ['Actions', 'Thao tác'],
    'assets.specFields.manageTitle': ['Manage Spec Fields – {category}', 'Quản lý trường Spec – {category}'],
    'assets.specFields.readonlyHint': ['This version is read-only. Create a new draft to edit.', 'Phiên bản này chỉ đọc. Tạo bản nháp mới để chỉnh sửa.'],
    'assets.specFields.labelPlaceholder': ['e.g. Memory size', 'VD: Kích thước bộ nhớ'],
    'assets.specFields.fieldType': ['Field type', 'Kiểu dữ liệu'],
    'assets.specFields.enumHint': ['Comma-separated values.', 'Phân cách bằng dấu phẩy.'],
    'assets.specFields.helpTextPlaceholder': ['Describe how to fill this field', 'Mô tả cách điền trường này'],
    'assets.specFields.computedHint': ['Auto-extract expression (optional).', 'Gợi ý tự động trích xuất (tùy chọn).'],
    'assets.readonly': ['Read-only', 'Chỉ đọc'],
    'assets.searchable': ['Searchable', 'Có thể tìm kiếm'],
    'assets.filterable': ['Filterable', 'Có thể lọc'],
    'assets.computedExpression': ['Computed expression', 'Biểu thức tính toán'],
    'assets.normalizeOptions.none': ['None', 'Không'],
    'assets.normalizeOptions.trim': ['Trim', 'Trim'],
    'assets.normalizeOptions.upper': ['Uppercase', 'Viết hoa'],
    'assets.normalizeOptions.lower': ['Lowercase', 'Viết thường'],
};

// ─── warehouse page ───
const whPage = {
    'warehouse.overview': ['Warehouse Overview', 'Tổng quan kho hàng'],
    'warehouse.overviewSubtitle': ['Key metrics of the warehouse system', 'Các chỉ số chính của hệ thống kho hàng'],
    'warehouse.cards.warehouses': ['Warehouses', 'Kho hàng'],
    'warehouse.cards.parts': ['Parts', 'Linh kiện'],
    'warehouse.cards.documents': ['Documents', 'Chứng từ'],
    'warehouse.cards.repairs': ['Repairs', 'Sửa chữa'],
    'warehouse.cards.belowMin': ['Below minimum', 'Dưới mức tối thiểu'],
    'warehouse.reorderAlert': ['Low stock alert ({count})', 'Cảnh báo tồn kho thấp ({count})'],
    'warehouse.alertHeaders.part': ['Part', 'Linh kiện'],
    'warehouse.alertHeaders.warehouse': ['Warehouse', 'Kho'],
    'warehouse.alertHeaders.stock': ['Stock', 'Tồn kho'],
    'warehouse.alertHeaders.minLevel': ['Min level', 'Mức tối thiểu'],
    'warehouse.alertHeaders.toOrder': ['To order', 'Cần nhập'],
    'warehouse.viewAllAlerts': ['View all {count} alerts →', 'Xem tất cả {count} cảnh báo →'],
};

// ─── reports ───
const reportsNew = {
    'reports.drilldownTitle': ['Drilldown: {dimension} = {value}', 'Chi tiết: {dimension} = {value}'],
    'reports.totalResults': ['{total} results', '{total} kết quả'],
    'reports.showingPartial': ['Showing {shown} / {total} — Export CSV for all', 'Hiển thị {shown} / {total} — Export CSV để lấy tất cả'],
    'reports.unknownError': ['Unknown error', 'Lỗi không xác định'],
};

// Combine all patches
const allPatches = {
    ...commonNew,
    ...cmdbTopology,
    ...cmdbPage,
    ...setup,
    ...adminRbacOld,
    ...adminUser,
    ...notif,
    ...inboxNew,
    ...invPage,
    ...maintPage,
    ...assetsPage,
    ...whPage,
    ...reportsNew,
};

let added = 0;
for (const [key, [enVal, viVal]] of Object.entries(allPatches)) {
    setDeep(en, key, enVal);
    setDeep(vi, key, viVal);
    added++;
}

writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf-8');
writeFileSync(viPath, JSON.stringify(vi, null, 2) + '\n', 'utf-8');

console.log(`✅ Patched ${added} keys into en.json and vi.json`);

// Verify parity
function countLeaves(obj, prefix = '') {
    let count = 0;
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null) count += countLeaves(v, prefix + k + '.');
        else count++;
    }
    return count;
}

const enCount = countLeaves(en);
const viCount = countLeaves(vi);
console.log(`EN: ${enCount} keys | VI: ${viCount} keys | Parity: ${enCount === viCount ? '✅' : '❌'}`);
