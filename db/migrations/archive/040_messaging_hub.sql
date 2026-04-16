-- Description: Conversational Ops (messaging hub) tables

CREATE TABLE
IF NOT EXISTS channels
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    type TEXT NOT NULL CHECK
(type IN
('telegram', 'discord', 'email')),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE TABLE
IF NOT EXISTS channel_bindings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    channel_id UUID NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    external_user_id TEXT
NOT NULL,
    external_chat_id TEXT NOT NULL,
    user_id UUID REFERENCES users
(id) ON
DELETE
SET NULL
,
    status TEXT NOT NULL CHECK
(status IN
('pending', 'active', 'blocked')),
    role_hint TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    UNIQUE
(channel_id, external_user_id, external_chat_id)
);

CREATE TABLE
IF NOT EXISTS channel_conversations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    channel_id UUID NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    external_chat_id TEXT
NOT NULL,
    thread_id TEXT NULL,
    conversation_id UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    UNIQUE
(channel_id, external_chat_id, thread_id)
);

CREATE TABLE
IF NOT EXISTS message_links
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    conversation_id TEXT NOT NULL,
    internal_message_id UUID NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    external_message_id TEXT
NOT NULL,
    thread_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_message_links_conversation_id ON message_links
(conversation_id);
CREATE INDEX
IF NOT EXISTS idx_message_links_external_message_id ON message_links
(external_message_id);

CREATE TABLE
IF NOT EXISTS inbound_dedup
(
    channel_id UUID NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    external_event_id TEXT
NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    UNIQUE
(channel_id, external_event_id)
);

CREATE TABLE
IF NOT EXISTS pending_actions
(
    action_id UUID PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    correlation_id UUID NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    external_chat_id TEXT
NOT NULL,
    external_user_id TEXT NOT NULL,
    action_kind TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_reason BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL CHECK
(status IN
('pending', 'confirmed', 'cancelled', 'expired', 'executed')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    reason TEXT NULL
);

CREATE INDEX
IF NOT EXISTS idx_pending_actions_conversation_id ON pending_actions
(conversation_id);
CREATE INDEX
IF NOT EXISTS idx_pending_actions_status ON pending_actions
(status);

CREATE TABLE
IF NOT EXISTS alert_subscriptions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    user_id UUID NOT NULL REFERENCES users
(id) ON
DELETE CASCADE,
    channel_id UUID
NOT NULL REFERENCES channels
(id) ON
DELETE CASCADE,
    target_chat_id TEXT
NOT NULL,
    alert_types TEXT[] NOT NULL,
    severity_min TEXT NOT NULL CHECK
(severity_min IN
('info', 'warning', 'critical')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE TABLE
IF NOT EXISTS alert_dedup
(
    dedup_key TEXT PRIMARY KEY,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    count INT NOT NULL DEFAULT 1
);
