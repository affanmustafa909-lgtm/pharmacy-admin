const TOKEN_KEY = 'hera-admin-token'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000').replace(/\/$/, '')

export function authToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function setAuthToken(token: string) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = authToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...init, headers })
  if (response.status === 401) {
    setAuthToken('')
    throw new Error('Sign in required')
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      message = `Request failed (${response.status})`
    }
    throw new Error(message)
  }
  if (response.status === 204) return null
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('application/json')) return response.json()
  return response.blob()
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = (await response.json()) as { message?: string; token?: string }
  if (!response.ok || !payload.token) throw new Error(payload.message || 'Sign in failed')
  setAuthToken(payload.token)
}
