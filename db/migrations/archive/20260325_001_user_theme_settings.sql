-- Migration: Add theme_settings JSONB column to users table
-- Stores per-user theme preferences (preset + custom token overrides)
-- so users can sync settings across devices/sessions.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'theme_settings'
    ) THEN
        ALTER TABLE users ADD COLUMN theme_settings JSONB DEFAULT NULL;
    END IF;
END $$;
