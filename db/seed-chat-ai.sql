-- =============================================================================
-- SEED: AI PROVIDERS, MODELS, CHANNELS, CONVERSATIONS, CHAT, USAGE
-- =============================================================================
BEGIN;

    -- ============================================================================
    -- 1. AI PROVIDERS (varchar PK)
    -- Actual columns: id, name, description, api_endpoint, auth_type, api_key,
    --   capabilities, status, rate_limit_per_minute, credits_remaining,
    --   tokens_used, last_usage_at, metadata
    -- NO base_url, NO config
    -- ============================================================================
    INSERT INTO ai_providers
        (id, name, description, api_endpoint, auth_type, capabilities, status)
    VALUES
        ('openai', 'OpenAI', 'OpenAI GPT models', 'https://api.openai.com/v1', 'api_key',
            '{"models":["gpt-4o","gpt-4o-mini"],"streaming":true,"functions":true}'
    ::jsonb,'active'),
    ('anthropic','Anthropic','Claude AI models','https://api.anthropic.com','api_key',
     '{"models":["claude-3-5-sonnet","claude-3-haiku"],"streaming":true,"functions":false}'::jsonb,'active'),
    ('ollama','Ollama Local','Local LLM via Ollama','http://localhost:11434','none',
     '{"models":["llama3","mistral"],"streaming":true,"functions":false}'::jsonb,'active')
ON CONFLICT
    (id) DO
    UPDATE SET status = EXCLUDED.status;

    -- ============================================================================
    -- 2. MODEL CONFIGS (varchar PK)
    -- Actual columns: id, provider, tier, context_window, max_tokens,
    --   cost_per_1k_input, cost_per_1k_output, capabilities, enabled,
    --   supports_streaming, supports_functions, supports_vision, description,
    --   priority, status, display_name
    -- NO is_default (use enabled instead)
    -- ============================================================================
    INSERT INTO model_configs
        (id, provider, display_name, description, tier, max_tokens,
        context_window, cost_per_1k_input, cost_per_1k_output, enabled, status)
    VALUES
        ('gpt-4o', 'openai', 'GPT-4o', 'OpenAI GPT-4 Omni - highest capability', 3, 4096, 128000, 0.005, 0.015, true, 'active'),
        ('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'OpenAI GPT-4o Mini - fast and cheap', 1, 4096, 128000, 0.00015, 0.0006, true, 'active'),
        ('claude-3-5-sonnet', 'anthropic', 'Claude 3.5 Sonnet', 'Anthropic Claude 3.5 Sonnet - best balance', 2, 4096, 200000, 0.003, 0.015, true, 'active'),
        ('claude-3-haiku', 'anthropic', 'Claude 3 Haiku', 'Anthropic Claude 3 Haiku - fast', 1, 4096, 200000, 0.00025, 0.00125, true, 'active'),
        ('llama3', 'ollama', 'Llama 3 8B', 'Meta Llama 3 local via Ollama', 0, 2048, 8000, 0, 0, false, 'active')
    ON CONFLICT
    (id) DO
    UPDATE SET status = EXCLUDED.status;

    -- ============================================================================
    -- 3. MODEL PERFORMANCE
    -- Actual columns (composite PK model,provider,date):
    --   model, provider, date, total_requests, successful_requests,
    --   failed_requests, avg_latency_ms, avg_tokens_per_request, total_cost, quality_score
    -- NO id, NO model_id, NO metric_type, NO metric_date, NO value, NO sample_count
    -- ============================================================================
    INSERT INTO model_performance
        (model, provider, date, total_requests, successful_requests,
        failed_requests, avg_latency_ms, avg_tokens_per_request, total_cost)
    VALUES
        ('gpt-4o-mini', 'openai', '2024-03-01', 500, 498, 2, 1250, 610, 0.147375),
        ('gpt-4o', 'openai', '2024-03-01', 80, 80, 0, 3800, 1438, 1.025000),
        ('claude-3-5-sonnet', 'anthropic', '2024-03-01', 120, 119, 1, 2200, 1750, 1.455000),
        ('claude-3-haiku', 'anthropic', '2024-03-01', 90, 90, 0, 980, 2000, 0.101250),
        ('gpt-4o-mini', 'openai', '2024-03-02', 295, 295, 0, 1180, 1932, 0.138570)
    ON CONFLICT
    (model, provider, date) DO
    UPDATE SET
    total_requests = EXCLUDED.total_requests;

    -- ============================================================================
    -- 4. MODEL USAGE HISTORY
    -- Actual columns (composite PK model,usage_date):
    --   model, usage_date, total_tokens, total_cost, message_count
    -- NO id, NO model_id, NO input_tokens, NO output_tokens, NO request_count, NO total_cost_usd
    -- ============================================================================
    INSERT INTO model_usage_history
        (model, usage_date, total_tokens, total_cost, message_count)
    VALUES
        ('gpt-4o-mini', '2024-03-01', 610000, 0.147375, 320),
        ('gpt-4o-mini', '2024-03-02', 570000, 0.138570, 295),
        ('gpt-4o', '2024-03-01', 145000, 1.025000, 25),
        ('claude-3-5-sonnet', '2024-03-01', 265000, 1.455000, 45),
        ('claude-3-haiku', '2024-03-01', 225000, 0.101250, 60)
    ON CONFLICT
    (model, usage_date) DO
    UPDATE SET total_tokens = EXCLUDED.total_tokens;

    -- ============================================================================
    -- 5. PROVIDER USAGE HISTORY
    -- Actual columns (composite PK provider,usage_date):
    --   provider, usage_date, total_tokens, total_cost, credits_used
    -- NO id, NO provider_id, NO request_count, NO input_tokens, NO output_tokens, NO error_count
    -- ============================================================================
    INSERT INTO provider_usage_history
        (provider, usage_date, total_tokens, total_cost, credits_used)
    VALUES
        ('openai', '2024-03-01', 755000, 1.172375, 1.172375),
        ('openai', '2024-03-02', 570000, 0.138570, 0.138570),
        ('anthropic', '2024-03-01', 490000, 1.556250, 1.556250)
    ON CONFLICT
    (provider, usage_date) DO
    UPDATE SET total_tokens = EXCLUDED.total_tokens;

    -- ============================================================================
    -- 6. USER TOKEN STATS (composite PK: user_id + date + model + provider)
    -- Actual columns: user_id (varchar255), date, model, provider,
    --   total_tokens, total_cost, message_count, conversation_count
    -- NO input_tokens, NO output_tokens, NO request_count, NO cost_usd
    -- ============================================================================
    INSERT INTO user_token_stats
        (user_id, date, model, provider, total_tokens, total_cost, message_count, conversation_count)
    VALUES
        ('00000000-0000-0000-0000-000000000001', '2024-03-01', 'gpt-4o-mini', 'openai', 19200, 0.004710, 12, 2),
        ('00000000-0000-0000-0000-000000000002', '2024-03-01', 'gpt-4o-mini', 'openai', 36500, 0.009300, 25, 3),
        ('00000000-0000-0000-0000-000000000006', '2024-03-01', 'gpt-4o-mini', 'openai', 15800, 0.004080, 10, 1),
        ('00000000-0000-0000-0000-000000000001', '2024-03-02', 'gpt-4o', 'openai', 6500, 0.047500, 3, 1),
        ('00000000-0000-0000-0000-000000000002', '2024-03-02', 'claude-3-5-sonnet', 'anthropic', 23200, 0.132000, 15, 2),
        ('00000000-0000-0000-0000-000000000005', '2024-03-01', 'gpt-4o-mini', 'openai', 10100, 0.002460, 7, 1)
    ON CONFLICT
    (user_id, date, model, provider) DO
    UPDATE SET
    total_tokens   = EXCLUDED.total_tokens,
    message_count  = EXCLUDED.message_count;

    -- ============================================================================
    -- 7. CHANNELS
    -- Actual columns: id, type, name, config, enabled
    -- type CHECK: 'telegram'/'discord'/'email' only (NO web_widget, NO slack)
    -- NO description, NO status
    -- ============================================================================
    INSERT INTO channels
        (id, type, name, config, enabled)
    VALUES
        ('1d000000-0000-0000-0000-000000000001', 'telegram', 'Telegram Bot QLTB',
            '{"bot_token":"<telegram_bot_token>","default_parse_mode":"Markdown"}'
    ::jsonb,true),
    ('1d000000-0000-0000-0000-000000000002','email','Email Notification',
     '{"smtp_host":"smtp.example.com","from":"noreply@company.com"}'::jsonb,true),
    ('1d000000-0000-0000-0000-000000000003','discord','Discord Webhook',
     '{"webhook_url":"<discord_webhook_url>","channel_id":"123456789"}'::jsonb,false)
ON CONFLICT
    (id) DO
    UPDATE SET enabled = EXCLUDED.enabled;

    -- ============================================================================
    -- 8. CHANNEL BINDINGS
    -- Actual columns: id, channel_id, external_user_id, external_chat_id,
    --                 user_id (UUID nullable), status, role_hint
    -- UNIQUE: (channel_id, external_user_id, external_chat_id)
    -- NO bound_at
    -- ============================================================================
    INSERT INTO channel_bindings
        (id, channel_id, external_user_id, external_chat_id, user_id, status)
    VALUES
        ('cb000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001', 'telegram_uid_100001', 'tg_chat_100001', '00000000-0000-0000-0000-000000000002', 'active'),
        ('cb000000-0000-0000-0000-000000000002', '1d000000-0000-0000-0000-000000000001', 'telegram_uid_100002', 'tg_chat_100002', '00000000-0000-0000-0000-000000000006', 'active'),
        ('cb000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000002', 'email_user_001', 'it.manager@company.com', '00000000-0000-0000-0000-000000000002', 'active')
    ON CONFLICT
    (id) DO NOTHING;

-- ============================================================================
-- 9. CONVERSATIONS (must be before channel_conversations which FKs to this)
-- Actual columns: id, user_id (varchar255), title, model, status,
--   message_count, metadata
-- NO system_prompt
-- ============================================================================
INSERT INTO conversations
    (id, user_id, title, model, status, metadata)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
        'Hoi danh sach tai san laptop', 'gpt-4o-mini', 'active',
        '{"channel":"telegram"}'
::jsonb),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006',
     'Huong dan yeu cau cap thiet bi','gpt-4o-mini','active',
     '{"channel":"telegram"}'::jsonb),
('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
     'Phan tich chi phi bao tri Q1','gpt-4o','active',
     '{"channel":"email"}'::jsonb)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 10. CHANNEL CONVERSATIONS
-- Actual columns: id, channel_id, external_chat_id, thread_id,
--                 conversation_id (UUID FK to conversations)
-- UNIQUE: (channel_id, external_chat_id, thread_id)
-- NO title, NO status, NO last_message_at
-- ============================================================================
INSERT INTO channel_conversations
    (id, channel_id, external_chat_id, conversation_id)
VALUES
    ('cc000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001',
        'tg_chat_100001', '20000000-0000-0000-0000-000000000001'),
    ('cc000000-0000-0000-0000-000000000002', '1d000000-0000-0000-0000-000000000001',
        'tg_chat_100002', '20000000-0000-0000-0000-000000000002'),
    ('cc000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000002',
        'email_thread_001', '20000000-0000-0000-0000-000000000003')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 11. INBOUND DEDUP
-- Actual columns: channel_id, external_event_id, received_at (default now())
-- NO id column, NO external_message_id, NO processed_at
-- UNIQUE: (channel_id, external_event_id)
-- ============================================================================
INSERT INTO inbound_dedup
    (channel_id, external_event_id)
VALUES
    ('1d000000-0000-0000-0000-000000000001', 'tg_evt_999001'),
    ('1d000000-0000-0000-0000-000000000001', 'tg_evt_999002'),
    ('1d000000-0000-0000-0000-000000000002', 'email_evt_001')
ON CONFLICT
(channel_id, external_event_id) DO NOTHING;

-- ============================================================================
-- 12. MESSAGES
-- Actual columns: id, conversation_id, role, content, model, provider,
--   prompt_tokens, completion_tokens, cost, latency_ms, metadata,
--   tool_calls, tool_call_id, token_count
-- NO input_tokens/output_tokens (use prompt_tokens/completion_tokens)
-- ============================================================================
INSERT INTO messages
    (id, conversation_id, role, content, model, prompt_tokens, completion_tokens, created_at)
VALUES
    ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'user',
        'Cho toi danh sach laptop dang duoc su dung', NULL, NULL, NULL, '2024-03-01 09:00:00'),
    ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'assistant',
        'Hien co 10 laptop Dell Latitude dang duoc su dung. Danh sach: LAP-DELL-001 den LAP-DELL-010.',
        'gpt-4o-mini', 25, 85, '2024-03-01 09:00:02'),
    ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'user',
        'Laptop nao can bao tri trong thang nay?', NULL, NULL, NULL, '2024-03-01 09:01:00'),
    ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'assistant',
        'Co 2 laptop can bao tri: LAP-DELL-005 (thay pin) va LAP-DELL-008 (ve sinh tan nhiet).',
        'gpt-4o-mini', 30, 95, '2024-03-01 09:01:02'),
    ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'user',
        'Lam the nao de yeu cau cap laptop moi?', NULL, NULL, NULL, '2024-03-10 14:00:00'),
    ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'assistant',
        'De yeu cau cap laptop moi, vao menu Yeu cau > Tai san > tao yeu cau moi voi loai Cap moi.',
        'gpt-4o-mini', 28, 120, '2024-03-10 14:00:02'),
    ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 'user',
        'Tong chi phi bao tri Q1/2024 la bao nhieu?', NULL, NULL, NULL, '2024-03-15 10:00:00'),
    ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', 'assistant',
        'Tong chi phi bao tri Q1/2024: Chi phi phong ngua 1.850.000d, Chi phi sua chua 4.500.000d. Tong 6.350.000d.',
        'gpt-4o', 80, 180, '2024-03-15 10:00:05')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 13. CHAT CONTEXTS
-- Actual columns: id, conversation_id, context_type, content,
--   tokens, priority, metadata
-- NO token_count (use tokens)
-- ============================================================================
INSERT INTO chat_contexts
    (id, conversation_id, context_type, content, tokens)
VALUES
    ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'system_data', '{"total_assets":50,"laptops":10,"in_maintenance":2}', 45),
    ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003',
        'report_data', '{"maintenance_q1_total":6350000,"repair_cost":4500000,"preventive_cost":1850000}', 65)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 14. MESSAGE LINKS
-- Actual columns: id, conversation_id (text), internal_message_id (UUID),
--   channel_id (UUID FK), external_message_id (text), thread_id
-- NO message_id, entity_type, entity_id, link_text
-- ============================================================================
INSERT INTO message_links
    (id, conversation_id, internal_message_id, channel_id, external_message_id)
VALUES
    ('23000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        '21000000-0000-0000-0000-000000000002', '1d000000-0000-0000-0000-000000000001', 'tg_msg_001'),
    ('23000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000006', '1d000000-0000-0000-0000-000000000001', 'tg_msg_002')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 15. CONVERSATION TOKEN USAGE
-- Actual columns: id, conversation_id, model, provider,
--   prompt_tokens, completion_tokens, total_tokens, cost, message_count
-- NO total_input_tokens, total_output_tokens, total_cost_usd, last_updated
-- ============================================================================
INSERT INTO conversation_token_usage
    (id, conversation_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost, message_count)
VALUES
    ('24000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'gpt-4o-mini', 'openai', 55, 180, 235, 0.000135, 4),
    ('24000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        'gpt-4o-mini', 'openai', 28, 120, 148, 0.000090, 2),
    ('24000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',
        'gpt-4o', 'openai', 80, 180, 260, 0.006500, 2)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 16. ORCHESTRATION RULES
-- Actual columns: id, name, description, strategy (NOT NULL), model_sequence (jsonb NOT NULL),
--   conditions, enabled, priority, metadata
-- NO trigger_type, trigger_config, actions, status
-- ============================================================================
INSERT INTO orchestration_rules
    (id, name, description, strategy, model_sequence, conditions, enabled, priority)
VALUES
    ('25000000-0000-0000-0000-000000000001',
        'Default Single Model', 'Su dung mo hinh mac dinh cho moi yeu cau',
        'single',
        '[{"model":"gpt-4o-mini","provider":"openai","priority":1}]'
::jsonb,
     '{}'::jsonb,
     true,100),
('25000000-0000-0000-0000-000000000002',
     'High Complexity Fallback','Su dung mo hinh manh hon cho yeu cau phuc tap',
     'fallback',
     '[{"model":"gpt-4o-mini","provider":"openai","priority":1},{"model":"gpt-4o","provider":"openai","priority":2}]'::jsonb,
     '{"complexity":"high"}'::jsonb,
     true,200)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 17. PENDING ACTIONS
-- Actual columns: action_id, conversation_id (text), correlation_id (UUID NOT NULL),
--   channel_id (UUID FK), external_chat_id, external_user_id,
--   action_kind, payload, requires_reason, status, expires_at
-- status: 'pending'/'confirmed'/'cancelled'/'expired'/'executed'
-- ============================================================================
INSERT INTO pending_actions
    (action_id, conversation_id, correlation_id, channel_id,
    external_chat_id, external_user_id, action_kind, status,
    payload, expires_at)
VALUES
    ('26000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000001',
        '1d000000-0000-0000-0000-000000000001',
        'tg_chat_100002', 'telegram_uid_100002', 'confirm_asset_request', 'pending',
        '{"asset_type":"laptop","quantity":1}'
::jsonb,
     '2024-03-11 14:00:00'),
('26000000-0000-0000-0000-000000000002',
     '20000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002',
     '1d000000-0000-0000-0000-000000000001',
     'tg_chat_100001','telegram_uid_100001','confirm_maintenance_ticket','expired',
     '{"asset_id":"a1000000-0000-0000-0000-000000000001","issue":"screen_flickering"}'::jsonb,
     '2024-03-02 09:00:00')
ON CONFLICT
(action_id) DO
UPDATE SET status = EXCLUDED.status;

-- ============================================================================
-- 18. USAGE LOGS
-- Actual columns: id, user_id (varchar255), model_id (varchar100),
--   tier, prompt_tokens, completion_tokens, total_tokens, total_cost,
--   quality_score, escalated
-- NO provider, model, input_tokens, output_tokens, cost_usd, duration_ms, success, error_code, session_id
-- ============================================================================
INSERT INTO usage_logs
    (id, user_id, model_id, tier, prompt_tokens, completion_tokens, total_tokens, total_cost, escalated)
VALUES
    ('27000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'gpt-4o-mini', 1, 25, 85, 110, 0.000013, false),
    ('27000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'gpt-4o-mini', 1, 30, 95, 125, 0.000014, false),
    ('27000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'gpt-4o-mini', 1, 28, 120, 148, 0.000018, false),
    ('27000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'gpt-4o', 3, 80, 180, 260, 0.006700, false),
    ('27000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'gpt-4o', 3, 55, 0, 55, 0, false)
ON CONFLICT
(id) DO NOTHING;

COMMIT;
