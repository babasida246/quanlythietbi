ALTER TABLE workflow_requests
    DROP CONSTRAINT IF EXISTS workflow_requests_request_type_check;

ALTER TABLE workflow_requests
    ADD CONSTRAINT workflow_requests_request_type_check
    CHECK (request_type IN ('assign', 'return', 'move', 'repair', 'dispose', 'issue_stock'));
