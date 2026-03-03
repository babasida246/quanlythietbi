--
-- PostgreSQL database dump
--

\restrict cVY6zYj7yr2OzZjwKRoKyaJzkRCFeEkzc1Qs2CEqgqcInbAAqAdwiZAlg00OJyi

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

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
    CONSTRAINT asset_assignments_assignee_type_check CHECK (((assignee_type)::text = ANY ((ARRAY['person'::character varying, 'department'::character varying, 'system'::character varying])::text[])))
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
-- Name: asset_category_spec_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_category_spec_defs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version_id uuid NOT NULL,
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
-- Name: asset_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    actor_user_id character varying(255),
    correlation_id character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


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
    created_at timestamp with time zone DEFAULT now()
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
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['in_stock'::character varying, 'in_use'::character varying, 'in_repair'::character varying, 'retired'::character varying, 'disposed'::character varying, 'lost'::character varying])::text[])))
);


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
    CONSTRAINT cmdb_ci_schemas_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['text'::character varying, 'number'::character varying, 'boolean'::character varying, 'date'::character varying, 'datetime'::character varying, 'json'::character varying, 'url'::character varying, 'email'::character varying, 'select'::character varying, 'multi_select'::character varying])::text[])))
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
    CONSTRAINT cmdb_ci_type_versions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'deprecated'::character varying])::text[]))),
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
    CONSTRAINT cmdb_cis_environment_check CHECK (((environment)::text = ANY ((ARRAY['dev'::character varying, 'test'::character varying, 'staging'::character varying, 'prod'::character varying])::text[]))),
    CONSTRAINT cmdb_cis_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'decommissioned'::character varying, 'maintenance'::character varying])::text[])))
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
    CONSTRAINT cmdb_services_criticality_check CHECK (((criticality)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


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
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    path text DEFAULT '/'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
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
    CONSTRAINT maintenance_tickets_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT maintenance_tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'closed'::character varying, 'canceled'::character varying])::text[])))
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
    CONSTRAINT messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying, 'tool'::character varying])::text[])))
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
    CONSTRAINT ops_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['repair_order'::text, 'stock_document'::text, 'spare_part'::text, 'warehouse'::text, 'asset_category'::text, 'cmdb_ci'::text, 'cmdb_rel'::text, 'cmdb_service'::text, 'cmdb_type'::text, 'cmdb_schema'::text])))
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
    CONSTRAINT repair_orders_repair_type_check CHECK ((repair_type = ANY (ARRAY['internal'::text, 'vendor'::text]))),
    CONSTRAINT repair_orders_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT repair_orders_status_check CHECK ((status = ANY (ARRAY['open'::text, 'diagnosing'::text, 'waiting_parts'::text, 'repaired'::text, 'closed'::text, 'canceled'::text])))
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
    updated_at timestamp with time zone DEFAULT now()
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
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_document_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_document_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_id uuid NOT NULL,
    part_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_cost numeric(12,2),
    serial_no text,
    note text,
    adjust_direction text,
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
    CONSTRAINT stock_documents_doc_type_check CHECK ((doc_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'adjust'::text, 'transfer'::text]))),
    CONSTRAINT stock_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'posted'::text, 'canceled'::text])))
);


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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
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
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


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
-- Name: asset_category_spec_defs asset_category_spec_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_defs
    ADD CONSTRAINT asset_category_spec_defs_pkey PRIMARY KEY (id);


--
-- Name: asset_category_spec_defs asset_category_spec_defs_version_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_defs
    ADD CONSTRAINT asset_category_spec_defs_version_id_key_key UNIQUE (version_id, key);


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
-- Name: asset_events asset_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_pkey PRIMARY KEY (id);


--
-- Name: asset_models asset_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_pkey PRIMARY KEY (id);


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
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_contexts chat_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_contexts
    ADD CONSTRAINT chat_contexts_pkey PRIMARY KEY (id);


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
-- Name: provider_usage_history provider_usage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_usage_history
    ADD CONSTRAINT provider_usage_history_pkey PRIMARY KEY (provider, usage_date);


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
-- Name: usage_logs usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_logs
    ADD CONSTRAINT usage_logs_pkey PRIMARY KEY (id);


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
-- Name: workflow_requests workflow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_requests
    ADD CONSTRAINT workflow_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_asset_assignments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_assignments_asset ON public.asset_assignments USING btree (asset_id, assigned_at DESC);


--
-- Name: idx_asset_attachments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_attachments_asset ON public.asset_attachments USING btree (asset_id, created_at DESC);


--
-- Name: idx_asset_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_categories_name ON public.asset_categories USING btree (name);


--
-- Name: idx_asset_events_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_events_asset ON public.asset_events USING btree (asset_id, created_at DESC);


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
-- Name: idx_asset_models_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_vendor_id ON public.asset_models USING btree (vendor_id);


--
-- Name: idx_assets_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_location_id ON public.assets USING btree (location_id);


--
-- Name: idx_assets_mgmt_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_mgmt_ip ON public.assets USING btree (mgmt_ip);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_warranty_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_warranty_end ON public.assets USING btree (warranty_end);


--
-- Name: idx_attachments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_audit_logs_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_correlation ON public.audit_logs USING btree (correlation_id);


--
-- Name: idx_audit_logs_user_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_action ON public.audit_logs USING btree (user_id, action, created_at DESC);


--
-- Name: idx_category_spec_defs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_spec_defs_version ON public.asset_category_spec_defs USING btree (version_id, sort_order);


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
-- Name: idx_cmdb_ci_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cmdb_ci_types_code ON public.cmdb_ci_types USING btree (code);


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
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_model_configs_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_configs_tier ON public.model_configs USING btree (tier, enabled);


--
-- Name: idx_ops_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ops_events_entity ON public.ops_events USING btree (entity_type, entity_id, created_at DESC);


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
-- Name: idx_repair_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_status ON public.repair_orders USING btree (status, opened_at DESC);


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
-- Name: idx_stock_document_lines_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_document_lines_doc ON public.stock_document_lines USING btree (document_id);


--
-- Name: idx_stock_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_documents_status ON public.stock_documents USING btree (status, doc_date DESC);


--
-- Name: idx_usage_logs_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_logs_user_date ON public.usage_logs USING btree (user_id, created_at DESC);


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
-- Name: idx_workflow_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_requests_status ON public.workflow_requests USING btree (status, created_at DESC);


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_attachments asset_attachments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_attachments
    ADD CONSTRAINT asset_attachments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_category_spec_defs asset_category_spec_defs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_defs
    ADD CONSTRAINT asset_category_spec_defs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.asset_category_spec_versions(id) ON DELETE CASCADE;


--
-- Name: asset_category_spec_versions asset_category_spec_versions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_category_spec_versions
    ADD CONSTRAINT asset_category_spec_versions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE CASCADE;


--
-- Name: asset_events asset_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


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
-- Name: assets assets_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: cmdb_ci_attr_values cmdb_ci_attr_values_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_attr_values
    ADD CONSTRAINT cmdb_ci_attr_values_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.cmdb_cis(id) ON DELETE CASCADE;


--
-- Name: cmdb_ci_schemas cmdb_ci_schemas_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cmdb_ci_schemas
    ADD CONSTRAINT cmdb_ci_schemas_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.cmdb_ci_type_versions(id) ON DELETE CASCADE;


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
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


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
-- Name: repair_orders repair_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: workflow_requests workflow_requests_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_requests
    ADD CONSTRAINT workflow_requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

