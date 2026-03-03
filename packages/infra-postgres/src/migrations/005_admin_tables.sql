-- Admin Audit Log Table
CREATE TABLE
IF NOT EXISTS admin_audit_log
(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR
(255) NOT NULL,
    action VARCHAR
(100) NOT NULL,
    resource VARCHAR
(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR
(45),
    timestamp TIMESTAMP DEFAULT NOW
(),
    created_at TIMESTAMP DEFAULT NOW
()
);

CREATE INDEX idx_admin_audit_user ON admin_audit_log(user_id);
CREATE INDEX idx_admin_audit_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action);

-- AI Providers Table (for provider management)
CREATE TABLE IF NOT EXISTS ai_providers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_endpoint VARCHAR(255),
    auth_type VARCHAR(50),
    capabilities JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    rate_limit_per_minute INT,
    metadata JSONB DEFAULT '{}',
    api_key_encrypted TEXT,
    config JSONB DEFAULT '{}',
    last_health_check JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Models Table (for model registry)
CREATE TABLE
IF NOT EXISTS ai_models
(
    id VARCHAR
(200) PRIMARY KEY,
    display_name VARCHAR
(255) NOT NULL,
    provider_id VARCHAR
(50) NOT NULL,
    tier INTEGER NOT NULL CHECK
(tier BETWEEN 0 AND 3),
    enabled BOOLEAN DEFAULT true,
    
    -- Context & Performance
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    default_temperature DECIMAL
(3,2) DEFAULT 0.7,
    
    -- Pricing
    input_cost_per_1k DECIMAL
(10,6) DEFAULT 0.0,
    output_cost_per_1k DECIMAL
(10,6) DEFAULT 0.0,
    
    -- Capabilities
    capabilities JSONB DEFAULT '{}',
    
    -- Orchestration
    quality_threshold DECIMAL
(3,2) DEFAULT 0.7,
    escalation_target_tier INTEGER,
    max_retries INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 30000,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW
(),
    updated_at TIMESTAMP DEFAULT NOW
(),
    created_by VARCHAR
(255),
    
    FOREIGN KEY
(provider_id) REFERENCES ai_providers
(id) ON
DELETE CASCADE
);

CREATE INDEX idx_models_tier ON ai_models(tier, enabled);
CREATE INDEX idx_models_provider ON ai_models(provider_id);
CREATE INDEX idx_models_enabled ON ai_models(enabled);
