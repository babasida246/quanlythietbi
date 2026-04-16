-- =============================================================
-- QLTB (Quản Lý Thiết Bị) — Baseline Schema
-- Squashed from: schema.sql + 60 migrations (007–20260326)
-- Generated: 2026-04-07 via pg_dump (PostgreSQL 16)
-- This file replaces the full migration chain for fresh installs.
-- New migrations → db/migrations/065_xxx.sql
-- =============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: license_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.license_status AS ENUM (
    'draft',
    'active',
    'expired',
    'retired'
);


--
-- Name: license_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.license_type AS ENUM (
    'per_seat',
    'per_device',
    'per_user',
    'site_license',
    'unlimited'
);


--
-- Name: seat_assignment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.seat_assignment_type AS ENUM (
    'user',
    'asset'
);


--
-- Name: auto_expire_licenses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_expire_licenses() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.licenses
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE;
END;
$$;


--
-- Name: auto_generate_checkout_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_checkout_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.checkout_code IS NULL OR NEW.checkout_code = '' THEN
        NEW.checkout_code = generate_checkout_code();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: calculate_depreciation_end_date(date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_depreciation_end_date(p_start_date date, p_useful_life_years integer) RETURNS date
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN (p_start_date + (p_useful_life_years * INTERVAL
    '1 year') - INTERVAL '1 day')::DATE;
END;
$$;


--
-- Name: calculate_next_run(character varying, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_run(p_cron character varying, p_last_run timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_next_run TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Simplified: for now just add based on common patterns
    -- In production, use a proper cron parser library
    IF p_cron LIKE '0 0 * * *' THEN -- daily
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '1 day';
    ELSIF p_cron LIKE '0 0 * * 1' THEN -- weekly Monday
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '7 days';
    ELSIF p_cron LIKE '0 0 1 * *' THEN -- monthly 1st
        v_next_run := DATE_TRUNC('month', COALESCE(p_last_run, NOW())) + INTERVAL '1 month';
    ELSE
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '1 day';
    END IF;
    
    RETURN v_next_run;
END;
$$;


--
-- Name: calculate_straight_line_depreciation(numeric, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_straight_line_depreciation(p_original_cost numeric, p_salvage_value numeric, p_useful_life_months integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN ROUND((p_original_cost - p_salvage_value) / p_useful_life_months, 2);
END;
$$;


--
-- Name: calculate_total_labels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_total_labels() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.total_labels := NEW.asset_count * NEW.copies_per_asset;
RETURN NEW;
END;
$$;


--
-- Name: check_license_seat_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_license_seat_availability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: ensure_single_default_template(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_single_default_template() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.is_default = true THEN
    UPDATE label_templates 
        SET is_default = false, updated_at = NOW()
        WHERE id != NEW.id
        AND (organization_id = NEW.organization_id OR (organization_id IS NULL AND NEW.organization_id IS NULL))
        AND is_default = true;
END
IF;
    RETURN NEW;
END;
$$;


--
-- Name: fn_stock_document_state_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_stock_document_state_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    valid_transitions TEXT[][] := ARRAY[
        ARRAY['draft',     'submitted'],
        ARRAY['draft',     'canceled'],
        ARRAY['submitted', 'approved'],
        ARRAY['submitted', 'canceled'],
        ARRAY['approved',  'posted'],
        ARRAY['approved',  'canceled']
    ];
pair TEXT[];
BEGIN
    -- Only check status changes
    IF OLD.status = NEW.status THEN
    RETURN NEW;
END
IF;

    -- Check transition is valid
    FOREACH pair SLICE 1 IN ARRAY valid_transitions LOOP
IF OLD.status = pair[1] AND NEW.status = pair[2] THEN
RETURN NEW;
END
IF;
    END LOOP;

    RAISE EXCEPTION 'Invalid stock document status transition: % → % (doc %, id %)',
        OLD.status, NEW.status, OLD.code, OLD.id;
END;
$$;


--
-- Name: FUNCTION fn_stock_document_state_guard(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fn_stock_document_state_guard() IS 'Enforces stock document state machine: draft→submitted→approved→posted, with cancel allowed from any non-posted state.';


--
-- Name: fn_wf_req_line_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_wf_req_line_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: generate_alert_rule_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_alert_rule_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.rule_code IS NULL OR NEW.rule_code = '' THEN
        NEW.rule_code := 'ALR-' || UPPER(LEFT(NEW.rule_type, 3)) || '-' || 
                         LPAD(NEXTVAL('alert_rule_code_seq')::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_audit_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_audit_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    date_part VARCHAR(8);
    seq_num INTEGER;
    new_code VARCHAR(20);
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(audit_code FROM 14 FOR 3) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM audit_sessions
    WHERE audit_code LIKE 'AUD-' || date_part || '-%';
    
    new_code := 'AUD-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
    NEW.audit_code := new_code;
    
    RETURN NEW;
END;
$$;


--
-- Name: generate_checkout_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_checkout_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'CHK-' || LPAD(nextval('checkout_code_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_depreciation_run_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_depreciation_run_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.run_code IS NULL OR NEW.run_code = '' THEN
        NEW.run_code := 'DEP-' || TO_CHAR
    (NOW
    (), 'YYYYMMDD') || '-' || 
                        LPAD
    (NEXTVAL
    ('depreciation_run_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_print_job_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_print_job_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.job_code IS NULL OR NEW.job_code = '' THEN
        NEW.job_code := 'PJ-' || TO_CHAR
    (NOW
    (), 'YYYYMMDD') || '-' || 
                        LPAD
    (NEXTVAL
    ('print_job_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_report_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_report_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.report_code IS NULL OR NEW.report_code = '' THEN
        NEW.report_code := 'RPT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(NEXTVAL('report_code_seq')::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_request_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_request_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
    new_code TEXT;
BEGIN
    -- Format: REQ-YYYYMMDD-XXXX
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CASE 
            WHEN request_code ~ ('^REQ-' || today_date || '-[0-9]{4}$')
            THEN CAST(SUBSTRING(request_code FROM 14 FOR 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO seq_num
    FROM asset_requests
    WHERE request_code LIKE 'REQ-' || today_date || '-%';
    
    new_code := 'REQ-' || today_date || '-' || LPAD(seq_num::TEXT, 4, '0');
    
    NEW.request_code := new_code;
    RETURN NEW;
END;
$_$;


--
-- Name: generate_template_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_template_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.template_code IS NULL OR NEW.template_code = '' THEN
        NEW.template_code := 'TPL-' || LPAD
    (NEXTVAL
    ('template_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$;


--
-- Name: get_accessory_stock_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_accessory_stock_status(p_accessory_id uuid) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_available INTEGER;
    v_min_qty INTEGER;
BEGIN
    SELECT available_quantity, min_quantity
    INTO v_available
    , v_min_qty
    FROM accessories 
    WHERE id = p_accessory_id;

IF v_available = 0 THEN
RETURN 'out_of_stock';
ELSIF v_available <= COALESCE
(v_min_qty, 0) THEN
RETURN 'low_stock';
ELSE
RETURN 'in_stock';
END
IF;
END;
$$;


--
-- Name: set_document_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_document_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: should_send_alert(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.should_send_alert(p_rule_id uuid, p_cooldown_hours integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_last_triggered TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT MAX(triggered_at) INTO v_last_triggered
    FROM alert_history
    WHERE rule_id = p_rule_id
    AND delivery_status = 'sent';
    
    IF v_last_triggered IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN (NOW() - v_last_triggered) > (p_cooldown_hours * INTERVAL '1 hour');
END;
$$;


--
-- Name: update_audit_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_audit_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE audit_sessions
    SET 
        audited_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status != 'pending'
        ),
        found_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'found'
        ),
        missing_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'missing'
        ),
        misplaced_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'misplaced'
        )
    WHERE id = COALESCE(NEW.audit_id, OLD.audit_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_audit_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_audit_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_checkout_overdue_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_checkout_overdue_status() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE asset_checkouts
    SET is_overdue = true
    WHERE status = 'checked_out'
    AND expected_checkin_date IS NOT NULL
    AND expected_checkin_date < CURRENT_DATE
    AND is_overdue = false;
END;
$$;


--
-- Name: update_checkout_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_checkout_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_components_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_components_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_consumables_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_consumables_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_depreciation_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_depreciation_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW
();
RETURN NEW;
END;
$$;


--
-- Name: update_labels_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_labels_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW
();
RETURN NEW;
END;
$$;


--
-- Name: update_request_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_request_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_schedule_after_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_schedule_after_post() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.is_posted = true AND OLD.is_posted = false THEN
    UPDATE depreciation_schedules
        SET 
            accumulated_depreciation = NEW.accumulated_after,
            book_value = NEW.book_value_after,
            status = CASE 
                WHEN NEW.book_value_after <= salvage_value THEN 'fully_depreciated'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;
END
IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    accessory_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    model_number character varying(100),
    category_id uuid,
    manufacturer_id uuid,
    image_url character varying(1000),
    total_quantity integer DEFAULT 0 NOT NULL,
    available_quantity integer DEFAULT 0 NOT NULL,
    min_quantity integer DEFAULT 0,
    unit_price numeric(18,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'VND'::character varying,
    supplier_id uuid,
    purchase_order character varying(100),
    purchase_date date,
    location_id uuid,
    location_name character varying(200),
    notes text,
    organization_id uuid,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accessories_available_quantity_check CHECK ((available_quantity >= 0)),
    CONSTRAINT accessories_min_quantity_check CHECK ((min_quantity >= 0)),
    CONSTRAINT accessories_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying])::text[]))),
    CONSTRAINT accessories_total_quantity_check CHECK ((total_quantity >= 0)),
    CONSTRAINT chk_available_lte_total CHECK ((available_quantity <= total_quantity))
);


--
-- Name: accessory_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    accessory_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    field_name character varying(100),
    old_value jsonb,
    new_value jsonb,
    checkout_id uuid,
    adjustment_id uuid,
    notes text,
    performed_by uuid NOT NULL,
    performed_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_checkouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    accessory_id uuid NOT NULL,
    quantity integer NOT NULL,
    quantity_returned integer DEFAULT 0,
    assignment_type character varying(20) NOT NULL,
    assigned_user_id uuid,
    assigned_asset_id uuid,
    checkout_date timestamp with time zone DEFAULT now() NOT NULL,
    expected_checkin_date date,
    actual_checkin_date timestamp with time zone,
    checked_out_by uuid NOT NULL,
    checked_in_by uuid,
    checkout_notes text,
    checkin_notes text,
    status character varying(20) DEFAULT 'checked_out'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accessory_checkouts_assignment_type_check CHECK (((assignment_type)::text = ANY ((ARRAY['user'::character varying, 'asset'::character varying])::text[]))),
    CONSTRAINT accessory_checkouts_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT accessory_checkouts_quantity_returned_check CHECK ((quantity_returned >= 0)),
    CONSTRAINT accessory_checkouts_status_check CHECK (((status)::text = ANY ((ARRAY['checked_out'::character varying, 'partially_returned'::character varying, 'returned'::character varying])::text[]))),
    CONSTRAINT chk_assignment_target CHECK (((((assignment_type)::text = 'user'::text) AND (assigned_user_id IS NOT NULL)) OR (((assignment_type)::text = 'asset'::text) AND (assigned_asset_id IS NOT NULL)))),
    CONSTRAINT chk_returned_lte_quantity CHECK ((quantity_returned <= quantity))
);


--
-- Name: accessory_manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_manufacturers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    website character varying(500),
    support_url character varying(500),
    support_phone character varying(50),
    support_email character varying(200),
    notes text,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_stock_adjustments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    accessory_id uuid NOT NULL,
    adjustment_type character varying(30) NOT NULL,
    quantity_change integer NOT NULL,
    quantity_before integer NOT NULL,
    quantity_after integer NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    reference_number character varying(100),
    reason text,
    notes text,
    performed_by uuid NOT NULL,
    performed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accessory_stock_adjustments_adjustment_type_check CHECK (((adjustment_type)::text = ANY ((ARRAY['purchase'::character varying, 'return_to_supplier'::character varying, 'lost'::character varying, 'damaged'::character varying, 'inventory_adjustment'::character varying, 'initial_stock'::character varying, 'transfer_in'::character varying, 'transfer_out'::character varying])::text[])))
);


--
-- Name: ai_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_providers (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    api_endpoint text,
    auth_type character varying(50),
    api_key text,
    capabilities jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    rate_limit_per_minute integer,
    credits_remaining numeric(12,4),
    tokens_used bigint,
    last_usage_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_dedup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_dedup (
    dedup_key text NOT NULL,
    last_sent_at timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 1 NOT NULL
);


--
-- Name: alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    triggered_at timestamp with time zone DEFAULT now(),
    trigger_data jsonb NOT NULL,
    affected_count integer DEFAULT 1,
    title character varying(500) NOT NULL,
    message text NOT NULL,
    severity character varying(20) NOT NULL,
    recipients_notified jsonb DEFAULT '[]'::jsonb,
    channel_used character varying(50),
    delivery_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    delivery_error text,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    acknowledgment_note text,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_alert_severity CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT chk_delivery_status CHECK (((delivery_status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'partial'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: alert_rule_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alert_rule_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    rule_type character varying(50) NOT NULL,
    condition_field character varying(100) NOT NULL,
    condition_operator character varying(20) NOT NULL,
    condition_value jsonb NOT NULL,
    condition_query text,
    severity character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    channel character varying(50) DEFAULT 'both'::character varying NOT NULL,
    frequency character varying(20) DEFAULT 'once'::character varying NOT NULL,
    cooldown_hours integer DEFAULT 24,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    recipient_roles jsonb DEFAULT '[]'::jsonb,
    is_builtin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0,
    organization_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_channel CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'in_app'::character varying, 'both'::character varying])::text[]))),
    CONSTRAINT chk_frequency CHECK (((frequency)::text = ANY ((ARRAY['once'::character varying, 'daily'::character varying, 'weekly'::character varying])::text[]))),
    CONSTRAINT chk_rule_type CHECK (((rule_type)::text = ANY ((ARRAY['license'::character varying, 'warranty'::character varying, 'stock'::character varying, 'checkout'::character varying, 'depreciation'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT chk_severity CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: alert_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    target_chat_id text NOT NULL,
    alert_types text[] NOT NULL,
    severity_min text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_subscriptions_severity_min_check CHECK ((severity_min = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: approval_chain_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_chain_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    asset_category_id uuid,
    min_value numeric(18,4),
    max_value numeric(18,4),
    department_id uuid,
    request_type character varying(20),
    priority integer DEFAULT 0,
    steps jsonb NOT NULL,
    is_active boolean DEFAULT true,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: TABLE approval_chain_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_chain_templates IS 'Configurable approval chain templates';


--
-- Name: approval_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    step_order integer NOT NULL,
    approver_id uuid NOT NULL,
    approver_role character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    decision_date timestamp with time zone,
    comments text,
    is_escalated boolean DEFAULT false,
    escalated_from uuid,
    escalated_at timestamp with time zone,
    escalation_reason text,
    reminder_sent_count integer DEFAULT 0,
    last_reminder_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_steps_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT approval_steps_step_order_check CHECK ((step_order > 0))
);


--
-- Name: TABLE approval_steps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_steps IS 'Individual approval steps in the request approval chain';


--
-- Name: COLUMN approval_steps.step_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_steps.step_order IS 'Order in approval chain (1, 2, 3...)';


--
-- Name: COLUMN approval_steps.is_escalated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.approval_steps.is_escalated IS 'Whether this step was escalated from original approver';


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    step_no integer NOT NULL,
    approver_id character varying(255) NOT NULL,
    approver_name character varying(255),
    decision character varying(20),
    note text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approvals_decision_check CHECK (((decision)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: TABLE approvals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approvals IS 'Approval workflow for purchase plans and asset input documents';


--
-- Name: asset_analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    total_assets integer DEFAULT 0 NOT NULL,
    active_assets integer DEFAULT 0 NOT NULL,
    in_repair_assets integer DEFAULT 0 NOT NULL,
    disposed_assets integer DEFAULT 0 NOT NULL,
    unassigned_assets integer DEFAULT 0 NOT NULL,
    warranty_expiring_30d integer DEFAULT 0 NOT NULL,
    warranty_expired integer DEFAULT 0 NOT NULL,
    total_maintenance_tickets integer DEFAULT 0 NOT NULL,
    open_tickets integer DEFAULT 0 NOT NULL,
    avg_repair_hours numeric(10,2),
    category_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    location_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    vendor_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    assignee_type character varying(20) NOT NULL,
    assignee_id character varying(255) NOT NULL,
    assignee_name character varying(255) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    returned_at timestamp with time zone,
    note text,
    location_id uuid,
    organization_id uuid,
    CONSTRAINT asset_assignments_assignee_type_check CHECK (((assignee_type)::text = ANY (ARRAY[('person'::character varying)::text, ('department'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: asset_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    file_name text,
    mime_type text,
    storage_key text,
    size_bytes bigint,
    version integer NOT NULL,
    uploaded_by text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_category_spec_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_category_spec_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    spec_version_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    unit text,
    required boolean DEFAULT false NOT NULL,
    enum_values jsonb,
    pattern text,
    min_len integer,
    max_len integer,
    min_value numeric,
    max_value numeric,
    step_value numeric,
    "precision" integer,
    scale integer,
    "normalize" text,
    default_value jsonb,
    help_text text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_readonly boolean DEFAULT false NOT NULL,
    computed_expr text,
    is_searchable boolean DEFAULT false NOT NULL,
    is_filterable boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_category_spec_defs_field_type_check CHECK ((field_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'enum'::text, 'date'::text, 'ip'::text, 'mac'::text, 'hostname'::text, 'cidr'::text, 'port'::text, 'regex'::text, 'json'::text, 'multi_enum'::text])))
);


--
-- Name: asset_category_spec_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_category_spec_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid NOT NULL,
    version integer NOT NULL,
    status text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_category_spec_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: asset_checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_checkouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    checkout_code character varying(50) NOT NULL,
    asset_id uuid NOT NULL,
    checkout_type character varying(20) DEFAULT 'user'::character varying NOT NULL,
    target_user_id uuid,
    target_location_id uuid,
    target_asset_id uuid,
    checkout_date timestamp with time zone DEFAULT now() NOT NULL,
    expected_checkin_date date,
    checked_out_by uuid NOT NULL,
    checkout_notes text,
    checkin_date timestamp with time zone,
    checked_in_by uuid,
    checkin_notes text,
    checkin_condition character varying(50),
    next_action character varying(50),
    status character varying(20) DEFAULT 'checked_out'::character varying NOT NULL,
    is_overdue boolean DEFAULT false,
    overdue_notified_at timestamp with time zone,
    overdue_notification_count integer DEFAULT 0,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_checkouts_checkout_type_check CHECK (((checkout_type)::text = ANY ((ARRAY['user'::character varying, 'location'::character varying, 'asset'::character varying])::text[]))),
    CONSTRAINT asset_checkouts_status_check CHECK (((status)::text = ANY ((ARRAY['checked_out'::character varying, 'checked_in'::character varying])::text[]))),
    CONSTRAINT chk_checkout_target CHECK (((((checkout_type)::text = 'user'::text) AND (target_user_id IS NOT NULL)) OR (((checkout_type)::text = 'location'::text) AND (target_location_id IS NOT NULL)) OR (((checkout_type)::text = 'asset'::text) AND (target_asset_id IS NOT NULL))))
);


--
-- Name: TABLE asset_checkouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_checkouts IS 'Track asset checkout/checkin for users, locations, or other assets';


--
-- Name: COLUMN asset_checkouts.checkout_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_checkouts.checkout_type IS 'Type: user (to person), location (to room/building), asset (to another asset like docking station)';


--
-- Name: COLUMN asset_checkouts.checkin_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_checkouts.checkin_condition IS 'Condition on return: good/damaged/needs_maintenance';


--
-- Name: COLUMN asset_checkouts.next_action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_checkouts.next_action IS 'What to do after checkin: available/maintenance/retire';


--
-- Name: COLUMN asset_checkouts.is_overdue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_checkouts.is_overdue IS 'True when expected_checkin_date has passed and still checked out';


--
-- Name: asset_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_consumption_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_consumption_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id uuid NOT NULL,
    consumption_date date NOT NULL,
    quantity integer NOT NULL,
    reason character varying(100),
    ref_doc_type character varying(50),
    ref_doc_id uuid,
    note text,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE asset_consumption_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_consumption_logs IS 'Track asset consumption for calculating average usage rates';


--
-- Name: asset_cost_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_cost_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    cost_type character varying(50) NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'VND'::character varying NOT NULL,
    description text,
    recorded_date date DEFAULT CURRENT_DATE NOT NULL,
    recorded_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_cost_records_cost_type_check CHECK (((cost_type)::text = ANY ((ARRAY['purchase'::character varying, 'maintenance'::character varying, 'repair'::character varying, 'upgrade'::character varying, 'disposal'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: asset_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    actor_user_id character varying(255),
    correlation_id character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    ref_doc_type character varying(50),
    ref_doc_id uuid,
    old_snapshot jsonb,
    new_snapshot jsonb
);


--
-- Name: COLUMN asset_events.ref_doc_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_events.ref_doc_type IS 'Document type that caused this event';


--
-- Name: COLUMN asset_events.ref_doc_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_events.ref_doc_id IS 'Document ID that caused this event';


--
-- Name: COLUMN asset_events.old_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_events.old_snapshot IS 'Asset state before event';


--
-- Name: COLUMN asset_events.new_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_events.new_snapshot IS 'Asset state after event';


--
-- Name: asset_increase_docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_increase_docs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doc_no character varying(50) NOT NULL,
    doc_date date NOT NULL,
    increase_type character varying(50) NOT NULL,
    org_unit_id character varying(100),
    org_unit_name character varying(255),
    vendor_id uuid,
    vendor_name character varying(255),
    invoice_no character varying(100),
    invoice_date date,
    total_cost numeric(18,2),
    currency character varying(3) DEFAULT 'VND'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    submitted_by character varying(255),
    submitted_at timestamp with time zone,
    approved_by character varying(255),
    approved_at timestamp with time zone,
    posted_by character varying(255),
    posted_at timestamp with time zone,
    cancelled_by character varying(255),
    cancelled_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    purchase_plan_doc_id uuid,
    note text,
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT asset_increase_docs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying, 'posted'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT asset_increase_docs_type_check CHECK (((increase_type)::text = ANY ((ARRAY['purchase'::character varying, 'donation'::character varying, 'transfer_in'::character varying, 'found'::character varying, 'reclass'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: TABLE asset_increase_docs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_increase_docs IS 'Asset increase documents (Ghi tăng tài sản)';


--
-- Name: asset_increase_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_increase_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doc_id uuid NOT NULL,
    line_no integer NOT NULL,
    asset_code character varying(100),
    asset_name character varying(255) NOT NULL,
    category_id uuid,
    model_id uuid,
    serial_number character varying(100),
    quantity integer DEFAULT 1 NOT NULL,
    unit character varying(50),
    original_cost numeric(18,2) NOT NULL,
    current_value numeric(18,2),
    location_id uuid,
    location_name character varying(255),
    custodian_id character varying(100),
    custodian_name character varying(255),
    acquisition_date date,
    in_service_date date,
    warranty_end_date date,
    specs jsonb DEFAULT '{}'::jsonb,
    note text,
    asset_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_increase_lines_cost_check CHECK ((original_cost >= (0)::numeric)),
    CONSTRAINT asset_increase_lines_qty_check CHECK ((quantity > 0))
);


--
-- Name: TABLE asset_increase_lines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_increase_lines IS 'Line items for asset increase documents';


--
-- Name: asset_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_models (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid,
    spec_version_id uuid,
    vendor_id uuid,
    brand character varying(255),
    model character varying(255) NOT NULL,
    spec jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    min_stock_qty integer DEFAULT 0,
    current_stock_qty integer DEFAULT 0,
    unit character varying(50) DEFAULT 'pcs'::character varying,
    avg_daily_consumption numeric(10,2) DEFAULT 0,
    avg_weekly_consumption numeric(10,2) DEFAULT 0,
    lead_time_days integer DEFAULT 7
);


--
-- Name: COLUMN asset_models.min_stock_qty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_models.min_stock_qty IS 'Minimum stock quantity to trigger purchase suggestion';


--
-- Name: COLUMN asset_models.current_stock_qty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_models.current_stock_qty IS 'Current available stock (updated when assets are added/removed)';


--
-- Name: COLUMN asset_models.avg_daily_consumption; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_models.avg_daily_consumption IS 'Average daily consumption rate';


--
-- Name: COLUMN asset_models.avg_weekly_consumption; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_models.avg_weekly_consumption IS 'Average weekly consumption rate';


--
-- Name: COLUMN asset_models.lead_time_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_models.lead_time_days IS 'Expected delivery time in days';


--
-- Name: asset_performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_value numeric(12,4) NOT NULL,
    unit character varying(20),
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT asset_performance_metrics_metric_type_check CHECK (((metric_type)::text = ANY ((ARRAY['uptime'::character varying, 'response_time'::character varying, 'error_rate'::character varying, 'utilization'::character varying, 'throughput'::character varying, 'temperature'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: asset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_code character varying(50) NOT NULL,
    request_type character varying(20) DEFAULT 'new'::character varying NOT NULL,
    requester_id uuid NOT NULL,
    department_id uuid,
    asset_category_id uuid,
    asset_model_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    current_asset_id uuid,
    justification text NOT NULL,
    priority character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    required_date date,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    approval_chain jsonb,
    total_approval_steps integer DEFAULT 0,
    current_approval_step integer DEFAULT 0,
    fulfilled_by uuid,
    fulfilled_at timestamp with time zone,
    fulfilled_asset_ids jsonb,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    reject_reason text,
    submitted_at timestamp with time zone,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT asset_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT asset_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT asset_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['new'::character varying, 'replacement'::character varying, 'upgrade'::character varying, 'return'::character varying])::text[]))),
    CONSTRAINT asset_requests_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending_approval'::character varying, 'need_info'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'fulfilling'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT chk_justification_length CHECK ((length(TRIM(BOTH FROM justification)) >= 20)),
    CONSTRAINT chk_replacement_asset CHECK (((((request_type)::text = ANY ((ARRAY['replacement'::character varying, 'upgrade'::character varying, 'return'::character varying])::text[])) AND (current_asset_id IS NOT NULL)) OR ((request_type)::text = 'new'::text)))
);


--
-- Name: TABLE asset_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_requests IS 'Asset request submissions for new, replacement, upgrade, or return';


--
-- Name: COLUMN asset_requests.request_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_requests.request_code IS 'Auto-generated: REQ-YYYYMMDD-XXXX';


--
-- Name: COLUMN asset_requests.approval_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_requests.approval_chain IS 'Snapshot of approval chain at submission time';


--
-- Name: COLUMN asset_requests.current_approval_step; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_requests.current_approval_step IS 'Current step in approval flow (1-indexed)';


--
-- Name: asset_status_catalogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_status_catalogs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_code character varying(100) NOT NULL,
    model_id uuid NOT NULL,
    serial_no character varying(255),
    mac_address character varying(50),
    mgmt_ip inet,
    hostname character varying(255),
    vlan_id integer,
    switch_name character varying(255),
    switch_port character varying(100),
    location_id uuid,
    status character varying(20) DEFAULT 'in_stock'::character varying NOT NULL,
    purchase_date date,
    warranty_end date,
    vendor_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    spec jsonb DEFAULT '{}'::jsonb,
    source_doc_type character varying(50),
    source_doc_id uuid,
    source_doc_no character varying(50),
    warehouse_id uuid,
    source_doc_line_id uuid,
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY (ARRAY[('in_stock'::character varying)::text, ('in_use'::character varying)::text, ('in_repair'::character varying)::text, ('retired'::character varying)::text, ('disposed'::character varying)::text, ('lost'::character varying)::text])))
);


--
-- Name: COLUMN assets.spec; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.spec IS 'Asset-specific specifications (can override model specs)';


--
-- Name: COLUMN assets.source_doc_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.source_doc_type IS 'Type of document that created this asset (e.g., asset_increase)';


--
-- Name: COLUMN assets.source_doc_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.source_doc_id IS 'ID of the source document';


--
-- Name: COLUMN assets.source_doc_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.source_doc_no IS 'Document number for quick reference';


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    storage_key text NOT NULL,
    size_bytes bigint,
    version integer DEFAULT 1 NOT NULL,
    uploaded_by text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attachments_entity_type_check CHECK ((entity_type = ANY (ARRAY['repair_order'::text, 'stock_document'::text])))
);


--
-- Name: audit_auditors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_auditors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_location_id uuid,
    is_lead boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_auditors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_auditors IS 'Users assigned to perform audit';


--
-- Name: audit_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_categories IS 'Asset categories included in an audit session';


--
-- Name: audit_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    actor_id uuid NOT NULL,
    old_status character varying(20),
    new_status character varying(20),
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_history IS 'Audit trail for audit sessions';


--
-- Name: audit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    expected_location_id uuid,
    expected_user_id uuid,
    expected_condition character varying(50),
    audit_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    actual_location_id uuid,
    actual_user_id uuid,
    actual_condition character varying(50),
    audited_by uuid,
    audited_at timestamp with time zone,
    notes text,
    resolution_status character varying(20) DEFAULT 'unresolved'::character varying,
    resolution_action text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_items_audit_status_check CHECK (((audit_status)::text = ANY ((ARRAY['pending'::character varying, 'found'::character varying, 'missing'::character varying, 'misplaced'::character varying, 'condition_issue'::character varying])::text[]))),
    CONSTRAINT audit_items_resolution_status_check CHECK (((resolution_status)::text = ANY ((ARRAY['unresolved'::character varying, 'resolved'::character varying, 'pending_action'::character varying, 'ignored'::character varying])::text[])))
);


--
-- Name: TABLE audit_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_items IS 'Individual assets being audited with results';


--
-- Name: COLUMN audit_items.audit_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_items.audit_status IS 'pending=not checked, found=matches system, missing=not found, misplaced=wrong location';


--
-- Name: audit_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    location_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_locations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_locations IS 'Locations included in an audit session';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    correlation_id character varying(100),
    user_id character varying(255),
    action character varying(100) NOT NULL,
    resource character varying(255),
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_code character varying(20),
    name character varying(200) NOT NULL,
    audit_type character varying(20) NOT NULL,
    scope_description text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    notes text,
    total_items integer DEFAULT 0,
    audited_items integer DEFAULT 0,
    found_items integer DEFAULT 0,
    missing_items integer DEFAULT 0,
    misplaced_items integer DEFAULT 0,
    completed_at timestamp with time zone,
    completed_by uuid,
    completion_notes text,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    CONSTRAINT audit_sessions_audit_type_check CHECK (((audit_type)::text = ANY ((ARRAY['full'::character varying, 'partial'::character varying, 'spot_check'::character varying])::text[]))),
    CONSTRAINT audit_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'in_progress'::character varying, 'reviewing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE audit_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_sessions IS 'Asset audit/inventory check sessions';


--
-- Name: COLUMN audit_sessions.audit_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_sessions.audit_type IS 'full=entire inventory, partial=specific locations/categories, spot_check=random sample';


--
-- Name: audit_unregistered_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_unregistered_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    temporary_id character varying(50) NOT NULL,
    description text NOT NULL,
    serial_number character varying(100),
    location_found_id uuid,
    location_found_text character varying(200),
    condition character varying(50),
    photo_path text,
    action character varying(20) DEFAULT 'investigate'::character varying NOT NULL,
    action_notes text,
    registered_asset_id uuid,
    registered_at timestamp with time zone,
    registered_by uuid,
    found_by uuid NOT NULL,
    found_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_unregistered_assets_action_check CHECK (((action)::text = ANY ((ARRAY['register'::character varying, 'investigate'::character varying, 'dispose'::character varying])::text[])))
);


--
-- Name: TABLE audit_unregistered_assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_unregistered_assets IS 'Assets found during audit that are not in the system';


--
-- Name: COLUMN audit_unregistered_assets.action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_unregistered_assets.action IS 'register=add to system, investigate=check origin, dispose=remove/discard';


--
-- Name: channel_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    external_user_id text NOT NULL,
    external_chat_id text NOT NULL,
    user_id uuid,
    status text NOT NULL,
    role_hint text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT channel_bindings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'blocked'::text])))
);


--
-- Name: channel_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    external_chat_id text NOT NULL,
    thread_id text,
    conversation_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT channels_type_check CHECK ((type = ANY (ARRAY['telegram'::text, 'discord'::text, 'email'::text])))
);


--
-- Name: chat_contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_contexts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    context_type character varying(50) NOT NULL,
    content text NOT NULL,
    tokens integer DEFAULT 0,
    priority integer DEFAULT 100,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: checkout_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    checkout_id uuid,
    asset_id uuid,
    action character varying(50) NOT NULL,
    action_type character varying(30) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    performed_by uuid NOT NULL,
    performed_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    notes text
);


--
-- Name: TABLE checkout_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checkout_audit_logs IS 'Audit trail for checkout operations';


--
-- Name: checkout_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checkout_code_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checkout_extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_extensions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    checkout_id uuid NOT NULL,
    previous_expected_date date NOT NULL,
    new_expected_date date NOT NULL,
    extension_reason text,
    extended_by uuid NOT NULL,
    extended_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: TABLE checkout_extensions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checkout_extensions IS 'Track extensions to checkout expected return dates';


--
-- Name: checkout_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    original_checkout_id uuid NOT NULL,
    new_checkout_id uuid NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    transfer_reason text,
    transferred_by uuid NOT NULL,
    transferred_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: TABLE checkout_transfers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checkout_transfers IS 'Track asset transfers between users';


--
-- Name: cmdb_change_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_change_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(300) NOT NULL,
    description text,
    target_ci_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    impact_analysis jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_score numeric(3,1) DEFAULT 0.0 NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by character varying(100),
    reviewed_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_change_assessments_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'analyzing'::character varying, 'reviewed'::character varying, 'approved'::character varying, 'rejected'::character varying, 'executed'::character varying])::text[])))
);


--
-- Name: cmdb_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_changes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    risk text DEFAULT 'medium'::text NOT NULL,
    primary_ci_id uuid,
    impact_snapshot jsonb,
    implementation_plan text,
    rollback_plan text,
    planned_start_at timestamp with time zone,
    planned_end_at timestamp with time zone,
    requested_by text,
    approved_by text,
    implemented_by text,
    implemented_at timestamp with time zone,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_changes_risk_check CHECK ((risk = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT cmdb_changes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'implemented'::text, 'closed'::text, 'canceled'::text])))
);


--
-- Name: cmdb_ci_attr_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_attr_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ci_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    attr_key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_ci_attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_attribute_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ci_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    attribute_key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_ci_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    attr_key character varying(100) NOT NULL,
    attr_label character varying(255) NOT NULL,
    data_type character varying(50) NOT NULL,
    is_required boolean DEFAULT false,
    is_indexed boolean DEFAULT false,
    default_value jsonb,
    validation_rules jsonb DEFAULT '{}'::jsonb,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    ci_type_version_id uuid,
    attribute_key character varying(100),
    attribute_label character varying(255),
    CONSTRAINT cmdb_ci_schemas_data_type_check CHECK (((data_type)::text = ANY (ARRAY[('text'::character varying)::text, ('number'::character varying)::text, ('boolean'::character varying)::text, ('date'::character varying)::text, ('datetime'::character varying)::text, ('json'::character varying)::text, ('url'::character varying)::text, ('email'::character varying)::text, ('select'::character varying)::text, ('multi_select'::character varying)::text])))
);


--
-- Name: cmdb_ci_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_tags (
    ci_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    assigned_by character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    confidence numeric(3,2) DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_ci_tags_assigned_by_check CHECK (((assigned_by)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying, 'ai'::character varying])::text[])))
);


--
-- Name: cmdb_ci_type_attr_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_type_attr_defs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    unit text,
    enum_values jsonb,
    pattern text,
    min_value numeric,
    max_value numeric,
    step_value numeric,
    min_len integer,
    max_len integer,
    default_value jsonb,
    is_searchable boolean DEFAULT false NOT NULL,
    is_filterable boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cmdb_ci_type_attr_defs_field_type_check CHECK ((field_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'enum'::text, 'date'::text, 'ip'::text, 'mac'::text, 'cidr'::text, 'hostname'::text, 'port'::text, 'regex'::text, 'json'::text, 'multi_enum'::text])))
);


--
-- Name: cmdb_ci_type_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_type_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cmdb_ci_type_versions_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('deprecated'::character varying)::text]))),
    CONSTRAINT positive_version CHECK ((version > 0))
);


--
-- Name: cmdb_ci_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_ci_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_cis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_cis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_id uuid NOT NULL,
    asset_id uuid,
    location_id uuid,
    name character varying(255) NOT NULL,
    ci_code character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    environment character varying(50) DEFAULT 'prod'::character varying,
    owner_team character varying(255),
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cmdb_cis_environment_check CHECK (((environment)::text = ANY (ARRAY[('dev'::character varying)::text, ('test'::character varying)::text, ('staging'::character varying)::text, ('prod'::character varying)::text]))),
    CONSTRAINT cmdb_cis_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('decommissioned'::character varying)::text, ('maintenance'::character varying)::text])))
);


--
-- Name: cmdb_config_file_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_config_file_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_file_id uuid NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cmdb_config_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_config_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ci_id uuid NOT NULL,
    name text NOT NULL,
    file_type text DEFAULT 'config'::text NOT NULL,
    language text,
    description text,
    file_path text,
    content text DEFAULT ''::text NOT NULL,
    current_version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT cmdb_config_files_file_type_check CHECK ((file_type = ANY (ARRAY['config'::text, 'script'::text, 'template'::text, 'env'::text, 'other'::text])))
);


--
-- Name: cmdb_discovery_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_discovery_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    discovered_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    confidence numeric(3,2) DEFAULT 0.0 NOT NULL,
    ci_id uuid,
    reviewed_by character varying(100),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_discovery_results_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'rejected'::character varying, 'auto_applied'::character varying])::text[])))
);


--
-- Name: cmdb_discovery_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_discovery_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    discovery_type character varying(50) NOT NULL,
    scope jsonb DEFAULT '[]'::jsonb NOT NULL,
    schedule_cron character varying(100),
    mapping_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    last_status character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_discovery_rules_discovery_type_check CHECK (((discovery_type)::text = ANY ((ARRAY['network_scan'::character varying, 'agent_based'::character varying, 'cloud_api'::character varying, 'manual_import'::character varying])::text[])))
);


--
-- Name: cmdb_impact_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_impact_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    source_ci_type_id uuid,
    relationship_type_id uuid,
    impact_level character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    propagation_depth integer DEFAULT 3 NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cmdb_impact_rules_impact_level_check CHECK (((impact_level)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying, 'info'::character varying])::text[])))
);


--
-- Name: cmdb_relationship_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_relationship_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    reverse_name character varying(255),
    allowed_from_type_id uuid,
    allowed_to_type_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_id uuid NOT NULL,
    from_ci_id uuid NOT NULL,
    to_ci_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT no_self_relationship CHECK ((from_ci_id <> to_ci_id))
);


--
-- Name: cmdb_service_cis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_service_cis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    ci_id uuid NOT NULL,
    dependency_type character varying(50) DEFAULT 'uses'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_service_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_service_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    service_id uuid NOT NULL,
    ci_id uuid NOT NULL,
    role text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cmdb_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    criticality character varying(20) DEFAULT 'normal'::character varying,
    owner character varying(255),
    sla jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cmdb_services_criticality_check CHECK (((criticality)::text = ANY (ARRAY[('low'::character varying)::text, ('normal'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text])))
);


--
-- Name: cmdb_smart_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cmdb_smart_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag_name character varying(100) NOT NULL,
    tag_category character varying(50) DEFAULT 'auto'::character varying NOT NULL,
    color character varying(7) DEFAULT '#3b82f6'::character varying,
    description text,
    auto_assign_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework_id uuid NOT NULL,
    assessment_date date DEFAULT CURRENT_DATE NOT NULL,
    total_controls integer DEFAULT 0 NOT NULL,
    passed_controls integer DEFAULT 0 NOT NULL,
    failed_controls integer DEFAULT 0 NOT NULL,
    not_applicable integer DEFAULT 0 NOT NULL,
    score numeric(5,2) DEFAULT 0,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    assessed_by character varying(100),
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_assessments_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'reviewed'::character varying])::text[])))
);


--
-- Name: compliance_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework_id uuid NOT NULL,
    control_code character varying(50) NOT NULL,
    title character varying(300) NOT NULL,
    description text,
    category character varying(100),
    check_type character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    check_query text,
    severity character varying(20) DEFAULT 'medium'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_controls_check_type_check CHECK (((check_type)::text = ANY ((ARRAY['manual'::character varying, 'automated'::character varying, 'semi_automated'::character varying])::text[])))
);


--
-- Name: compliance_frameworks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_frameworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    version character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: component_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    component_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    serial_numbers text[],
    asset_id uuid NOT NULL,
    installed_at timestamp with time zone DEFAULT now(),
    installed_by uuid NOT NULL,
    installation_notes text,
    removed_at timestamp with time zone,
    removed_by uuid,
    removal_reason character varying(50),
    removal_notes text,
    post_removal_action character varying(20),
    status character varying(20) DEFAULT 'installed'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_assignments_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT component_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['installed'::character varying, 'removed'::character varying])::text[])))
);


--
-- Name: TABLE component_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_assignments IS 'Track component installation into assets';


--
-- Name: COLUMN component_assignments.serial_numbers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_assignments.serial_numbers IS 'Array of serial numbers for individually tracked components';


--
-- Name: COLUMN component_assignments.post_removal_action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_assignments.post_removal_action IS 'What happens after removal: restock (return to available) or dispose (reduce total)';


--
-- Name: component_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    component_id uuid,
    assignment_id uuid,
    receipt_id uuid,
    action character varying(50) NOT NULL,
    action_type character varying(30) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    performed_by uuid NOT NULL,
    performed_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    notes text
);


--
-- Name: TABLE component_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_audit_logs IS 'Audit trail for component operations';


--
-- Name: component_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE component_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_categories IS 'Component classification categories';


--
-- Name: component_manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_manufacturers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    website character varying(500),
    support_url character varying(500),
    support_phone character varying(50),
    support_email character varying(200),
    notes text,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE component_manufacturers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_manufacturers IS 'Component manufacturers/vendors';


--
-- Name: component_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_receipts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    component_id uuid NOT NULL,
    quantity integer NOT NULL,
    serial_numbers text[],
    receipt_type character varying(30) DEFAULT 'purchase'::character varying NOT NULL,
    supplier_id uuid,
    purchase_order character varying(100),
    unit_cost numeric(15,2),
    reference_number character varying(100),
    reference_type character varying(50),
    reference_id uuid,
    received_by uuid NOT NULL,
    received_at timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_receipts_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT component_receipts_receipt_type_check CHECK (((receipt_type)::text = ANY ((ARRAY['purchase'::character varying, 'restock'::character varying, 'transfer'::character varying, 'adjustment'::character varying, 'initial'::character varying])::text[]))),
    CONSTRAINT component_receipts_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: TABLE component_receipts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_receipts IS 'Inventory receipts for components';


--
-- Name: components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.components (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    component_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    model_number character varying(100),
    category_id uuid,
    manufacturer_id uuid,
    component_type character varying(50) DEFAULT 'other'::character varying NOT NULL,
    specifications text,
    image_url character varying(500),
    total_quantity integer DEFAULT 0 NOT NULL,
    available_quantity integer DEFAULT 0 NOT NULL,
    min_quantity integer DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0.00,
    currency character varying(3) DEFAULT 'VND'::character varying,
    supplier_id uuid,
    purchase_order character varying(100),
    purchase_date date,
    location_id uuid,
    location_name character varying(200),
    organization_id uuid,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_component_available_qty CHECK ((available_quantity <= total_quantity)),
    CONSTRAINT components_available_quantity_check CHECK ((available_quantity >= 0)),
    CONSTRAINT components_min_quantity_check CHECK ((min_quantity >= 0)),
    CONSTRAINT components_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying])::text[]))),
    CONSTRAINT components_total_quantity_check CHECK ((total_quantity >= 0)),
    CONSTRAINT components_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: TABLE components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.components IS 'IT components/parts for upgrades and replacements';


--
-- Name: COLUMN components.component_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.components.component_type IS 'Type: ram/ssd/hdd/cpu/gpu/psu/motherboard/network_card/other';


--
-- Name: COLUMN components.total_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.components.total_quantity IS 'Total quantity including installed and available';


--
-- Name: COLUMN components.available_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.components.available_quantity IS 'Quantity available for installation (not installed in assets)';


--
-- Name: consumable_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumable_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    changes jsonb,
    performed_by character varying(100) NOT NULL,
    performed_at timestamp with time zone DEFAULT now(),
    ip_address character varying(45),
    user_agent text,
    notes text
);


--
-- Name: TABLE consumable_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumable_audit_logs IS 'Audit trail for all consumable-related changes';


--
-- Name: consumable_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumable_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE consumable_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumable_categories IS 'Categories for organizing consumables';


--
-- Name: consumable_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumable_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumable_id uuid NOT NULL,
    quantity integer NOT NULL,
    issue_type character varying(20) NOT NULL,
    issued_to_user_id uuid,
    issued_to_department character varying(200),
    issued_to_asset_id uuid,
    issue_date timestamp with time zone DEFAULT now(),
    issued_by character varying(100) NOT NULL,
    reference_number character varying(100),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT consumable_issues_issue_type_check CHECK (((issue_type)::text = ANY ((ARRAY['user'::character varying, 'department'::character varying, 'asset'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT consumable_issues_quantity_check CHECK ((quantity > 0))
);


--
-- Name: TABLE consumable_issues; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumable_issues IS 'Track consumable items issued to users, departments, or assets';


--
-- Name: consumable_manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumable_manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    website character varying(500),
    support_url character varying(500),
    support_phone character varying(50),
    support_email character varying(200),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE consumable_manufacturers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumable_manufacturers IS 'Manufacturers of consumable items';


--
-- Name: consumable_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumable_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumable_id uuid NOT NULL,
    quantity integer NOT NULL,
    receipt_type character varying(20) DEFAULT 'purchase'::character varying,
    purchase_order character varying(100),
    unit_cost numeric(15,2),
    total_cost numeric(15,2),
    receipt_date timestamp with time zone DEFAULT now(),
    supplier_id uuid,
    invoice_number character varying(100),
    received_by character varying(100) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT consumable_receipts_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT consumable_receipts_receipt_type_check CHECK (((receipt_type)::text = ANY ((ARRAY['purchase'::character varying, 'return'::character varying, 'transfer'::character varying, 'adjustment'::character varying, 'initial'::character varying])::text[])))
);


--
-- Name: TABLE consumable_receipts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumable_receipts IS 'Track consumable items received into inventory';


--
-- Name: consumables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumable_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    category_id uuid,
    manufacturer_id uuid,
    model_number character varying(100),
    part_number character varying(100),
    image_url character varying(500),
    unit_of_measure character varying(50) DEFAULT 'unit'::character varying NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    min_quantity integer DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0,
    currency character varying(3) DEFAULT 'VND'::character varying,
    supplier_id uuid,
    purchase_order character varying(100),
    purchase_date date,
    location_id uuid,
    location_name character varying(200),
    notes text,
    organization_id uuid,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by character varying(100) NOT NULL,
    updated_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT consumables_min_quantity_check CHECK ((min_quantity >= 0)),
    CONSTRAINT consumables_quantity_check CHECK ((quantity >= 0)),
    CONSTRAINT consumables_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying])::text[])))
);


--
-- Name: TABLE consumables; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consumables IS 'IT consumable items (ink, paper, cables, batteries, etc.)';


--
-- Name: conversation_token_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_token_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    model character varying(150) NOT NULL,
    provider character varying(100) NOT NULL,
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    cost numeric(12,6) DEFAULT 0,
    message_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    model character varying(255) DEFAULT 'openai/gpt-4o-mini'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dashboard_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(100),
    name character varying(200) DEFAULT 'Default'::character varying NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    widget_type character varying(50) NOT NULL,
    data_source character varying(100) NOT NULL,
    data_query text,
    data_config jsonb DEFAULT '{}'::jsonb,
    default_size character varying(20) DEFAULT 'medium'::character varying,
    min_width integer DEFAULT 1,
    min_height integer DEFAULT 1,
    refresh_interval integer DEFAULT 300,
    is_builtin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    organization_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_widget_type CHECK (((widget_type)::text = ANY ((ARRAY['pie_chart'::character varying, 'bar_chart'::character varying, 'line_chart'::character varying, 'stat_card'::character varying, 'table'::character varying, 'timeline'::character varying, 'list'::character varying, 'map'::character varying])::text[])))
);


--
-- Name: depreciation_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciation_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    depreciation_amount numeric(18,2) NOT NULL,
    accumulated_after numeric(18,2) NOT NULL,
    book_value_after numeric(18,2) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    is_posted boolean DEFAULT false,
    posted_at timestamp with time zone,
    posted_by uuid,
    is_adjustment boolean DEFAULT false,
    adjustment_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_non_negative_amount CHECK ((depreciation_amount >= (0)::numeric)),
    CONSTRAINT chk_period_month CHECK (((period_month >= 1) AND (period_month <= 12)))
);


--
-- Name: TABLE depreciation_entries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.depreciation_entries IS 'Depreciation module: Monthly depreciation entries (Sprint 1.4)';


--
-- Name: depreciation_run_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.depreciation_run_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: depreciation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_code character varying(50) NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    run_type character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    entries_created integer DEFAULT 0,
    entries_posted integer DEFAULT 0,
    total_depreciation numeric(18,2) DEFAULT 0,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    organization_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_run_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT chk_run_type CHECK (((run_type)::text = ANY ((ARRAY['monthly'::character varying, 'adjustment'::character varying, 'closing'::character varying])::text[])))
);


--
-- Name: TABLE depreciation_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.depreciation_runs IS 'Depreciation module: Depreciation run logs (Sprint 1.4)';


--
-- Name: depreciation_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciation_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    depreciation_method character varying(30) DEFAULT 'straight_line'::character varying NOT NULL,
    original_cost numeric(18,2) NOT NULL,
    salvage_value numeric(18,2) DEFAULT 0 NOT NULL,
    useful_life_years integer NOT NULL,
    useful_life_months integer GENERATED ALWAYS AS ((useful_life_years * 12)) STORED,
    start_date date NOT NULL,
    end_date date NOT NULL,
    monthly_depreciation numeric(18,2) NOT NULL,
    accumulated_depreciation numeric(18,2) DEFAULT 0 NOT NULL,
    book_value numeric(18,2) NOT NULL,
    currency character varying(3) DEFAULT 'VND'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    stopped_at date,
    stopped_reason text,
    notes text,
    organization_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_depreciation_method CHECK (((depreciation_method)::text = ANY ((ARRAY['straight_line'::character varying, 'declining_balance'::character varying, 'double_declining'::character varying, 'sum_of_years'::character varying, 'units_of_production'::character varying])::text[]))),
    CONSTRAINT chk_non_negative_book CHECK ((book_value >= (0)::numeric)),
    CONSTRAINT chk_positive_cost CHECK ((original_cost > (0)::numeric)),
    CONSTRAINT chk_positive_life CHECK ((useful_life_years > 0)),
    CONSTRAINT chk_salvage_less_than_cost CHECK ((salvage_value <= original_cost)),
    CONSTRAINT chk_schedule_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'fully_depreciated'::character varying, 'stopped'::character varying])::text[])))
);


--
-- Name: TABLE depreciation_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.depreciation_schedules IS 'Depreciation module: Asset depreciation schedules (Sprint 1.4)';


--
-- Name: COLUMN depreciation_schedules.book_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.depreciation_schedules.book_value IS 'Current book value = original_cost - accumulated_depreciation';


--
-- Name: depreciation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciation_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    value_type character varying(20) DEFAULT 'string'::character varying,
    description text,
    organization_id uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE depreciation_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.depreciation_settings IS 'Depreciation module: System settings (Sprint 1.4)';


--
-- Name: document_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    storage_key text NOT NULL,
    filename text NOT NULL,
    sha256 text,
    size_bytes bigint,
    mime_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_relations (
    document_id uuid NOT NULL,
    relation_type text NOT NULL,
    relation_id text NOT NULL
);


--
-- Name: document_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version_no integer NOT NULL,
    title character varying(200),
    html_content text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    change_note text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by uuid,
    published_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    template_format text DEFAULT 'html'::text NOT NULL,
    binary_content bytea,
    CONSTRAINT chk_document_template_version_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_dtv_template_format CHECK ((template_format = ANY (ARRAY['html'::text, 'docx'::text])))
);


--
-- Name: TABLE document_template_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_template_versions IS 'Version history for each shared document template';


--
-- Name: COLUMN document_template_versions.template_format; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_template_versions.template_format IS 'html = HTML template with {{field}} placeholders; docx = binary .docx with docxtemplater {field} / {#arr}..{/arr} syntax';


--
-- Name: COLUMN document_template_versions.binary_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_template_versions.binary_content IS 'Raw .docx file bytes (non-null when template_format = ''docx'')';


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_code character varying(80) NOT NULL,
    name character varying(160) NOT NULL,
    description text,
    module character varying(50) DEFAULT 'general'::character varying NOT NULL,
    organization_id uuid,
    active_version_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE document_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_templates IS 'Server-managed document templates shared across the system';


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid,
    type text DEFAULT 'other'::text NOT NULL,
    title text NOT NULL,
    summary text,
    content_type text DEFAULT 'file'::text NOT NULL,
    markdown text,
    external_url text,
    visibility text DEFAULT 'team'::text NOT NULL,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    approval_reason text,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    version text DEFAULT '1'::text NOT NULL,
    tags text[],
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fieldkit_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    requested_by text NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    ticket_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fieldkit_approvals_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: fieldkit_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    actor text NOT NULL,
    event_type text NOT NULL,
    detail text NOT NULL,
    ticket_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fieldkit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    author text NOT NULL,
    message text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    ticket_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fieldkit_playbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_playbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    vendor character varying(20) NOT NULL,
    scenario character varying(20) NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fieldkit_playbooks_scenario CHECK (((scenario)::text = ANY ((ARRAY['loss'::character varying, 'loop'::character varying, 'packet-loss'::character varying, 'slow'::character varying])::text[]))),
    CONSTRAINT chk_fieldkit_playbooks_vendor CHECK (((vendor)::text = ANY ((ARRAY['cisco'::character varying, 'mikrotik'::character varying, 'fortigate'::character varying, 'generic'::character varying])::text[])))
);


--
-- Name: fieldkit_quick_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_quick_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    ticket_id text NOT NULL,
    vendor character varying(20) NOT NULL,
    overall_status character varying(10) NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fieldkit_quick_checks_status CHECK (((overall_status)::text = ANY ((ARRAY['pass'::character varying, 'warn'::character varying, 'fail'::character varying])::text[]))),
    CONSTRAINT chk_fieldkit_quick_checks_vendor CHECK (((vendor)::text = ANY ((ARRAY['cisco'::character varying, 'mikrotik'::character varying, 'fortigate'::character varying, 'generic'::character varying])::text[])))
);


--
-- Name: fieldkit_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    quick_check_id uuid,
    summary text NOT NULL,
    notes text,
    ticket_id text NOT NULL,
    visualizer jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fieldkit_snippets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fieldkit_snippets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(80) NOT NULL,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    command text NOT NULL,
    risk character varying(10) NOT NULL,
    vendor character varying(20) NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fieldkit_snippets_risk CHECK (((risk)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT chk_fieldkit_snippets_vendor CHECK (((vendor)::text = ANY ((ARRAY['cisco'::character varying, 'mikrotik'::character varying, 'fortigate'::character varying, 'generic'::character varying, 'any'::character varying])::text[])))
);


--
-- Name: inbound_dedup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_dedup (
    channel_id uuid NOT NULL,
    external_event_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integration_connectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    provider character varying(50) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    credentials_ref character varying(200),
    is_active boolean DEFAULT false NOT NULL,
    health_status character varying(20) DEFAULT 'unknown'::character varying,
    last_health_check timestamp with time zone,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integration_connectors_health_status_check CHECK (((health_status)::text = ANY ((ARRAY['healthy'::character varying, 'degraded'::character varying, 'error'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT integration_connectors_provider_check CHECK (((provider)::text = ANY ((ARRAY['servicenow'::character varying, 'jira'::character varying, 'slack'::character varying, 'teams'::character varying, 'aws'::character varying, 'azure'::character varying, 'email'::character varying, 'webhook'::character varying, 'csv_import'::character varying, 'api_generic'::character varying])::text[])))
);


--
-- Name: integration_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_rule_id uuid NOT NULL,
    direction character varying(20) NOT NULL,
    records_processed integer DEFAULT 0 NOT NULL,
    records_created integer DEFAULT 0 NOT NULL,
    records_updated integer DEFAULT 0 NOT NULL,
    records_failed integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL
);


--
-- Name: integration_sync_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_sync_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connector_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    direction character varying(20) DEFAULT 'inbound'::character varying NOT NULL,
    entity_type character varying(50) NOT NULL,
    field_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    filter_conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    schedule_cron character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status character varying(20),
    last_sync_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integration_sync_rules_direction_check CHECK (((direction)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying, 'bidirectional'::character varying])::text[])))
);


--
-- Name: integration_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connector_id uuid,
    name character varying(200) NOT NULL,
    url character varying(500) NOT NULL,
    secret character varying(200),
    events character varying(50)[] DEFAULT '{}'::character varying[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp with time zone,
    failure_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    asset_id uuid,
    expected_location_id uuid,
    scanned_location_id uuid,
    scanned_at timestamp with time zone,
    status text NOT NULL,
    note text,
    CONSTRAINT inventory_items_status_check CHECK ((status = ANY (ARRAY['found'::text, 'missing'::text, 'moved'::text, 'unknown'::text])))
);


--
-- Name: inventory_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    location_id uuid,
    status text NOT NULL,
    started_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_by text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_sessions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'closed'::text, 'canceled'::text])))
);


--
-- Name: label_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.label_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    value_type character varying(20) DEFAULT 'string'::character varying,
    description text,
    organization_id uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE label_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.label_settings IS 'Labels module: System and organization settings (Sprint 1.4)';


--
-- Name: label_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.label_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    label_type character varying(20) DEFAULT 'combined'::character varying NOT NULL,
    size_preset character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    width_mm numeric(10,2) NOT NULL,
    height_mm numeric(10,2) NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    barcode_type character varying(20) DEFAULT 'code128'::character varying,
    include_logo boolean DEFAULT false,
    include_company_name boolean DEFAULT false,
    font_family character varying(50) DEFAULT 'Arial'::character varying,
    font_size integer DEFAULT 10,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    organization_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_barcode_type CHECK (((barcode_type)::text = ANY ((ARRAY['code128'::character varying, 'code39'::character varying, 'qrcode'::character varying, 'datamatrix'::character varying, 'ean13'::character varying])::text[]))),
    CONSTRAINT chk_label_type CHECK (((label_type)::text = ANY ((ARRAY['barcode'::character varying, 'qrcode'::character varying, 'combined'::character varying])::text[]))),
    CONSTRAINT chk_positive_dimensions CHECK (((width_mm > (0)::numeric) AND (height_mm > (0)::numeric))),
    CONSTRAINT chk_size_preset CHECK (((size_preset)::text = ANY ((ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: TABLE label_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.label_templates IS 'Labels module: Template definitions for asset labels (Sprint 1.4)';


--
-- Name: COLUMN label_templates.layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.label_templates.layout IS 'JSON defining element positions, sizes, and styles';


--
-- Name: COLUMN label_templates.fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.label_templates.fields IS 'Array of field IDs: asset_tag, serial, name, barcode, qrcode, etc.';


--
-- Name: license_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    actor_user_id character varying(255),
    old_values jsonb,
    new_values jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: license_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: license_seats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_seats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_id uuid NOT NULL,
    assignment_type public.seat_assignment_type NOT NULL,
    assigned_user_id uuid,
    assigned_asset_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by character varying(255) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_assignment CHECK ((((assignment_type = 'user'::public.seat_assignment_type) AND (assigned_user_id IS NOT NULL)) OR ((assignment_type = 'asset'::public.seat_assignment_type) AND (assigned_asset_id IS NOT NULL))))
);


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_code character varying(100) NOT NULL,
    software_name character varying(255) NOT NULL,
    supplier_id uuid,
    category_id uuid,
    license_type public.license_type DEFAULT 'per_seat'::public.license_type NOT NULL,
    product_key text,
    seat_count integer DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0,
    currency character varying(3) DEFAULT 'VND'::character varying,
    purchase_date date,
    expiry_date date,
    warranty_date date,
    invoice_number character varying(100),
    notes text,
    status public.license_status DEFAULT 'draft'::public.license_status NOT NULL,
    organization_id uuid,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT licenses_seat_count_check CHECK ((seat_count >= 0)),
    CONSTRAINT licenses_unit_price_check CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT valid_dates CHECK (((expiry_date IS NULL) OR (purchase_date IS NULL) OR (expiry_date >= purchase_date)))
);


--
-- Name: license_usage_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.license_usage_summary AS
 SELECT l.id,
    l.license_code,
    l.software_name,
    l.license_type,
    l.seat_count,
    l.status,
    l.expiry_date,
    count(ls.id) AS seats_used,
    (l.seat_count - count(ls.id)) AS seats_available,
        CASE
            WHEN (l.seat_count = 0) THEN (0)::numeric
            ELSE round((((count(ls.id))::numeric / (l.seat_count)::numeric) * (100)::numeric), 2)
        END AS usage_percentage
   FROM (public.licenses l
     LEFT JOIN public.license_seats ls ON ((l.id = ls.license_id)))
  GROUP BY l.id, l.license_code, l.software_name, l.license_type, l.seat_count, l.status, l.expiry_date;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    path text DEFAULT '/'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid
);


--
-- Name: maintenance_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    diagnosis text,
    resolution text,
    created_by character varying(255),
    correlation_id character varying(100),
    CONSTRAINT maintenance_tickets_severity_check CHECK (((severity)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text]))),
    CONSTRAINT maintenance_tickets_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('in_progress'::character varying)::text, ('closed'::character varying)::text, ('canceled'::character varying)::text])))
);


--
-- Name: message_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id text NOT NULL,
    internal_message_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    external_message_id text NOT NULL,
    thread_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    model character varying(255),
    provider character varying(50),
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    cost numeric(12,4),
    latency_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    tool_calls jsonb,
    tool_call_id character varying(255),
    token_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text, ('tool'::character varying)::text])))
);


--
-- Name: model_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_configs (
    id character varying(100) NOT NULL,
    provider character varying(50) NOT NULL,
    tier integer NOT NULL,
    context_window integer,
    max_tokens integer,
    cost_per_1k_input numeric(10,6),
    cost_per_1k_output numeric(10,6),
    capabilities jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    supports_streaming boolean DEFAULT false,
    supports_functions boolean DEFAULT false,
    supports_vision boolean DEFAULT false,
    description text,
    priority integer DEFAULT 100,
    status character varying(20) DEFAULT 'active'::character varying,
    updated_at timestamp with time zone DEFAULT now(),
    display_name character varying(255),
    CONSTRAINT model_configs_tier_check CHECK (((tier >= 0) AND (tier <= 3)))
);


--
-- Name: model_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_performance (
    model character varying(150) NOT NULL,
    provider character varying(100) NOT NULL,
    date date NOT NULL,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    avg_latency_ms numeric(10,2) DEFAULT 0,
    avg_tokens_per_request numeric(10,2) DEFAULT 0,
    total_cost numeric(12,6) DEFAULT 0,
    quality_score numeric(5,2)
);


--
-- Name: model_usage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_usage_history (
    model character varying(150) NOT NULL,
    usage_date date NOT NULL,
    total_tokens integer DEFAULT 0,
    total_cost numeric(12,6) DEFAULT 0,
    message_count integer DEFAULT 0
);


--
-- Name: notification_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    event_type character varying(50) NOT NULL,
    channel character varying(30) DEFAULT 'ui'::character varying NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    template text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_rules_channel_check CHECK (((channel)::text = ANY ((ARRAY['ui'::character varying, 'email'::character varying, 'slack'::character varying, 'teams'::character varying, 'webhook'::character varying])::text[]))),
    CONSTRAINT notification_rules_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['warranty_expiring'::character varying, 'maintenance_due'::character varying, 'status_changed'::character varying, 'asset_assigned'::character varying, 'asset_returned'::character varying, 'workflow_approved'::character varying, 'workflow_rejected'::character varying, 'threshold_exceeded'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    user_id character varying(100),
    title character varying(300) NOT NULL,
    body text,
    channel character varying(30) DEFAULT 'ui'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    sent_at timestamp with time zone,
    CONSTRAINT notifications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'read'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: ops_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ops_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    actor_user_id text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ops_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['repair_order'::text, 'stock_document'::text, 'spare_part'::text, 'warehouse'::text, 'asset_category'::text, 'cmdb_ci'::text, 'cmdb_rel'::text, 'cmdb_service'::text, 'cmdb_type'::text, 'cmdb_schema'::text, 'cmdb_change'::text])))
);


--
-- Name: orchestration_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    strategy character varying(50) NOT NULL,
    model_sequence jsonb NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true,
    priority integer DEFAULT 100,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: org_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    path text DEFAULT '/'::text NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    code character varying(50),
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ou_organization_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ou_organization_mappings (
    ou_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pending_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_actions (
    action_id uuid NOT NULL,
    conversation_id text NOT NULL,
    correlation_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    external_chat_id text NOT NULL,
    external_user_id text NOT NULL,
    action_kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    requires_reason boolean DEFAULT false NOT NULL,
    status text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    CONSTRAINT pending_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text, 'executed'::text])))
);


--
-- Name: rbac_acl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_acl (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_type character varying(10) NOT NULL,
    principal_user_id uuid,
    principal_group_id uuid,
    role_id uuid NOT NULL,
    scope_type character varying(10) DEFAULT 'GLOBAL'::character varying NOT NULL,
    scope_ou_id uuid,
    scope_resource character varying(500),
    effect character varying(5) DEFAULT 'ALLOW'::character varying NOT NULL,
    inherit boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_acl_principal_xor CHECK (((((principal_type)::text = 'USER'::text) AND (principal_user_id IS NOT NULL) AND (principal_group_id IS NULL)) OR (((principal_type)::text = 'GROUP'::text) AND (principal_group_id IS NOT NULL) AND (principal_user_id IS NULL)))),
    CONSTRAINT chk_acl_scope CHECK (((((scope_type)::text = 'GLOBAL'::text) AND (scope_ou_id IS NULL)) OR (((scope_type)::text = 'OU'::text) AND (scope_ou_id IS NOT NULL)) OR (((scope_type)::text = 'RESOURCE'::text) AND (scope_resource IS NOT NULL)))),
    CONSTRAINT rbac_acl_effect_check CHECK (((effect)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[]))),
    CONSTRAINT rbac_acl_principal_type_check CHECK (((principal_type)::text = ANY ((ARRAY['USER'::character varying, 'GROUP'::character varying])::text[]))),
    CONSTRAINT rbac_acl_scope_type_check CHECK (((scope_type)::text = ANY ((ARRAY['GLOBAL'::character varying, 'OU'::character varying, 'RESOURCE'::character varying])::text[])))
);


--
-- Name: rbac_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    email character varying(255),
    ou_id uuid NOT NULL,
    linked_user_id uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rbac_users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'disabled'::character varying, 'locked'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    username character varying(255),
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    tier character varying(50) DEFAULT 'free'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    theme_settings jsonb,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['root'::character varying, 'admin'::character varying, 'super_admin'::character varying, 'it_asset_manager'::character varying, 'warehouse_keeper'::character varying, 'accountant'::character varying, 'technician'::character varying, 'requester'::character varying, 'user'::character varying, 'viewer'::character varying])::text[])))
);


--
-- Name: permission_center_assignments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.permission_center_assignments AS
 SELECT 'classic'::text AS source,
    'USER'::text AS principal_type,
    ru.id AS principal_rbac_user_id,
    rr.id AS role_id,
    rr.key AS role_key,
    'GLOBAL'::text AS scope_type,
    NULL::uuid AS scope_ou_id,
    NULL::text AS scope_resource,
    'ALLOW'::text AS effect,
    true AS inherit,
    u.updated_at AS created_at
   FROM ((public.users u
     JOIN public.rbac_users ru ON ((ru.linked_user_id = u.id)))
     JOIN public.rbac_roles rr ON (((rr.key)::text =
        CASE
            WHEN ((u.role)::text = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::text[])) THEN 'full_admin'::text
            WHEN ((u.role)::text = ANY ((ARRAY['it_asset_manager'::character varying, 'it_manager'::character varying, 'manager'::character varying])::text[])) THEN 'it_admin'::text
            WHEN ((u.role)::text = ANY ((ARRAY['warehouse_keeper'::character varying, 'warehouse_staff'::character varying, 'storekeeper'::character varying])::text[])) THEN 'warehouse_mgr'::text
            WHEN ((u.role)::text = 'technician'::text) THEN 'technician'::text
            WHEN ((u.role)::text = ANY ((ARRAY['requester'::character varying, 'user'::character varying, 'helpdesk'::character varying])::text[])) THEN 'helpdesk'::text
            WHEN ((u.role)::text = 'viewer'::text) THEN 'viewer'::text
            ELSE NULL::text
        END)))
  WHERE (u.role IS NOT NULL)
UNION ALL
 SELECT 'directory'::text AS source,
    a.principal_type,
    a.principal_user_id AS principal_rbac_user_id,
    a.role_id,
    rr.key AS role_key,
    a.scope_type,
    a.scope_ou_id,
    a.scope_resource,
    a.effect,
    a.inherit,
    a.created_at
   FROM (public.rbac_acl a
     JOIN public.rbac_roles rr ON ((rr.id = a.role_id)))
  WHERE ((a.principal_type)::text = 'USER'::text);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rbac_ad_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_ad_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_center_permissions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.permission_center_permissions AS
 SELECT 'classic'::text AS source,
    p.id,
    p.name AS permission_key,
    p.description,
    p.created_at,
    NULL::timestamp with time zone AS updated_at
   FROM public.permissions p
UNION ALL
 SELECT 'directory'::text AS source,
    p.id,
    p.key AS permission_key,
    p.description,
    p.created_at,
    NULL::timestamp with time zone AS updated_at
   FROM public.rbac_ad_permissions p;


--
-- Name: rbac_role_ad_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_role_ad_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: permission_center_role_permissions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.permission_center_role_permissions AS
 SELECT 'classic'::text AS source,
    r.slug AS role_key,
    p.name AS permission_key,
    NULL::timestamp with time zone AS created_at
   FROM ((public.role_permissions rp
     JOIN public.roles r ON ((r.id = rp.role_id)))
     JOIN public.permissions p ON ((p.id = rp.permission_id)))
UNION ALL
 SELECT 'directory'::text AS source,
    rr.key AS role_key,
    p.key AS permission_key,
    NULL::timestamp with time zone AS created_at
   FROM ((public.rbac_role_ad_permissions rp
     JOIN public.rbac_roles rr ON ((rr.id = rp.role_id)))
     JOIN public.rbac_ad_permissions p ON ((p.id = rp.permission_id)));


--
-- Name: permission_center_roles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.permission_center_roles AS
 SELECT 'classic'::text AS source,
    r.id,
    r.slug AS role_key,
    r.name,
    r.description,
    r.is_system,
    r.created_at,
    r.updated_at
   FROM public.roles r
UNION ALL
 SELECT 'directory'::text AS source,
    rr.id,
    rr.key AS role_key,
    rr.name,
    rr.description,
    rr.is_system,
    rr.created_at,
    rr.updated_at
   FROM public.rbac_roles rr;


--
-- Name: policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: policy_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_id uuid NOT NULL,
    principal_type character varying(10) NOT NULL,
    principal_id uuid NOT NULL,
    scope_type character varying(10) DEFAULT 'GLOBAL'::character varying NOT NULL,
    scope_ou_id uuid,
    scope_resource text,
    effect character varying(5) DEFAULT 'ALLOW'::character varying NOT NULL,
    inherit boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_assignments_effect_check CHECK (((effect)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[]))),
    CONSTRAINT policy_assignments_principal_type_check CHECK (((principal_type)::text = ANY ((ARRAY['USER'::character varying, 'GROUP'::character varying, 'OU'::character varying])::text[]))),
    CONSTRAINT policy_assignments_scope_type_check CHECK (((scope_type)::text = ANY ((ARRAY['GLOBAL'::character varying, 'OU'::character varying, 'RESOURCE'::character varying])::text[])))
);


--
-- Name: policy_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_permissions (
    policy_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: print_job_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.print_job_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: print_job_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_job_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    print_job_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    copy_number integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    label_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE print_job_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.print_job_items IS 'Labels module: Individual label items in print jobs (Sprint 1.4)';


--
-- Name: print_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_code character varying(50) NOT NULL,
    template_id uuid NOT NULL,
    asset_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    asset_count integer DEFAULT 0 NOT NULL,
    copies_per_asset integer DEFAULT 1 NOT NULL,
    total_labels integer DEFAULT 0 NOT NULL,
    printer_name character varying(100),
    paper_size character varying(50),
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    error_message text,
    output_type character varying(20) DEFAULT 'pdf'::character varying,
    output_url text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    organization_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_job_status CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_output_type CHECK (((output_type)::text = ANY ((ARRAY['pdf'::character varying, 'direct'::character varying, 'preview'::character varying])::text[]))),
    CONSTRAINT chk_positive_copies CHECK ((copies_per_asset > 0))
);


--
-- Name: TABLE print_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.print_jobs IS 'Labels module: Print job records and history (Sprint 1.4)';


--
-- Name: provider_usage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_usage_history (
    provider character varying(100) NOT NULL,
    usage_date date NOT NULL,
    total_tokens integer DEFAULT 0,
    total_cost numeric(12,6) DEFAULT 0,
    credits_used numeric(12,6) DEFAULT 0
);


--
-- Name: purchase_plan_docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_plan_docs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doc_no character varying(50) NOT NULL,
    doc_date date NOT NULL,
    fiscal_year integer NOT NULL,
    org_unit_id character varying(100),
    org_unit_name character varying(255),
    title character varying(500) NOT NULL,
    description text,
    total_estimated_cost numeric(18,2),
    currency character varying(3) DEFAULT 'VND'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    submitted_by character varying(255),
    submitted_at timestamp with time zone,
    approved_by character varying(255),
    approved_at timestamp with time zone,
    posted_by character varying(255),
    posted_at timestamp with time zone,
    cancelled_by character varying(255),
    cancelled_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT purchase_plan_docs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying, 'posted'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE purchase_plan_docs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.purchase_plan_docs IS 'Purchase plan documents for asset procurement planning';


--
-- Name: purchase_plan_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_plan_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doc_id uuid NOT NULL,
    line_no integer NOT NULL,
    model_id uuid,
    category_id uuid,
    item_description character varying(500) NOT NULL,
    quantity integer NOT NULL,
    unit character varying(50),
    estimated_unit_cost numeric(18,2),
    estimated_total_cost numeric(18,2),
    suggestion_reason character varying(100),
    current_stock integer,
    min_stock integer,
    avg_consumption numeric(10,2),
    days_until_stockout integer,
    funding_source character varying(255),
    purpose text,
    expected_delivery_date date,
    using_dept character varying(255),
    priority character varying(20) DEFAULT 'medium'::character varying,
    specs jsonb DEFAULT '{}'::jsonb,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_plan_lines_priority_check CHECK (((priority)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT purchase_plan_lines_qty_check CHECK ((quantity > 0))
);


--
-- Name: TABLE purchase_plan_lines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.purchase_plan_lines IS 'Purchase plan line items with auto-suggestion support';


--
-- Name: rbac_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    member_type character varying(10) NOT NULL,
    member_user_id uuid,
    member_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_member_xor CHECK (((((member_type)::text = 'USER'::text) AND (member_user_id IS NOT NULL) AND (member_group_id IS NULL)) OR (((member_type)::text = 'GROUP'::text) AND (member_group_id IS NOT NULL) AND (member_user_id IS NULL)))),
    CONSTRAINT rbac_group_members_member_type_check CHECK (((member_type)::text = ANY ((ARRAY['USER'::character varying, 'GROUP'::character varying])::text[])))
);


--
-- Name: rbac_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    ou_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    module character varying(50) NOT NULL,
    action character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rbac_permissions_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'read'::character varying, 'update'::character varying, 'delete'::character varying, 'execute'::character varying, 'approve'::character varying, 'export'::character varying])::text[])))
);


--
-- Name: rbac_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_role_permissions (
    role character varying(50) NOT NULL,
    permission_id uuid NOT NULL,
    granted_by character varying(100),
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reminder_type text NOT NULL,
    asset_id uuid,
    due_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    channel text DEFAULT 'ui'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    correlation_id text,
    CONSTRAINT reminders_reminder_type_check CHECK ((reminder_type = ANY (ARRAY['warranty_expiring'::text, 'maintenance_due'::text]))),
    CONSTRAINT reminders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'canceled'::text])))
);


--
-- Name: repair_order_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_order_parts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    repair_order_id uuid NOT NULL,
    part_id uuid,
    part_name text,
    warehouse_id uuid,
    action text NOT NULL,
    qty integer NOT NULL,
    unit_cost numeric(12,2),
    serial_no text,
    note text,
    stock_document_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT repair_order_parts_action_check CHECK ((action = ANY (ARRAY['replace'::text, 'add'::text, 'remove'::text, 'upgrade'::text]))),
    CONSTRAINT repair_order_parts_qty_check CHECK ((qty > 0))
);


--
-- Name: repair_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    severity text NOT NULL,
    status text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    diagnosis text,
    resolution text,
    repair_type text NOT NULL,
    technician_name text,
    vendor_id uuid,
    labor_cost numeric(12,2) DEFAULT 0,
    parts_cost numeric(12,2) DEFAULT 0,
    downtime_minutes integer,
    created_by text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ci_id uuid,
    CONSTRAINT repair_orders_repair_type_check CHECK ((repair_type = ANY (ARRAY['internal'::text, 'vendor'::text]))),
    CONSTRAINT repair_orders_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT repair_orders_status_check CHECK ((status = ANY (ARRAY['open'::text, 'diagnosing'::text, 'waiting_parts'::text, 'repaired'::text, 'closed'::text, 'canceled'::text])))
);


--
-- Name: report_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    report_type character varying(50) NOT NULL,
    data_source character varying(100) NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    filters jsonb DEFAULT '[]'::jsonb,
    default_filters jsonb DEFAULT '{}'::jsonb,
    "grouping" jsonb DEFAULT '[]'::jsonb,
    sorting jsonb DEFAULT '[]'::jsonb,
    chart_config jsonb DEFAULT '{}'::jsonb,
    access_level character varying(50) DEFAULT 'all'::character varying NOT NULL,
    allowed_roles jsonb DEFAULT '[]'::jsonb,
    is_scheduled boolean DEFAULT false,
    schedule_cron character varying(100),
    schedule_recipients jsonb DEFAULT '[]'::jsonb,
    schedule_format character varying(20) DEFAULT 'excel'::character varying,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    is_builtin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_favorite boolean DEFAULT false,
    view_count integer DEFAULT 0,
    organization_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_access_level CHECK (((access_level)::text = ANY ((ARRAY['all'::character varying, 'admin'::character varying, 'asset_manager'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT chk_report_type CHECK (((report_type)::text = ANY ((ARRAY['dashboard'::character varying, 'tabular'::character varying, 'chart'::character varying, 'scheduled'::character varying])::text[])))
);


--
-- Name: report_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    execution_type character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    filters_used jsonb DEFAULT '{}'::jsonb,
    row_count integer,
    file_path character varying(500),
    file_format character varying(20),
    file_size_bytes integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms integer,
    error_message text,
    recipients jsonb DEFAULT '[]'::jsonb,
    delivery_status character varying(20),
    delivery_error text,
    executed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_execution_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT chk_execution_type CHECK (((execution_type)::text = ANY ((ARRAY['manual'::character varying, 'scheduled'::character varying])::text[])))
);


--
-- Name: request_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(100),
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: TABLE request_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.request_attachments IS 'Files attached to asset requests';


--
-- Name: request_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_id uuid NOT NULL,
    old_status character varying(30),
    new_status character varying(30),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE request_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.request_audit_logs IS 'Audit trail for all request-related events';


--
-- Name: request_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    comment_type character varying(20) DEFAULT 'comment'::character varying NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    approval_step_id uuid,
    parent_comment_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT request_comments_comment_type_check CHECK (((comment_type)::text = ANY ((ARRAY['comment'::character varying, 'info_request'::character varying, 'info_response'::character varying])::text[])))
);


--
-- Name: TABLE request_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.request_comments IS 'Comments and info request/response threads';


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    task_type character varying(50) NOT NULL,
    cron_expression character varying(100) DEFAULT '0 8 * * *'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    last_status character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_tasks_last_status_check CHECK (((last_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'running'::character varying])::text[]))),
    CONSTRAINT scheduled_tasks_task_type_check CHECK (((task_type)::text = ANY ((ARRAY['warranty_check'::character varying, 'maintenance_reminder'::character varying, 'report_generation'::character varying, 'data_cleanup'::character varying, 'sync_external'::character varying, 'custom'::character varying])::text[])))
);





--
-- Name: security_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(100),
    action character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(200),
    ip_address character varying(45),
    user_agent text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_audit_logs_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['info'::character varying, 'low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(500) NOT NULL,
    refresh_token character varying(500) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    refresh_expires_at timestamp with time zone NOT NULL,
    ip_address character varying(45),
    user_agent text,
    is_revoked boolean DEFAULT false,
    last_activity_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: spare_part_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_part_lots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    warehouse_id uuid NOT NULL,
    part_id uuid NOT NULL,
    lot_number character varying(100) NOT NULL,
    serial_no character varying(100) DEFAULT NULL::character varying,
    manufacture_date date,
    expiry_date date,
    on_hand integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT spare_part_lots_on_hand_check CHECK ((on_hand >= 0)),
    CONSTRAINT spare_part_lots_reserved_check CHECK ((reserved >= 0)),
    CONSTRAINT spare_part_lots_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'consumed'::character varying])::text[])))
);


--
-- Name: spare_part_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_part_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    warehouse_id uuid NOT NULL,
    part_id uuid NOT NULL,
    movement_type text NOT NULL,
    qty integer NOT NULL,
    unit_cost numeric(12,2),
    ref_type text,
    ref_id uuid,
    actor_user_id text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT spare_part_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjust_in'::text, 'adjust_out'::text, 'transfer_in'::text, 'transfer_out'::text, 'reserve'::text, 'release'::text]))),
    CONSTRAINT spare_part_movements_qty_check CHECK ((qty > 0))
);


--
-- Name: spare_part_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_part_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    warehouse_id uuid NOT NULL,
    part_id uuid NOT NULL,
    on_hand integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT spare_part_stock_on_hand_nonneg CHECK ((on_hand >= 0)),
    CONSTRAINT spare_part_stock_reserved_nonneg CHECK ((reserved >= 0))
);


--
-- Name: spare_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_parts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    part_code text NOT NULL,
    name text NOT NULL,
    category text,
    uom text DEFAULT 'pcs'::text,
    manufacturer text,
    model text,
    spec jsonb DEFAULT '{}'::jsonb,
    min_level integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    unit_cost numeric(15,2) DEFAULT 0
);


--
-- Name: stock_doc_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_doc_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_document_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_document_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_id uuid NOT NULL,
    part_id uuid,
    qty integer NOT NULL,
    unit_cost numeric(12,2),
    serial_no text,
    note text,
    adjust_direction text,
    spec_fields jsonb,
    line_type character varying(20) DEFAULT 'spare_part'::character varying NOT NULL,
    asset_model_id uuid,
    asset_category_id uuid,
    asset_name character varying(255),
    asset_code character varying(100),
    asset_id uuid,
    CONSTRAINT stock_doc_lines_content_chk CHECK (((part_id IS NOT NULL) OR (asset_model_id IS NOT NULL) OR (asset_id IS NOT NULL))),
    CONSTRAINT stock_doc_lines_type_chk CHECK (((line_type)::text = ANY ((ARRAY['spare_part'::character varying, 'asset'::character varying])::text[]))),
    CONSTRAINT stock_document_lines_adjust_direction_check CHECK (((adjust_direction IS NULL) OR (adjust_direction = ANY (ARRAY['plus'::text, 'minus'::text])))),
    CONSTRAINT stock_document_lines_qty_check CHECK ((qty > 0))
);


--
-- Name: stock_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doc_type text NOT NULL,
    code text NOT NULL,
    status text NOT NULL,
    warehouse_id uuid,
    target_warehouse_id uuid,
    doc_date date DEFAULT CURRENT_DATE NOT NULL,
    ref_type text,
    ref_id uuid,
    note text,
    created_by text,
    approved_by text,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    idempotency_key character varying(255) DEFAULT NULL::character varying,
    posted_at timestamp with time zone,
    posted_by text,
    rejected_at timestamp with time zone,
    rejected_by text,
    ref_request_id uuid,
    supplier character varying(255) DEFAULT NULL::character varying,
    submitter_name character varying(255) DEFAULT NULL::character varying,
    receiver_name character varying(255) DEFAULT NULL::character varying,
    department character varying(255) DEFAULT NULL::character varying,
    location_id uuid,
    CONSTRAINT stock_documents_doc_type_check CHECK ((doc_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'adjust'::text, 'transfer'::text]))),
    CONSTRAINT stock_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'posted'::text, 'canceled'::text])))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    contact_name character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    address text,
    website character varying(255),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: template_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.template_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    model_id character varying(100),
    tier integer NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    total_cost numeric(10,6),
    quality_score numeric(3,2),
    escalated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_alert_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_alert_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    digest_frequency character varying(20) DEFAULT 'immediate'::character varying,
    digest_time time without time zone DEFAULT '09:00:00'::time without time zone,
    digest_day integer DEFAULT 1,
    email_min_severity character varying(20) DEFAULT 'warning'::character varying,
    muted_rules jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_digest_freq CHECK (((digest_frequency)::text = ANY ((ARRAY['immediate'::character varying, 'daily'::character varying, 'weekly'::character varying])::text[]))),
    CONSTRAINT chk_min_severity CHECK (((email_min_severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: user_dashboard_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_dashboard_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    dashboard_type character varying(50) DEFAULT 'main'::character varying NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_token_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_token_stats (
    user_id character varying(255) NOT NULL,
    date date NOT NULL,
    model character varying(150) NOT NULL,
    provider character varying(100) NOT NULL,
    total_tokens integer DEFAULT 0,
    total_cost numeric(12,6) DEFAULT 0,
    message_count integer DEFAULT 0,
    conversation_count integer DEFAULT 0
);


--
-- Name: v_accessories_with_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_accessories_with_stock AS
 SELECT a.id,
    a.accessory_code,
    a.name,
    a.model_number,
    a.category_id,
    a.manufacturer_id,
    a.image_url,
    a.total_quantity,
    a.available_quantity,
    a.min_quantity,
    a.unit_price,
    a.currency,
    a.supplier_id,
    a.purchase_order,
    a.purchase_date,
    a.location_id,
    a.location_name,
    a.notes,
    a.organization_id,
    a.status,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at,
    c.name AS category_name,
    m.name AS manufacturer_name,
    s.name AS supplier_name,
    (a.total_quantity - a.available_quantity) AS checked_out_quantity,
    public.get_accessory_stock_status(a.id) AS stock_status,
        CASE
            WHEN (a.available_quantity = 0) THEN 'out_of_stock'::text
            WHEN (a.available_quantity <= COALESCE(a.min_quantity, 0)) THEN 'low_stock'::text
            ELSE 'in_stock'::text
        END AS stock_badge
   FROM (((public.accessories a
     LEFT JOIN public.accessory_categories c ON ((a.category_id = c.id)))
     LEFT JOIN public.accessory_manufacturers m ON ((a.manufacturer_id = m.id)))
     LEFT JOIN public.suppliers s ON ((a.supplier_id = s.id)));


--
-- Name: v_accessory_active_checkouts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_accessory_active_checkouts AS
 SELECT co.id,
    co.accessory_id,
    co.quantity,
    co.quantity_returned,
    co.assignment_type,
    co.assigned_user_id,
    co.assigned_asset_id,
    co.checkout_date,
    co.expected_checkin_date,
    co.actual_checkin_date,
    co.checked_out_by,
    co.checked_in_by,
    co.checkout_notes,
    co.checkin_notes,
    co.status,
    co.created_at,
    co.updated_at,
    a.name AS accessory_name,
    a.accessory_code,
    (co.quantity - co.quantity_returned) AS remaining_quantity,
        CASE
            WHEN (co.expected_checkin_date < CURRENT_DATE) THEN true
            ELSE false
        END AS is_overdue
   FROM (public.accessory_checkouts co
     JOIN public.accessories a ON ((co.accessory_id = a.id)))
  WHERE ((co.status)::text = ANY ((ARRAY['checked_out'::character varying, 'partially_returned'::character varying])::text[]));


--
-- Name: v_active_audits; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_active_audits AS
 SELECT a.id,
    a.audit_code,
    a.name,
    a.audit_type,
    a.scope_description,
    a.start_date,
    a.end_date,
    a.status,
    a.total_items,
    a.audited_items,
    a.found_items,
    a.missing_items,
    a.misplaced_items,
        CASE
            WHEN (a.total_items > 0) THEN round((((a.audited_items)::numeric / (a.total_items)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS progress_percent,
    a.organization_id,
    a.created_at,
    u.name AS created_by_name,
    ( SELECT string_agg((l.name)::text, ', '::text) AS string_agg
           FROM (public.audit_locations al
             JOIN public.locations l ON ((al.location_id = l.id)))
          WHERE (al.audit_id = a.id)) AS locations,
    ( SELECT count(*) AS count
           FROM public.audit_auditors
          WHERE (audit_auditors.audit_id = a.id)) AS auditor_count
   FROM (public.audit_sessions a
     LEFT JOIN public.users u ON ((a.created_by = u.id)))
  WHERE ((a.status)::text = ANY ((ARRAY['draft'::character varying, 'in_progress'::character varying, 'reviewing'::character varying])::text[]));


--
-- Name: v_active_checkouts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_active_checkouts AS
 SELECT id,
    checkout_code,
    asset_id,
    checkout_type,
    target_user_id,
    target_location_id,
    target_asset_id,
    checkout_date,
    expected_checkin_date,
    checked_out_by,
    checkout_notes,
    is_overdue,
    organization_id,
    created_at,
        CASE
            WHEN (expected_checkin_date IS NULL) THEN 'indefinite'::text
            WHEN (expected_checkin_date < CURRENT_DATE) THEN 'overdue'::text
            WHEN (expected_checkin_date <= (CURRENT_DATE + '3 days'::interval)) THEN 'due_soon'::text
            ELSE 'on_track'::text
        END AS checkout_status,
        CASE
            WHEN (expected_checkin_date IS NULL) THEN NULL::integer
            ELSE (expected_checkin_date - CURRENT_DATE)
        END AS days_until_due
   FROM public.asset_checkouts c
  WHERE ((status)::text = 'checked_out'::text);


--
-- Name: VIEW v_active_checkouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_active_checkouts IS 'Active checkouts with status indicators (overdue/due_soon/on_track)';


--
-- Name: v_active_label_templates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_active_label_templates AS
 SELECT lt.id,
    lt.template_code,
    lt.name,
    lt.description,
    lt.label_type,
    lt.size_preset,
    lt.width_mm,
    lt.height_mm,
    lt.layout,
    lt.fields,
    lt.barcode_type,
    lt.include_logo,
    lt.include_company_name,
    lt.font_family,
    lt.font_size,
    lt.is_default,
    lt.is_active,
    lt.organization_id,
    lt.created_by,
    lt.updated_by,
    lt.created_at,
    lt.updated_at,
    u.name AS created_by_name,
    ( SELECT count(*) AS count
           FROM public.print_jobs pj
          WHERE (pj.template_id = lt.id)) AS usage_count
   FROM (public.label_templates lt
     LEFT JOIN public.users u ON ((lt.created_by = u.id)))
  WHERE (lt.is_active = true);


--
-- Name: v_alert_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_alert_rules AS
 SELECT a.id,
    a.rule_code,
    a.name,
    a.description,
    a.rule_type,
    a.condition_field,
    a.condition_operator,
    a.condition_value,
    a.condition_query,
    a.severity,
    a.channel,
    a.frequency,
    a.cooldown_hours,
    a.recipients,
    a.recipient_roles,
    a.is_builtin,
    a.is_active,
    a.last_triggered_at,
    a.trigger_count,
    a.organization_id,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at,
    u.name AS created_by_name,
    ( SELECT count(*) AS count
           FROM public.alert_history
          WHERE (alert_history.rule_id = a.id)) AS total_triggers,
    ( SELECT count(*) AS count
           FROM public.alert_history
          WHERE ((alert_history.rule_id = a.id) AND (alert_history.triggered_at > (now() - '30 days'::interval)))) AS triggers_last_30_days,
    ( SELECT count(*) AS count
           FROM public.alert_history
          WHERE ((alert_history.rule_id = a.id) AND (alert_history.is_acknowledged = false))) AS unacknowledged_count
   FROM (public.alert_rules a
     LEFT JOIN public.users u ON ((a.created_by = u.id)));


--
-- Name: v_approval_queue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_approval_queue AS
 SELECT r.id AS request_id,
    r.request_code,
    r.request_type,
    r.requester_id,
    r.quantity,
    r.priority,
    r.required_date,
    r.status AS request_status,
    r.justification,
    r.submitted_at,
    s.id AS approval_step_id,
    s.step_order,
    s.approver_id,
    s.approver_role,
    s.status AS step_status,
    s.reminder_sent_count,
    s.last_reminder_sent_at,
    EXTRACT(day FROM (now() - COALESCE(s.created_at, r.submitted_at))) AS days_waiting
   FROM (public.asset_requests r
     JOIN public.approval_steps s ON ((r.id = s.request_id)))
  WHERE (((r.status)::text = 'pending_approval'::text) AND (s.step_order = r.current_approval_step) AND ((s.status)::text = 'pending'::text));


--
-- Name: v_audit_discrepancies; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_audit_discrepancies AS
 SELECT ai.id,
    ai.audit_id,
    a.audit_code,
    ai.asset_id,
    ast.asset_code AS asset_tag,
    ast.asset_code AS asset_name,
    ai.audit_status,
    ai.expected_location_id,
    el.name AS expected_location,
    ai.actual_location_id,
    al.name AS actual_location,
    ai.expected_user_id,
    eu.name AS expected_user,
    ai.actual_user_id,
    au.name AS actual_user,
    ai.expected_condition,
    ai.actual_condition,
    ai.resolution_status,
    ai.resolution_action,
    ai.notes,
    ai.audited_by,
    aud.name AS audited_by_name,
    ai.audited_at
   FROM (((((((public.audit_items ai
     JOIN public.audit_sessions a ON ((ai.audit_id = a.id)))
     JOIN public.assets ast ON ((ai.asset_id = ast.id)))
     LEFT JOIN public.locations el ON ((ai.expected_location_id = el.id)))
     LEFT JOIN public.locations al ON ((ai.actual_location_id = al.id)))
     LEFT JOIN public.users eu ON ((ai.expected_user_id = eu.id)))
     LEFT JOIN public.users au ON ((ai.actual_user_id = au.id)))
     LEFT JOIN public.users aud ON ((ai.audited_by = aud.id)))
  WHERE ((ai.audit_status)::text = ANY ((ARRAY['missing'::character varying, 'misplaced'::character varying, 'condition_issue'::character varying])::text[]));


--
-- Name: v_audit_statistics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_audit_statistics AS
 SELECT organization_id,
    count(*) FILTER (WHERE ((status)::text = 'completed'::text)) AS completed_audits,
    count(*) FILTER (WHERE ((status)::text = ANY ((ARRAY['in_progress'::character varying, 'reviewing'::character varying])::text[]))) AS active_audits,
    count(*) FILTER (WHERE ((status)::text = 'draft'::text)) AS draft_audits,
    avg(
        CASE
            WHEN (((status)::text = 'completed'::text) AND (total_items > 0)) THEN (((found_items)::numeric / (total_items)::numeric) * (100)::numeric)
            ELSE NULL::numeric
        END) AS avg_found_rate,
    avg(
        CASE
            WHEN (((status)::text = 'completed'::text) AND (total_items > 0)) THEN (((missing_items)::numeric / (total_items)::numeric) * (100)::numeric)
            ELSE NULL::numeric
        END) AS avg_missing_rate,
    count(*) FILTER (WHERE (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'reviewing'::character varying])::text[])) AND (end_date < CURRENT_DATE))) AS overdue_audits
   FROM public.audit_sessions
  GROUP BY organization_id;


--
-- Name: v_depreciation_by_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_depreciation_by_category AS
 SELECT ac.id AS category_id,
    ac.name AS category_name,
    count(ds.id) AS asset_count,
    sum(ds.original_cost) AS total_original_cost,
    sum(ds.accumulated_depreciation) AS total_accumulated,
    sum(ds.book_value) AS total_book_value,
    avg(round(((ds.accumulated_depreciation / NULLIF((ds.original_cost - ds.salvage_value), (0)::numeric)) * (100)::numeric), 2)) AS avg_percent_depreciated
   FROM (((public.depreciation_schedules ds
     JOIN public.assets a ON ((ds.asset_id = a.id)))
     JOIN public.asset_models am ON ((a.model_id = am.id)))
     JOIN public.asset_categories ac ON ((am.category_id = ac.id)))
  WHERE ((ds.status)::text = 'active'::text)
  GROUP BY ac.id, ac.name;


--
-- Name: v_depreciation_schedules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_depreciation_schedules AS
 SELECT ds.id,
    ds.asset_id,
    ds.depreciation_method,
    ds.original_cost,
    ds.salvage_value,
    ds.useful_life_years,
    ds.useful_life_months,
    ds.start_date,
    ds.end_date,
    ds.monthly_depreciation,
    ds.accumulated_depreciation,
    ds.book_value,
    ds.currency,
    ds.status,
    ds.stopped_at,
    ds.stopped_reason,
    ds.notes,
    ds.organization_id,
    ds.created_by,
    ds.updated_by,
    ds.created_at,
    ds.updated_at,
    a.asset_code,
    a.asset_code AS asset_name,
    ac.name AS category_name,
    u.name AS created_by_name,
    round(((ds.accumulated_depreciation / NULLIF((ds.original_cost - ds.salvage_value), (0)::numeric)) * (100)::numeric), 2) AS percent_depreciated,
    (date_part('month'::text, age((ds.end_date)::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone)) + (date_part('year'::text, age((ds.end_date)::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone)) * (12)::double precision)) AS months_remaining,
        CASE
            WHEN ((ds.status)::text = 'fully_depreciated'::text) THEN 0
            WHEN (ds.end_date <= (CURRENT_DATE + '6 mons'::interval)) THEN 1
            ELSE 2
        END AS urgency_level
   FROM ((((public.depreciation_schedules ds
     JOIN public.assets a ON ((ds.asset_id = a.id)))
     LEFT JOIN public.asset_models am ON ((a.model_id = am.id)))
     LEFT JOIN public.asset_categories ac ON ((am.category_id = ac.id)))
     LEFT JOIN public.users u ON ((ds.created_by = u.id)));


--
-- Name: v_monthly_depreciation_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_monthly_depreciation_summary AS
 SELECT period_year,
    period_month,
    count(*) AS entry_count,
    sum(depreciation_amount) AS total_depreciation,
    sum(
        CASE
            WHEN is_posted THEN depreciation_amount
            ELSE (0)::numeric
        END) AS posted_amount,
    sum(
        CASE
            WHEN (NOT is_posted) THEN depreciation_amount
            ELSE (0)::numeric
        END) AS pending_amount,
    count(
        CASE
            WHEN is_posted THEN 1
            ELSE NULL::integer
        END) AS posted_count,
    count(
        CASE
            WHEN (NOT is_posted) THEN 1
            ELSE NULL::integer
        END) AS pending_count
   FROM public.depreciation_entries
  GROUP BY period_year, period_month
  ORDER BY period_year DESC, period_month DESC;


--
-- Name: v_my_assigned_audits; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_my_assigned_audits AS
 SELECT a.id,
    a.audit_code,
    a.name,
    a.audit_type,
    a.status,
    a.start_date,
    a.end_date,
    a.total_items,
    a.audited_items,
    aa.user_id AS auditor_id,
    aa.is_lead,
    aa.assigned_location_id,
    l.name AS assigned_location_name,
        CASE
            WHEN (a.total_items > 0) THEN round((((a.audited_items)::numeric / (a.total_items)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS progress_percent
   FROM ((public.audit_sessions a
     JOIN public.audit_auditors aa ON ((a.id = aa.audit_id)))
     LEFT JOIN public.locations l ON ((aa.assigned_location_id = l.id)))
  WHERE ((a.status)::text = ANY ((ARRAY['in_progress'::character varying, 'reviewing'::character varying])::text[]));


--
-- Name: v_my_requests; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_my_requests AS
 SELECT r.id,
    r.request_code,
    r.request_type,
    r.requester_id,
    r.quantity,
    r.priority,
    r.required_date,
    r.status,
    r.current_approval_step,
    r.total_approval_steps,
    r.submitted_at,
    r.created_at,
    r.updated_at,
    cs.approver_id AS current_approver_id,
    cs.approver_role AS current_approver_role,
    ( SELECT count(*) AS count
           FROM public.approval_steps
          WHERE ((approval_steps.request_id = r.id) AND ((approval_steps.status)::text = 'approved'::text))) AS approved_steps,
    ( SELECT count(*) AS count
           FROM public.request_comments
          WHERE (request_comments.request_id = r.id)) AS comment_count
   FROM (public.asset_requests r
     LEFT JOIN public.approval_steps cs ON (((r.id = cs.request_id) AND (cs.step_order = r.current_approval_step))));


--
-- Name: v_overdue_checkouts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_overdue_checkouts AS
 SELECT id,
    checkout_code,
    asset_id,
    checkout_type,
    target_user_id,
    target_location_id,
    target_asset_id,
    checkout_date,
    expected_checkin_date,
    checked_out_by,
    checkout_notes,
    checkin_date,
    checked_in_by,
    checkin_notes,
    checkin_condition,
    next_action,
    status,
    is_overdue,
    overdue_notified_at,
    overdue_notification_count,
    organization_id,
    created_at,
    updated_at,
    (CURRENT_DATE - expected_checkin_date) AS days_overdue
   FROM public.asset_checkouts c
  WHERE (((status)::text = 'checked_out'::text) AND (expected_checkin_date < CURRENT_DATE));


--
-- Name: VIEW v_overdue_checkouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_overdue_checkouts IS 'Checkouts that are past their expected return date';


--
-- Name: v_pending_depreciation_entries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pending_depreciation_entries AS
 SELECT de.id,
    de.schedule_id,
    de.asset_id,
    de.period_year,
    de.period_month,
    de.period_start,
    de.period_end,
    de.depreciation_amount,
    de.accumulated_after,
    de.book_value_after,
    de.entry_date,
    de.is_posted,
    de.posted_at,
    de.posted_by,
    de.is_adjustment,
    de.adjustment_reason,
    de.notes,
    de.created_at,
    ds.depreciation_method,
    a.asset_code,
    a.asset_code AS asset_name
   FROM ((public.depreciation_entries de
     JOIN public.depreciation_schedules ds ON ((de.schedule_id = ds.id)))
     JOIN public.assets a ON ((de.asset_id = a.id)))
  WHERE (de.is_posted = false)
  ORDER BY de.period_year, de.period_month, a.asset_code;


--
-- Name: v_print_jobs_with_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_print_jobs_with_details AS
 SELECT pj.id,
    pj.job_code,
    pj.template_id,
    pj.asset_ids,
    pj.asset_count,
    pj.copies_per_asset,
    pj.total_labels,
    pj.printer_name,
    pj.paper_size,
    pj.status,
    pj.error_message,
    pj.output_type,
    pj.output_url,
    pj.started_at,
    pj.completed_at,
    pj.organization_id,
    pj.created_by,
    pj.created_at,
    pj.updated_at,
    lt.name AS template_name,
    lt.label_type,
    lt.size_preset,
    u.name AS created_by_name,
    u.email AS created_by_email,
    EXTRACT(epoch FROM (COALESCE(pj.completed_at, now()) - pj.created_at)) AS duration_seconds
   FROM ((public.print_jobs pj
     JOIN public.label_templates lt ON ((pj.template_id = lt.id)))
     JOIN public.users u ON ((pj.created_by = u.id)));


--
-- Name: v_recent_alerts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_recent_alerts AS
 SELECT h.id,
    h.rule_id,
    h.triggered_at,
    h.trigger_data,
    h.affected_count,
    h.title,
    h.message,
    h.severity,
    h.recipients_notified,
    h.channel_used,
    h.delivery_status,
    h.delivery_error,
    h.is_acknowledged,
    h.acknowledged_by,
    h.acknowledged_at,
    h.acknowledgment_note,
    h.organization_id,
    h.created_at,
    r.name AS rule_name,
    r.rule_type,
    r.severity AS rule_severity
   FROM (public.alert_history h
     JOIN public.alert_rules r ON ((h.rule_id = r.id)))
  ORDER BY h.triggered_at DESC;


--
-- Name: v_recent_print_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_recent_print_history AS
 SELECT pj.id,
    pj.job_code,
    lt.name AS template_name,
    pj.asset_count,
    pj.total_labels,
    pj.status,
    u.name AS printed_by,
    pj.created_at,
    pj.completed_at
   FROM ((public.print_jobs pj
     JOIN public.label_templates lt ON ((pj.template_id = lt.id)))
     JOIN public.users u ON ((pj.created_by = u.id)))
  ORDER BY pj.created_at DESC;


--
-- Name: v_report_definitions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_report_definitions AS
 SELECT r.id,
    r.report_code,
    r.name,
    r.description,
    r.report_type,
    r.data_source,
    r.fields,
    r.filters,
    r.default_filters,
    r."grouping",
    r.sorting,
    r.chart_config,
    r.access_level,
    r.allowed_roles,
    r.is_scheduled,
    r.schedule_cron,
    r.schedule_recipients,
    r.schedule_format,
    r.last_run_at,
    r.next_run_at,
    r.is_builtin,
    r.is_active,
    r.is_favorite,
    r.view_count,
    r.organization_id,
    r.created_by,
    r.updated_by,
    r.created_at,
    r.updated_at,
    u.name AS created_by_name,
    ( SELECT count(*) AS count
           FROM public.report_executions
          WHERE (report_executions.report_id = r.id)) AS execution_count,
    ( SELECT count(*) AS count
           FROM public.report_executions
          WHERE ((report_executions.report_id = r.id) AND ((report_executions.status)::text = 'completed'::text))) AS success_count,
    ( SELECT max(report_executions.completed_at) AS max
           FROM public.report_executions
          WHERE ((report_executions.report_id = r.id) AND ((report_executions.status)::text = 'completed'::text))) AS last_success_at
   FROM (public.report_definitions r
     LEFT JOIN public.users u ON ((r.created_by = u.id)));


--
-- Name: v_request_statistics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_request_statistics AS
 SELECT organization_id,
    count(*) AS total_requests,
    count(*) FILTER (WHERE ((status)::text = 'draft'::text)) AS draft_count,
    count(*) FILTER (WHERE ((status)::text = 'pending_approval'::text)) AS pending_count,
    count(*) FILTER (WHERE ((status)::text = 'need_info'::text)) AS need_info_count,
    count(*) FILTER (WHERE ((status)::text = 'approved'::text)) AS approved_count,
    count(*) FILTER (WHERE ((status)::text = 'rejected'::text)) AS rejected_count,
    count(*) FILTER (WHERE ((status)::text = 'cancelled'::text)) AS cancelled_count,
    count(*) FILTER (WHERE ((status)::text = 'fulfilling'::text)) AS fulfilling_count,
    count(*) FILTER (WHERE ((status)::text = 'completed'::text)) AS completed_count,
    avg(
        CASE
            WHEN ((status)::text = 'completed'::text) THEN (EXTRACT(epoch FROM (fulfilled_at - submitted_at)) / (86400)::numeric)
            ELSE NULL::numeric
        END) AS avg_completion_days,
    count(*) FILTER (WHERE ((priority)::text = 'urgent'::text)) AS urgent_count,
    count(*) FILTER (WHERE ((priority)::text = 'high'::text)) AS high_priority_count
   FROM public.asset_requests
  GROUP BY organization_id;


--
-- Name: v_requests_to_fulfill; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_requests_to_fulfill AS
 SELECT id,
    request_code,
    request_type,
    requester_id,
    department_id,
    asset_category_id,
    asset_model_id,
    quantity,
    priority,
    required_date,
    status,
    current_asset_id,
    submitted_at,
    created_at,
    EXTRACT(day FROM (now() - ( SELECT max(approval_steps.decision_date) AS max
           FROM public.approval_steps
          WHERE ((approval_steps.request_id = r.id) AND ((approval_steps.status)::text = 'approved'::text))))) AS days_since_approval
   FROM public.asset_requests r
  WHERE ((status)::text = ANY ((ARRAY['approved'::character varying, 'fulfilling'::character varying])::text[]));


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    location_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_stock_available; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_stock_available AS
 SELECT sps.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    sps.part_id,
    sp.part_code,
    sp.name AS part_name,
    sp.uom,
    sps.on_hand,
    sps.reserved,
    GREATEST((sps.on_hand - sps.reserved), 0) AS available,
    sp.min_level
   FROM ((public.spare_part_stock sps
     JOIN public.warehouses w ON ((w.id = sps.warehouse_id)))
     JOIN public.spare_parts sp ON ((sp.id = sps.part_id)));


--
-- Name: v_user_checkout_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_user_checkout_history AS
 SELECT id,
    checkout_code,
    asset_id,
    target_user_id AS user_id,
    checkout_date,
    expected_checkin_date,
    checkin_date,
    status,
    checkout_notes,
    checkin_notes,
        CASE
            WHEN ((checkin_date IS NOT NULL) AND (expected_checkin_date IS NOT NULL)) THEN ((checkin_date)::date - expected_checkin_date)
            ELSE NULL::integer
        END AS days_late
   FROM public.asset_checkouts c
  WHERE ((checkout_type)::text = 'user'::text)
  ORDER BY checkout_date DESC;


--
-- Name: VIEW v_user_checkout_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_user_checkout_history IS 'Checkout history for users with late return tracking';


--
-- Name: wf_request_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_request_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    line_no integer NOT NULL,
    item_type character varying(20) DEFAULT 'part'::character varying NOT NULL,
    asset_id uuid,
    part_id uuid,
    requested_qty integer DEFAULT 1 NOT NULL,
    fulfilled_qty integer DEFAULT 0 NOT NULL,
    unit_cost numeric(18,4),
    note text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wf_request_lines_fulfilled_qty_check CHECK ((fulfilled_qty >= 0)),
    CONSTRAINT wf_request_lines_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['asset'::character varying, 'part'::character varying, 'service'::character varying])::text[]))),
    CONSTRAINT wf_request_lines_requested_qty_check CHECK ((requested_qty > 0)),
    CONSTRAINT wf_request_lines_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'partial'::character varying, 'fulfilled'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE wf_request_lines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wf_request_lines IS 'Individual line items within a workflow request (header+lines model)';


--
-- Name: COLUMN wf_request_lines.item_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wf_request_lines.item_type IS 'asset | part | service';


--
-- Name: COLUMN wf_request_lines.fulfilled_qty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wf_request_lines.fulfilled_qty IS 'Quantity actually provided; enables partial-fulfillment tracking';


--
-- Name: COLUMN wf_request_lines.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wf_request_lines.metadata IS 'Arbitrary per-line data: serial_no, spec fields, etc.';


--
-- Name: COLUMN wf_request_lines.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wf_request_lines.status IS 'pending | partial | fulfilled | cancelled';


--
-- Name: wf_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(500) NOT NULL,
    request_type character varying(80) NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    requester_id uuid NOT NULL,
    requester_ou_id uuid,
    definition_id uuid,
    current_step_no integer,
    due_at timestamp with time zone,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wf_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT wf_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['asset_request'::character varying, 'repair_request'::character varying, 'disposal_request'::character varying, 'purchase'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT wf_requests_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: v_wf_request_line_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_wf_request_line_summary AS
 SELECT r.id AS request_id,
    r.code,
    r.title,
    r.status AS request_status,
    count(l.id) AS total_lines,
    sum(l.requested_qty) AS total_requested_qty,
    sum(l.fulfilled_qty) AS total_fulfilled_qty,
    sum(
        CASE
            WHEN ((l.status)::text = 'fulfilled'::text) THEN 1
            ELSE 0
        END) AS fulfilled_lines,
    sum(
        CASE
            WHEN ((l.status)::text = 'partial'::text) THEN 1
            ELSE 0
        END) AS partial_lines,
    sum(
        CASE
            WHEN ((l.status)::text = 'pending'::text) THEN 1
            ELSE 0
        END) AS pending_lines,
    sum(
        CASE
            WHEN ((l.status)::text = 'cancelled'::text) THEN 1
            ELSE 0
        END) AS cancelled_lines,
    round(
        CASE
            WHEN (sum(l.requested_qty) > 0) THEN ((100.0 * (sum(l.fulfilled_qty))::numeric) / (sum(l.requested_qty))::numeric)
            ELSE (0)::numeric
        END, 1) AS fulfill_pct
   FROM (public.wf_requests r
     LEFT JOIN public.wf_request_lines l ON ((l.request_id = r.id)))
  GROUP BY r.id, r.code, r.title, r.status;


--
-- Name: VIEW v_wf_request_line_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_wf_request_line_summary IS 'Summary of line fulfillment per wf_request (total_lines, fulfill_pct, etc.)';


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    tax_code character varying(100),
    phone character varying(50),
    email character varying(255),
    address text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wf_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    step_id uuid NOT NULL,
    step_no integer NOT NULL,
    assignee_user_id uuid,
    assignee_group_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    comment text,
    decision_at timestamp with time zone,
    decision_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    due_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT wf_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: wf_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    file_key character varying(500) NOT NULL,
    filename character varying(255) NOT NULL,
    size bigint,
    mime character varying(100),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wf_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    request_type character varying(80) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wf_definitions_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['asset_request'::character varying, 'repair_request'::character varying, 'disposal_request'::character varying, 'purchase'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: wf_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_id uuid,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wf_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'submitted'::character varying, 'assigned'::character varying, 'step_started'::character varying, 'approved'::character varying, 'rejected'::character varying, 'commented'::character varying, 'cancelled'::character varying, 'closed'::character varying, 'reopened'::character varying, 'delegated'::character varying, 'info_requested'::character varying, 'withdrawn'::character varying])::text[])))
);


--
-- Name: wf_request_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wf_request_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wf_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wf_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_id uuid NOT NULL,
    step_no integer NOT NULL,
    name character varying(255) NOT NULL,
    approver_rule jsonb DEFAULT '{}'::jsonb NOT NULL,
    on_approve jsonb DEFAULT '{}'::jsonb NOT NULL,
    on_reject jsonb DEFAULT '{"cancel": true}'::jsonb NOT NULL,
    sla_hours integer DEFAULT 48
);


--
-- Name: workflow_automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    trigger_event jsonb DEFAULT '{}'::jsonb NOT NULL,
    actions_executed jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    correlation_id character varying(100),
    CONSTRAINT workflow_automation_logs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: workflow_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    trigger_type character varying(50) NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_automation_rules_trigger_type_check CHECK (((trigger_type)::text = ANY ((ARRAY['warranty_expiring'::character varying, 'maintenance_due'::character varying, 'status_change'::character varying, 'assignment_change'::character varying, 'schedule'::character varying, 'threshold'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: workflow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_type text NOT NULL,
    asset_id uuid,
    from_dept text,
    to_dept text,
    requested_by text,
    approved_by text,
    status text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    correlation_id text,
    CONSTRAINT workflow_requests_request_type_check CHECK ((request_type = ANY (ARRAY['assign'::text, 'return'::text, 'move'::text, 'repair'::text, 'dispose'::text, 'issue_stock'::text]))),
    CONSTRAINT workflow_requests_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text, 'in_progress'::text, 'done'::text, 'canceled'::text])))
);



--
-- Name: accessories accessories_accessory_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_accessory_code_key UNIQUE (accessory_code);


--
-- Name: accessories accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_pkey PRIMARY KEY (id);


--
-- Name: accessory_audit_logs accessory_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_audit_logs
    ADD CONSTRAINT accessory_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: accessory_categories accessory_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_categories
    ADD CONSTRAINT accessory_categories_code_key UNIQUE (code);


--
-- Name: accessory_categories accessory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_categories
    ADD CONSTRAINT accessory_categories_pkey PRIMARY KEY (id);


--
-- Name: accessory_checkouts accessory_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_checkouts
    ADD CONSTRAINT accessory_checkouts_pkey PRIMARY KEY (id);


--
-- Name: accessory_manufacturers accessory_manufacturers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_manufacturers
    ADD CONSTRAINT accessory_manufacturers_code_key UNIQUE (code);


--
-- Name: accessory_manufacturers accessory_manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_manufacturers
    ADD CONSTRAINT accessory_manufacturers_pkey PRIMARY KEY (id);


--
-- Name: accessory_stock_adjustments accessory_stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_stock_adjustments
    ADD CONSTRAINT accessory_stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


--
-- Name: alert_dedup alert_dedup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_dedup
    ADD CONSTRAINT alert_dedup_pkey PRIMARY KEY (dedup_key);


--
-- Name: alert_history alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_rule_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_rule_code_key UNIQUE (rule_code);


--
-- Name: alert_subscriptions alert_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_subscriptions
    ADD CONSTRAINT alert_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: approval_chain_templates approval_chain_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_chain_templates
    ADD CONSTRAINT approval_chain_templates_pkey PRIMARY KEY (id);


--
-- Name: approval_steps approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_unique_step; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_unique_step UNIQUE (entity_type, entity_id, step_no);


--
-- Name: asset_analytics_snapshots asset_analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_analytics_snapshots
    ADD CONSTRAINT asset_analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: asset_analytics_snapshots asset_analytics_snapshots_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_analytics_snapshots
    ADD CONSTRAINT asset_analytics_snapshots_snapshot_date_key UNIQUE (snapshot_date);


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_attachments asset_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_attachments
    ADD CONSTRAINT asset_attachments_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: asset_category_spec_definitions asset_category_spec_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_definitions
    ADD CONSTRAINT asset_category_spec_definitions_pkey PRIMARY KEY (id);


--
-- Name: asset_category_spec_definitions asset_category_spec_definitions_spec_version_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_definitions
    ADD CONSTRAINT asset_category_spec_definitions_spec_version_id_key_key UNIQUE (spec_version_id, key);


--
-- Name: asset_category_spec_versions asset_category_spec_versions_category_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_versions
    ADD CONSTRAINT asset_category_spec_versions_category_id_version_key UNIQUE (category_id, version);


--
-- Name: asset_category_spec_versions asset_category_spec_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_versions
    ADD CONSTRAINT asset_category_spec_versions_pkey PRIMARY KEY (id);


--
-- Name: asset_checkouts asset_checkouts_checkout_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_checkouts
    ADD CONSTRAINT asset_checkouts_checkout_code_key UNIQUE (checkout_code);


--
-- Name: asset_checkouts asset_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_checkouts
    ADD CONSTRAINT asset_checkouts_pkey PRIMARY KEY (id);


--
-- Name: asset_consumption_logs asset_consumption_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_consumption_logs
    ADD CONSTRAINT asset_consumption_logs_pkey PRIMARY KEY (id);


--
-- Name: asset_cost_records asset_cost_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_cost_records
    ADD CONSTRAINT asset_cost_records_pkey PRIMARY KEY (id);


--
-- Name: asset_events asset_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_pkey PRIMARY KEY (id);


--
-- Name: asset_increase_docs asset_increase_docs_doc_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_docs
    ADD CONSTRAINT asset_increase_docs_doc_no_key UNIQUE (doc_no);


--
-- Name: asset_increase_docs asset_increase_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_docs
    ADD CONSTRAINT asset_increase_docs_pkey PRIMARY KEY (id);


--
-- Name: asset_increase_lines asset_increase_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_pkey PRIMARY KEY (id);


--
-- Name: asset_increase_lines asset_increase_lines_unique_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_unique_line UNIQUE (doc_id, line_no);


--
-- Name: asset_models asset_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_pkey PRIMARY KEY (id);


--
-- Name: asset_performance_metrics asset_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_performance_metrics
    ADD CONSTRAINT asset_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: asset_requests asset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_pkey PRIMARY KEY (id);


--
-- Name: asset_requests asset_requests_request_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_request_code_key UNIQUE (request_code);


--
-- Name: asset_status_catalogs asset_status_catalogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_catalogs
    ADD CONSTRAINT asset_status_catalogs_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_auditors audit_auditors_audit_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_auditors
    ADD CONSTRAINT audit_auditors_audit_id_user_id_key UNIQUE (audit_id, user_id);


--
-- Name: audit_auditors audit_auditors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_auditors
    ADD CONSTRAINT audit_auditors_pkey PRIMARY KEY (id);


--
-- Name: audit_categories audit_categories_audit_id_category_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_categories
    ADD CONSTRAINT audit_categories_audit_id_category_id_key UNIQUE (audit_id, category_id);


--
-- Name: audit_categories audit_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_categories
    ADD CONSTRAINT audit_categories_pkey PRIMARY KEY (id);


--
-- Name: audit_history audit_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_history
    ADD CONSTRAINT audit_history_pkey PRIMARY KEY (id);


--
-- Name: audit_items audit_items_audit_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_audit_id_asset_id_key UNIQUE (audit_id, asset_id);


--
-- Name: audit_items audit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_pkey PRIMARY KEY (id);


--
-- Name: audit_locations audit_locations_audit_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_locations
    ADD CONSTRAINT audit_locations_audit_id_location_id_key UNIQUE (audit_id, location_id);


--
-- Name: audit_locations audit_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_locations
    ADD CONSTRAINT audit_locations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_sessions audit_sessions_audit_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_audit_code_key UNIQUE (audit_code);


--
-- Name: audit_sessions audit_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_pkey PRIMARY KEY (id);


--
-- Name: audit_unregistered_assets audit_unregistered_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_pkey PRIMARY KEY (id);


--
-- Name: channel_bindings channel_bindings_channel_id_external_user_id_external_chat__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bindings
    ADD CONSTRAINT channel_bindings_channel_id_external_user_id_external_chat__key UNIQUE (channel_id, external_user_id, external_chat_id);


--
-- Name: channel_bindings channel_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bindings
    ADD CONSTRAINT channel_bindings_pkey PRIMARY KEY (id);


--
-- Name: channel_conversations channel_conversations_channel_id_external_chat_id_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_conversations
    ADD CONSTRAINT channel_conversations_channel_id_external_chat_id_thread_id_key UNIQUE (channel_id, external_chat_id, thread_id);


--
-- Name: channel_conversations channel_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_conversations
    ADD CONSTRAINT channel_conversations_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: chat_contexts chat_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_contexts
    ADD CONSTRAINT chat_contexts_pkey PRIMARY KEY (id);


--
-- Name: checkout_audit_logs checkout_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_audit_logs
    ADD CONSTRAINT checkout_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: checkout_extensions checkout_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_extensions
    ADD CONSTRAINT checkout_extensions_pkey PRIMARY KEY (id);


--
-- Name: checkout_transfers checkout_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_transfers
    ADD CONSTRAINT checkout_transfers_pkey PRIMARY KEY (id);


--
-- Name: cmdb_change_assessments cmdb_change_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_change_assessments
    ADD CONSTRAINT cmdb_change_assessments_pkey PRIMARY KEY (id);


--
-- Name: cmdb_changes cmdb_changes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_changes
    ADD CONSTRAINT cmdb_changes_code_key UNIQUE (code);


--
-- Name: cmdb_changes cmdb_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_changes
    ADD CONSTRAINT cmdb_changes_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_attr_values cmdb_ci_attr_values_ci_id_attr_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attr_values
    ADD CONSTRAINT cmdb_ci_attr_values_ci_id_attr_key_key UNIQUE (ci_id, attr_key);


--
-- Name: cmdb_ci_attr_values cmdb_ci_attr_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attr_values
    ADD CONSTRAINT cmdb_ci_attr_values_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_attribute_values cmdb_ci_attribute_values_ci_id_attribute_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attribute_values
    ADD CONSTRAINT cmdb_ci_attribute_values_ci_id_attribute_key_key UNIQUE (ci_id, attribute_key);


--
-- Name: cmdb_ci_attribute_values cmdb_ci_attribute_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attribute_values
    ADD CONSTRAINT cmdb_ci_attribute_values_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_ci_type_version_id_attribute_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_ci_type_version_id_attribute_key_key UNIQUE (ci_type_version_id, attribute_key);


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_version_id_attr_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_version_id_attr_key_key UNIQUE (version_id, attr_key);


--
-- Name: cmdb_ci_tags cmdb_ci_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_tags
    ADD CONSTRAINT cmdb_ci_tags_pkey PRIMARY KEY (ci_id, tag_id);


--
-- Name: cmdb_ci_type_attr_defs cmdb_ci_type_attr_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_attr_defs
    ADD CONSTRAINT cmdb_ci_type_attr_defs_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_type_attr_defs cmdb_ci_type_attr_defs_version_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_attr_defs
    ADD CONSTRAINT cmdb_ci_type_attr_defs_version_id_key_key UNIQUE (version_id, key);


--
-- Name: cmdb_ci_type_versions cmdb_ci_type_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_versions
    ADD CONSTRAINT cmdb_ci_type_versions_pkey PRIMARY KEY (id);


--
-- Name: cmdb_ci_type_versions cmdb_ci_type_versions_type_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_versions
    ADD CONSTRAINT cmdb_ci_type_versions_type_id_version_key UNIQUE (type_id, version);


--
-- Name: cmdb_ci_types cmdb_ci_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_types
    ADD CONSTRAINT cmdb_ci_types_code_key UNIQUE (code);


--
-- Name: cmdb_ci_types cmdb_ci_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_types
    ADD CONSTRAINT cmdb_ci_types_pkey PRIMARY KEY (id);


--
-- Name: cmdb_cis cmdb_cis_ci_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_cis
    ADD CONSTRAINT cmdb_cis_ci_code_key UNIQUE (ci_code);


--
-- Name: cmdb_cis cmdb_cis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_cis
    ADD CONSTRAINT cmdb_cis_pkey PRIMARY KEY (id);


--
-- Name: cmdb_config_file_versions cmdb_config_file_versions_config_file_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_file_versions
    ADD CONSTRAINT cmdb_config_file_versions_config_file_id_version_key UNIQUE (config_file_id, version);


--
-- Name: cmdb_config_file_versions cmdb_config_file_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_file_versions
    ADD CONSTRAINT cmdb_config_file_versions_pkey PRIMARY KEY (id);


--
-- Name: cmdb_config_files cmdb_config_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_files
    ADD CONSTRAINT cmdb_config_files_pkey PRIMARY KEY (id);


--
-- Name: cmdb_discovery_results cmdb_discovery_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_discovery_results
    ADD CONSTRAINT cmdb_discovery_results_pkey PRIMARY KEY (id);


--
-- Name: cmdb_discovery_rules cmdb_discovery_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_discovery_rules
    ADD CONSTRAINT cmdb_discovery_rules_pkey PRIMARY KEY (id);


--
-- Name: cmdb_impact_rules cmdb_impact_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_impact_rules
    ADD CONSTRAINT cmdb_impact_rules_pkey PRIMARY KEY (id);


--
-- Name: cmdb_relationship_types cmdb_relationship_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationship_types
    ADD CONSTRAINT cmdb_relationship_types_code_key UNIQUE (code);


--
-- Name: cmdb_relationship_types cmdb_relationship_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationship_types
    ADD CONSTRAINT cmdb_relationship_types_pkey PRIMARY KEY (id);


--
-- Name: cmdb_relationships cmdb_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationships
    ADD CONSTRAINT cmdb_relationships_pkey PRIMARY KEY (id);


--
-- Name: cmdb_relationships cmdb_relationships_type_id_from_ci_id_to_ci_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationships
    ADD CONSTRAINT cmdb_relationships_type_id_from_ci_id_to_ci_id_key UNIQUE (type_id, from_ci_id, to_ci_id);


--
-- Name: cmdb_service_cis cmdb_service_cis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_cis
    ADD CONSTRAINT cmdb_service_cis_pkey PRIMARY KEY (id);


--
-- Name: cmdb_service_cis cmdb_service_cis_service_id_ci_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_cis
    ADD CONSTRAINT cmdb_service_cis_service_id_ci_id_key UNIQUE (service_id, ci_id);


--
-- Name: cmdb_service_members cmdb_service_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_members
    ADD CONSTRAINT cmdb_service_members_pkey PRIMARY KEY (id);


--
-- Name: cmdb_services cmdb_services_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_services
    ADD CONSTRAINT cmdb_services_code_key UNIQUE (code);


--
-- Name: cmdb_services cmdb_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_services
    ADD CONSTRAINT cmdb_services_pkey PRIMARY KEY (id);


--
-- Name: cmdb_smart_tags cmdb_smart_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_smart_tags
    ADD CONSTRAINT cmdb_smart_tags_pkey PRIMARY KEY (id);


--
-- Name: compliance_assessments compliance_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assessments
    ADD CONSTRAINT compliance_assessments_pkey PRIMARY KEY (id);


--
-- Name: compliance_controls compliance_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_pkey PRIMARY KEY (id);


--
-- Name: compliance_frameworks compliance_frameworks_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_frameworks
    ADD CONSTRAINT compliance_frameworks_code_key UNIQUE (code);


--
-- Name: compliance_frameworks compliance_frameworks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_frameworks
    ADD CONSTRAINT compliance_frameworks_pkey PRIMARY KEY (id);


--
-- Name: component_assignments component_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_assignments
    ADD CONSTRAINT component_assignments_pkey PRIMARY KEY (id);


--
-- Name: component_audit_logs component_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_audit_logs
    ADD CONSTRAINT component_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: component_categories component_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_categories
    ADD CONSTRAINT component_categories_code_key UNIQUE (code);


--
-- Name: component_categories component_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_categories
    ADD CONSTRAINT component_categories_pkey PRIMARY KEY (id);


--
-- Name: component_manufacturers component_manufacturers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_manufacturers
    ADD CONSTRAINT component_manufacturers_code_key UNIQUE (code);


--
-- Name: component_manufacturers component_manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_manufacturers
    ADD CONSTRAINT component_manufacturers_pkey PRIMARY KEY (id);


--
-- Name: component_receipts component_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_receipts
    ADD CONSTRAINT component_receipts_pkey PRIMARY KEY (id);


--
-- Name: components components_component_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_component_code_key UNIQUE (component_code);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: consumable_audit_logs consumable_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_audit_logs
    ADD CONSTRAINT consumable_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: consumable_categories consumable_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_categories
    ADD CONSTRAINT consumable_categories_code_key UNIQUE (code);


--
-- Name: consumable_categories consumable_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_categories
    ADD CONSTRAINT consumable_categories_pkey PRIMARY KEY (id);


--
-- Name: consumable_issues consumable_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_issues
    ADD CONSTRAINT consumable_issues_pkey PRIMARY KEY (id);


--
-- Name: consumable_manufacturers consumable_manufacturers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_manufacturers
    ADD CONSTRAINT consumable_manufacturers_code_key UNIQUE (code);


--
-- Name: consumable_manufacturers consumable_manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_manufacturers
    ADD CONSTRAINT consumable_manufacturers_pkey PRIMARY KEY (id);


--
-- Name: consumable_receipts consumable_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_receipts
    ADD CONSTRAINT consumable_receipts_pkey PRIMARY KEY (id);


--
-- Name: consumables consumables_consumable_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumables
    ADD CONSTRAINT consumables_consumable_code_key UNIQUE (consumable_code);


--
-- Name: consumables consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumables
    ADD CONSTRAINT consumables_pkey PRIMARY KEY (id);


--
-- Name: conversation_token_usage conversation_token_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_token_usage
    ADD CONSTRAINT conversation_token_usage_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: dashboard_configs dashboard_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_pkey PRIMARY KEY (id);


--
-- Name: dashboard_widgets dashboard_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);


--
-- Name: dashboard_widgets dashboard_widgets_widget_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_widget_code_key UNIQUE (widget_code);


--
-- Name: depreciation_entries depreciation_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_pkey PRIMARY KEY (id);


--
-- Name: depreciation_runs depreciation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_runs
    ADD CONSTRAINT depreciation_runs_pkey PRIMARY KEY (id);


--
-- Name: depreciation_runs depreciation_runs_run_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_runs
    ADD CONSTRAINT depreciation_runs_run_code_key UNIQUE (run_code);


--
-- Name: depreciation_schedules depreciation_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT depreciation_schedules_pkey PRIMARY KEY (id);


--
-- Name: depreciation_settings depreciation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_settings
    ADD CONSTRAINT depreciation_settings_pkey PRIMARY KEY (id);


--
-- Name: document_files document_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_pkey PRIMARY KEY (id);


--
-- Name: document_relations document_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relations
    ADD CONSTRAINT document_relations_pkey PRIMARY KEY (document_id, relation_type, relation_id);


--
-- Name: document_template_versions document_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_template_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_template_code_key UNIQUE (template_code);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_approvals fieldkit_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_approvals
    ADD CONSTRAINT fieldkit_approvals_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_audit_events fieldkit_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_audit_events
    ADD CONSTRAINT fieldkit_audit_events_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_notes fieldkit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_notes
    ADD CONSTRAINT fieldkit_notes_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_playbooks fieldkit_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_playbooks
    ADD CONSTRAINT fieldkit_playbooks_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_quick_checks fieldkit_quick_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_quick_checks
    ADD CONSTRAINT fieldkit_quick_checks_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_snapshots fieldkit_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_snapshots
    ADD CONSTRAINT fieldkit_snapshots_pkey PRIMARY KEY (id);


--
-- Name: fieldkit_snippets fieldkit_snippets_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_snippets
    ADD CONSTRAINT fieldkit_snippets_code_key UNIQUE (code);


--
-- Name: fieldkit_snippets fieldkit_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_snippets
    ADD CONSTRAINT fieldkit_snippets_pkey PRIMARY KEY (id);


--
-- Name: inbound_dedup inbound_dedup_channel_id_external_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_dedup
    ADD CONSTRAINT inbound_dedup_channel_id_external_event_id_key UNIQUE (channel_id, external_event_id);


--
-- Name: integration_connectors integration_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_connectors
    ADD CONSTRAINT integration_connectors_pkey PRIMARY KEY (id);


--
-- Name: integration_sync_logs integration_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_logs
    ADD CONSTRAINT integration_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: integration_sync_rules integration_sync_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_rules
    ADD CONSTRAINT integration_sync_rules_pkey PRIMARY KEY (id);


--
-- Name: integration_webhooks integration_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_sessions inventory_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_sessions
    ADD CONSTRAINT inventory_sessions_pkey PRIMARY KEY (id);


--
-- Name: label_settings label_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_settings
    ADD CONSTRAINT label_settings_pkey PRIMARY KEY (id);


--
-- Name: label_templates label_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_templates
    ADD CONSTRAINT label_templates_pkey PRIMARY KEY (id);


--
-- Name: label_templates label_templates_template_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_templates
    ADD CONSTRAINT label_templates_template_code_key UNIQUE (template_code);


--
-- Name: license_audit_logs license_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_audit_logs
    ADD CONSTRAINT license_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: license_categories license_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_categories
    ADD CONSTRAINT license_categories_name_key UNIQUE (name);


--
-- Name: license_categories license_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_categories
    ADD CONSTRAINT license_categories_pkey PRIMARY KEY (id);


--
-- Name: license_seats license_seats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_seats
    ADD CONSTRAINT license_seats_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_license_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_license_code_key UNIQUE (license_code);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: maintenance_tickets maintenance_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_tickets
    ADD CONSTRAINT maintenance_tickets_pkey PRIMARY KEY (id);


--
-- Name: message_links message_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_links
    ADD CONSTRAINT message_links_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: model_configs model_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs
    ADD CONSTRAINT model_configs_pkey PRIMARY KEY (id);


--
-- Name: model_performance model_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_performance
    ADD CONSTRAINT model_performance_pkey PRIMARY KEY (model, provider, date);


--
-- Name: model_usage_history model_usage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_usage_history
    ADD CONSTRAINT model_usage_history_pkey PRIMARY KEY (model, usage_date);


--
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ops_events ops_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ops_events
    ADD CONSTRAINT ops_events_pkey PRIMARY KEY (id);


--
-- Name: orchestration_rules orchestration_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_rules
    ADD CONSTRAINT orchestration_rules_pkey PRIMARY KEY (id);


--
-- Name: org_units org_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT org_units_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: ou_organization_mappings ou_organization_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ou_organization_mappings
    ADD CONSTRAINT ou_organization_mappings_pkey PRIMARY KEY (ou_id);


--
-- Name: pending_actions pending_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_actions
    ADD CONSTRAINT pending_actions_pkey PRIMARY KEY (action_id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: policies policies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_slug_key UNIQUE (slug);


--
-- Name: policy_assignments policy_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_pkey PRIMARY KEY (id);


--
-- Name: policy_permissions policy_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_permissions
    ADD CONSTRAINT policy_permissions_pkey PRIMARY KEY (policy_id, permission_id);


--
-- Name: print_job_items print_job_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_job_items
    ADD CONSTRAINT print_job_items_pkey PRIMARY KEY (id);


--
-- Name: print_jobs print_jobs_job_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_job_code_key UNIQUE (job_code);


--
-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_pkey PRIMARY KEY (id);


--
-- Name: provider_usage_history provider_usage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_usage_history
    ADD CONSTRAINT provider_usage_history_pkey PRIMARY KEY (provider, usage_date);


--
-- Name: purchase_plan_docs purchase_plan_docs_doc_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_docs
    ADD CONSTRAINT purchase_plan_docs_doc_no_key UNIQUE (doc_no);


--
-- Name: purchase_plan_docs purchase_plan_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_docs
    ADD CONSTRAINT purchase_plan_docs_pkey PRIMARY KEY (id);


--
-- Name: purchase_plan_lines purchase_plan_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_lines
    ADD CONSTRAINT purchase_plan_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_plan_lines purchase_plan_lines_unique_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_lines
    ADD CONSTRAINT purchase_plan_lines_unique_line UNIQUE (doc_id, line_no);


--
-- Name: rbac_acl rbac_acl_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_acl
    ADD CONSTRAINT rbac_acl_pkey PRIMARY KEY (id);


--
-- Name: rbac_ad_permissions rbac_ad_permissions_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_ad_permissions
    ADD CONSTRAINT rbac_ad_permissions_key_key UNIQUE (key);


--
-- Name: rbac_ad_permissions rbac_ad_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_ad_permissions
    ADD CONSTRAINT rbac_ad_permissions_pkey PRIMARY KEY (id);


--
-- Name: rbac_group_members rbac_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT rbac_group_members_pkey PRIMARY KEY (id);


--
-- Name: rbac_groups rbac_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_groups
    ADD CONSTRAINT rbac_groups_pkey PRIMARY KEY (id);


--
-- Name: rbac_permissions rbac_permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permissions
    ADD CONSTRAINT rbac_permissions_code_key UNIQUE (code);


--
-- Name: rbac_permissions rbac_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permissions
    ADD CONSTRAINT rbac_permissions_pkey PRIMARY KEY (id);


--
-- Name: rbac_role_ad_permissions rbac_role_ad_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_ad_permissions
    ADD CONSTRAINT rbac_role_ad_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: rbac_role_permissions rbac_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_pkey PRIMARY KEY (role, permission_id);


--
-- Name: rbac_roles rbac_roles_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_roles
    ADD CONSTRAINT rbac_roles_key_key UNIQUE (key);


--
-- Name: rbac_roles rbac_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_roles
    ADD CONSTRAINT rbac_roles_pkey PRIMARY KEY (id);


--
-- Name: rbac_users rbac_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_users
    ADD CONSTRAINT rbac_users_pkey PRIMARY KEY (id);


--
-- Name: rbac_users rbac_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_users
    ADD CONSTRAINT rbac_users_username_key UNIQUE (username);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: repair_order_parts repair_order_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_parts
    ADD CONSTRAINT repair_order_parts_pkey PRIMARY KEY (id);


--
-- Name: repair_orders repair_orders_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_code_key UNIQUE (code);


--
-- Name: repair_orders repair_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_pkey PRIMARY KEY (id);


--
-- Name: report_definitions report_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_definitions
    ADD CONSTRAINT report_definitions_pkey PRIMARY KEY (id);


--
-- Name: report_definitions report_definitions_report_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_definitions
    ADD CONSTRAINT report_definitions_report_code_key UNIQUE (report_code);


--
-- Name: report_executions report_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_executions
    ADD CONSTRAINT report_executions_pkey PRIMARY KEY (id);


--
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- Name: request_audit_logs request_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_audit_logs
    ADD CONSTRAINT request_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: request_comments request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);


--
-- Name: scheduled_tasks scheduled_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_pkey PRIMARY KEY (id);




--
-- Name: security_audit_logs security_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_logs
    ADD CONSTRAINT security_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_key UNIQUE (refresh_token);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: spare_part_lots spare_part_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_lots
    ADD CONSTRAINT spare_part_lots_pkey PRIMARY KEY (id);


--
-- Name: spare_part_lots spare_part_lots_warehouse_id_part_id_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_lots
    ADD CONSTRAINT spare_part_lots_warehouse_id_part_id_lot_number_key UNIQUE (warehouse_id, part_id, lot_number);


--
-- Name: spare_part_movements spare_part_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_movements
    ADD CONSTRAINT spare_part_movements_pkey PRIMARY KEY (id);


--
-- Name: spare_part_stock spare_part_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_stock
    ADD CONSTRAINT spare_part_stock_pkey PRIMARY KEY (id);


--
-- Name: spare_part_stock spare_part_stock_warehouse_id_part_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_stock
    ADD CONSTRAINT spare_part_stock_warehouse_id_part_id_key UNIQUE (warehouse_id, part_id);


--
-- Name: spare_parts spare_parts_part_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_parts
    ADD CONSTRAINT spare_parts_part_code_key UNIQUE (part_code);


--
-- Name: spare_parts spare_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_parts
    ADD CONSTRAINT spare_parts_pkey PRIMARY KEY (id);


--
-- Name: stock_document_lines stock_document_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_documents stock_documents_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_code_key UNIQUE (code);


--
-- Name: stock_documents stock_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_code_key UNIQUE (code);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: depreciation_schedules uk_asset_active_schedule; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT uk_asset_active_schedule UNIQUE (asset_id);


--
-- Name: depreciation_settings uk_depreciation_settings_key_org; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_settings
    ADD CONSTRAINT uk_depreciation_settings_key_org UNIQUE (setting_key, organization_id);


--
-- Name: document_template_versions uk_document_template_versions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT uk_document_template_versions UNIQUE (template_id, version_no);


--
-- Name: label_settings uk_label_settings_key_org; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_settings
    ADD CONSTRAINT uk_label_settings_key_org UNIQUE (setting_key, organization_id);


--
-- Name: depreciation_entries uk_schedule_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT uk_schedule_period UNIQUE (schedule_id, period_year, period_month);


--
-- Name: license_seats unique_asset_license; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_seats
    ADD CONSTRAINT unique_asset_license UNIQUE (license_id, assigned_asset_id);


--
-- Name: license_seats unique_user_license; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_seats
    ADD CONSTRAINT unique_user_license UNIQUE (license_id, assigned_user_id);


--
-- Name: rbac_group_members uq_group_group; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT uq_group_group UNIQUE (group_id, member_group_id);


--
-- Name: rbac_group_members uq_group_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT uq_group_user UNIQUE (group_id, member_user_id);


--
-- Name: org_units uq_org_units_path; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT uq_org_units_path UNIQUE (path);


--
-- Name: rbac_groups uq_rbac_groups_ou_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_groups
    ADD CONSTRAINT uq_rbac_groups_ou_name UNIQUE (ou_id, name);


--
-- Name: approval_steps uq_request_step_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT uq_request_step_order UNIQUE (request_id, step_order);


--
-- Name: usage_logs usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_logs
    ADD CONSTRAINT usage_logs_pkey PRIMARY KEY (id);


--
-- Name: user_alert_preferences user_alert_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_alert_preferences
    ADD CONSTRAINT user_alert_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_dashboard_layouts user_dashboard_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_dashboard_layouts
    ADD CONSTRAINT user_dashboard_layouts_pkey PRIMARY KEY (id);


--
-- Name: user_dashboard_layouts user_dashboard_layouts_user_id_dashboard_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_dashboard_layouts
    ADD CONSTRAINT user_dashboard_layouts_user_id_dashboard_type_key UNIQUE (user_id, dashboard_type);


--
-- Name: user_token_stats user_token_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_stats
    ADD CONSTRAINT user_token_stats_pkey PRIMARY KEY (user_id, date, model, provider);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: wf_approvals wf_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_approvals
    ADD CONSTRAINT wf_approvals_pkey PRIMARY KEY (id);


--
-- Name: wf_attachments wf_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_attachments
    ADD CONSTRAINT wf_attachments_pkey PRIMARY KEY (id);


--
-- Name: wf_definitions wf_definitions_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_definitions
    ADD CONSTRAINT wf_definitions_key_key UNIQUE (key);


--
-- Name: wf_definitions wf_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_definitions
    ADD CONSTRAINT wf_definitions_pkey PRIMARY KEY (id);


--
-- Name: wf_events wf_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_events
    ADD CONSTRAINT wf_events_pkey PRIMARY KEY (id);


--
-- Name: wf_request_lines wf_request_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_request_lines
    ADD CONSTRAINT wf_request_lines_pkey PRIMARY KEY (id);


--
-- Name: wf_request_lines wf_request_lines_request_id_line_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_request_lines
    ADD CONSTRAINT wf_request_lines_request_id_line_no_key UNIQUE (request_id, line_no);


--
-- Name: wf_requests wf_requests_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_requests
    ADD CONSTRAINT wf_requests_code_key UNIQUE (code);


--
-- Name: wf_requests wf_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_requests
    ADD CONSTRAINT wf_requests_pkey PRIMARY KEY (id);


--
-- Name: wf_steps wf_steps_definition_id_step_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_steps
    ADD CONSTRAINT wf_steps_definition_id_step_no_key UNIQUE (definition_id, step_no);


--
-- Name: wf_steps wf_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_steps
    ADD CONSTRAINT wf_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_logs workflow_automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_logs
    ADD CONSTRAINT workflow_automation_logs_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_rules workflow_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_rules
    ADD CONSTRAINT workflow_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: workflow_requests workflow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_requests
    ADD CONSTRAINT workflow_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_accessories_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_available ON public.accessories USING btree (available_quantity);


--
-- Name: idx_accessories_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_category ON public.accessories USING btree (category_id);


--
-- Name: idx_accessories_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_code ON public.accessories USING btree (accessory_code);


--
-- Name: idx_accessories_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_low_stock ON public.accessories USING btree (available_quantity, min_quantity) WHERE (available_quantity <= min_quantity);


--
-- Name: idx_accessories_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_manufacturer ON public.accessories USING btree (manufacturer_id);


--
-- Name: idx_accessories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_name ON public.accessories USING btree (name);


--
-- Name: idx_accessories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_org ON public.accessories USING btree (organization_id);


--
-- Name: idx_accessories_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_status ON public.accessories USING btree (status);


--
-- Name: idx_accessories_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_supplier ON public.accessories USING btree (supplier_id);


--
-- Name: idx_accessory_audit_accessory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_audit_accessory ON public.accessory_audit_logs USING btree (accessory_id);


--
-- Name: idx_accessory_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_audit_action ON public.accessory_audit_logs USING btree (action);


--
-- Name: idx_accessory_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_audit_date ON public.accessory_audit_logs USING btree (performed_at);


--
-- Name: idx_accessory_categories_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_categories_code ON public.accessory_categories USING btree (code);


--
-- Name: idx_accessory_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_categories_parent ON public.accessory_categories USING btree (parent_id);


--
-- Name: idx_accessory_checkouts_accessory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_accessory ON public.accessory_checkouts USING btree (accessory_id);


--
-- Name: idx_accessory_checkouts_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_asset ON public.accessory_checkouts USING btree (assigned_asset_id);


--
-- Name: idx_accessory_checkouts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_date ON public.accessory_checkouts USING btree (checkout_date);


--
-- Name: idx_accessory_checkouts_expected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_expected ON public.accessory_checkouts USING btree (expected_checkin_date) WHERE ((status)::text = ANY ((ARRAY['checked_out'::character varying, 'partially_returned'::character varying])::text[]));


--
-- Name: idx_accessory_checkouts_overdue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_overdue ON public.accessory_checkouts USING btree (expected_checkin_date) WHERE ((status)::text = ANY ((ARRAY['checked_out'::character varying, 'partially_returned'::character varying])::text[]));


--
-- Name: idx_accessory_checkouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_status ON public.accessory_checkouts USING btree (status);


--
-- Name: idx_accessory_checkouts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_checkouts_user ON public.accessory_checkouts USING btree (assigned_user_id);


--
-- Name: idx_accessory_manufacturers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_manufacturers_code ON public.accessory_manufacturers USING btree (code);


--
-- Name: idx_alert_history_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_history_org ON public.alert_history USING btree (organization_id);


--
-- Name: idx_alert_history_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_history_rule ON public.alert_history USING btree (rule_id);


--
-- Name: idx_alert_history_triggered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_history_triggered ON public.alert_history USING btree (triggered_at);


--
-- Name: idx_alert_history_unack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_history_unack ON public.alert_history USING btree (is_acknowledged) WHERE (is_acknowledged = false);


--
-- Name: idx_alert_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_active ON public.alert_rules USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_alert_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_org ON public.alert_rules USING btree (organization_id);


--
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_type ON public.alert_rules USING btree (rule_type);


--
-- Name: idx_analytics_snapshots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_snapshots_date ON public.asset_analytics_snapshots USING btree (snapshot_date DESC);


--
-- Name: idx_approval_steps_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_approver ON public.approval_steps USING btree (approver_id);


--
-- Name: idx_approval_steps_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_order ON public.approval_steps USING btree (request_id, step_order);


--
-- Name: idx_approval_steps_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_pending ON public.approval_steps USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_approval_steps_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_request ON public.approval_steps USING btree (request_id);


--
-- Name: idx_approval_steps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_status ON public.approval_steps USING btree (status);


--
-- Name: idx_approval_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_active ON public.approval_chain_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_approval_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_category ON public.approval_chain_templates USING btree (asset_category_id);


--
-- Name: idx_approval_templates_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_department ON public.approval_chain_templates USING btree (department_id);


--
-- Name: idx_approval_templates_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_organization ON public.approval_chain_templates USING btree (organization_id);


--
-- Name: idx_approval_templates_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_priority ON public.approval_chain_templates USING btree (priority DESC);


--
-- Name: idx_approval_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_type ON public.approval_chain_templates USING btree (request_type);


--
-- Name: idx_asset_assignments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_assignments_asset ON public.asset_assignments USING btree (asset_id, assigned_at DESC);


--
-- Name: idx_asset_assignments_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_assignments_location ON public.asset_assignments USING btree (location_id) WHERE (location_id IS NOT NULL);


--
-- Name: idx_asset_assignments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_assignments_org ON public.asset_assignments USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_asset_attachments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_attachments_asset ON public.asset_attachments USING btree (asset_id, created_at DESC);


--
-- Name: idx_asset_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_categories_name ON public.asset_categories USING btree (name);


--
-- Name: idx_asset_checkouts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_active ON public.asset_checkouts USING btree (status) WHERE ((status)::text = 'checked_out'::text);


--
-- Name: idx_asset_checkouts_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_asset ON public.asset_checkouts USING btree (asset_id);


--
-- Name: idx_asset_checkouts_checked_out_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_checked_out_by ON public.asset_checkouts USING btree (checked_out_by);


--
-- Name: idx_asset_checkouts_checkout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_checkout_date ON public.asset_checkouts USING btree (checkout_date);


--
-- Name: idx_asset_checkouts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_code ON public.asset_checkouts USING btree (checkout_code);


--
-- Name: idx_asset_checkouts_expected_checkin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_expected_checkin ON public.asset_checkouts USING btree (expected_checkin_date);


--
-- Name: idx_asset_checkouts_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_location ON public.asset_checkouts USING btree (target_location_id);


--
-- Name: idx_asset_checkouts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_organization ON public.asset_checkouts USING btree (organization_id);


--
-- Name: idx_asset_checkouts_overdue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_overdue ON public.asset_checkouts USING btree (is_overdue) WHERE (is_overdue = true);


--
-- Name: idx_asset_checkouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_status ON public.asset_checkouts USING btree (status);


--
-- Name: idx_asset_checkouts_target_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_target_asset ON public.asset_checkouts USING btree (target_asset_id);


--
-- Name: idx_asset_checkouts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_type ON public.asset_checkouts USING btree (checkout_type);


--
-- Name: idx_asset_checkouts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_checkouts_user ON public.asset_checkouts USING btree (target_user_id);


--
-- Name: idx_asset_events_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_events_asset ON public.asset_events USING btree (asset_id, created_at DESC);


--
-- Name: idx_asset_events_ref_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_events_ref_doc ON public.asset_events USING btree (ref_doc_type, ref_doc_id);


--
-- Name: idx_asset_increase_docs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_increase_docs_status ON public.asset_increase_docs USING btree (status, doc_date DESC);


--
-- Name: idx_asset_increase_docs_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_increase_docs_vendor ON public.asset_increase_docs USING btree (vendor_id);


--
-- Name: idx_asset_increase_lines_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_increase_lines_asset ON public.asset_increase_lines USING btree (asset_id);


--
-- Name: idx_asset_increase_lines_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_increase_lines_doc ON public.asset_increase_lines USING btree (doc_id, line_no);


--
-- Name: idx_asset_models_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_category_id ON public.asset_models USING btree (category_id);


--
-- Name: idx_asset_models_spec_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_spec_gin ON public.asset_models USING gin (spec);


--
-- Name: idx_asset_models_spec_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_spec_version_id ON public.asset_models USING btree (spec_version_id);


--
-- Name: idx_asset_models_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_stock ON public.asset_models USING btree (current_stock_qty, min_stock_qty) WHERE (current_stock_qty < min_stock_qty);


--
-- Name: idx_asset_models_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_vendor_id ON public.asset_models USING btree (vendor_id);


--
-- Name: idx_asset_requests_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_approved ON public.asset_requests USING btree (status) WHERE ((status)::text = 'approved'::text);


--
-- Name: idx_asset_requests_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_category ON public.asset_requests USING btree (asset_category_id);


--
-- Name: idx_asset_requests_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_code ON public.asset_requests USING btree (request_code);


--
-- Name: idx_asset_requests_current_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_current_asset ON public.asset_requests USING btree (current_asset_id);


--
-- Name: idx_asset_requests_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_department ON public.asset_requests USING btree (department_id);


--
-- Name: idx_asset_requests_fulfilling; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_fulfilling ON public.asset_requests USING btree (status) WHERE ((status)::text = 'fulfilling'::text);


--
-- Name: idx_asset_requests_need_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_need_info ON public.asset_requests USING btree (status) WHERE ((status)::text = 'need_info'::text);


--
-- Name: idx_asset_requests_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_organization ON public.asset_requests USING btree (organization_id);


--
-- Name: idx_asset_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_pending ON public.asset_requests USING btree (status) WHERE ((status)::text = 'pending_approval'::text);


--
-- Name: idx_asset_requests_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_priority ON public.asset_requests USING btree (priority);


--
-- Name: idx_asset_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_requester ON public.asset_requests USING btree (requester_id);


--
-- Name: idx_asset_requests_required_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_required_date ON public.asset_requests USING btree (required_date);


--
-- Name: idx_asset_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_status ON public.asset_requests USING btree (status);


--
-- Name: idx_asset_requests_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_submitted ON public.asset_requests USING btree (submitted_at);


--
-- Name: idx_asset_requests_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_type ON public.asset_requests USING btree (request_type);


--
-- Name: idx_asset_status_catalogs_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_status_catalogs_code ON public.asset_status_catalogs USING btree (code);


--
-- Name: idx_asset_status_catalogs_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_status_catalogs_name ON public.asset_status_catalogs USING btree (name);


--
-- Name: idx_asset_status_catalogs_terminal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_status_catalogs_terminal ON public.asset_status_catalogs USING btree (is_terminal);


--
-- Name: idx_assets_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_location_id ON public.assets USING btree (location_id);


--
-- Name: idx_assets_mgmt_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_mgmt_ip ON public.assets USING btree (mgmt_ip);


--
-- Name: idx_assets_source_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_source_doc ON public.assets USING btree (source_doc_type, source_doc_id);


--
-- Name: idx_assets_source_doc_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_source_doc_line ON public.assets USING btree (source_doc_line_id) WHERE (source_doc_line_id IS NOT NULL);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_warehouse_id ON public.assets USING btree (warehouse_id);


--
-- Name: idx_assets_warranty_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_warranty_end ON public.assets USING btree (warranty_end);


--
-- Name: idx_attachments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_audit_auditors_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_auditors_audit ON public.audit_auditors USING btree (audit_id);


--
-- Name: idx_audit_auditors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_auditors_user ON public.audit_auditors USING btree (user_id);


--
-- Name: idx_audit_categories_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_categories_audit ON public.audit_categories USING btree (audit_id);


--
-- Name: idx_audit_history_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_history_audit ON public.audit_history USING btree (audit_id);


--
-- Name: idx_audit_history_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_history_time ON public.audit_history USING btree (created_at);


--
-- Name: idx_audit_items_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_asset ON public.audit_items USING btree (asset_id);


--
-- Name: idx_audit_items_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_audit ON public.audit_items USING btree (audit_id);


--
-- Name: idx_audit_items_auditor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_auditor ON public.audit_items USING btree (audited_by);


--
-- Name: idx_audit_items_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_resolution ON public.audit_items USING btree (resolution_status);


--
-- Name: idx_audit_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_status ON public.audit_items USING btree (audit_status);


--
-- Name: idx_audit_locations_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_locations_audit ON public.audit_locations USING btree (audit_id);


--
-- Name: idx_audit_locations_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_locations_location ON public.audit_locations USING btree (location_id);


--
-- Name: idx_audit_logs_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_correlation ON public.audit_logs USING btree (correlation_id);


--
-- Name: idx_audit_logs_user_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_action ON public.audit_logs USING btree (user_id, action, created_at DESC);


--
-- Name: idx_audit_sessions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_sessions_code ON public.audit_sessions USING btree (audit_code);


--
-- Name: idx_audit_sessions_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_sessions_dates ON public.audit_sessions USING btree (start_date, end_date);


--
-- Name: idx_audit_sessions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_sessions_org ON public.audit_sessions USING btree (organization_id);


--
-- Name: idx_audit_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_sessions_status ON public.audit_sessions USING btree (status);


--
-- Name: idx_audit_unregistered_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_unregistered_action ON public.audit_unregistered_assets USING btree (action);


--
-- Name: idx_audit_unregistered_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_unregistered_audit ON public.audit_unregistered_assets USING btree (audit_id);


--
-- Name: idx_automation_logs_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_logs_rule ON public.workflow_automation_logs USING btree (rule_id);


--
-- Name: idx_automation_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_logs_status ON public.workflow_automation_logs USING btree (status);


--
-- Name: idx_automation_rules_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_trigger ON public.workflow_automation_rules USING btree (trigger_type) WHERE (is_active = true);


--
-- Name: idx_category_spec_definitions_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_spec_definitions_version ON public.asset_category_spec_definitions USING btree (spec_version_id, sort_order);


--
-- Name: idx_category_spec_definitions_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_category_spec_definitions_version_key ON public.asset_category_spec_definitions USING btree (spec_version_id, key);


--
-- Name: idx_change_assessments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_assessments_status ON public.cmdb_change_assessments USING btree (status);


--
-- Name: idx_checkout_audit_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_audit_action_type ON public.checkout_audit_logs USING btree (action_type);


--
-- Name: idx_checkout_audit_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_audit_asset ON public.checkout_audit_logs USING btree (asset_id);


--
-- Name: idx_checkout_audit_checkout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_audit_checkout ON public.checkout_audit_logs USING btree (checkout_id);


--
-- Name: idx_checkout_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_audit_performed_at ON public.checkout_audit_logs USING btree (performed_at);


--
-- Name: idx_checkout_audit_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_audit_performed_by ON public.checkout_audit_logs USING btree (performed_by);


--
-- Name: idx_checkout_extensions_checkout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_extensions_checkout ON public.checkout_extensions USING btree (checkout_id);


--
-- Name: idx_checkout_extensions_extended_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_extensions_extended_at ON public.checkout_extensions USING btree (extended_at);


--
-- Name: idx_checkout_extensions_extended_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_extensions_extended_by ON public.checkout_extensions USING btree (extended_by);


--
-- Name: idx_checkout_transfers_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_transfers_from ON public.checkout_transfers USING btree (from_user_id);


--
-- Name: idx_checkout_transfers_new; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_transfers_new ON public.checkout_transfers USING btree (new_checkout_id);


--
-- Name: idx_checkout_transfers_original; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_transfers_original ON public.checkout_transfers USING btree (original_checkout_id);


--
-- Name: idx_checkout_transfers_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_transfers_to ON public.checkout_transfers USING btree (to_user_id);


--
-- Name: idx_checkout_transfers_transferred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_transfers_transferred_at ON public.checkout_transfers USING btree (transferred_at);


--
-- Name: idx_ci_attr_values_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_attr_values_ci ON public.cmdb_ci_attr_values USING btree (ci_id);


--
-- Name: idx_ci_attr_values_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_attr_values_key ON public.cmdb_ci_attr_values USING btree (attr_key);


--
-- Name: idx_ci_attr_values_schema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_attr_values_schema ON public.cmdb_ci_attr_values USING btree (schema_id);


--
-- Name: idx_ci_attr_values_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_attr_values_value ON public.cmdb_ci_attr_values USING gin (value);


--
-- Name: idx_ci_schemas_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_schemas_order ON public.cmdb_ci_schemas USING btree (version_id, display_order);


--
-- Name: idx_ci_schemas_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_schemas_version ON public.cmdb_ci_schemas USING btree (version_id);


--
-- Name: idx_ci_tags_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_tags_ci ON public.cmdb_ci_tags USING btree (ci_id);


--
-- Name: idx_ci_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_tags_tag ON public.cmdb_ci_tags USING btree (tag_id);


--
-- Name: idx_ci_type_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_type_versions_status ON public.cmdb_ci_type_versions USING btree (type_id, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_ci_type_versions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_type_versions_type ON public.cmdb_ci_type_versions USING btree (type_id);


--
-- Name: idx_cis_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_asset ON public.cmdb_cis USING btree (asset_id);


--
-- Name: idx_cis_ci_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_ci_code ON public.cmdb_cis USING btree (ci_code);


--
-- Name: idx_cis_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_environment ON public.cmdb_cis USING btree (environment);


--
-- Name: idx_cis_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_location ON public.cmdb_cis USING btree (location_id);


--
-- Name: idx_cis_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_metadata ON public.cmdb_cis USING gin (metadata);


--
-- Name: idx_cis_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_name ON public.cmdb_cis USING btree (name);


--
-- Name: idx_cis_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_status ON public.cmdb_cis USING btree (status);


--
-- Name: idx_cis_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cis_type ON public.cmdb_cis USING btree (type_id);


--
-- Name: idx_cmdb_changes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_changes_created_at ON public.cmdb_changes USING btree (created_at DESC);


--
-- Name: idx_cmdb_changes_primary_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_changes_primary_ci ON public.cmdb_changes USING btree (primary_ci_id);


--
-- Name: idx_cmdb_changes_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_changes_risk ON public.cmdb_changes USING btree (risk);


--
-- Name: idx_cmdb_changes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_changes_status ON public.cmdb_changes USING btree (status);


--
-- Name: idx_cmdb_ci_attr_values_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_ci_attr_values_ci ON public.cmdb_ci_attr_values USING btree (ci_id);


--
-- Name: idx_cmdb_ci_type_attr_defs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_ci_type_attr_defs_version ON public.cmdb_ci_type_attr_defs USING btree (version_id, sort_order);


--
-- Name: idx_cmdb_ci_type_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_ci_type_versions_status ON public.cmdb_ci_type_versions USING btree (type_id, status);


--
-- Name: idx_cmdb_ci_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_ci_types_code ON public.cmdb_ci_types USING btree (code);


--
-- Name: idx_cmdb_cis_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_cis_asset ON public.cmdb_cis USING btree (asset_id);


--
-- Name: idx_cmdb_cis_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_cis_location ON public.cmdb_cis USING btree (location_id);


--
-- Name: idx_cmdb_cis_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_cis_type ON public.cmdb_cis USING btree (type_id);


--
-- Name: idx_cmdb_config_file_versions_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_config_file_versions_file_id ON public.cmdb_config_file_versions USING btree (config_file_id);


--
-- Name: idx_cmdb_config_files_ci_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_config_files_ci_id ON public.cmdb_config_files USING btree (ci_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_cmdb_relationships_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_relationships_from ON public.cmdb_relationships USING btree (from_ci_id);


--
-- Name: idx_cmdb_relationships_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_relationships_to ON public.cmdb_relationships USING btree (to_ci_id);


--
-- Name: idx_cmdb_service_members_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_service_members_ci ON public.cmdb_service_members USING btree (ci_id);


--
-- Name: idx_cmdb_service_members_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_service_members_service ON public.cmdb_service_members USING btree (service_id);


--
-- Name: idx_compliance_assessments_fw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_assessments_fw ON public.compliance_assessments USING btree (framework_id);


--
-- Name: idx_compliance_controls_fw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_controls_fw ON public.compliance_controls USING btree (framework_id);


--
-- Name: idx_component_assignments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_assignments_asset ON public.component_assignments USING btree (asset_id);


--
-- Name: idx_component_assignments_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_assignments_component ON public.component_assignments USING btree (component_id);


--
-- Name: idx_component_assignments_installed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_assignments_installed_at ON public.component_assignments USING btree (installed_at);


--
-- Name: idx_component_assignments_installed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_assignments_installed_by ON public.component_assignments USING btree (installed_by);


--
-- Name: idx_component_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_assignments_status ON public.component_assignments USING btree (status);


--
-- Name: idx_component_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_audit_action ON public.component_audit_logs USING btree (action_type);


--
-- Name: idx_component_audit_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_audit_assignment ON public.component_audit_logs USING btree (assignment_id);


--
-- Name: idx_component_audit_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_audit_component ON public.component_audit_logs USING btree (component_id);


--
-- Name: idx_component_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_audit_performed_at ON public.component_audit_logs USING btree (performed_at);


--
-- Name: idx_component_audit_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_audit_performed_by ON public.component_audit_logs USING btree (performed_by);


--
-- Name: idx_component_categories_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_categories_code ON public.component_categories USING btree (code);


--
-- Name: idx_component_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_categories_parent ON public.component_categories USING btree (parent_id);


--
-- Name: idx_component_manufacturers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_manufacturers_code ON public.component_manufacturers USING btree (code);


--
-- Name: idx_component_receipts_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_receipts_component ON public.component_receipts USING btree (component_id);


--
-- Name: idx_component_receipts_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_receipts_received_at ON public.component_receipts USING btree (received_at);


--
-- Name: idx_component_receipts_received_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_receipts_received_by ON public.component_receipts USING btree (received_by);


--
-- Name: idx_component_receipts_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_receipts_reference ON public.component_receipts USING btree (reference_id);


--
-- Name: idx_component_receipts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_receipts_type ON public.component_receipts USING btree (receipt_type);


--
-- Name: idx_components_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_category ON public.components USING btree (category_id);


--
-- Name: idx_components_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_code ON public.components USING btree (component_code);


--
-- Name: idx_components_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_location ON public.components USING btree (location_id);


--
-- Name: idx_components_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_manufacturer ON public.components USING btree (manufacturer_id);


--
-- Name: idx_components_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_name ON public.components USING btree (name);


--
-- Name: idx_components_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_organization ON public.components USING btree (organization_id);


--
-- Name: idx_components_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_status ON public.components USING btree (status);


--
-- Name: idx_components_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_supplier ON public.components USING btree (supplier_id);


--
-- Name: idx_components_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_type ON public.components USING btree (component_type);


--
-- Name: idx_connectors_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_provider ON public.integration_connectors USING btree (provider);


--
-- Name: idx_consumable_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_audit_entity ON public.consumable_audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_consumable_audit_performed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_audit_performed ON public.consumable_audit_logs USING btree (performed_at);


--
-- Name: idx_consumable_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_categories_active ON public.consumable_categories USING btree (is_active);


--
-- Name: idx_consumable_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_categories_parent ON public.consumable_categories USING btree (parent_id);


--
-- Name: idx_consumable_issues_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_asset ON public.consumable_issues USING btree (issued_to_asset_id) WHERE (issued_to_asset_id IS NOT NULL);


--
-- Name: idx_consumable_issues_consumable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_consumable ON public.consumable_issues USING btree (consumable_id);


--
-- Name: idx_consumable_issues_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_date ON public.consumable_issues USING btree (issue_date);


--
-- Name: idx_consumable_issues_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_type ON public.consumable_issues USING btree (issue_type);


--
-- Name: idx_consumable_issues_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_user ON public.consumable_issues USING btree (issued_to_user_id) WHERE (issued_to_user_id IS NOT NULL);


--
-- Name: idx_consumable_receipts_consumable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_receipts_consumable ON public.consumable_receipts USING btree (consumable_id);


--
-- Name: idx_consumable_receipts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_receipts_date ON public.consumable_receipts USING btree (receipt_date);


--
-- Name: idx_consumable_receipts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_receipts_type ON public.consumable_receipts USING btree (receipt_type);


--
-- Name: idx_consumables_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_category ON public.consumables USING btree (category_id);


--
-- Name: idx_consumables_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_code ON public.consumables USING btree (consumable_code);


--
-- Name: idx_consumables_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_low_stock ON public.consumables USING btree (quantity, min_quantity) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_consumables_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_manufacturer ON public.consumables USING btree (manufacturer_id);


--
-- Name: idx_consumables_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_name ON public.consumables USING btree (name);


--
-- Name: idx_consumables_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_org ON public.consumables USING btree (organization_id);


--
-- Name: idx_consumables_quantity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_quantity ON public.consumables USING btree (quantity);


--
-- Name: idx_consumables_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumables_status ON public.consumables USING btree (status);


--
-- Name: idx_consumption_logs_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumption_logs_model ON public.asset_consumption_logs USING btree (model_id, consumption_date DESC);


--
-- Name: idx_conversation_usage_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_usage_conversation ON public.conversation_token_usage USING btree (conversation_id, created_at DESC);


--
-- Name: idx_conversations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_created_at ON public.conversations USING btree (created_at DESC);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_cost_records_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_records_asset ON public.asset_cost_records USING btree (asset_id);


--
-- Name: idx_cost_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_records_date ON public.asset_cost_records USING btree (recorded_date DESC);


--
-- Name: idx_cost_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_records_type ON public.asset_cost_records USING btree (cost_type);


--
-- Name: idx_dashboard_configs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_configs_user ON public.dashboard_configs USING btree (user_id);


--
-- Name: idx_dashboard_widgets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_widgets_type ON public.dashboard_widgets USING btree (widget_type);


--
-- Name: idx_depreciation_entries_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_asset ON public.depreciation_entries USING btree (asset_id);


--
-- Name: idx_depreciation_entries_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_entry_date ON public.depreciation_entries USING btree (entry_date);


--
-- Name: idx_depreciation_entries_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_period ON public.depreciation_entries USING btree (period_year, period_month);


--
-- Name: idx_depreciation_entries_posted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_posted ON public.depreciation_entries USING btree (is_posted);


--
-- Name: idx_depreciation_entries_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_schedule ON public.depreciation_entries USING btree (schedule_id);


--
-- Name: idx_depreciation_runs_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_runs_organization ON public.depreciation_runs USING btree (organization_id);


--
-- Name: idx_depreciation_runs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_runs_period ON public.depreciation_runs USING btree (period_year, period_month);


--
-- Name: idx_depreciation_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_runs_status ON public.depreciation_runs USING btree (status);


--
-- Name: idx_depreciation_schedules_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_schedules_asset ON public.depreciation_schedules USING btree (asset_id);


--
-- Name: idx_depreciation_schedules_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_schedules_end_date ON public.depreciation_schedules USING btree (end_date);


--
-- Name: idx_depreciation_schedules_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_schedules_organization ON public.depreciation_schedules USING btree (organization_id);


--
-- Name: idx_depreciation_schedules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_schedules_status ON public.depreciation_schedules USING btree (status);


--
-- Name: idx_discovery_results_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discovery_results_rule ON public.cmdb_discovery_results USING btree (rule_id);


--
-- Name: idx_discovery_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discovery_results_status ON public.cmdb_discovery_results USING btree (status);


--
-- Name: idx_discovery_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discovery_rules_type ON public.cmdb_discovery_rules USING btree (discovery_type) WHERE (is_active = true);


--
-- Name: idx_document_files_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_files_document ON public.document_files USING btree (document_id);


--
-- Name: idx_document_relations_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relations_document ON public.document_relations USING btree (document_id);


--
-- Name: idx_document_relations_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relations_type_id ON public.document_relations USING btree (relation_type, relation_id);


--
-- Name: idx_document_template_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_template_versions_created_at ON public.document_template_versions USING btree (created_at DESC);


--
-- Name: idx_document_template_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_template_versions_status ON public.document_template_versions USING btree (status);


--
-- Name: idx_document_template_versions_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_template_versions_template ON public.document_template_versions USING btree (template_id);


--
-- Name: idx_document_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_active ON public.document_templates USING btree (is_active);


--
-- Name: idx_document_templates_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_module ON public.document_templates USING btree (module);


--
-- Name: idx_document_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_org ON public.document_templates USING btree (organization_id);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_status ON public.documents USING btree (approval_status);


--
-- Name: idx_documents_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_tags ON public.documents USING gin (tags);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (type);


--
-- Name: idx_documents_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_updated_at ON public.documents USING btree (updated_at DESC);


--
-- Name: idx_documents_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_visibility ON public.documents USING btree (visibility);


--
-- Name: idx_entries_period_posted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entries_period_posted ON public.depreciation_entries USING btree (period_year, period_month, is_posted);


--
-- Name: idx_fieldkit_approvals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_approvals_created_at ON public.fieldkit_approvals USING btree (created_at DESC);


--
-- Name: idx_fieldkit_approvals_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_approvals_device ON public.fieldkit_approvals USING btree (device_id);


--
-- Name: idx_fieldkit_audit_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_audit_events_created_at ON public.fieldkit_audit_events USING btree (created_at DESC);


--
-- Name: idx_fieldkit_audit_events_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_audit_events_device ON public.fieldkit_audit_events USING btree (device_id);


--
-- Name: idx_fieldkit_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_notes_created_at ON public.fieldkit_notes USING btree (created_at DESC);


--
-- Name: idx_fieldkit_notes_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_notes_device ON public.fieldkit_notes USING btree (device_id);


--
-- Name: idx_fieldkit_playbooks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_playbooks_created_at ON public.fieldkit_playbooks USING btree (created_at DESC);


--
-- Name: idx_fieldkit_playbooks_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_playbooks_device ON public.fieldkit_playbooks USING btree (device_id);


--
-- Name: idx_fieldkit_quick_checks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_quick_checks_created_at ON public.fieldkit_quick_checks USING btree (created_at DESC);


--
-- Name: idx_fieldkit_quick_checks_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_quick_checks_device ON public.fieldkit_quick_checks USING btree (device_id);


--
-- Name: idx_fieldkit_snapshots_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_snapshots_created_at ON public.fieldkit_snapshots USING btree (created_at DESC);


--
-- Name: idx_fieldkit_snapshots_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fieldkit_snapshots_device ON public.fieldkit_snapshots USING btree (device_id);


--
-- Name: idx_inventory_items_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_session ON public.inventory_items USING btree (session_id);


--
-- Name: idx_inventory_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_sessions_created ON public.inventory_sessions USING btree (created_at DESC);


--
-- Name: idx_inventory_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_sessions_status ON public.inventory_sessions USING btree (status);


--
-- Name: idx_label_settings_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_label_settings_organization ON public.label_settings USING btree (organization_id);


--
-- Name: idx_label_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_label_templates_active ON public.label_templates USING btree (is_active);


--
-- Name: idx_label_templates_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_label_templates_default ON public.label_templates USING btree (is_default) WHERE (is_default = true);


--
-- Name: idx_label_templates_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_label_templates_organization ON public.label_templates USING btree (organization_id);


--
-- Name: idx_label_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_label_templates_type ON public.label_templates USING btree (label_type);


--
-- Name: idx_license_audit_license; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_audit_license ON public.license_audit_logs USING btree (license_id);


--
-- Name: idx_license_seats_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_seats_asset ON public.license_seats USING btree (assigned_asset_id);


--
-- Name: idx_license_seats_license; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_seats_license ON public.license_seats USING btree (license_id);


--
-- Name: idx_license_seats_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_seats_user ON public.license_seats USING btree (assigned_user_id);


--
-- Name: idx_licenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_category ON public.licenses USING btree (category_id);


--
-- Name: idx_licenses_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_expiry ON public.licenses USING btree (expiry_date);


--
-- Name: idx_licenses_software_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_software_name ON public.licenses USING btree (software_name);


--
-- Name: idx_licenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_status ON public.licenses USING btree (status);


--
-- Name: idx_licenses_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_supplier ON public.licenses USING btree (supplier_id);


--
-- Name: idx_locations_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_organization ON public.locations USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_locations_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_parent_id ON public.locations USING btree (parent_id);


--
-- Name: idx_locations_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_path ON public.locations USING btree (path);


--
-- Name: idx_maintenance_tickets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_tickets_asset ON public.maintenance_tickets USING btree (asset_id, opened_at DESC);


--
-- Name: idx_message_links_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_links_conversation_id ON public.message_links USING btree (conversation_id);


--
-- Name: idx_message_links_external_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_links_external_message_id ON public.message_links USING btree (external_message_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_model_configs_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_configs_tier ON public.model_configs USING btree (tier, enabled);


--
-- Name: idx_notification_rules_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_rules_event ON public.notification_rules USING btree (event_type) WHERE (is_active = true);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, status);


--
-- Name: idx_ops_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ops_events_entity ON public.ops_events USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_org_units_depth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_depth ON public.org_units USING btree (depth);


--
-- Name: idx_org_units_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_parent ON public.org_units USING btree (parent_id);


--
-- Name: idx_org_units_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_path ON public.org_units USING btree (path);


--
-- Name: idx_organizations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_organizations_code ON public.organizations USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: idx_organizations_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_parent ON public.organizations USING btree (parent_id);


--
-- Name: idx_ou_organization_mappings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ou_organization_mappings_org ON public.ou_organization_mappings USING btree (organization_id);


--
-- Name: idx_pa_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_policy ON public.policy_assignments USING btree (policy_id);


--
-- Name: idx_pa_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_principal ON public.policy_assignments USING btree (principal_type, principal_id);


--
-- Name: idx_pa_scope_ou; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_scope_ou ON public.policy_assignments USING btree (scope_ou_id) WHERE (scope_ou_id IS NOT NULL);


--
-- Name: idx_pending_actions_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_actions_conversation_id ON public.pending_actions USING btree (conversation_id);


--
-- Name: idx_pending_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_actions_status ON public.pending_actions USING btree (status);


--
-- Name: idx_performance_metrics_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_asset ON public.asset_performance_metrics USING btree (asset_id, metric_type);


--
-- Name: idx_performance_metrics_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_time ON public.asset_performance_metrics USING btree (recorded_at DESC);


--
-- Name: idx_permissions_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_resource ON public.permissions USING btree (resource);


--
-- Name: idx_policies_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_slug ON public.policies USING btree (slug);


--
-- Name: idx_print_job_items_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_job_items_asset ON public.print_job_items USING btree (asset_id);


--
-- Name: idx_print_job_items_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_job_items_job ON public.print_job_items USING btree (print_job_id);


--
-- Name: idx_print_job_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_job_items_status ON public.print_job_items USING btree (status);


--
-- Name: idx_print_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_created_at ON public.print_jobs USING btree (created_at DESC);


--
-- Name: idx_print_jobs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_created_by ON public.print_jobs USING btree (created_by);


--
-- Name: idx_print_jobs_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_organization ON public.print_jobs USING btree (organization_id);


--
-- Name: idx_print_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_status ON public.print_jobs USING btree (status);


--
-- Name: idx_print_jobs_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_template ON public.print_jobs USING btree (template_id);


--
-- Name: idx_purchase_plan_docs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_plan_docs_org ON public.purchase_plan_docs USING btree (org_unit_id, fiscal_year);


--
-- Name: idx_purchase_plan_docs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_plan_docs_status ON public.purchase_plan_docs USING btree (status, doc_date DESC);


--
-- Name: idx_purchase_plan_lines_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_plan_lines_doc ON public.purchase_plan_lines USING btree (doc_id, line_no);


--
-- Name: idx_purchase_plan_lines_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_plan_lines_model ON public.purchase_plan_lines USING btree (model_id);


--
-- Name: idx_rbac_acl_effect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_acl_effect ON public.rbac_acl USING btree (effect);


--
-- Name: idx_rbac_acl_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_acl_group ON public.rbac_acl USING btree (principal_group_id);


--
-- Name: idx_rbac_acl_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_acl_role ON public.rbac_acl USING btree (role_id);


--
-- Name: idx_rbac_acl_scope_ou; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_acl_scope_ou ON public.rbac_acl USING btree (scope_ou_id);


--
-- Name: idx_rbac_acl_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_acl_user ON public.rbac_acl USING btree (principal_user_id);


--
-- Name: idx_rbac_gm_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_gm_group ON public.rbac_group_members USING btree (group_id);


--
-- Name: idx_rbac_gm_nested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_gm_nested ON public.rbac_group_members USING btree (member_group_id);


--
-- Name: idx_rbac_gm_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_gm_user ON public.rbac_group_members USING btree (member_user_id);


--
-- Name: idx_rbac_groups_ou; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_groups_ou ON public.rbac_groups USING btree (ou_id);


--
-- Name: idx_rbac_role_perms_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_role_perms_role ON public.rbac_role_permissions USING btree (role);


--
-- Name: idx_rbac_users_linked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_users_linked ON public.rbac_users USING btree (linked_user_id);


--
-- Name: idx_rbac_users_ou; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_users_ou ON public.rbac_users USING btree (ou_id);


--
-- Name: idx_rbac_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_users_status ON public.rbac_users USING btree (status);


--
-- Name: idx_rel_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rel_types_code ON public.cmdb_relationship_types USING btree (code);


--
-- Name: idx_rel_types_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rel_types_from ON public.cmdb_relationship_types USING btree (allowed_from_type_id);


--
-- Name: idx_rel_types_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rel_types_to ON public.cmdb_relationship_types USING btree (allowed_to_type_id);


--
-- Name: idx_relationships_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_from ON public.cmdb_relationships USING btree (from_ci_id);


--
-- Name: idx_relationships_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_metadata ON public.cmdb_relationships USING gin (metadata);


--
-- Name: idx_relationships_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_to ON public.cmdb_relationships USING btree (to_ci_id);


--
-- Name: idx_relationships_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_type ON public.cmdb_relationships USING btree (type_id);


--
-- Name: idx_reminders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_status ON public.reminders USING btree (status, due_at);


--
-- Name: idx_repair_order_parts_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_order_parts_order ON public.repair_order_parts USING btree (repair_order_id, created_at);


--
-- Name: idx_repair_orders_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_asset ON public.repair_orders USING btree (asset_id, opened_at DESC);


--
-- Name: idx_repair_orders_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_ci ON public.repair_orders USING btree (ci_id, opened_at DESC);


--
-- Name: idx_repair_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_status ON public.repair_orders USING btree (status, opened_at DESC);


--
-- Name: idx_report_definitions_data_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_definitions_data_source ON public.report_definitions USING btree (data_source);


--
-- Name: idx_report_definitions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_definitions_org ON public.report_definitions USING btree (organization_id);


--
-- Name: idx_report_definitions_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_definitions_scheduled ON public.report_definitions USING btree (is_scheduled, next_run_at) WHERE (is_scheduled = true);


--
-- Name: idx_report_definitions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_definitions_type ON public.report_definitions USING btree (report_type);


--
-- Name: idx_report_executions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_executions_date ON public.report_executions USING btree (started_at);


--
-- Name: idx_report_executions_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_executions_report ON public.report_executions USING btree (report_id);


--
-- Name: idx_report_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_executions_status ON public.report_executions USING btree (status);


--
-- Name: idx_request_attachments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id);


--
-- Name: idx_request_attachments_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_attachments_uploaded_by ON public.request_attachments USING btree (uploaded_by);


--
-- Name: idx_request_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_audit_actor ON public.request_audit_logs USING btree (actor_id);


--
-- Name: idx_request_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_audit_created ON public.request_audit_logs USING btree (created_at);


--
-- Name: idx_request_audit_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_audit_event ON public.request_audit_logs USING btree (event_type);


--
-- Name: idx_request_audit_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_audit_request ON public.request_audit_logs USING btree (request_id);


--
-- Name: idx_request_comments_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_author ON public.request_comments USING btree (author_id);


--
-- Name: idx_request_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_parent ON public.request_comments USING btree (parent_comment_id);


--
-- Name: idx_request_comments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_request ON public.request_comments USING btree (request_id);


--
-- Name: idx_request_comments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_type ON public.request_comments USING btree (comment_type);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- Name: idx_scheduled_tasks_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_tasks_next ON public.scheduled_tasks USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_schedules_ending_soon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_ending_soon ON public.depreciation_schedules USING btree (end_date) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_security_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_action ON public.security_audit_logs USING btree (action);


--
-- Name: idx_security_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_created ON public.security_audit_logs USING btree (created_at DESC);


--
-- Name: idx_security_audit_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_risk ON public.security_audit_logs USING btree (risk_level);


--
-- Name: idx_security_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_user ON public.security_audit_logs USING btree (user_id);


--
-- Name: idx_service_cis_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_cis_ci ON public.cmdb_service_cis USING btree (ci_id);


--
-- Name: idx_service_cis_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_cis_service ON public.cmdb_service_cis USING btree (service_id);


--
-- Name: idx_services_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_code ON public.cmdb_services USING btree (code);


--
-- Name: idx_services_criticality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_criticality ON public.cmdb_services USING btree (criticality);


--
-- Name: idx_services_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_metadata ON public.cmdb_services USING gin (metadata);


--
-- Name: idx_services_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_status ON public.cmdb_services USING btree (status);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_refresh_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_refresh_token ON public.sessions USING btree (refresh_token);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_spare_part_movements_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_movements_part ON public.spare_part_movements USING btree (part_id, created_at DESC);


--
-- Name: idx_spare_part_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_movements_warehouse ON public.spare_part_movements USING btree (warehouse_id, created_at DESC);


--
-- Name: idx_spare_part_stock_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_stock_lookup ON public.spare_part_stock USING btree (warehouse_id, part_id);


--
-- Name: idx_spare_part_stock_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_part_stock_part ON public.spare_part_stock USING btree (part_id);


--
-- Name: idx_spare_parts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_code ON public.spare_parts USING btree (part_code);


--
-- Name: idx_spare_parts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_name ON public.spare_parts USING btree (name);


--
-- Name: idx_spec_versions_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spec_versions_category_status ON public.asset_category_spec_versions USING btree (category_id, status);


--
-- Name: idx_stock_adjustments_accessory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_accessory ON public.accessory_stock_adjustments USING btree (accessory_id);


--
-- Name: idx_stock_adjustments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_date ON public.accessory_stock_adjustments USING btree (performed_at);


--
-- Name: idx_stock_adjustments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_type ON public.accessory_stock_adjustments USING btree (adjustment_type);


--
-- Name: idx_stock_doc_lines_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_doc_lines_asset_id ON public.stock_document_lines USING btree (asset_id) WHERE (asset_id IS NOT NULL);


--
-- Name: idx_stock_doc_lines_asset_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_doc_lines_asset_model ON public.stock_document_lines USING btree (asset_model_id) WHERE (asset_model_id IS NOT NULL);


--
-- Name: idx_stock_docs_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_docs_location ON public.stock_documents USING btree (location_id) WHERE (location_id IS NOT NULL);


--
-- Name: idx_stock_document_lines_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_document_lines_doc ON public.stock_document_lines USING btree (document_id);


--
-- Name: idx_stock_documents_ref_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_documents_ref_request ON public.stock_documents USING btree (ref_request_id) WHERE (ref_request_id IS NOT NULL);


--
-- Name: idx_stock_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_documents_status ON public.stock_documents USING btree (status, doc_date DESC);


--
-- Name: idx_stock_documents_warehouse_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_documents_warehouse_status ON public.stock_documents USING btree (warehouse_id, status);


--
-- Name: idx_sync_logs_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_logs_rule ON public.integration_sync_logs USING btree (sync_rule_id);


--
-- Name: idx_sync_rules_connector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_rules_connector ON public.integration_sync_rules USING btree (connector_id);


--
-- Name: idx_usage_logs_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_logs_user_date ON public.usage_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_user_alert_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_alert_prefs_user ON public.user_alert_preferences USING btree (user_id);


--
-- Name: idx_user_dashboard_layouts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_dashboard_layouts_user ON public.user_dashboard_layouts USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_vendors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_name ON public.vendors USING btree (name);


--
-- Name: idx_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_code ON public.warehouses USING btree (code);


--
-- Name: idx_warehouses_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_location ON public.warehouses USING btree (location_id);


--
-- Name: idx_webhooks_connector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhooks_connector ON public.integration_webhooks USING btree (connector_id);


--
-- Name: idx_wf_approvals_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_approvals_assignee ON public.wf_approvals USING btree (assignee_user_id);


--
-- Name: idx_wf_approvals_assignee_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_approvals_assignee_pending ON public.wf_approvals USING btree (assignee_user_id, status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_wf_approvals_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_approvals_due_at ON public.wf_approvals USING btree (due_at) WHERE (((status)::text = 'pending'::text) AND (due_at IS NOT NULL));


--
-- Name: idx_wf_approvals_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_approvals_request ON public.wf_approvals USING btree (request_id);


--
-- Name: idx_wf_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_approvals_status ON public.wf_approvals USING btree (status);


--
-- Name: idx_wf_attachments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_attachments_request ON public.wf_attachments USING btree (request_id);


--
-- Name: idx_wf_events_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_events_actor ON public.wf_events USING btree (actor_id);


--
-- Name: idx_wf_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_events_request ON public.wf_events USING btree (request_id);


--
-- Name: idx_wf_req_lines_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_req_lines_asset ON public.wf_request_lines USING btree (asset_id) WHERE (asset_id IS NOT NULL);


--
-- Name: idx_wf_req_lines_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_req_lines_part ON public.wf_request_lines USING btree (part_id) WHERE (part_id IS NOT NULL);


--
-- Name: idx_wf_req_lines_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_req_lines_request ON public.wf_request_lines USING btree (request_id);


--
-- Name: idx_wf_req_lines_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_req_lines_status ON public.wf_request_lines USING btree (status);


--
-- Name: idx_wf_requests_definition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_requests_definition ON public.wf_requests USING btree (definition_id);


--
-- Name: idx_wf_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_requests_requester ON public.wf_requests USING btree (requester_id);


--
-- Name: idx_wf_requests_requester_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_requests_requester_status ON public.wf_requests USING btree (requester_id, status);


--
-- Name: idx_wf_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_requests_status ON public.wf_requests USING btree (status);


--
-- Name: idx_wf_requests_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_requests_type ON public.wf_requests USING btree (request_type);


--
-- Name: idx_workflow_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_requests_status ON public.workflow_requests USING btree (status, created_at DESC);


--
-- Name: ix_approvals__approver_id__decided_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approvals__approver_id__decided_at ON public.approvals USING btree (approver_id, decided_at);


--
-- Name: ix_approvals__entity_type__entity_id__step_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_approvals__entity_type__entity_id__step_no ON public.approvals USING btree (entity_type, entity_id, step_no);


--
-- Name: ix_cmdb_ci_attribute_values__attribute_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_attribute_values__attribute_key ON public.cmdb_ci_attribute_values USING btree (attribute_key);


--
-- Name: ix_cmdb_ci_attribute_values__ci_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_attribute_values__ci_id ON public.cmdb_ci_attribute_values USING btree (ci_id);


--
-- Name: ix_cmdb_ci_attribute_values__schema_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_attribute_values__schema_id ON public.cmdb_ci_attribute_values USING btree (schema_id);


--
-- Name: ix_cmdb_ci_attribute_values__value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_attribute_values__value ON public.cmdb_ci_attribute_values USING gin (value);


--
-- Name: ix_cmdb_ci_schemas__ci_type_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_schemas__ci_type_version_id ON public.cmdb_ci_schemas USING btree (ci_type_version_id);


--
-- Name: ix_cmdb_ci_schemas__ci_type_version_id__display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_schemas__ci_type_version_id__display_order ON public.cmdb_ci_schemas USING btree (ci_type_version_id, display_order);


--
-- Name: ix_cmdb_ci_type_versions__type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_type_versions__type_id ON public.cmdb_ci_type_versions USING btree (type_id);


--
-- Name: ix_cmdb_ci_type_versions__type_id__status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_type_versions__type_id__status ON public.cmdb_ci_type_versions USING btree (type_id, status) WHERE ((status)::text = 'active'::text);


--
-- Name: ix_cmdb_ci_types__code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cmdb_ci_types__code ON public.cmdb_ci_types USING btree (code);


--
-- Name: spare_part_lots_fefo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spare_part_lots_fefo_idx ON public.spare_part_lots USING btree (expiry_date) WHERE (((status)::text = 'active'::text) AND (on_hand > 0));


--
-- Name: spare_part_lots_warehouse_part_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spare_part_lots_warehouse_part_idx ON public.spare_part_lots USING btree (warehouse_id, part_id);


--
-- Name: stock_documents_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_documents_idempotency_key_idx ON public.stock_documents USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uidx_wf_approvals_one_approved_per_step; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_wf_approvals_one_approved_per_step ON public.wf_approvals USING btree (request_id, step_no) WHERE ((status)::text = 'approved'::text);


--
-- Name: uq_asset_status_catalogs_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_asset_status_catalogs_code ON public.asset_status_catalogs USING btree (lower(code));


--
-- Name: uq_asset_status_catalogs_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_asset_status_catalogs_name ON public.asset_status_catalogs USING btree (lower(name));


--
-- Name: license_seats check_seat_availability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_seat_availability BEFORE INSERT ON public.license_seats FOR EACH ROW EXECUTE FUNCTION public.check_license_seat_availability();


--
-- Name: alert_rules trg_alert_rules_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_alert_rules_updated BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approval_steps trg_approval_step_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_step_updated_at BEFORE UPDATE ON public.approval_steps FOR EACH ROW EXECUTE FUNCTION public.update_request_timestamp();


--
-- Name: asset_checkouts trg_asset_checkouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_checkouts_updated_at BEFORE UPDATE ON public.asset_checkouts FOR EACH ROW EXECUTE FUNCTION public.update_checkout_updated_at();


--
-- Name: audit_sessions trg_audit_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_code BEFORE INSERT ON public.audit_sessions FOR EACH ROW WHEN ((new.audit_code IS NULL)) EXECUTE FUNCTION public.generate_audit_code();


--
-- Name: audit_items trg_audit_items_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_items_timestamp BEFORE UPDATE ON public.audit_items FOR EACH ROW EXECUTE FUNCTION public.update_audit_timestamp();


--
-- Name: audit_items trg_audit_progress; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_progress AFTER INSERT OR DELETE OR UPDATE ON public.audit_items FOR EACH ROW EXECUTE FUNCTION public.update_audit_progress();


--
-- Name: audit_sessions trg_audit_sessions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_sessions_timestamp BEFORE UPDATE ON public.audit_sessions FOR EACH ROW EXECUTE FUNCTION public.update_audit_timestamp();


--
-- Name: audit_unregistered_assets trg_audit_unregistered_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_unregistered_timestamp BEFORE UPDATE ON public.audit_unregistered_assets FOR EACH ROW EXECUTE FUNCTION public.update_audit_timestamp();


--
-- Name: asset_checkouts trg_auto_checkout_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_checkout_code BEFORE INSERT ON public.asset_checkouts FOR EACH ROW EXECUTE FUNCTION public.auto_generate_checkout_code();


--
-- Name: component_assignments trg_component_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_component_assignments_updated_at BEFORE UPDATE ON public.component_assignments FOR EACH ROW EXECUTE FUNCTION public.update_components_updated_at();


--
-- Name: component_categories trg_component_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_component_categories_updated_at BEFORE UPDATE ON public.component_categories FOR EACH ROW EXECUTE FUNCTION public.update_components_updated_at();


--
-- Name: component_manufacturers trg_component_manufacturers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_component_manufacturers_updated_at BEFORE UPDATE ON public.component_manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_components_updated_at();


--
-- Name: components trg_components_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_components_updated_at();


--
-- Name: dashboard_widgets trg_dashboard_widgets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dashboard_widgets_updated BEFORE UPDATE ON public.dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: depreciation_entries trg_depreciation_entry_posted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_depreciation_entry_posted AFTER UPDATE ON public.depreciation_entries FOR EACH ROW WHEN (((new.is_posted = true) AND (old.is_posted = false))) EXECUTE FUNCTION public.update_schedule_after_post();


--
-- Name: depreciation_runs trg_depreciation_runs_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_depreciation_runs_code BEFORE INSERT ON public.depreciation_runs FOR EACH ROW EXECUTE FUNCTION public.generate_depreciation_run_code();


--
-- Name: depreciation_schedules trg_depreciation_schedules_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_depreciation_schedules_timestamp BEFORE UPDATE ON public.depreciation_schedules FOR EACH ROW EXECUTE FUNCTION public.update_depreciation_timestamp();


--
-- Name: document_templates trg_document_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.set_document_templates_updated_at();


--
-- Name: alert_rules trg_generate_alert_rule_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_alert_rule_code BEFORE INSERT ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.generate_alert_rule_code();


--
-- Name: report_definitions trg_generate_report_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_report_code BEFORE INSERT ON public.report_definitions FOR EACH ROW EXECUTE FUNCTION public.generate_report_code();


--
-- Name: asset_requests trg_generate_request_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_request_code BEFORE INSERT ON public.asset_requests FOR EACH ROW WHEN (((new.request_code IS NULL) OR ((new.request_code)::text = ''::text))) EXECUTE FUNCTION public.generate_request_code();


--
-- Name: label_templates trg_label_templates_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_label_templates_code BEFORE INSERT ON public.label_templates FOR EACH ROW EXECUTE FUNCTION public.generate_template_code();


--
-- Name: label_templates trg_label_templates_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_label_templates_default BEFORE INSERT OR UPDATE ON public.label_templates FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_template();


--
-- Name: label_templates trg_label_templates_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_label_templates_timestamp BEFORE UPDATE ON public.label_templates FOR EACH ROW EXECUTE FUNCTION public.update_labels_timestamp();


--
-- Name: print_jobs trg_print_jobs_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_code BEFORE INSERT ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.generate_print_job_code();


--
-- Name: print_jobs trg_print_jobs_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_timestamp BEFORE UPDATE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.update_labels_timestamp();


--
-- Name: print_jobs trg_print_jobs_total; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_total BEFORE INSERT OR UPDATE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.calculate_total_labels();


--
-- Name: report_definitions trg_report_definitions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_report_definitions_updated BEFORE UPDATE ON public.report_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asset_requests trg_request_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_updated_at BEFORE UPDATE ON public.asset_requests FOR EACH ROW EXECUTE FUNCTION public.update_request_timestamp();


--
-- Name: stock_documents trg_stock_document_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_document_state BEFORE UPDATE OF status ON public.stock_documents FOR EACH ROW EXECUTE FUNCTION public.fn_stock_document_state_guard();


--
-- Name: user_dashboard_layouts trg_user_dashboard_layouts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_dashboard_layouts_updated BEFORE UPDATE ON public.user_dashboard_layouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: wf_request_lines trg_wf_req_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wf_req_lines_updated_at BEFORE UPDATE ON public.wf_request_lines FOR EACH ROW EXECUTE FUNCTION public.fn_wf_req_line_updated_at();


--
-- Name: consumable_categories trigger_consumable_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_consumable_categories_updated_at BEFORE UPDATE ON public.consumable_categories FOR EACH ROW EXECUTE FUNCTION public.update_consumables_updated_at();


--
-- Name: consumable_manufacturers trigger_consumable_manufacturers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_consumable_manufacturers_updated_at BEFORE UPDATE ON public.consumable_manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_consumables_updated_at();


--
-- Name: consumables trigger_consumables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_consumables_updated_at BEFORE UPDATE ON public.consumables FOR EACH ROW EXECUTE FUNCTION public.update_consumables_updated_at();


--
-- Name: accessories accessories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.accessory_categories(id);


--
-- Name: accessories accessories_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.accessory_manufacturers(id);


--
-- Name: accessories accessories_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: accessory_audit_logs accessory_audit_logs_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_audit_logs
    ADD CONSTRAINT accessory_audit_logs_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE CASCADE;


--
-- Name: accessory_audit_logs accessory_audit_logs_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_audit_logs
    ADD CONSTRAINT accessory_audit_logs_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.accessory_stock_adjustments(id);


--
-- Name: accessory_audit_logs accessory_audit_logs_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_audit_logs
    ADD CONSTRAINT accessory_audit_logs_checkout_id_fkey FOREIGN KEY (checkout_id) REFERENCES public.accessory_checkouts(id);


--
-- Name: accessory_categories accessory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_categories
    ADD CONSTRAINT accessory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accessory_categories(id);


--
-- Name: accessory_checkouts accessory_checkouts_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_checkouts
    ADD CONSTRAINT accessory_checkouts_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE CASCADE;


--
-- Name: accessory_stock_adjustments accessory_stock_adjustments_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_stock_adjustments
    ADD CONSTRAINT accessory_stock_adjustments_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE CASCADE;


--
-- Name: alert_history alert_history_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;


--
-- Name: alert_subscriptions alert_subscriptions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_subscriptions
    ADD CONSTRAINT alert_subscriptions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: alert_subscriptions alert_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_subscriptions
    ADD CONSTRAINT alert_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: approval_steps approval_steps_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.asset_requests(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: asset_attachments asset_attachments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_attachments
    ADD CONSTRAINT asset_attachments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_category_spec_definitions asset_category_spec_defs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_definitions
    ADD CONSTRAINT asset_category_spec_defs_version_id_fkey FOREIGN KEY (spec_version_id) REFERENCES public.asset_category_spec_versions(id) ON DELETE CASCADE;


--
-- Name: asset_category_spec_versions asset_category_spec_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_versions
    ADD CONSTRAINT asset_category_spec_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE CASCADE;


--
-- Name: asset_consumption_logs asset_consumption_logs_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_consumption_logs
    ADD CONSTRAINT asset_consumption_logs_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.asset_models(id) ON DELETE CASCADE;


--
-- Name: asset_events asset_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_increase_docs asset_increase_docs_purchase_plan_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_docs
    ADD CONSTRAINT asset_increase_docs_purchase_plan_doc_id_fkey FOREIGN KEY (purchase_plan_doc_id) REFERENCES public.purchase_plan_docs(id);


--
-- Name: asset_increase_docs asset_increase_docs_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_docs
    ADD CONSTRAINT asset_increase_docs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: asset_increase_lines asset_increase_lines_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: asset_increase_lines asset_increase_lines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id);


--
-- Name: asset_increase_lines asset_increase_lines_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_doc_id_fkey FOREIGN KEY (doc_id) REFERENCES public.asset_increase_docs(id) ON DELETE CASCADE;


--
-- Name: asset_increase_lines asset_increase_lines_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: asset_increase_lines asset_increase_lines_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_increase_lines
    ADD CONSTRAINT asset_increase_lines_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.asset_models(id);


--
-- Name: asset_models asset_models_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;


--
-- Name: asset_models asset_models_spec_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_spec_version_id_fkey FOREIGN KEY (spec_version_id) REFERENCES public.asset_category_spec_versions(id) ON DELETE SET NULL;


--
-- Name: asset_models asset_models_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: assets assets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: assets assets_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.asset_models(id) ON DELETE SET NULL;


--
-- Name: assets assets_source_doc_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_source_doc_line_id_fkey FOREIGN KEY (source_doc_line_id) REFERENCES public.stock_document_lines(id) ON DELETE SET NULL;


--
-- Name: assets assets_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: assets assets_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: audit_auditors audit_auditors_assigned_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_auditors
    ADD CONSTRAINT audit_auditors_assigned_location_id_fkey FOREIGN KEY (assigned_location_id) REFERENCES public.locations(id);


--
-- Name: audit_auditors audit_auditors_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_auditors
    ADD CONSTRAINT audit_auditors_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_auditors audit_auditors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_auditors
    ADD CONSTRAINT audit_auditors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_categories audit_categories_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_categories
    ADD CONSTRAINT audit_categories_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_categories audit_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_categories
    ADD CONSTRAINT audit_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id);


--
-- Name: audit_history audit_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_history
    ADD CONSTRAINT audit_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: audit_history audit_history_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_history
    ADD CONSTRAINT audit_history_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_items audit_items_actual_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_actual_location_id_fkey FOREIGN KEY (actual_location_id) REFERENCES public.locations(id);


--
-- Name: audit_items audit_items_actual_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_actual_user_id_fkey FOREIGN KEY (actual_user_id) REFERENCES public.users(id);


--
-- Name: audit_items audit_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: audit_items audit_items_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_items audit_items_audited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_audited_by_fkey FOREIGN KEY (audited_by) REFERENCES public.users(id);


--
-- Name: audit_items audit_items_expected_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_expected_location_id_fkey FOREIGN KEY (expected_location_id) REFERENCES public.locations(id);


--
-- Name: audit_items audit_items_expected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_expected_user_id_fkey FOREIGN KEY (expected_user_id) REFERENCES public.users(id);


--
-- Name: audit_items audit_items_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: audit_locations audit_locations_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_locations
    ADD CONSTRAINT audit_locations_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_locations audit_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_locations
    ADD CONSTRAINT audit_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: audit_sessions audit_sessions_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: audit_sessions audit_sessions_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: audit_sessions audit_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: audit_sessions audit_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_unregistered_assets audit_unregistered_assets_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_unregistered_assets audit_unregistered_assets_found_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_found_by_fkey FOREIGN KEY (found_by) REFERENCES public.users(id);


--
-- Name: audit_unregistered_assets audit_unregistered_assets_location_found_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_location_found_id_fkey FOREIGN KEY (location_found_id) REFERENCES public.locations(id);


--
-- Name: audit_unregistered_assets audit_unregistered_assets_registered_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_registered_asset_id_fkey FOREIGN KEY (registered_asset_id) REFERENCES public.assets(id);


--
-- Name: audit_unregistered_assets audit_unregistered_assets_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_unregistered_assets
    ADD CONSTRAINT audit_unregistered_assets_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);


--
-- Name: channel_bindings channel_bindings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bindings
    ADD CONSTRAINT channel_bindings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_bindings channel_bindings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_bindings
    ADD CONSTRAINT channel_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: channel_conversations channel_conversations_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_conversations
    ADD CONSTRAINT channel_conversations_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: checkout_audit_logs checkout_audit_logs_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_audit_logs
    ADD CONSTRAINT checkout_audit_logs_checkout_id_fkey FOREIGN KEY (checkout_id) REFERENCES public.asset_checkouts(id) ON DELETE SET NULL;


--
-- Name: checkout_extensions checkout_extensions_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_extensions
    ADD CONSTRAINT checkout_extensions_checkout_id_fkey FOREIGN KEY (checkout_id) REFERENCES public.asset_checkouts(id) ON DELETE CASCADE;


--
-- Name: checkout_transfers checkout_transfers_new_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_transfers
    ADD CONSTRAINT checkout_transfers_new_checkout_id_fkey FOREIGN KEY (new_checkout_id) REFERENCES public.asset_checkouts(id);


--
-- Name: checkout_transfers checkout_transfers_original_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_transfers
    ADD CONSTRAINT checkout_transfers_original_checkout_id_fkey FOREIGN KEY (original_checkout_id) REFERENCES public.asset_checkouts(id);


--
-- Name: cmdb_changes cmdb_changes_primary_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_changes
    ADD CONSTRAINT cmdb_changes_primary_ci_id_fkey FOREIGN KEY (primary_ci_id) REFERENCES public.cmdb_cis(id) ON DELETE SET NULL;


--
-- Name: cmdb_ci_attr_values cmdb_ci_attr_values_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attr_values
    ADD CONSTRAINT cmdb_ci_attr_values_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_attribute_values cmdb_ci_attribute_values_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attribute_values
    ADD CONSTRAINT cmdb_ci_attribute_values_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_attribute_values cmdb_ci_attribute_values_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attribute_values
    ADD CONSTRAINT cmdb_ci_attribute_values_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.cmdb_ci_schemas(id) ON DELETE RESTRICT;


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_ci_type_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_ci_type_version_id_fkey FOREIGN KEY (ci_type_version_id) REFERENCES public.cmdb_ci_type_versions(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.cmdb_ci_type_versions(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_tags cmdb_ci_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_tags
    ADD CONSTRAINT cmdb_ci_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cmdb_smart_tags(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_type_attr_defs cmdb_ci_type_attr_defs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_attr_defs
    ADD CONSTRAINT cmdb_ci_type_attr_defs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.cmdb_ci_type_versions(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_type_versions cmdb_ci_type_versions_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_type_versions
    ADD CONSTRAINT cmdb_ci_type_versions_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.cmdb_ci_types(id) ON DELETE CASCADE;


--
-- Name: cmdb_cis cmdb_cis_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_cis
    ADD CONSTRAINT cmdb_cis_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: cmdb_cis cmdb_cis_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_cis
    ADD CONSTRAINT cmdb_cis_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: cmdb_cis cmdb_cis_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_cis
    ADD CONSTRAINT cmdb_cis_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.cmdb_ci_types(id) ON DELETE RESTRICT;


--
-- Name: cmdb_config_file_versions cmdb_config_file_versions_config_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_file_versions
    ADD CONSTRAINT cmdb_config_file_versions_config_file_id_fkey FOREIGN KEY (config_file_id) REFERENCES public.cmdb_config_files(id) ON DELETE CASCADE;


--
-- Name: cmdb_config_file_versions cmdb_config_file_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_file_versions
    ADD CONSTRAINT cmdb_config_file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cmdb_config_files cmdb_config_files_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_files
    ADD CONSTRAINT cmdb_config_files_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_config_files cmdb_config_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_files
    ADD CONSTRAINT cmdb_config_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cmdb_config_files cmdb_config_files_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_config_files
    ADD CONSTRAINT cmdb_config_files_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: cmdb_discovery_results cmdb_discovery_results_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_discovery_results
    ADD CONSTRAINT cmdb_discovery_results_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.cmdb_discovery_rules(id) ON DELETE CASCADE;


--
-- Name: cmdb_relationship_types cmdb_relationship_types_allowed_from_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationship_types
    ADD CONSTRAINT cmdb_relationship_types_allowed_from_type_id_fkey FOREIGN KEY (allowed_from_type_id) REFERENCES public.cmdb_ci_types(id) ON DELETE SET NULL;


--
-- Name: cmdb_relationship_types cmdb_relationship_types_allowed_to_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationship_types
    ADD CONSTRAINT cmdb_relationship_types_allowed_to_type_id_fkey FOREIGN KEY (allowed_to_type_id) REFERENCES public.cmdb_ci_types(id) ON DELETE SET NULL;


--
-- Name: cmdb_relationships cmdb_relationships_from_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationships
    ADD CONSTRAINT cmdb_relationships_from_ci_id_fkey FOREIGN KEY (from_ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_relationships cmdb_relationships_to_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationships
    ADD CONSTRAINT cmdb_relationships_to_ci_id_fkey FOREIGN KEY (to_ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_relationships cmdb_relationships_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_relationships
    ADD CONSTRAINT cmdb_relationships_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.cmdb_relationship_types(id) ON DELETE RESTRICT;


--
-- Name: cmdb_service_cis cmdb_service_cis_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_cis
    ADD CONSTRAINT cmdb_service_cis_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_service_cis cmdb_service_cis_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_cis
    ADD CONSTRAINT cmdb_service_cis_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.cmdb_services(id) ON DELETE CASCADE;


--
-- Name: cmdb_service_members cmdb_service_members_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_members
    ADD CONSTRAINT cmdb_service_members_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_service_members cmdb_service_members_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_service_members
    ADD CONSTRAINT cmdb_service_members_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.cmdb_services(id) ON DELETE CASCADE;


--
-- Name: compliance_assessments compliance_assessments_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assessments
    ADD CONSTRAINT compliance_assessments_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE;


--
-- Name: compliance_controls compliance_controls_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE;


--
-- Name: component_assignments component_assignments_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_assignments
    ADD CONSTRAINT component_assignments_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE RESTRICT;


--
-- Name: component_audit_logs component_audit_logs_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_audit_logs
    ADD CONSTRAINT component_audit_logs_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.component_assignments(id) ON DELETE SET NULL;


--
-- Name: component_audit_logs component_audit_logs_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_audit_logs
    ADD CONSTRAINT component_audit_logs_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE SET NULL;


--
-- Name: component_audit_logs component_audit_logs_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_audit_logs
    ADD CONSTRAINT component_audit_logs_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.component_receipts(id) ON DELETE SET NULL;


--
-- Name: component_categories component_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_categories
    ADD CONSTRAINT component_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.component_categories(id);


--
-- Name: component_receipts component_receipts_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_receipts
    ADD CONSTRAINT component_receipts_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE RESTRICT;


--
-- Name: components components_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.component_categories(id);


--
-- Name: components components_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.component_manufacturers(id);


--
-- Name: consumable_categories consumable_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_categories
    ADD CONSTRAINT consumable_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.consumable_categories(id) ON DELETE SET NULL;


--
-- Name: consumable_issues consumable_issues_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_issues
    ADD CONSTRAINT consumable_issues_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id) ON DELETE CASCADE;


--
-- Name: consumable_receipts consumable_receipts_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_receipts
    ADD CONSTRAINT consumable_receipts_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id) ON DELETE CASCADE;


--
-- Name: consumables consumables_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumables
    ADD CONSTRAINT consumables_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.consumable_categories(id) ON DELETE SET NULL;


--
-- Name: consumables consumables_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumables
    ADD CONSTRAINT consumables_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.consumable_manufacturers(id) ON DELETE SET NULL;


--
-- Name: depreciation_entries depreciation_entries_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: depreciation_entries depreciation_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: depreciation_entries depreciation_entries_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.depreciation_schedules(id) ON DELETE CASCADE;


--
-- Name: depreciation_runs depreciation_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_runs
    ADD CONSTRAINT depreciation_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: depreciation_runs depreciation_runs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_runs
    ADD CONSTRAINT depreciation_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: depreciation_schedules depreciation_schedules_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT depreciation_schedules_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: depreciation_schedules depreciation_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT depreciation_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: depreciation_schedules depreciation_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT depreciation_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: depreciation_schedules depreciation_schedules_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_schedules
    ADD CONSTRAINT depreciation_schedules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: depreciation_settings depreciation_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_settings
    ADD CONSTRAINT depreciation_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: depreciation_settings depreciation_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_settings
    ADD CONSTRAINT depreciation_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_files document_files_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_relations document_relations_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relations
    ADD CONSTRAINT document_relations_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_template_versions document_template_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_template_versions document_template_versions_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_template_versions document_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE;


--
-- Name: document_templates document_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_templates document_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: document_templates document_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: fieldkit_snapshots fieldkit_snapshots_quick_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fieldkit_snapshots
    ADD CONSTRAINT fieldkit_snapshots_quick_check_id_fkey FOREIGN KEY (quick_check_id) REFERENCES public.fieldkit_quick_checks(id) ON DELETE SET NULL;


--
-- Name: asset_checkouts fk_asset_checkouts_organization; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_checkouts
    ADD CONSTRAINT fk_asset_checkouts_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: document_templates fk_document_templates_active_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT fk_document_templates_active_version FOREIGN KEY (active_version_id) REFERENCES public.document_template_versions(id) ON DELETE SET NULL;


--
-- Name: inbound_dedup inbound_dedup_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_dedup
    ADD CONSTRAINT inbound_dedup_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: integration_sync_logs integration_sync_logs_sync_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_logs
    ADD CONSTRAINT integration_sync_logs_sync_rule_id_fkey FOREIGN KEY (sync_rule_id) REFERENCES public.integration_sync_rules(id) ON DELETE CASCADE;


--
-- Name: integration_sync_rules integration_sync_rules_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_sync_rules
    ADD CONSTRAINT integration_sync_rules_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.integration_connectors(id) ON DELETE CASCADE;


--
-- Name: integration_webhooks integration_webhooks_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.integration_connectors(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_expected_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_expected_location_id_fkey FOREIGN KEY (expected_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_scanned_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_scanned_location_id_fkey FOREIGN KEY (scanned_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.inventory_sessions(id) ON DELETE CASCADE;


--
-- Name: inventory_sessions inventory_sessions_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_sessions
    ADD CONSTRAINT inventory_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: label_settings label_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_settings
    ADD CONSTRAINT label_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: label_settings label_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_settings
    ADD CONSTRAINT label_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: label_templates label_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_templates
    ADD CONSTRAINT label_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: label_templates label_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_templates
    ADD CONSTRAINT label_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: label_templates label_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_templates
    ADD CONSTRAINT label_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_audit_logs license_audit_logs_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_audit_logs
    ADD CONSTRAINT license_audit_logs_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_seats license_seats_assigned_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_seats
    ADD CONSTRAINT license_seats_assigned_asset_id_fkey FOREIGN KEY (assigned_asset_id) REFERENCES public.assets(id);


--
-- Name: license_seats license_seats_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_seats
    ADD CONSTRAINT license_seats_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: licenses licenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.license_categories(id);


--
-- Name: licenses licenses_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: locations locations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: maintenance_tickets maintenance_tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_tickets
    ADD CONSTRAINT maintenance_tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: message_links message_links_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_links
    ADD CONSTRAINT message_links_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id) ON DELETE SET NULL;


--
-- Name: org_units org_units_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT org_units_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.org_units(id) ON DELETE RESTRICT;


--
-- Name: organizations organizations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: ou_organization_mappings ou_organization_mappings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ou_organization_mappings
    ADD CONSTRAINT ou_organization_mappings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ou_organization_mappings ou_organization_mappings_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ou_organization_mappings
    ADD CONSTRAINT ou_organization_mappings_ou_id_fkey FOREIGN KEY (ou_id) REFERENCES public.org_units(id) ON DELETE CASCADE;


--
-- Name: pending_actions pending_actions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_actions
    ADD CONSTRAINT pending_actions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: policy_assignments policy_assignments_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE CASCADE;


--
-- Name: policy_assignments policy_assignments_scope_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_scope_ou_id_fkey FOREIGN KEY (scope_ou_id) REFERENCES public.org_units(id) ON DELETE SET NULL;


--
-- Name: policy_permissions policy_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_permissions
    ADD CONSTRAINT policy_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: policy_permissions policy_permissions_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_permissions
    ADD CONSTRAINT policy_permissions_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE CASCADE;


--
-- Name: print_job_items print_job_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_job_items
    ADD CONSTRAINT print_job_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: print_job_items print_job_items_print_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_job_items
    ADD CONSTRAINT print_job_items_print_job_id_fkey FOREIGN KEY (print_job_id) REFERENCES public.print_jobs(id) ON DELETE CASCADE;


--
-- Name: print_jobs print_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: print_jobs print_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: print_jobs print_jobs_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.label_templates(id) ON DELETE RESTRICT;


--
-- Name: purchase_plan_lines purchase_plan_lines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_lines
    ADD CONSTRAINT purchase_plan_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id);


--
-- Name: purchase_plan_lines purchase_plan_lines_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_lines
    ADD CONSTRAINT purchase_plan_lines_doc_id_fkey FOREIGN KEY (doc_id) REFERENCES public.purchase_plan_docs(id) ON DELETE CASCADE;


--
-- Name: purchase_plan_lines purchase_plan_lines_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_plan_lines
    ADD CONSTRAINT purchase_plan_lines_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.asset_models(id);


--
-- Name: rbac_acl rbac_acl_principal_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_acl
    ADD CONSTRAINT rbac_acl_principal_group_id_fkey FOREIGN KEY (principal_group_id) REFERENCES public.rbac_groups(id) ON DELETE CASCADE;


--
-- Name: rbac_acl rbac_acl_principal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_acl
    ADD CONSTRAINT rbac_acl_principal_user_id_fkey FOREIGN KEY (principal_user_id) REFERENCES public.rbac_users(id) ON DELETE CASCADE;


--
-- Name: rbac_acl rbac_acl_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_acl
    ADD CONSTRAINT rbac_acl_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_roles(id) ON DELETE CASCADE;


--
-- Name: rbac_acl rbac_acl_scope_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_acl
    ADD CONSTRAINT rbac_acl_scope_ou_id_fkey FOREIGN KEY (scope_ou_id) REFERENCES public.org_units(id) ON DELETE CASCADE;


--
-- Name: rbac_group_members rbac_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT rbac_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.rbac_groups(id) ON DELETE CASCADE;


--
-- Name: rbac_group_members rbac_group_members_member_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT rbac_group_members_member_group_id_fkey FOREIGN KEY (member_group_id) REFERENCES public.rbac_groups(id) ON DELETE CASCADE;


--
-- Name: rbac_group_members rbac_group_members_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_group_members
    ADD CONSTRAINT rbac_group_members_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES public.rbac_users(id) ON DELETE CASCADE;


--
-- Name: rbac_groups rbac_groups_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_groups
    ADD CONSTRAINT rbac_groups_ou_id_fkey FOREIGN KEY (ou_id) REFERENCES public.org_units(id) ON DELETE RESTRICT;


--
-- Name: rbac_role_ad_permissions rbac_role_ad_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_ad_permissions
    ADD CONSTRAINT rbac_role_ad_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.rbac_ad_permissions(id) ON DELETE CASCADE;


--
-- Name: rbac_role_ad_permissions rbac_role_ad_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_ad_permissions
    ADD CONSTRAINT rbac_role_ad_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_roles(id) ON DELETE CASCADE;


--
-- Name: rbac_role_permissions rbac_role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.rbac_permissions(id) ON DELETE CASCADE;


--
-- Name: rbac_users rbac_users_linked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_users
    ADD CONSTRAINT rbac_users_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rbac_users rbac_users_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_users
    ADD CONSTRAINT rbac_users_ou_id_fkey FOREIGN KEY (ou_id) REFERENCES public.org_units(id) ON DELETE RESTRICT;


--
-- Name: reminders reminders_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: repair_order_parts repair_order_parts_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_parts
    ADD CONSTRAINT repair_order_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id) ON DELETE SET NULL;


--
-- Name: repair_order_parts repair_order_parts_repair_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_parts
    ADD CONSTRAINT repair_order_parts_repair_order_id_fkey FOREIGN KEY (repair_order_id) REFERENCES public.repair_orders(id) ON DELETE CASCADE;


--
-- Name: repair_order_parts repair_order_parts_stock_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_parts
    ADD CONSTRAINT repair_order_parts_stock_document_id_fkey FOREIGN KEY (stock_document_id) REFERENCES public.stock_documents(id) ON DELETE SET NULL;


--
-- Name: repair_order_parts repair_order_parts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_parts
    ADD CONSTRAINT repair_order_parts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: repair_orders repair_orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: repair_orders repair_orders_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE SET NULL;


--
-- Name: repair_orders repair_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: report_executions report_executions_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_executions
    ADD CONSTRAINT report_executions_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.report_definitions(id) ON DELETE CASCADE;


--
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.asset_requests(id) ON DELETE CASCADE;


--
-- Name: request_audit_logs request_audit_logs_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_audit_logs
    ADD CONSTRAINT request_audit_logs_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.asset_requests(id) ON DELETE CASCADE;


--
-- Name: request_comments request_comments_approval_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_approval_step_id_fkey FOREIGN KEY (approval_step_id) REFERENCES public.approval_steps(id) ON DELETE SET NULL;


--
-- Name: request_comments request_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.request_comments(id) ON DELETE SET NULL;


--
-- Name: request_comments request_comments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.asset_requests(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: spare_part_lots spare_part_lots_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_lots
    ADD CONSTRAINT spare_part_lots_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id) ON DELETE CASCADE;


--
-- Name: spare_part_lots spare_part_lots_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_lots
    ADD CONSTRAINT spare_part_lots_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: spare_part_movements spare_part_movements_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_movements
    ADD CONSTRAINT spare_part_movements_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id) ON DELETE CASCADE;


--
-- Name: spare_part_movements spare_part_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_movements
    ADD CONSTRAINT spare_part_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: spare_part_stock spare_part_stock_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_stock
    ADD CONSTRAINT spare_part_stock_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id) ON DELETE CASCADE;


--
-- Name: spare_part_stock spare_part_stock_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_part_stock
    ADD CONSTRAINT spare_part_stock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_document_lines stock_document_lines_asset_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_asset_category_id_fkey FOREIGN KEY (asset_category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;


--
-- Name: stock_document_lines stock_document_lines_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: stock_document_lines stock_document_lines_asset_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_asset_model_id_fkey FOREIGN KEY (asset_model_id) REFERENCES public.asset_models(id) ON DELETE SET NULL;


--
-- Name: stock_document_lines stock_document_lines_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.stock_documents(id) ON DELETE CASCADE;


--
-- Name: stock_document_lines stock_document_lines_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_document_lines
    ADD CONSTRAINT stock_document_lines_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id);


--
-- Name: stock_documents stock_documents_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: stock_documents stock_documents_ref_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_ref_request_id_fkey FOREIGN KEY (ref_request_id) REFERENCES public.wf_requests(id) ON DELETE SET NULL;


--
-- Name: stock_documents stock_documents_target_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_target_warehouse_id_fkey FOREIGN KEY (target_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: stock_documents stock_documents_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_documents
    ADD CONSTRAINT stock_documents_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: warehouses warehouses_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: wf_approvals wf_approvals_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_approvals
    ADD CONSTRAINT wf_approvals_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wf_approvals wf_approvals_decision_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_approvals
    ADD CONSTRAINT wf_approvals_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wf_approvals wf_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_approvals
    ADD CONSTRAINT wf_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.wf_requests(id) ON DELETE CASCADE;


--
-- Name: wf_approvals wf_approvals_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_approvals
    ADD CONSTRAINT wf_approvals_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.wf_steps(id) ON DELETE RESTRICT;


--
-- Name: wf_attachments wf_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_attachments
    ADD CONSTRAINT wf_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.wf_requests(id) ON DELETE CASCADE;


--
-- Name: wf_attachments wf_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_attachments
    ADD CONSTRAINT wf_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wf_events wf_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_events
    ADD CONSTRAINT wf_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wf_events wf_events_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_events
    ADD CONSTRAINT wf_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.wf_requests(id) ON DELETE CASCADE;


--
-- Name: wf_request_lines wf_request_lines_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_request_lines
    ADD CONSTRAINT wf_request_lines_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: wf_request_lines wf_request_lines_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_request_lines
    ADD CONSTRAINT wf_request_lines_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.spare_parts(id) ON DELETE SET NULL;


--
-- Name: wf_request_lines wf_request_lines_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_request_lines
    ADD CONSTRAINT wf_request_lines_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.wf_requests(id) ON DELETE CASCADE;


--
-- Name: wf_requests wf_requests_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_requests
    ADD CONSTRAINT wf_requests_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.wf_definitions(id) ON DELETE SET NULL;


--
-- Name: wf_requests wf_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_requests
    ADD CONSTRAINT wf_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: wf_requests wf_requests_requester_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_requests
    ADD CONSTRAINT wf_requests_requester_ou_id_fkey FOREIGN KEY (requester_ou_id) REFERENCES public.org_units(id) ON DELETE SET NULL;


--
-- Name: wf_steps wf_steps_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wf_steps
    ADD CONSTRAINT wf_steps_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.wf_definitions(id) ON DELETE CASCADE;


--
-- Name: workflow_automation_logs workflow_automation_logs_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_logs
    ADD CONSTRAINT workflow_automation_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.workflow_automation_rules(id) ON DELETE CASCADE;


--
-- Name: workflow_requests workflow_requests_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_requests
    ADD CONSTRAINT workflow_requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;

