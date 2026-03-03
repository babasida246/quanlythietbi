type ErrorPayload = {
  message?: string
  error?: {
    message?: string
    code?: string
    details?: string
  } | string
  code?: string
}

const DEFAULT_ERROR = 'Unexpected error'

function normalizePayload(payload: unknown): string | null {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object') return null

  const typed = payload as ErrorPayload
  if (typeof typed.message === 'string' && typed.message.trim()) return typed.message.trim()
  if (typeof typed.error === 'string' && typed.error.trim()) return typed.error.trim()
  if (typed.error && typeof typed.error === 'object') {
    if (typeof typed.error.message === 'string' && typed.error.message.trim()) {
      return typed.error.message.trim()
    }
    if (typeof typed.error.code === 'string' && typeof typed.error.details === 'string') {
      return `${typed.error.code}: ${typed.error.details}`
    }
    if (typeof typed.error.code === 'string') return typed.error.code
  }
  if (typeof typed.code === 'string' && typed.code.trim()) return typed.code.trim()
  return null
}

function normalizeString(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return DEFAULT_ERROR
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const normalized = normalizePayload(parsed)
      if (normalized) return normalized
    } catch {
      // ignore JSON parse errors
    }
  }
  return trimmed
}

export function formatAdminError(error: unknown): string {
  if (!error) return DEFAULT_ERROR
  if (typeof error === 'string') return normalizeString(error)
  if (error instanceof Error) return normalizeString(error.message)
  if (typeof error === 'object') {
    const normalized = normalizePayload(error)
    if (normalized) return normalizeString(normalized)
  }
  return DEFAULT_ERROR
}

