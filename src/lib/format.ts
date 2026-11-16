import type { AdminOrder, OrderStatus, PrescriptionStatus } from '../types'

export function isPickupOrder(order: Pick<AdminOrder, 'deliveryType'>) {
  const type = (order.deliveryType ?? '').toLowerCase()
  return type.includes('pickup') || type.includes('collect')
}

export function orderFlowStatuses(order: Pick<AdminOrder, 'deliveryType'>): OrderStatus[] {
  const base: OrderStatus[] = ['placed', 'preparing']
  if (isPickupOrder(order)) {
    return [...base, 'ready_for_pickup', 'collected', 'cancelled']
  }
  return [...base, 'out_for_delivery', 'delivered', 'cancelled']
}

export function money(amount: number, digits = 2) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function compactMoney(amount: number) {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(amount >= 10000 ? 1 : 2)}k`
  return money(amount, 0)
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day}, ${time}`
}

export function greeting(firstName: string) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${firstName}`
}

export function orderLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    placed: 'Placed',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready for pickup',
    collected: 'Collected',
    out_for_delivery: 'On the way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

export function storeStatusLabel(status?: string) {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'active':
      return 'Active'
    case 'paused':
      return 'Paused'
    case 'archived':
      return 'Archived'
    default:
      return status ? status : 'Active'
  }
}

export function deskRoleLabel(role: string) {
  switch (role) {
    case 'OWNER':
      return 'Main Owner'
    case 'STORE_MANAGER':
    case 'MANAGER':
      return 'Store Manager'
    case 'PHARMACIST':
      return 'Pharmacist'
    case 'ORDER_STAFF':
    case 'STAFF':
      return 'Order Staff'
    default:
      return role
  }
}

export function rxLabel(status: PrescriptionStatus) {
  const labels: Record<PrescriptionStatus, string> = {
    pending: 'Pending review',
    needs_clearer_photo: 'Clearer photo needed',
    approved: 'Verified',
    dispensed: 'Dispensed',
    rejected: 'Rejected',
  }
  return labels[status]
}

export function deltaText(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
