-- Migration 048: Rename asset_category_spec_defs to asset_category_spec_definitions
-- and rename column version_id to spec_version_id to match API repo expectations.

-- Step 1: Rename the column version_id -> spec_version_id
ALTER TABLE public.asset_category_spec_defs
    RENAME COLUMN version_id TO spec_version_id;

-- Step 2: Rename the table itself
ALTER TABLE public.asset_category_spec_defs
    RENAME TO asset_category_spec_definitions;

-- Step 3: Rename indexes and constraints to reflect the new table name
ALTER INDEX
IF EXISTS asset_category_spec_defs_pkey
    RENAME TO asset_category_spec_definitions_pkey;

ALTER INDEX
IF EXISTS asset_category_spec_defs_version_id_key_key
    RENAME TO asset_category_spec_definitions_spec_version_id_key_key;

ALTER INDEX
IF EXISTS idx_category_spec_defs_version
    RENAME TO idx_category_spec_definitions_version;

ALTER INDEX
IF EXISTS idx_category_spec_defs_version_key
    RENAME TO idx_category_spec_definitions_version_key;
