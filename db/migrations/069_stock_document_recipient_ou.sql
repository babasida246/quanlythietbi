-- Migration 069: Add recipient_ou_id to stock_documents
--   Links the "nơi nhận" (recipient) of an issue document to an OU in org_units.
--   The free-text `department` column is kept for backward compatibility.
-- Idempotent: uses IF NOT EXISTS / IF EXISTS guards.

ALTER TABLE stock_documents
    ADD COLUMN IF NOT EXISTS recipient_ou_id UUID REFERENCES org_units(id) ON DELETE SET NULL;
