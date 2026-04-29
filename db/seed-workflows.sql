-- =============================================================================
-- SEED: WORKFLOW / AUTOMATION DATA
-- Dependencies: wf_definitions (fb...), wf_steps (fc...) already exist from seed-assets
--               users, assets, asset_models, asset_requests (a5...) already exist
-- =============================================================================
BEGIN;

    -- ============================================================================
    -- 1. WF REQUESTS (must be inserted BEFORE wf_attachments, wf_events, wf_approvals)
    -- Columns: id, code, title, request_type, priority, status, requester_id,
    --          definition_id, current_step_no, payload, submitted_at
    -- status: 'draft'/'submitted'/'in_review'/'approved'/'rejected'/'cancelled'/'closed'
    -- priority: 'low'/'normal'/'high'/'urgent'
    -- ============================================================================
    INSERT INTO wf_requests
        (id, code, title, request_type, priority, status, requester_id,
        definition_id, current_step_no, payload, submitted_at, closed_at)
    VALUES
        ('fd000000-0000-0000-0000-000000000001', 'WF-2024-001',
            'Mua server HP ProLiant DL380 Gen10 moi', 'purchase', 'normal', 'closed',
            '00000000-0000-0000-0000-000000000002',
            'fb000000-0000-0000-0000-000000000001', NULL,
            '{"estimated_cost":180000000,"vendor":"HP","justification":"Thay the server cu"}'
    ::jsonb,
     '2024-01-05 09:00:00','2024-01-08 15:00:00'),
    ('fd000000-0000-0000-0000-000000000002','WF-2024-002',
     'Ba giao tai san ve kho: Laptop Dell hoc vien','asset_request','normal','rejected',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000002',1,
     '{"asset_code":"LAP-DELL-005","reason":"Nhan vien nghi viec"}'::jsonb,
     '2024-02-01 09:00:00',NULL),
    ('fd000000-0000-0000-0000-000000000003','WF-2024-003',
     'Sua chua PC desktop bi loi HDD','repair_request','high','submitted',
     '00000000-0000-0000-0000-000000000006',
     'fb000000-0000-0000-0000-000000000004',1,
     '{"asset_code":"PC-HP-009","issue":"HDD failure","estimated_cost":2500000}'::jsonb,
     '2024-03-01 09:00:00',NULL)
ON CONFLICT
    (id) DO NOTHING;

-- ============================================================================
-- 2. WF REQUEST LINES
-- Columns: id, request_id, line_no, item_type ('asset'/'part'/'service'),
--          asset_id, part_id, requested_qty, fulfilled_qty, unit_cost, note, status
-- status: 'pending'/'partial'/'fulfilled'/'cancelled'
-- ============================================================================
INSERT INTO wf_request_lines
    (id, request_id, line_no, item_type, asset_id, requested_qty, fulfilled_qty, unit_cost, status)
VALUES
    ('fd100000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
        1, 'asset', 'a1000000-0000-0000-0000-000000000034', 1, 1, 180000000, 'fulfilled'),
    ('fd100000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000002',
        1, 'asset', 'a1000000-0000-0000-0000-000000000011', 1, 0, 0, 'cancelled'),
    ('fd100000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000003',
        1, 'service', NULL, 1, 0, 2500000, 'pending')
ON CONFLICT
(request_id, line_no) DO NOTHING;

-- ============================================================================
-- 3. WF APPROVALS
-- Columns: id, request_id, step_id, step_no, assignee_user_id,
--          status, comment, decision_at, decision_by, due_at
-- status: 'pending'/'approved'/'rejected'/'skipped'/'cancelled'
-- ============================================================================
INSERT INTO wf_approvals
    (id, request_id, step_id, step_no, assignee_user_id, status, comment, decision_at, decision_by)
VALUES
    ('fd200000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
        'fc000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000002',
        'approved', 'Dong y mua server moi', '2024-01-06 14:00:00', '00000000-0000-0000-0000-000000000002'),
    ('fd200000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000001',
        'fc000000-0000-0000-0000-000000000002', 2, '00000000-0000-0000-0000-000000000001',
        'approved', 'Full approved', '2024-01-08 10:00:00', '00000000-0000-0000-0000-000000000001'),
    ('fd200000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000002',
        'fc000000-0000-0000-0000-000000000003', 1, '00000000-0000-0000-0000-000000000002',
        'rejected', 'Thieu ho so ban giao', '2024-02-02 14:00:00', '00000000-0000-0000-0000-000000000002'),
    ('fd200000-0000-0000-0000-000000000004', 'fd000000-0000-0000-0000-000000000003',
        'fc000000-0000-0000-0000-000000000006', 1, '00000000-0000-0000-0000-000000000002',
        'pending', NULL, NULL, NULL)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 4. WF ATTACHMENTS (references wf_requests - must come AFTER wf_requests)
-- Columns: id, request_id, file_key, filename, size, mime, uploaded_by
-- ============================================================================
INSERT INTO wf_attachments
    (id, request_id, file_key, filename, size, mime, uploaded_by)
VALUES
    ('b8000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
        'wf/fd001/invoice.pdf', 'invoice-srv-2024.pdf', 524288, 'application/pdf',
        '00000000-0000-0000-0000-000000000002'),
    ('b8000000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000001',
        'wf/fd001/quotation.pdf', 'quotation-server.pdf', 310000, 'application/pdf',
        '00000000-0000-0000-0000-000000000002'),
    ('b8000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000002',
        'wf/fd002/form.xlsx', 'asset-return-form.xlsx', 45056,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '00000000-0000-0000-0000-000000000006'),
    ('b8000000-0000-0000-0000-000000000004', 'fd000000-0000-0000-0000-000000000003',
        'wf/fd003/repair-estimate.pdf', 'repair-estimate.pdf', 200704, 'application/pdf',
        '00000000-0000-0000-0000-000000000006'),
    ('b8000000-0000-0000-0000-000000000005', 'fd000000-0000-0000-0000-000000000003',
        'wf/fd003/photo.jpg', 'pc009-damage.jpg', 1048576, 'image/jpeg',
        '00000000-0000-0000-0000-000000000006')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 5. WF EVENTS
-- Columns: id, request_id, event_type, actor_id, meta, created_at
-- event_type: 'created'/'updated'/'submitted'/'assigned'/'step_started'/
--             'approved'/'rejected'/'commented'/'cancelled'/'closed'/
--             'reopened'/'delegated'/'info_requested'/'withdrawn'
-- ============================================================================
INSERT INTO wf_events
    (id, request_id, event_type, actor_id, meta, created_at)
VALUES
    ('b8100000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
        'submitted', '00000000-0000-0000-0000-000000000002', '{"step":1}'
::jsonb,'2024-01-05 09:00:00'),
('b8100000-0000-0000-0000-000000000002','fd000000-0000-0000-0000-000000000001',
     'approved','00000000-0000-0000-0000-000000000002','{"step":1,"comment":"Dong y mua server moi"}'::jsonb,'2024-01-06 14:00:00'),
('b8100000-0000-0000-0000-000000000003','fd000000-0000-0000-0000-000000000001',
     'approved','00000000-0000-0000-0000-000000000001','{"step":2,"comment":"Full approved"}'::jsonb,'2024-01-08 10:00:00'),
('b8100000-0000-0000-0000-000000000004','fd000000-0000-0000-0000-000000000001',
     'closed','00000000-0000-0000-0000-000000000001','{"final_status":"approved"}'::jsonb,'2024-01-08 15:00:00'),
('b8100000-0000-0000-0000-000000000005','fd000000-0000-0000-0000-000000000002',
     'submitted','00000000-0000-0000-0000-000000000006','{"step":1}'::jsonb,'2024-02-01 09:00:00'),
('b8100000-0000-0000-0000-000000000006','fd000000-0000-0000-0000-000000000002',
     'rejected','00000000-0000-0000-0000-000000000002','{"step":1,"comment":"Thieu ho so ban giao"}'::jsonb,'2024-02-02 14:00:00'),
('b8100000-0000-0000-0000-000000000007','fd000000-0000-0000-0000-000000000003',
     'submitted','00000000-0000-0000-0000-000000000006','{"step":1}'::jsonb,'2024-03-01 09:00:00')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 6. WORKFLOW AUTOMATION RULES
-- trigger_type CHECK: 'warranty_expiring'/'maintenance_due'/'status_change'/
--   'assignment_change'/'schedule'/'threshold'/'custom'
-- created_by is VARCHAR(100) not UUID
-- ============================================================================
INSERT INTO workflow_automation_rules
    (id, name, description, trigger_type, trigger_config, conditions, actions,
    is_active, priority, created_by)
VALUES
    ('b9000000-0000-0000-0000-000000000001', 'Auto notify khi asset het bao hanh',
        'Gui thong bao cho IT Manager khi thiet bi het bao hanh trong 30 ngay toi',
        'warranty_expiring',
        '{"days_before":30,"check_time":"08:00","timezone":"Asia/Ho_Chi_Minh"}'
::jsonb,
     '[{"field":"warranty_end","operator":"lt","value":"now+30d"}]'::jsonb,
     '[{"type":"notify","target_role":"it_asset_manager","message":"Thiet bi {asset_code} sap het bao hanh"}]'::jsonb,
     true,10,'admin'),
('b9000000-0000-0000-0000-000000000002','Auto tao ticket khi asset bao loi',
     'Tu dong tao maintenance ticket khi nhan duoc bao cao loi tu thiet bi',
     'status_change',
     '{"from_status":"assigned","to_status":"in_repair"}'::jsonb,
     '[]'::jsonb,
     '[{"type":"create_ticket","severity":"medium","title":"Thiet bi {asset_code} can kiem tra"}]'::jsonb,
     true,20,'admin'),
('b9000000-0000-0000-0000-000000000003','Nhac nho tra checkout qua han',
     'Gui nhac nho khi checkout qua han tra thiet bi',
     'schedule',
     '{"cron":"0 9 * * *","timezone":"Asia/Ho_Chi_Minh"}'::jsonb,
     '[{"field":"expected_checkin_date","operator":"lt","value":"now"},{"field":"status","operator":"eq","value":"checked_out"}]'::jsonb,
     '[{"type":"notify","target":"assignee","message":"Ban dang giu thiet bi {asset_code} qua han"}]'::jsonb,
     true,30,'admin')
ON CONFLICT
(id) DO
UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 7. WORKFLOW AUTOMATION LOGS
-- status: 'pending'/'running'/'completed'/'failed'/'skipped'
-- ============================================================================
INSERT INTO workflow_automation_logs
    (id, rule_id, trigger_event, actions_executed, status, started_at, completed_at)
VALUES
    ('b9100000-0000-0000-0000-000000000001', 'b9000000-0000-0000-0000-000000000001',
        '{"triggered_at":"2024-03-11T08:00:00Z","assets_near_expiry":3}'
::jsonb,
     '[{"type":"notify","sent_to":"it_manager","count":3}]'::jsonb,
     'completed','2024-03-11 08:00:00','2024-03-11 08:00:05'),
('b9100000-0000-0000-0000-000000000002','b9000000-0000-0000-0000-000000000003',
     '{"triggered_at":"2024-03-15T09:00:00Z","overdue_checkouts":1}'::jsonb,
     '[{"type":"notify","sent_to":"requester"}]'::jsonb,
     'completed','2024-03-15 09:00:00','2024-03-15 09:00:02'),
('b9100000-0000-0000-0000-000000000003','b9000000-0000-0000-0000-000000000002',
     '{"asset_id":"a1000000-0000-0000-0000-000000000009","old_status":"assigned","new_status":"in_repair"}'::jsonb,
     '[{"type":"create_ticket","ticket_id":"a2000000-0000-0000-0000-000000000001"}]'::jsonb,
     'completed','2024-03-01 09:05:00','2024-03-01 09:05:03'),
('b9100000-0000-0000-0000-000000000004','b9000000-0000-0000-0000-000000000001',
     '{"triggered_at":"2024-03-18T08:00:00Z","assets_near_expiry":2}'::jsonb,
     '[]'::jsonb,
     'failed','2024-03-18 08:00:00',NULL),
('b9100000-0000-0000-0000-000000000005','b9000000-0000-0000-0000-000000000003',
     '{"triggered_at":"2024-03-16T09:00:00Z"}'::jsonb,
     '[{"type":"notify","sent_to":"requester"}]'::jsonb,
     'completed','2024-03-16 09:00:00','2024-03-16 09:00:01')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 8. WORKFLOW REQUESTS (generic workflow_requests table - different from wf_requests)
-- request_type: 'assign'/'return'/'move'/'repair'/'dispose'/'issue_stock'
-- status: 'submitted'/'approved'/'rejected'/'in_progress'/'done'/'canceled'
-- ============================================================================
INSERT INTO workflow_requests
    (id, request_type, asset_id, from_dept, to_dept, requested_by,
    approved_by, status, payload, correlation_id)
VALUES
    ('b9200000-0000-0000-0000-000000000001', 'move',
        'a1000000-0000-0000-0000-000000000007',
        'Chi nhanh HN', 'Kho chinh', 'Ky su CNTT', NULL, 'submitted',
        '{"reason":"PC cu khong du hieu nang"}'
::jsonb,'COR-2024-001'),
('b9200000-0000-0000-0000-000000000002','dispose',
     'a1000000-0000-0000-0000-000000000015',
     NULL,NULL,'IT Manager','Admin','approved',
     '{"reason":"End of life","salvage_value":0}'::jsonb,'COR-2024-002'),
('b9200000-0000-0000-0000-000000000003','repair',
     'a1000000-0000-0000-0000-000000000009',
     'Ke toan','Phong CNTT','Ke toan',NULL,'in_progress',
     '{"issue":"HDD failure"}'::jsonb,'COR-2024-003')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 9. APPROVAL STEPS (FK  asset_requests(id), NOT purchase_plan_docs)
-- request_id must reference existing asset_requests IDs (a5000000-...-001 to -005)
-- status: 'pending'/'approved'/'rejected'/'skipped'
-- decision_date is timestamptz
-- UNIQUE (request_id, step_order)
-- ============================================================================
INSERT INTO approval_steps
    (id, request_id, step_order, approver_id, approver_role,
    status, decision_date, comments)
VALUES
    ('a6000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000001',
        2, '00000000-0000-0000-0000-000000000002', 'it_asset_manager',
        'approved', '2024-01-08 10:00:00', 'Duyet yeu cau thi nghiem'),
    ('a6000000-0000-0000-0000-000000000006', 'a5000000-0000-0000-0000-000000000002',
        2, '00000000-0000-0000-0000-000000000001', 'admin',
        'approved', '2024-01-10 14:00:00', 'OKed'),
    ('a6000000-0000-0000-0000-000000000007', 'a5000000-0000-0000-0000-000000000003',
        2, '00000000-0000-0000-0000-000000000002', 'it_asset_manager',
        'pending', NULL, NULL)
ON CONFLICT
(request_id, step_order) DO
UPDATE SET status = EXCLUDED.status, decision_date = EXCLUDED.decision_date, comments = EXCLUDED.comments, approver_id = EXCLUDED.approver_id;

COMMIT;
