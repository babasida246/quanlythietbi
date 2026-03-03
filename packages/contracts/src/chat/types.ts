/**
 * Chat-related TypeScript interfaces and types
 * Used across frontend and backend for type safety
 */

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface Conversation {
    id: string
    userId: string
    title: string
    modelId: string
    modelName?: string
    tier?: number
    maxLayers: number
    temperature: number
    createdAt: string
    updatedAt: string
    firstMessagePreview?: string
    messageCount?: number
}

export interface CreateConversationRequest {
    title?: string
    modelId?: string
    maxLayers?: number
    temperature?: number
}

export interface UpdateConversationRequest {
    title?: string
    modelId?: string
    maxLayers?: number
    temperature?: number
}

export interface ConversationListResponse {
    conversations: Conversation[]
    total: number
    limit: number
    offset: number
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
    id: string
    conversationId: string
    role: MessageRole
    content: string
    attachments?: FileAttachment[]
    modelUsed?: string
    tier?: number
    latency?: number
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    cost?: number
    createdAt: string
    updatedAt?: string
}

export interface CreateMessageRequest {
    content: string
    fileIds?: string[]
    regenerate?: boolean
    parentMessageId?: string
}

export interface MessageListResponse {
    messages: Message[]
    total: number
    limit: number
    offset: number
}

export interface StreamMessageEvent {
    type: 'start' | 'token' | 'done' | 'error'
    messageId?: string
    content?: string
    usage?: MessageTokenUsage
    latency?: number
    tier?: number
    modelUsed?: string
    error?: string
}

export interface MessageTokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface FileAttachment {
    id: string
    filename: string
    size: number
    mimeType: string
    url: string
    thumbnailUrl?: string
    createdAt: string
}

export interface UploadFileRequest {
    file: any // File (browser) | Buffer (Node.js) 
    filename: string
    mimeType: string
}

export interface UploadFileResponse {
    fileId: string
    filename: string
    size: number
    mimeType: string
    url: string
    thumbnailUrl?: string
}

export const ALLOWED_FILE_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/csv': '.csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
} as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILES_PER_MESSAGE = 5

// ============================================================================
// MODEL TYPES
// ============================================================================

export interface Model {
    id: string
    name: string
    provider: string
    tier: number
    description?: string
    contextWindow: number
    maxTokens?: number
    costPer1kPromptTokens?: number
    costPer1kCompletionTokens?: number
    capabilities?: ModelCapability[]
    isAvailable: boolean
    requiresAuth?: boolean
}

export type ModelCapability =
    | 'text-generation'
    | 'code-generation'
    | 'function-calling'
    | 'vision'
    | 'embeddings'

export interface ModelsListResponse {
    models: Model[]
    tiers: {
        [tier: number]: {
            name: string
            description: string
            models: Model[]
        }
    }
}

// ============================================================================
// ORCHESTRATION TYPES
// ============================================================================

export interface OrchestrationConfig {
    maxLayers: number
    temperature: number
    modelId?: string
    fallbackModels?: string[]
    qualityThreshold?: number
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface ChatState {
    conversations: Conversation[]
    activeConversationId: string | null
    messages: Record<string, Message[]>
    isLoading: boolean
    streamingMessageId: string | null
    streamingContent: string
    error: string | null
}

export interface ModelsState {
    models: Model[]
    modelsByTier: Record<number, Model[]>
    selectedModelId: string | null
    isLoading: boolean
    error: string | null
}

export interface UserPreferences {
    defaultModelId?: string
    defaultMaxLayers: number
    defaultTemperature: number
    theme: 'light' | 'dark' | 'system'
    sidebarCollapsed: boolean
    enableSounds: boolean
    enableNotifications: boolean
}

// ============================================================================
// TIME GROUPING TYPES
// ============================================================================

export interface ConversationGroups {
    today: Conversation[]
    yesterday: Conversation[]
    last7days: Conversation[]
    last30days: Conversation[]
    older: Conversation[]
}

export type TimeGroup = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'older'
