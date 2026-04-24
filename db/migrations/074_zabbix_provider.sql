-- Migration 074: Add 'zabbix' to integration_connectors provider constraint
-- Idempotent: drops and recreates the CHECK constraint

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'integration_connectors_provider_check'
          AND conrelid = 'integration_connectors'::regclass
    ) THEN
        ALTER TABLE integration_connectors
            DROP CONSTRAINT integration_connectors_provider_check;
    END IF;

    ALTER TABLE integration_connectors
        ADD CONSTRAINT integration_connectors_provider_check
        CHECK (provider = ANY (ARRAY[
            'servicenow', 'jira', 'slack', 'teams', 'aws', 'azure',
            'email', 'webhook', 'csv_import', 'api_generic', 'zabbix'
        ]));
END $$;
