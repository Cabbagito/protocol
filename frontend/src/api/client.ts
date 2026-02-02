import { getToken, clearToken } from '../lib/auth'

const BASE_URL = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new ApiError(response.status, error.detail || 'Request failed')
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

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, {
      method: 'DELETE',
    })
  },
}
