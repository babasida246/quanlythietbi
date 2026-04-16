-- Chat Enhancements Migration
-- Adds tables for AI-powered chat, token tracking, cost management, and model orchestration

-- ============================================================================
-- CHAT SESSIONS & CONTEXT
-- ============================================================================

-- Enhanced conversations with AI metadata
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS model VARCHAR(100),
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS context_summary TEXT,
ADD COLUMN IF NOT EXISTS total_tokens INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,6) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_model ON conversations(model);

-- Chat context storage - stores important context from conversations
CREATE TABLE IF NOT EXISTS chat_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    context_type VARCHAR(50) NOT NULL CHECK (context_type IN ('summary', 'key_points', 'code_snippet', 'decision', 'custom')),
    content TEXT NOT NULL,
    tokens INT DEFAULT 0,
    priority INT DEFAULT 0, -- Higher priority contexts are retained longer
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_contexts_conversation ON chat_contexts(conversation_id, priority DESC);
CREATE INDEX idx_chat_contexts_type ON chat_contexts(context_type);

-- ============================================================================
-- TOKEN USAGE & COST TRACKING
-- ============================================================================

-- Enhanced messages with token and cost details
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS model VARCHAR(100),
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS prompt_tokens INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_tokens INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS latency_ms INT,
ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);
CREATE INDEX IF NOT EXISTS idx_messages_tokens ON messages(conversation_id, token_count DESC);

-- Token usage tracking by conversation
CREATE TABLE IF NOT EXISTS conversation_token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    cost DECIMAL(10,6) NOT NULL DEFAULT 0,
    message_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_token_usage_conversation ON conversation_token_usage(conversation_id, created_at DESC);
CREATE INDEX idx_token_usage_model ON conversation_token_usage(model, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_unique_day ON conversation_token_usage (conversation_id, model, usage_date);

-- User token usage statistics
CREATE TABLE IF NOT EXISTS user_token_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    total_tokens INT DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    message_count INT DEFAULT 0,
    conversation_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, model)
);

CREATE INDEX idx_user_token_stats_user ON user_token_stats(user_id, date DESC);
CREATE INDEX idx_user_token_stats_model ON user_token_stats(model, date DESC);

-- ============================================================================
-- MODEL & PROVIDER MANAGEMENT
-- ============================================================================

-- AI Providers configuration
CREATE TABLE IF NOT EXISTS ai_providers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    api_endpoint VARCHAR(255),
    auth_type VARCHAR(50), -- 'api_key', 'oauth', 'bearer'
    capabilities JSONB DEFAULT '{}', -- Supported features like streaming, functions, vision
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    rate_limit_per_minute INT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_providers_status ON ai_providers(status);

-- Insert default providers
INSERT INTO ai_providers (id, name, description, auth_type, capabilities, status) VALUES
    ('openai', 'OpenAI', 'OpenAI GPT models', 'api_key', '{"streaming": true, "functions": true, "vision": true}'::jsonb, 'active'),
    ('anthropic', 'Anthropic', 'Claude models', 'api_key', '{"streaming": true, "functions": true}'::jsonb, 'active'),
    ('google', 'Google AI', 'Gemini models', 'api_key', '{"streaming": true, "vision": true}'::jsonb, 'active'),
    ('azure', 'Azure OpenAI', 'Azure-hosted OpenAI models', 'api_key', '{"streaming": true, "functions": true}'::jsonb, 'active'),
    ('openrouter', 'OpenRouter', 'Unified model router', 'api_key', '{"streaming": true, "functions": true, "vision": true}'::jsonb, 'active')
ON CONFLICT (id) DO NOTHING;

-- Enhanced model configs with more details
ALTER TABLE model_configs
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS supports_streaming BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS supports_functions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS supports_vision BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 100, -- Lower number = higher priority
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated'));

CREATE INDEX IF NOT EXISTS idx_model_configs_provider ON model_configs(provider, status);
CREATE INDEX IF NOT EXISTS idx_model_configs_priority ON model_configs(priority, tier);

-- Model orchestration rules
CREATE TABLE IF NOT EXISTS orchestration_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('fallback', 'load_balance', 'cost_optimize', 'quality_first', 'custom')),
    model_sequence JSONB NOT NULL, -- Array of model IDs in priority order
    conditions JSONB DEFAULT '{}', -- Conditions for applying this rule
    enabled BOOLEAN DEFAULT true,
    priority INT DEFAULT 100,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestration_rules_enabled ON orchestration_rules(enabled, priority);

-- Insert default orchestration rule
INSERT INTO orchestration_rules (name, description, strategy, model_sequence, enabled, priority) VALUES
    (
        'default_fallback',
        'Default fallback strategy for chat',
        'fallback',
        '["openai/gpt-4o-mini", "anthropic/claude-3-haiku", "google/gemini-pro"]'::jsonb,
        true,
        1
    )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MODEL PERFORMANCE TRACKING
-- ============================================================================

-- Model performance metrics
CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    total_requests INT DEFAULT 0,
    successful_requests INT DEFAULT 0,
    failed_requests INT DEFAULT 0,
    avg_latency_ms INT DEFAULT 0,
    avg_tokens_per_request INT DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    quality_score DECIMAL(3,2), -- Average user rating or quality metric
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model, provider, date)
);

CREATE INDEX idx_model_performance_date ON model_performance(date DESC, model);
CREATE INDEX idx_model_performance_quality ON model_performance(quality_score DESC);

-- ============================================================================
-- CHAT QUALITY & FEEDBACK
-- ============================================================================

-- User feedback on AI responses
CREATE TABLE IF NOT EXISTS message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    feedback_type VARCHAR(50), -- 'helpful', 'accurate', 'creative', 'fast', etc.
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_feedback_message ON message_feedback(message_id);
CREATE INDEX idx_message_feedback_rating ON message_feedback(rating, created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        total_tokens = COALESCE((
            SELECT SUM(token_count)
            FROM messages
            WHERE conversation_id = NEW.conversation_id
        ), 0),
        total_cost = COALESCE((
            SELECT SUM(cost)
            FROM messages
            WHERE conversation_id = NEW.conversation_id
        ), 0),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation stats when message is added
DROP TRIGGER IF EXISTS trigger_update_conversation_stats ON messages;
CREATE TRIGGER trigger_update_conversation_stats
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_stats();

-- Function to aggregate token usage
CREATE OR REPLACE FUNCTION aggregate_token_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation token usage
    INSERT INTO conversation_token_usage (
        conversation_id,
        model,
        provider,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost,
        message_count,
        usage_date
    ) VALUES (
        NEW.conversation_id,
        COALESCE(NEW.model, 'unknown'),
        COALESCE(NEW.provider, 'unknown'),
        COALESCE(NEW.prompt_tokens, 0),
        COALESCE(NEW.completion_tokens, 0),
        COALESCE(NEW.token_count, 0),
        COALESCE(NEW.cost, 0),
        1,
        CURRENT_DATE
    )
    ON CONFLICT (conversation_id, model, usage_date)
    DO UPDATE SET
        prompt_tokens = conversation_token_usage.prompt_tokens + EXCLUDED.prompt_tokens,
        completion_tokens = conversation_token_usage.completion_tokens + EXCLUDED.completion_tokens,
        total_tokens = conversation_token_usage.total_tokens + EXCLUDED.total_tokens,
        cost = conversation_token_usage.cost + EXCLUDED.cost,
        message_count = conversation_token_usage.message_count + 1;
    
    -- Update user token stats
    INSERT INTO user_token_stats (
        user_id,
        date,
        model,
        provider,
        total_tokens,
        total_cost,
        message_count,
        conversation_count
    )
    SELECT
        c.user_id,
        CURRENT_DATE,
        COALESCE(NEW.model, 'unknown'),
        COALESCE(NEW.provider, 'unknown'),
        COALESCE(NEW.token_count, 0),
        COALESCE(NEW.cost, 0),
        1,
        1
    FROM conversations c
    WHERE c.id = NEW.conversation_id
    ON CONFLICT (user_id, date, model)
    DO UPDATE SET
        total_tokens = user_token_stats.total_tokens + EXCLUDED.total_tokens,
        total_cost = user_token_stats.total_cost + EXCLUDED.total_cost,
        message_count = user_token_stats.message_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to aggregate token usage
DROP TRIGGER IF EXISTS trigger_aggregate_token_usage ON messages;
CREATE TRIGGER trigger_aggregate_token_usage
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.role = 'assistant')
    EXECUTE FUNCTION aggregate_token_usage();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View for conversation summaries with stats
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
    c.id,
    c.user_id,
    c.title,
    c.model,
    c.provider,
    c.status,
    c.total_tokens,
    c.total_cost,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    c.created_at,
    c.updated_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id;

-- View for daily usage statistics
CREATE OR REPLACE VIEW daily_usage_stats AS
SELECT
    user_id,
    date,
    SUM(total_tokens) as total_tokens,
    SUM(total_cost) as total_cost,
    SUM(message_count) as total_messages,
    COUNT(DISTINCT model) as models_used
FROM user_token_stats
GROUP BY user_id, date
ORDER BY date DESC;

COMMENT ON TABLE chat_contexts IS 'Stores important context extracted from conversations for long-term memory';
COMMENT ON TABLE conversation_token_usage IS 'Tracks token usage per conversation and model';
COMMENT ON TABLE user_token_stats IS 'Aggregated token and cost statistics by user and model';
COMMENT ON TABLE ai_providers IS 'Configuration for AI service providers';
COMMENT ON TABLE orchestration_rules IS 'Rules for model selection and fallback strategies';
COMMENT ON TABLE model_performance IS 'Performance metrics for each model';
COMMENT ON TABLE message_feedback IS 'User feedback on AI-generated messages';
