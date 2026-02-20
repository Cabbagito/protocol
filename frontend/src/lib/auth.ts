const TOKEN_KEY = 'protocol_token'
const USER_KEY = 'protocol_user'

export interface UserInfo {
  name: string
  is_admin: boolean
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getUserInfo(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

export function setUserInfo(info: UserInfo): void {
  localStorage.setItem(USER_KEY, JSON.stringify(info))
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
