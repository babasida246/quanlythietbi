-- ============================================================================
-- seed-asset-flow.sql — Dữ liệu demo cho luồng Thu hồi & Điều chuyển tài sản
--
-- Constraints đã kiểm tra:
--   wf_definitions.request_type  CHECK  — migration 068 mở rộng cho asset_recall/transfer
--   wf_requests.request_type     CHECK  — migration 068 mở rộng
--   wf_requests.priority         CHECK  — low/normal/high/urgent ✓
--   wf_requests.status           CHECK  — draft/submitted/in_review/approved/rejected/cancelled/closed ✓
--   wf_approvals.status          CHECK  — pending/approved/rejected/skipped/cancelled ✓
--   wf_request_lines.item_type   CHECK  — asset/part/service ✓
--   wf_request_lines.status      CHECK  — pending/partial/fulfilled/cancelled ✓
--   wf_request_lines.requested_qty CHECK — > 0 ✓
--   wf_request_lines.fulfilled_qty CHECK — >= 0 ✓
--   wf_events.event_type         CHECK  — created/submitted/step_started/approved/... ✓
--   stock_documents.doc_type     CHECK  — receipt/issue/adjust/transfer ✓
--   stock_documents.status       CHECK  — draft/submitted/approved/posted/canceled ✓
--   stock_document_lines.line_type CHECK — spare_part/asset ✓
--   stock_document_lines.qty     CHECK  — > 0 ✓
--   stock_document_lines.adjust_direction CHECK — plus/minus/NULL ✓
--   stock_doc_lines_content_chk         — part_id OR asset_model_id OR asset_id NOT NULL ✓
--   uidx_wf_approvals_one_approved_per_step — unique approved per (request_id, step_no) ✓
--
-- FK phụ thuộc:
--   wf_definitions (fb0..005,006) ← wf_steps (fc0..007-009)
--   wf_definitions ← wf_requests (fd0..004-008)
--   wf_requests ← wf_approvals, wf_events, wf_request_lines
--   assets (a1...007,008,012,026,027) ← wf_request_lines
--   warehouses (d1...001,004) ← stock_documents
--   wf_requests ← stock_documents.ref_request_id (FK)
--   stock_documents ← stock_document_lines
--   assets (a1...012,027) ← stock_document_lines
--
-- Idempotent: ON CONFLICT (id) DO NOTHING trên mọi bảng có PK dạng UUID explicit.
--             ON CONFLICT (key) DO UPDATE cho wf_definitions.
--             ON CONFLICT (definition_id, step_no) DO UPDATE cho wf_steps.
--
-- UUID prefixes (không trùng với các seed cũ):
--   fb0..005-006    wf_definitions
--   fc0..007-009    wf_steps
--   fd0..004-008    wf_requests
--   fe0..004-008    wf_approvals
--   b8100000-...-0001-xxxxxxxx  wf_events (4th segment 0001 ≠ 0000 dùng bởi seed-workflows.sql)
--   ff0..004-008    wf_request_lines
--   b60..008-009    stock_documents (tiếp sau 007 của seed-warehouse.sql)
--   b6100000-...-017-018  stock_document_lines
--
-- Phụ thuộc thứ tự seed: phải chạy SAU seed-qlts-demo.sql (fb0 001-004, fc0 001-006)
--                                        và SAU seed-assets.sql (a1... assets)
--                                        và SAU seed-warehouse.sql (b60... 001-007)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WF DEFINITIONS — Thu hồi và Điều chuyển tài sản
--    request_type CHECK được mở rộng bởi migration 068 trước khi seed chạy
-- ============================================================================

INSERT INTO wf_definitions (id, key, name, request_type, version, is_active)
VALUES
    ('fb000000-0000-0000-0000-000000000005',
     'wf-asset-recall',
     'Quy trình thu hồi tài sản',
     'asset_recall', 1, true),

    ('fb000000-0000-0000-0000-000000000006',
     'wf-asset-transfer',
     'Quy trình điều chuyển tài sản nội bộ',
     'asset_transfer', 1, true)
ON CONFLICT (key) DO UPDATE
    SET name       = EXCLUDED.name,
        is_active  = EXCLUDED.is_active;

-- ============================================================================
-- 2. WF STEPS
--    approver_rule dùng đúng format ApproverRule: {"type":"role","value":"..."}
--    UNIQUE (definition_id, step_no)
-- ============================================================================

INSERT INTO wf_steps (id, definition_id, step_no, name, approver_rule, on_approve, on_reject)
VALUES
    -- Thu hồi bước 1: IT Manager xét duyệt → chuyển bước 2
    ('fc000000-0000-0000-0000-000000000007',
     'fb000000-0000-0000-0000-000000000005', 1,
     'Trưởng phòng CNTT xét duyệt',
     '{"type":"role","value":"it_asset_manager"}'::jsonb,
     '{"next_step":2}'::jsonb,
     '{"cancel":true}'::jsonb),

    -- Thu hồi bước 2: Admin phê duyệt cuối → complete
    ('fc000000-0000-0000-0000-000000000008',
     'fb000000-0000-0000-0000-000000000005', 2,
     'Ban giám đốc phê duyệt',
     '{"type":"role","value":"admin"}'::jsonb,
     '{"complete":true}'::jsonb,
     '{"cancel":true}'::jsonb),

    -- Điều chuyển bước 1: IT Manager duyệt → complete (1 bước)
    ('fc000000-0000-0000-0000-000000000009',
     'fb000000-0000-0000-0000-000000000006', 1,
     'Trưởng phòng CNTT duyệt điều chuyển',
     '{"type":"role","value":"it_asset_manager"}'::jsonb,
     '{"complete":true}'::jsonb,
     '{"cancel":true}'::jsonb)
ON CONFLICT (definition_id, step_no) DO UPDATE
    SET name          = EXCLUDED.name,
        approver_rule = EXCLUDED.approver_rule;

-- ============================================================================
-- 3. WF REQUESTS
--    Dùng ON CONFLICT (id) DO NOTHING để tránh vi phạm PK khi re-seed.
--    Mỗi request có code UNIQUE — các code WF-2025-RC/TF-xxx không trùng với
--    code hiện có trong seed-qlts-demo.sql (WF-2024-xxx) và seed-workflows.sql.
-- ============================================================================

INSERT INTO wf_requests
    (id, code, title, request_type, priority, status,
     requester_id, definition_id, current_step_no, payload, submitted_at, closed_at)
VALUES

    -- ── THU HỒI ─────────────────────────────────────────────────────────────

    -- R1: APPROVED — Nhân viên nghỉ việc, thu hồi laptop LT-002
    ('fd000000-0000-0000-0000-000000000004',
     'WF-2025-RC-001',
     'Thu hồi Laptop Dell LT-002 — nhân viên kế toán nghỉ việc',
     'asset_recall', 'high', 'approved',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000005',
     NULL,
     '{"asset_code":"LT-002","reason":"Nhân viên nghỉ việc — thu hồi tài sản theo quy định","department":"Phòng Kế toán","handover_person":"Nguyễn Văn An"}'::jsonb,
     '2025-03-01 09:00:00+07', '2025-03-03 16:00:00+07'),

    -- R2: IN_REVIEW — Thu hồi PC chi nhánh Hà Nội (chờ duyệt bước 1)
    ('fd000000-0000-0000-0000-000000000005',
     'WF-2025-RC-002',
     'Thu hồi PC-007 chi nhánh Hà Nội — máy hỏng, cần sửa chữa tập trung',
     'asset_recall', 'normal', 'in_review',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000005',
     1,
     '{"asset_code":"PC-007","reason":"Máy hỏng nhiều lần, cần thu về kho trung tâm sửa chữa","branch":"Chi nhánh Hà Nội"}'::jsonb,
     '2025-04-10 10:30:00+07', NULL),

    -- R3: REJECTED — Thu hồi màn hình (bị từ chối do thiếu biên bản)
    ('fd000000-0000-0000-0000-000000000006',
     'WF-2025-RC-003',
     'Thu hồi MN-006 phòng Kinh doanh — thay thế màn hình mới',
     'asset_recall', 'low', 'rejected',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000005',
     NULL,
     '{"asset_code":"MN-006","reason":"Thay thế màn hình mới, thu hồi màn hình cũ"}'::jsonb,
     '2025-02-15 14:00:00+07', '2025-02-16 09:00:00+07'),

    -- R4: DRAFT — Chưa gửi duyệt
    ('fd000000-0000-0000-0000-000000000007',
     'WF-2025-RC-004',
     'Thu hồi PC-008 — Ban Giám đốc đổi thiết bị mới',
     'asset_recall', 'normal', 'draft',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000005',
     NULL,
     '{"asset_code":"PC-008","reason":"Ban Giám đốc được cấp phát thiết bị mới, thu hồi máy cũ"}'::jsonb,
     NULL, NULL),

    -- ── ĐIỀU CHUYỂN ─────────────────────────────────────────────────────────

    -- R5: APPROVED — Điều chuyển màn hình MN-007 từ Kho Chính → Kho CNTT
    ('fd000000-0000-0000-0000-000000000008',
     'WF-2025-TF-001',
     'Điều chuyển MN-007 từ Kho Chính → Phòng Kinh doanh',
     'asset_transfer', 'normal', 'approved',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000006',
     NULL,
     '{"asset_code":"MN-007","from_location":"Kho Chính","to_location":"Phòng Kinh doanh","reason":"Bổ sung màn hình cho nhân viên mới"}'::jsonb,
     '2025-04-01 08:00:00+07', '2025-04-01 15:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. WF REQUEST LINES
--    UNIQUE (request_id, line_no) — ON CONFLICT (request_id, line_no) DO NOTHING
--    item_type CHECK: 'asset' ✓
--    requested_qty CHECK: > 0  (1) ✓
--    fulfilled_qty CHECK: >= 0 (0 hoặc 1) ✓
--    status CHECK: pending/partial/fulfilled/cancelled ✓
--    asset_id FK: a1...007,008,012,026,027 đều tồn tại trong seed-assets.sql ✓
-- ============================================================================

INSERT INTO wf_request_lines
    (id, request_id, line_no, item_type, asset_id,
     requested_qty, fulfilled_qty, note, status)
VALUES
    -- R1 (approved): LT-002 — đã thực hiện
    ('ff000000-0000-0000-0000-000000000004',
     'fd000000-0000-0000-0000-000000000004',
     1, 'asset', 'a1000000-0000-0000-0000-000000000012',
     1, 1,
     'Laptop Dell Inspiron 5415 — SN-LT002-2023 — kèm sạc và túi xách',
     'fulfilled'),

    -- R2 (in_review): PC-007 chi nhánh HN — chờ
    ('ff000000-0000-0000-0000-000000000005',
     'fd000000-0000-0000-0000-000000000005',
     1, 'asset', 'a1000000-0000-0000-0000-000000000007',
     1, 0,
     'PC Desktop HP EliteDesk — SN-PC007-2022 — chi nhánh Hà Nội',
     'pending'),

    -- R3 (rejected): MN-006 — bị huỷ
    ('ff000000-0000-0000-0000-000000000006',
     'fd000000-0000-0000-0000-000000000006',
     1, 'asset', 'a1000000-0000-0000-0000-000000000026',
     1, 0,
     'Màn hình Dell 24" SN-MN006-2022',
     'cancelled'),

    -- R4 (draft): PC-008 — chờ
    ('ff000000-0000-0000-0000-000000000007',
     'fd000000-0000-0000-0000-000000000007',
     1, 'asset', 'a1000000-0000-0000-0000-000000000008',
     1, 0,
     'PC Desktop Lenovo IdeaCentre — SN-PC008-2023',
     'pending'),

    -- R5 (approved transfer): MN-007 — đã thực hiện
    ('ff000000-0000-0000-0000-000000000008',
     'fd000000-0000-0000-0000-000000000008',
     1, 'asset', 'a1000000-0000-0000-0000-000000000027',
     1, 1,
     'Màn hình Dell 24" SN-MN007-2022 — điều chuyển sang phòng Kinh doanh',
     'fulfilled')

ON CONFLICT (request_id, line_no) DO NOTHING;

-- ============================================================================
-- 5. WF APPROVALS
--    status CHECK: pending/approved/rejected/skipped/cancelled ✓
--    Partial unique index uidx_wf_approvals_one_approved_per_step:
--      UNIQUE (request_id, step_no) WHERE status='approved'
--      Không bị vi phạm: R1 có step 1 & step 2 khác nhau; mỗi (request,step) tối đa 1 approved ✓
--    step_id FK → wf_steps: fc0..007,008,009 ✓ (đã insert ở trên)
--    assignee_user_id FK → users: 001 (admin), 002 (it_manager) ✓ từ seed-data.sql
--    decision_by FK → users: 001, 002 ✓
-- ============================================================================

INSERT INTO wf_approvals
    (id, request_id, step_id, step_no, assignee_user_id,
     status, comment, decision_at, decision_by)
VALUES

    -- R1 bước 1: IT Manager đồng ý
    ('fe000000-0000-0000-0000-000000000004',
     'fd000000-0000-0000-0000-000000000004',
     'fc000000-0000-0000-0000-000000000007', 1,
     '00000000-0000-0000-0000-000000000002',
     'approved',
     'Xác nhận nhân viên đã nghỉ việc. Đồng ý thu hồi laptop LT-002.',
     '2025-03-02 11:00:00+07',
     '00000000-0000-0000-0000-000000000002'),

    -- R1 bước 2: Admin phê duyệt cuối
    ('fe000000-0000-0000-0000-000000000005',
     'fd000000-0000-0000-0000-000000000004',
     'fc000000-0000-0000-0000-000000000008', 2,
     '00000000-0000-0000-0000-000000000001',
     'approved',
     'Đã kiểm tra hồ sơ. Phê duyệt thu hồi.',
     '2025-03-03 15:30:00+07',
     '00000000-0000-0000-0000-000000000001'),

    -- R2 bước 1: đang chờ IT Manager
    ('fe000000-0000-0000-0000-000000000006',
     'fd000000-0000-0000-0000-000000000005',
     'fc000000-0000-0000-0000-000000000007', 1,
     '00000000-0000-0000-0000-000000000002',
     'pending',
     NULL, NULL, NULL),

    -- R3 bước 1: bị từ chối
    ('fe000000-0000-0000-0000-000000000007',
     'fd000000-0000-0000-0000-000000000006',
     'fc000000-0000-0000-0000-000000000007', 1,
     '00000000-0000-0000-0000-000000000002',
     'rejected',
     'Thiếu biên bản bàn giao từ người dùng. Yêu cầu bổ sung trước khi gửi lại.',
     '2025-02-16 09:00:00+07',
     '00000000-0000-0000-0000-000000000002'),

    -- R5 bước 1: IT Manager duyệt điều chuyển
    ('fe000000-0000-0000-0000-000000000008',
     'fd000000-0000-0000-0000-000000000008',
     'fc000000-0000-0000-0000-000000000009', 1,
     '00000000-0000-0000-0000-000000000002',
     'approved',
     'Màn hình trong kho. Đồng ý điều chuyển sang phòng Kinh doanh.',
     '2025-04-01 14:30:00+07',
     '00000000-0000-0000-0000-000000000002')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. WF EVENTS
--    event_type CHECK: created/updated/submitted/assigned/step_started/
--                      approved/rejected/commented/cancelled/closed/... ✓
--    actor_id FK → users (nullable) ✓
--    4th UUID segment = 0001 (≠ 0000 dùng bởi seed-workflows.sql) → không trùng ✓
-- ============================================================================

INSERT INTO wf_events (id, request_id, event_type, actor_id, meta, created_at)
VALUES

    -- R1: approved recall
    ('b8100000-0000-0000-0001-000000000001',
     'fd000000-0000-0000-0000-000000000004',
     'created', '00000000-0000-0000-0000-000000000006',
     '{"title":"Thu hồi Laptop Dell LT-002","requestType":"asset_recall"}'::jsonb,
     '2025-03-01 08:50:00+07'),

    ('b8100000-0000-0000-0001-000000000002',
     'fd000000-0000-0000-0000-000000000004',
     'submitted', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1}'::jsonb,
     '2025-03-01 09:00:00+07'),

    ('b8100000-0000-0000-0001-000000000003',
     'fd000000-0000-0000-0000-000000000004',
     'step_started', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1,"stepName":"Trưởng phòng CNTT xét duyệt"}'::jsonb,
     '2025-03-01 09:00:00+07'),

    ('b8100000-0000-0000-0001-000000000004',
     'fd000000-0000-0000-0000-000000000004',
     'approved', '00000000-0000-0000-0000-000000000002',
     '{"stepNo":1,"comment":"Xác nhận nhân viên đã nghỉ việc. Đồng ý thu hồi laptop LT-002."}'::jsonb,
     '2025-03-02 11:00:00+07'),

    ('b8100000-0000-0000-0001-000000000005',
     'fd000000-0000-0000-0000-000000000004',
     'step_started', '00000000-0000-0000-0000-000000000002',
     '{"stepNo":2,"stepName":"Ban giám đốc phê duyệt"}'::jsonb,
     '2025-03-02 11:00:00+07'),

    ('b8100000-0000-0000-0001-000000000006',
     'fd000000-0000-0000-0000-000000000004',
     'approved', '00000000-0000-0000-0000-000000000001',
     '{"stepNo":2,"comment":"Đã kiểm tra hồ sơ. Phê duyệt thu hồi."}'::jsonb,
     '2025-03-03 15:30:00+07'),

    ('b8100000-0000-0000-0001-000000000007',
     'fd000000-0000-0000-0000-000000000004',
     'closed', '00000000-0000-0000-0000-000000000001',
     '{"note":"All steps approved","docGenerated":"ADJ-WF-RC-001"}'::jsonb,
     '2025-03-03 16:00:00+07'),

    -- R2: in_review recall
    ('b8100000-0000-0000-0001-000000000008',
     'fd000000-0000-0000-0000-000000000005',
     'created', '00000000-0000-0000-0000-000000000006',
     '{"title":"Thu hồi PC-007","requestType":"asset_recall"}'::jsonb,
     '2025-04-10 10:00:00+07'),

    ('b8100000-0000-0000-0001-000000000009',
     'fd000000-0000-0000-0000-000000000005',
     'submitted', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1}'::jsonb,
     '2025-04-10 10:30:00+07'),

    ('b8100000-0000-0000-0001-000000000010',
     'fd000000-0000-0000-0000-000000000005',
     'step_started', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1,"stepName":"Trưởng phòng CNTT xét duyệt"}'::jsonb,
     '2025-04-10 10:30:00+07'),

    -- R3: rejected recall
    ('b8100000-0000-0000-0001-000000000011',
     'fd000000-0000-0000-0000-000000000006',
     'created', '00000000-0000-0000-0000-000000000006',
     '{"title":"Thu hồi MN-006","requestType":"asset_recall"}'::jsonb,
     '2025-02-15 13:50:00+07'),

    ('b8100000-0000-0000-0001-000000000012',
     'fd000000-0000-0000-0000-000000000006',
     'submitted', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1}'::jsonb,
     '2025-02-15 14:00:00+07'),

    ('b8100000-0000-0000-0001-000000000013',
     'fd000000-0000-0000-0000-000000000006',
     'rejected', '00000000-0000-0000-0000-000000000002',
     '{"stepNo":1,"comment":"Thiếu biên bản bàn giao từ người dùng."}'::jsonb,
     '2025-02-16 09:00:00+07'),

    -- R4: draft recall
    ('b8100000-0000-0000-0001-000000000014',
     'fd000000-0000-0000-0000-000000000007',
     'created', '00000000-0000-0000-0000-000000000006',
     '{"title":"Thu hồi PC-008","requestType":"asset_recall"}'::jsonb,
     '2025-04-20 09:00:00+07'),

    -- R5: approved transfer
    ('b8100000-0000-0000-0001-000000000015',
     'fd000000-0000-0000-0000-000000000008',
     'created', '00000000-0000-0000-0000-000000000006',
     '{"title":"Điều chuyển MN-007","requestType":"asset_transfer"}'::jsonb,
     '2025-04-01 07:50:00+07'),

    ('b8100000-0000-0000-0001-000000000016',
     'fd000000-0000-0000-0000-000000000008',
     'submitted', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1}'::jsonb,
     '2025-04-01 08:00:00+07'),

    ('b8100000-0000-0000-0001-000000000017',
     'fd000000-0000-0000-0000-000000000008',
     'step_started', '00000000-0000-0000-0000-000000000006',
     '{"stepNo":1,"stepName":"Trưởng phòng CNTT duyệt điều chuyển"}'::jsonb,
     '2025-04-01 08:00:00+07'),

    ('b8100000-0000-0000-0001-000000000018',
     'fd000000-0000-0000-0000-000000000008',
     'approved', '00000000-0000-0000-0000-000000000002',
     '{"stepNo":1,"comment":"Màn hình trong kho. Đồng ý điều chuyển sang phòng Kinh doanh."}'::jsonb,
     '2025-04-01 14:30:00+07'),

    ('b8100000-0000-0000-0001-000000000019',
     'fd000000-0000-0000-0000-000000000008',
     'closed', '00000000-0000-0000-0000-000000000002',
     '{"note":"All steps approved","docGenerated":"TRF-WF-TF-001"}'::jsonb,
     '2025-04-01 15:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. STOCK DOCUMENTS — sinh tự động từ approved WF requests
--    doc_type CHECK: adjust/transfer ✓
--    status CHECK: 'draft' ✓
--    warehouse_id FK → warehouses: d1...001 (Kho Chính), d1...004 (Kho CNTT) ✓
--    target_warehouse_id FK → warehouses: d1...004 ✓
--    ref_request_id FK → wf_requests: fd...004, fd...008 ✓ (đã insert ở trên)
--    UNIQUE (code) — ON CONFLICT (id) DO NOTHING tránh vi phạm PK
-- ============================================================================

INSERT INTO stock_documents
    (id, code, doc_type, status,
     warehouse_id, target_warehouse_id,
     doc_date, ref_type, ref_id, ref_request_id,
     note, created_by)
VALUES

    -- Chứng từ thu hồi từ R1 (asset_recall approved → adjust doc)
    ('b6000000-0000-0000-0000-000000000008',
     'ADJ-WF-RC-001', 'adjust', 'draft',
     'd1000000-0000-0000-0000-000000000001', NULL,
     '2025-03-03',
     'wf_request',
     'fd000000-0000-0000-0000-000000000004',   -- ref_id (uuid)
     'fd000000-0000-0000-0000-000000000004',   -- ref_request_id (FK)
     'Sinh tự động từ yêu cầu thu hồi WF-2025-RC-001: Thu hồi Laptop Dell LT-002 — nhân viên kế toán nghỉ việc',
     'it.manager@example.com'),

    -- Chứng từ điều chuyển từ R5 (asset_transfer approved → transfer doc)
    ('b6000000-0000-0000-0000-000000000009',
     'TRF-WF-TF-001', 'transfer', 'draft',
     'd1000000-0000-0000-0000-000000000001',   -- from: Kho Chính
     'd1000000-0000-0000-0000-000000000004',   -- to: Kho CNTT
     '2025-04-01',
     'wf_request',
     'fd000000-0000-0000-0000-000000000008',   -- ref_id (uuid)
     'fd000000-0000-0000-0000-000000000008',   -- ref_request_id (FK)
     'Sinh tự động từ yêu cầu điều chuyển WF-2025-TF-001: Điều chuyển MN-007 từ Kho Chính → Phòng Kinh doanh',
     'it.manager@example.com')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. STOCK DOCUMENT LINES
--    document_id FK → stock_documents: b60..008, b60..009 ✓
--    asset_id FK → assets: a1...012 (LT-002), a1...027 (MN-007) ✓
--    line_type CHECK: 'asset' ✓
--    qty CHECK: > 0  (1) ✓
--    adjust_direction CHECK: 'plus' hoặc NULL ✓
--    stock_doc_lines_content_chk: asset_id IS NOT NULL ✓
-- ============================================================================

INSERT INTO stock_document_lines
    (id, document_id, line_type, asset_id, qty, note, adjust_direction)
VALUES

    -- ADJ-WF-RC-001: thu hồi LT-002 — nhập lại kho (plus = tăng tồn kho)
    ('b6100000-0000-0000-0000-000000000017',
     'b6000000-0000-0000-0000-000000000008',
     'asset',
     'a1000000-0000-0000-0000-000000000012',   -- LT-002
     1,
     'Thu hồi Laptop Dell Inspiron 5415 — SN-LT002-2023 — kèm sạc và túi xách',
     'plus'),                                  -- điều chỉnh tăng (nhập kho)

    -- TRF-WF-TF-001: điều chuyển MN-007 (transfer không cần adjust_direction)
    ('b6100000-0000-0000-0000-000000000018',
     'b6000000-0000-0000-0000-000000000009',
     'asset',
     'a1000000-0000-0000-0000-000000000027',   -- MN-007
     1,
     'Điều chuyển Màn hình Dell 24" SN-MN007-2022 sang phòng Kinh doanh',
     NULL)                                     -- transfer không có adjust_direction

ON CONFLICT (id) DO NOTHING;

COMMIT;
