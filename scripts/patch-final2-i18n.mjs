/**
 * patch-final2-i18n.mjs – Add remaining i18n keys discovered during final validation
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = resolve(__dirname, '../apps/web-ui/src/lib/i18n/locales');
const enPath = resolve(base, 'en.json');
const viPath = resolve(base, 'vi.json');

function readJson(p) {
    let raw = readFileSync(p, 'utf-8');
    while (raw.endsWith('\\n')) raw = raw.slice(0, -2);
    return JSON.parse(raw);
}
function writeJson(p, o) { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

function set(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] === 'string') cur[parts[i]] = {};
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (!cur[parts[parts.length - 1]]) {
        cur[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

const en = readJson(enPath);
const vi = readJson(viPath);

const keys = [
    // requests - detail modal extras
    ['requests.detail.submittedAt', 'Submitted at', 'Đã gửi lúc'],
    ['requests.detail.currentStep', 'Current step', 'Đang ở bước'],
    ['requests.detail.requestInfo', 'Request Info', 'Thông tin yêu cầu'],
    ['requests.detail.loading', 'Loading details...', 'Đang tải chi tiết...'],
    ['requests.detail.lineNo', 'Line', 'Dòng'],
    ['requests.detail.saved', 'Saved', 'Đã lưu'],

    // requests - line statuses
    ['requests.lineStatus.fulfilled', 'Fulfilled', 'Hoàn thành'],
    ['requests.lineStatus.partial', 'Partial', 'Một phần'],
    ['requests.lineStatus.cancelled', 'Cancelled', 'Hủy'],
    ['requests.lineStatus.pending', 'Pending', 'Chờ'],

    // requests - field extras
    ['requests.field.title', 'Title', 'Tiêu đề'],
    ['requests.field.priority', 'Priority', 'Ưu tiên'],
    ['requests.field.dueDate', 'Due Date', 'Hạn xử lý'],
    ['requests.field.assignModel', 'Device model to assign', 'Model thiết bị cần cấp'],
    ['requests.field.reclaimDevice', 'Device code/name to reclaim', 'Mã / tên thiết bị thu hồi'],
    ['requests.placeholder.title', 'Brief description of the request...', 'Mô tả ngắn gọn nội dung yêu cầu...'],
    ['requests.validation.titleRequired', 'Please enter a request title', 'Vui lòng nhập tiêu đề yêu cầu'],

    // requests - header extras
    ['requests.header.priority', 'Priority', 'Ưu tiên'],

    // reports - sidebar
    ['reports.sidebar.saved', 'Saved', 'Đã lưu'],

    // specField extras
    ['specField.placeholder.defaultValue', 'Default value (optional)', 'Giá trị mặc định (tùy chọn)'],
    ['specField.placeholder.helpText', 'Describe how to fill this field', 'Mô tả cách điền trường này'],

    // stockDoc extras
    ['stockDoc.header.direction', 'Direction', 'Hướng'],
    ['stockDoc.header.unitPrice', 'Unit Price', 'Đơn giá (₫)'],
    ['stockDoc.header.amount', 'Amount', 'Thành tiền (₫)'],

    // wfRequest extras
    ['wfRequest.header.type', 'Type', 'Loại'],
];

let added = 0;
for (const [key, enVal, viVal] of keys) {
    if (set(en, key, enVal)) added++;
    set(vi, key, viVal);
}

writeJson(enPath, en);
writeJson(viPath, vi);

const enCount = JSON.stringify(en).match(/"[^"]+"\s*:\s*"[^"]*"/g)?.length ?? 0;
const viCount = JSON.stringify(vi).match(/"[^"]+"\s*:\s*"[^"]*"/g)?.length ?? 0;
console.log(`Added ${added} new keys | EN: ${enCount} keys | VI: ${viCount} keys | Parity: ${enCount === viCount ? 'YES' : 'NO'}`);
