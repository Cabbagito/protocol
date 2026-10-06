import { getToken, clearToken } from '../lib/auth'

const BASE_URL = '/api'
const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** No response at all: offline, DNS/TLS failure, or timed out. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  // Weak gym signal tends to hang requests rather than fail them; give up
  // after a bound so callers (and the sync queue) can retry.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, { ...init, headers, signal: controller.signal })
  } catch (e) {
    throw new NetworkError(controller.signal.aborted ? 'Request timed out' : (e as Error).message)
  } finally {
    clearTimeout(timer)
  }

  // A 401 from the login endpoint is just a wrong password.
  if (response.status === 401 && endpoint !== '/auth/login') {
    clearToken()
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    const detail = typeof error.detail === 'string' ? error.detail : 'Request failed'
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint)
  },

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put<T>(endpoint: string, data: unknown, opts?: { timeoutMs?: number }): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      timeoutMs: opts?.timeoutMs,
    })
  },

  patch<T>(endpoint: string, data: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, {
      method: 'DELETE',
    })
  },
}
