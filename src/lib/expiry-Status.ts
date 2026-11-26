import { daysLeft, isExpired, normalizeExpiry } from './expiry'

/** One rule for every page: expired, or expiring within this many calendar days (today counts as day 0). */
export const EXPIRY_SOON_DAYS = 90

export type ExpiryState = 'none' | 'invalid' | 'expired' | 'soon' | 'ok'

/** Calendar days left. 0 = expires today, -1 = expired yesterday. Null if there is no readable expiry. */
export function calendarDaysLeft(value?: string | null, now = new Date()): number | null {
  const left = daysLeft(value, now)
  return left === null ? null : left - 1
}

export function expiryState(value?: string | null, now = new Date()): ExpiryState {
  if (!String(value ?? '').trim()) return 'none'
  const days = calendarDaysLeft(value, now)
  if (days === null) return 'invalid'
  if (isExpired(value, now)) return 'expired'
  return days <= EXPIRY_SOON_DAYS ? 'soon' : 'ok'
}

/** Same date format on every page: YYYY-MM-DD (12/27 becomes 2027-12-31). */
export function formatExpiry(value?: string | null): string {
  const iso = normalizeExpiry(value)
  return iso ?? (String(value ?? '').trim() || '—')
}

export function expiryLabel(value?: string | null, now = new Date()): string {
  const state = expiryState(value, now)
  const left = daysLeft(value, now)
  if (state === 'expired' && left !== null) {
    const ago = 1 - left
    return `Expired ${ago} ${ago === 1 ? 'day' : 'days'} ago`
  }
  if (state === 'soon') {
    const days = calendarDaysLeft(value, now) ?? 0
    return days === 0 ? 'Expires today' : `${days} ${days === 1 ? 'day' : 'days'} left`
  }
  return formatExpiry(value)
}