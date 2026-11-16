import type { AdminSnapshot, Medicine, NewMedicineInput, OrderStatus, PharmacyLocation, PrescriptionStatus, SettingsState, StoreStatus, VerifiedRxItem } from '../types'
import { apiFetch } from './http'

export interface PharmacyAdminApi {
  getSnapshot(): Promise<AdminSnapshot>
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>
  createMedicine(input: NewMedicineInput): Promise<{ id: string }>
  updateMedicine(id: string, patch: Partial<Medicine>): Promise<void>
  deactivateMedicine(id: string): Promise<void>
  deleteMedicine(id: string): Promise<void>
  decidePrescription(
    id: string,
    status: PrescriptionStatus,
    options?: { notes?: string; verifiedItems?: VerifiedRxItem[] },
  ): Promise<void>
  setPharmacyOpen(id: string, isOpen: boolean): Promise<void>
  createPharmacy(input: {
    code: string
    name: string
    address: string
    openUntil: string
    phone?: string
    pharmacist?: string
    standardDelivery?: number
    expressDelivery?: number
    status?: StoreStatus
  }): Promise<{ id: string }>
  deletePharmacy(id: string): Promise<void>
  updatePharmacy(id: string, patch: Partial<PharmacyLocation>): Promise<void>
  toggleReminder(id: string): Promise<void>
  toggleCampaign(id: string): Promise<void>
  redeemCare(points: number): Promise<void>
  sendMessage(threadId: string, text: string): Promise<void>
  markNoticesRead(): Promise<void>
  updateSettings(patch: Partial<SettingsState>): Promise<void>
  recordPayout(amount: number, note: string): Promise<void>
  restock(medicineId: string, quantity: number): Promise<void>
}

function post(path: string, body?: unknown) {
  return apiFetch(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then(() => undefined)
}

export class HttpPharmacyApi implements PharmacyAdminApi {
  getSnapshot() {
    return apiFetch('/admin/snapshot') as Promise<AdminSnapshot>
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    return post(`/admin/orders/${encodeURIComponent(id)}/status`, { status })
  }

  createMedicine(input: NewMedicineInput) {
    return apiFetch('/admin/products', { method: 'POST', body: JSON.stringify(input) }) as Promise<{ id: string }>
  }

  updateMedicine(id: string, patch: Partial<Medicine>) {
    return apiFetch(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(() => undefined)
  }

  deactivateMedicine(id: string) {
    return post(`/admin/products/${id}/deactivate`, {})
  }

  deleteMedicine(id: string) {
    return apiFetch(`/admin/products/${id}`, { method: 'DELETE' }).then(() => undefined)
  }

  decidePrescription(
    id: string,
    status: PrescriptionStatus,
    options?: { notes?: string; verifiedItems?: VerifiedRxItem[] },
  ) {
    return post(`/admin/prescriptions/${encodeURIComponent(id)}/decision`, {
      status,
      notes: options?.notes,
      verifiedItems: options?.verifiedItems,
    })
  }

  setPharmacyOpen(id: string, isOpen: boolean) {
    return post(`/admin/pharmacies/${id}/open`, { isOpen })
  }

  createPharmacy(input: {
    code: string
    name: string
    address: string
    openUntil: string
    phone?: string
    pharmacist?: string
    standardDelivery?: number
    expressDelivery?: number
    status?: StoreStatus
  }) {
    return apiFetch('/admin/pharmacies', { method: 'POST', body: JSON.stringify(input) }) as Promise<{ id: string }>
  }

  deletePharmacy(id: string) {
    return apiFetch(`/admin/pharmacies/${id}`, { method: 'DELETE' }).then(() => undefined)
  }

  updatePharmacy(id: string, patch: Partial<PharmacyLocation>) {
    return apiFetch(`/admin/pharmacies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(() => undefined)
  }

  toggleReminder(id: string) {
    return post(`/admin/reminders/${id}/toggle`, {})
  }

  toggleCampaign(id: string) {
    return post(`/admin/campaigns/${id}/toggle`, {})
  }

  redeemCare(points: number) {
    return post('/admin/care/redeem', { points })
  }

  sendMessage(threadId: string, text: string) {
    return post(`/admin/messages/${threadId}`, { text })
  }

  markNoticesRead() {
    return post('/admin/notices/read', {})
  }

  updateSettings(patch: Partial<SettingsState>) {
    return post('/admin/settings', patch)
  }

  recordPayout(amount: number, note: string) {
    return post('/admin/payouts', { amount, note })
  }

  restock(medicineId: string, quantity: number) {
    return post(`/admin/products/${medicineId}/restock`, { quantity })
  }
}

export function createPharmacyApi(): PharmacyAdminApi {
  return new HttpPharmacyApi()
}

export function usesRemoteApi() {
  return true
}
