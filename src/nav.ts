import type { PageId } from './types'

export const TOP_NAV: { id: PageId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'medicines', label: 'Medicines' },
  { id: 'pharmacies', label: 'Stores' },
  { id: 'customers', label: 'Customers' },
  { id: 'reports', label: 'Reports' },
]

/** Shown in header + sidebar while a single store workspace is open. */
export const STORE_TOP_NAV: { id: PageId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'medicines', label: 'Products' },
  { id: 'pharmacies', label: 'Delivery' },
  { id: 'settings', label: 'Store' },
]

export const PAGE_IDS: PageId[] = [
  'overview',
  'orders',
  'medicines',
  'prescriptions',
  'customers',
  'pharmacies',
  'team',
  'parallel',
  'reminders',
  'mobile',
  'reports',
  'messages',
  'settings',
]

export function pageFromHash(hash = window.location.hash): PageId {
  const id = hash.replace('#', '').split('?')[0] as PageId
  if (id === 'prescriptions') return 'overview'
  return PAGE_IDS.includes(id) ? id : 'overview'
}

export function hashQuery(key: string) {
  const query = window.location.hash.split('?')[1] ?? ''
  return new URLSearchParams(query).get(key) ?? ''
}

export function workspaceFromHash() {
  return hashQuery('workspace')
}

export function buildHash(page: PageId, search = '', workspaceId = '') {
  const params = new URLSearchParams(search)
  if (workspaceId) params.set('workspace', workspaceId)
  else params.delete('workspace')
  const query = params.toString()
  return `#${page}${query ? `?${query}` : ''}`
}
