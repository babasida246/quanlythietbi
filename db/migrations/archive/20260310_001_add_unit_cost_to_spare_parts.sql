-- Migration: Add unit_cost column to spare_parts table
-- This column stores the unit cost (purchase price) per spare part,
-- used to calculate warehouse valuation reports.
ALTER TABLE spare_parts ADD COLUMN
IF NOT EXISTS unit_cost NUMERIC
(15,2) DEFAULT 0;
