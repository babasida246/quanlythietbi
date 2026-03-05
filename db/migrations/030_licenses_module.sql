-- =============================================================================
-- ITAM License Management Module
-- Migration: 030_licenses_module.sql
-- Description: Create tables for software license management
-- =============================================================================

-- Suppliers table (if not exists)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    code varchar(50) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    contact_name varchar(255),
    contact_email varchar(255),
    contact_phone varchar(50),
    address text,
    website varchar(255),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- License categories
CREATE TABLE IF NOT EXISTS public.license_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    name varchar(255) NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- License types enum
DO $$ BEGIN
    CREATE TYPE license_type AS ENUM (
        'per_seat',
        'per_device', 
        'per_user',
        'site_license',
        'unlimited'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- License status enum
DO $$ BEGIN
    CREATE TYPE license_status AS ENUM (
        'draft',
        'active',
        'expired',
        'retired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main licenses table
CREATE TABLE IF NOT EXISTS public.licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    license_code varchar(100) NOT NULL UNIQUE,
    software_name varchar(255) NOT NULL,
    supplier_id uuid REFERENCES public.suppliers(id),
    category_id uuid REFERENCES public.license_categories(id),
    license_type license_type NOT NULL DEFAULT 'per_seat',
    product_key text, -- Will store encrypted value
    seat_count integer NOT NULL DEFAULT 1 CHECK (seat_count >= 0),
    unit_price numeric(15,2) DEFAULT 0 CHECK (unit_price >= 0),
    currency varchar(3) DEFAULT 'VND',
    purchase_date date,
    expiry_date date, -- NULL means perpetual
    warranty_date date,
    invoice_number varchar(100),
    notes text,
    status license_status NOT NULL DEFAULT 'draft',
    organization_id uuid, -- For multi-tenancy
    created_by varchar(255),
    updated_by varchar(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_dates CHECK (
        (expiry_date IS NULL OR purchase_date IS NULL OR expiry_date >= purchase_date)
    )
);

-- License seat assignment type
DO $$ BEGIN
    CREATE TYPE seat_assignment_type AS ENUM ('user', 'asset');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- License seats table (tracks assigned seats)
CREATE TABLE IF NOT EXISTS public.license_seats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    assignment_type seat_assignment_type NOT NULL,
    assigned_user_id uuid, -- References users table
    assigned_asset_id uuid REFERENCES public.assets(id),
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by varchar(255) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    
    -- Either user or asset must be assigned
    CONSTRAINT valid_assignment CHECK (
        (assignment_type = 'user' AND assigned_user_id IS NOT NULL) OR
        (assignment_type = 'asset' AND assigned_asset_id IS NOT NULL)
    ),
    -- Unique constraint: one seat per user/asset per license
    CONSTRAINT unique_user_license UNIQUE (license_id, assigned_user_id),
    CONSTRAINT unique_asset_license UNIQUE (license_id, assigned_asset_id)
);

-- License audit log
CREATE TABLE IF NOT EXISTS public.license_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    action varchar(50) NOT NULL, -- created, updated, status_changed, seat_assigned, seat_revoked
    actor_user_id varchar(255),
    old_values jsonb,
    new_values jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_supplier ON public.licenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_licenses_category ON public.licenses(category_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON public.licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_licenses_software_name ON public.licenses(software_name);
CREATE INDEX IF NOT EXISTS idx_license_seats_license ON public.license_seats(license_id);
CREATE INDEX IF NOT EXISTS idx_license_seats_user ON public.license_seats(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_license_seats_asset ON public.license_seats(assigned_asset_id);
CREATE INDEX IF NOT EXISTS idx_license_audit_license ON public.license_audit_logs(license_id);

-- View for license usage summary
CREATE OR REPLACE VIEW public.license_usage_summary AS
SELECT 
    l.id,
    l.license_code,
    l.software_name,
    l.license_type,
    l.seat_count,
    l.status,
    l.expiry_date,
    COUNT(ls.id) as seats_used,
    l.seat_count - COUNT(ls.id) as seats_available,
    CASE 
        WHEN l.seat_count = 0 THEN 0
        ELSE ROUND((COUNT(ls.id)::numeric / l.seat_count::numeric) * 100, 2)
    END as usage_percentage
FROM public.licenses l
LEFT JOIN public.license_seats ls ON l.id = ls.license_id
GROUP BY l.id, l.license_code, l.software_name, l.license_type, l.seat_count, l.status, l.expiry_date;

-- Function to check seat availability before assignment
CREATE OR REPLACE FUNCTION check_license_seat_availability()
RETURNS TRIGGER AS $$
DECLARE
    current_seats integer;
    max_seats integer;
    lic_status license_status;
    lic_type license_type;
BEGIN
    -- Get license info
    SELECT seat_count, status, license_type 
    INTO max_seats, lic_status, lic_type
    FROM public.licenses WHERE id = NEW.license_id;
    
    -- Check license status
    IF lic_status != 'active' THEN
        RAISE EXCEPTION 'Cannot assign seat: License is not active (status: %)', lic_status;
    END IF;
    
    -- Skip seat check for unlimited licenses
    IF lic_type = 'unlimited' THEN
        RETURN NEW;
    END IF;
    
    -- Count current seats
    SELECT COUNT(*) INTO current_seats
    FROM public.license_seats 
    WHERE license_id = NEW.license_id;
    
    -- Check availability
    IF current_seats >= max_seats THEN
        RAISE EXCEPTION 'Cannot assign seat: License has reached maximum seats (% of %)', current_seats, max_seats;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for seat availability check
DROP TRIGGER IF EXISTS check_seat_availability ON public.license_seats;
CREATE TRIGGER check_seat_availability
    BEFORE INSERT ON public.license_seats
    FOR EACH ROW
    EXECUTE FUNCTION check_license_seat_availability();

-- Function to auto-expire licenses
CREATE OR REPLACE FUNCTION auto_expire_licenses()
RETURNS void AS $$
BEGIN
    UPDATE public.licenses
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

