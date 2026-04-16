-- Align CMDB relationship FK column naming to canonical `type_id`
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cmdb_relationships'
          AND column_name = 'rel_type_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cmdb_relationships'
          AND column_name = 'type_id'
    ) THEN
        ALTER TABLE cmdb_relationships RENAME COLUMN rel_type_id TO type_id;
    END IF;
END $$;

