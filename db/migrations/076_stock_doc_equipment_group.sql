-- Migration 076: link stock_documents to equipment_groups catalog
-- equipment_group_id stores which Nhóm vật tư (equipment group) the document belongs to

ALTER TABLE stock_documents
    ADD COLUMN IF NOT EXISTS equipment_group_id UUID
        REFERENCES equipment_groups(id) ON DELETE SET NULL;
