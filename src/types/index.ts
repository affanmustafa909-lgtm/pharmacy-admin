/** Admin contracts. Shaped so a future API can return this snapshot to the dashboard
 * and the same entities can be reconciled with the mobile app (orders, pharmacies, reminders). */

export type PageId =
  | 'overview'
  | 'orders'
  | 'medicines'
  | 'prescriptions'
  | 'customers'
  | 'pharmacies'
  | 'team'
  | 'parallel'
  | 'reminders'
  | 'mobile'
  | 'reports'
  | 'messages'
  | 'settings'

export type DeskRole = 'OWNER' | 'STORE_MANAGER' | 'PHARMACIST' | 'ORDER_STAFF'

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type StoreStatus = 'draft' | 'active' | 'paused' | 'archived'

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed'

export type MobileConfig = {
  heroLight: string
  heroBold: string
  quickActions: { id: string; label: string; icon: string; href: string }[]
  deliveryOptions: { id: 'standard' | 'express'; title: string; eta: string; priceLabel: string; highlighted?: boolean }[]
  paymentMethods: { id: string; type: 'apple_pay' | 'card' | 'other'; label: string; detail?: string }[]
  aiMessages: { id: string; role: 'assistant' | 'user'; text: string }[]
  tracking: {
    riderName: string
    expressEtaMinutes: number
    standardEtaMinutes: number
    defaultDistanceKm: number
  }
}

export type PromoCode = {
  id: string
  code: string
  label: string
  discount: number
  active: boolean
}

export type OrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'collected'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export type PrescriptionStatus = 'pending' | 'needs_clearer_photo' | 'approved' | 'dispensed' | 'rejected'

export interface VerifiedRxItem {
  productId?: string
  name: string
  strength?: string
  quantity?: string
  approvedQty?: number
  packSize?: string
  sku?: string
  unitLabel?: string
  reviewer?: string
  reviewedAt?: string
}

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  deskRole: DeskRole
  canChangePrice: boolean
  canRefund: boolean
  createdAt: string
}

export interface StaffInvite {
  id: string
  email: string
  deskRole: DeskRole
  status: InviteStatus
  canChangePrice: boolean
  canRefund: boolean
  createdAt: string
  acceptedAt?: string
}

export interface CatalogProduct {
  id: string
  sku: string
  name: string
  strength?: string
  unitLabel: string
  packSize?: string
  price: number
  stock: number
  rxRequired: boolean
}

export interface AdminProfile {
  name: string
  firstName: string
  email: string
  role: string
  roleKey?: 'ADMIN' | 'STAFF' | 'CUSTOMER'
  storeId?: string | null
  deskRole?: DeskRole
  assignedStoreIds?: string[]
  canChangePrice?: boolean
  canRefund?: boolean
  initials: string
}

export interface Metrics {
  netSales: number
  salesDelta: number
  ordersToday: number
  ordersDelta: number
  refunds: number
  refundsDelta: number
  rxRevenue: number
  rxDelta: number
  retailRevenue: number
  retailDelta: number
  dispensed: number
  capacity: number
}

export interface MonthPoint {
  month: string
  sales: number
  returns: number
}

export interface LocationStat {
  pharmacyId: string
  code: string
  name: string
  revenue: number
  delta: string
  active: boolean
}

export interface AdminOrderItem {
  name: string
  sku: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface AdminOrder {
  id: string
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  pharmacyId: string
  pharmacyName: string
  itemSummary: string
  items?: AdminOrderItem[]
  total: number
  status: OrderStatus
  paymentStatus?: PaymentStatus
  channel: string
  deliveryType?: string
  paymentLabel?: string
  addressLine?: string
  createdAt: string
  productSubtotal?: number
  deliveryCharge?: number
  serviceCharge?: number
  bfpCharge?: number
  charges?: { kind: string; label: string; amount: number; mode?: string; rate?: number; percentBase?: string | null }[]
}

export interface Medicine {
  id: string
  storeId?: string
  storeName?: string
  name: string
  brand: string
  genericName?: string
  strength?: string
  category: string
  price: number
  unitLabel: string
  sku: string
  stock: number
  batch: string
  expiry: string
  held: boolean
  onlineSale: boolean
  rxRequired: boolean
  lowStockAlerts: boolean
  description: string
  imageUrl?: string
}

export interface NewMedicineInput {
  storeId: string
  name: string
  brand: string
  genericName?: string
  strength?: string
  category: string
  price: number
  unitLabel: string
  stock: number
  rxRequired: boolean
  imageUrl?: string
  onlineSale?: boolean
  sku?: string
  description?: string
  batch?: string
  expiry?: string
  held?: boolean
  lowStockAlerts?: boolean
}

export interface Prescription {
  id: string
  customerId: string
  customerName: string
  medicineName: string
  prescriber: string
  pharmacyId: string
  pharmacyName: string
  status: PrescriptionStatus
  quantity: string
  submittedAt: string
  notes: string
  imageUrl?: string
  scannedText?: string
  verifiedItems?: VerifiedRxItem[]
  customerNote?: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  city: string
  orders: number
  spend: number
  status: 'active' | 'inactive'
  since: string
}

export interface PharmacyFee {
  id: string
  kind: string
  label: string
  mode: string
  amount: number
  percentBase?: string | null
  deliveryType?: string | null
}

export interface PharmacyLocation {
  id: string
  code?: string
  name: string
  address: string
  openUntil: string
  weeklyHours?: Record<string, { open: string; close: string } | null>
  rating: number
  isOpen: boolean
  acceptingOrders?: boolean
  status?: StoreStatus
  ordersToday: number
  revenueToday: number
  pharmacist: string
  phone: string
  fees?: PharmacyFee[]
}

export interface Reminder {
  id: string
  customerName: string
  medicine: string
  time: string
  frequency: string
  enabled: boolean
  adherence: number
}

export interface Campaign {
  id: string
  title: string
  detail: string
  ends: string
  active: boolean
}

export interface CareEvent {
  id: string
  title: string
  date: string
  points: number
}

export interface CareProgram {
  points: number
  tier: 'Silver' | 'Gold' | 'Platinum'
  memberSince: string
  pointsToNext: number
  nextTier: string
  rewardValue: number
  tiers: Record<'Silver' | 'Gold' | 'Platinum', string[]>
  campaigns: Campaign[]
  history: CareEvent[]
}

export interface ChatMessage {
  id: string
  from: 'patient' | 'staff'
  text: string
  at: string
}

export interface MessageThread {
  id: string
  customerId: string
  name: string
  online: boolean
  unread: number
  messages: ChatMessage[]
}

export interface Notice {
  id: string
  title: string
  body: string
  at: string
  read: boolean
  page: PageId
}

export interface SettingsState {
  storeName: string
  alertEmail: boolean
  lowStockThreshold: number
  autoApproveRefills: boolean
  showOutOfStock: boolean
}

export interface Payout {
  id: string
  amount: number
  note: string
  at: string
}

export interface DashboardCounts {
  pendingRx: number
  lowStock: number
  expiringBatches: number
  ordersToday: number
}

export interface AdminSnapshot {
  admin: AdminProfile
  metrics: Record<string, Metrics>
  chart: Record<string, MonthPoint[]>
  locations: LocationStat[]
  orders: AdminOrder[]
  medicines: Medicine[]
  prescriptions: Prescription[]
  customers: Customer[]
  pharmacies: PharmacyLocation[]
  reminders: Reminder[]
  care: CareProgram
  threads: MessageThread[]
  notices: Notice[]
  settings: SettingsState
  payouts: Payout[]
  promos?: PromoCode[]
  mobileConfig?: MobileConfig
  dashboardCounts?: DashboardCounts
}
