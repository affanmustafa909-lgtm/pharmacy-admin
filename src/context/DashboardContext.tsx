import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildHash, pageFromHash, workspaceFromHash } from '../nav'
import { createPharmacyApi, usesRemoteApi, type PharmacyAdminApi } from '../services/api'
import { authToken, login as loginRequest, setAuthToken } from '../services/http'
import type { AdminSnapshot, Medicine, NewMedicineInput, OrderStatus, PageId, PharmacyLocation, PrescriptionStatus, SettingsState, StoreStatus, VerifiedRxItem } from '../types'

type Theme = 'light' | 'dark'

interface ToastItem {
  id: string
  text: string
}

interface DashboardContextValue {
  snapshot: AdminSnapshot | null
  loading: boolean
  error: string
  theme: Theme
  page: PageId
  activeStoreId: string | null
  activeStore: PharmacyLocation | null
  signedIn: boolean
  remote: boolean
  toasts: ToastItem[]
  go: (page: PageId, search?: string) => void
  openStore: (id: string, page?: PageId) => void
  exitStore: () => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => void
  reload: () => Promise<AdminSnapshot | void>
  notify: (text: string) => void
  run: (task: (api: PharmacyAdminApi) => Promise<void>, success: string) => Promise<boolean>
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<boolean>
  assignRider: (orderId: string, riderId: string | null) => Promise<boolean>
  createMedicine: (input: NewMedicineInput) => Promise<string | null>
  updateMedicine: (id: string, patch: Partial<Medicine>) => Promise<boolean>
  deactivateMedicine: (id: string) => Promise<boolean>
  deleteMedicine: (id: string) => Promise<boolean>
  decidePrescription: (
    id: string,
    status: PrescriptionStatus,
    options?: { notes?: string; verifiedItems?: VerifiedRxItem[] },
  ) => Promise<boolean>
  setPharmacyOpen: (id: string, isOpen: boolean) => Promise<boolean>
  createPharmacy: (input: {
    code: string
    name: string
    address: string
    openUntil: string
    phone?: string
    pharmacist?: string
    standardDelivery?: number
    expressDelivery?: number
    status?: StoreStatus
  }) => Promise<string | null>
  deletePharmacy: (id: string) => Promise<boolean>
  updatePharmacy: (id: string, patch: Partial<PharmacyLocation>) => Promise<boolean>
  toggleReminder: (id: string) => Promise<boolean>
  toggleCampaign: (id: string) => Promise<boolean>
  redeemCare: (points: number) => Promise<boolean>
  sendMessage: (threadId: string, text: string) => Promise<boolean>
  markNoticesRead: () => Promise<boolean>
  updateSettings: (patch: Partial<SettingsState>) => Promise<boolean>
  recordPayout: (amount: number, note: string) => Promise<boolean>
  restock: (medicineId: string, quantity: number) => Promise<boolean>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)
const THEME_KEY = 'hera-admin-theme'
const AUTH_ERROR = 'Sign in required'

function isAuthError(err: unknown) {
  return err instanceof Error && err.message === AUTH_ERROR
}

function errorText(err: unknown, fallback = 'Something went wrong') {
  return err instanceof Error && err.message ? err.message : fallback
}

/** crypto.randomUUID only exists on HTTPS/localhost, so fall back on plain HTTP. */
function makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => createPharmacyApi(), [])
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState<PageId>(() => pageFromHash())
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => workspaceFromHash() || null)
  const [signedIn, setSignedIn] = useState(() => Boolean(authToken()))
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const toastTimer = useRef<number[]>([])
  const autoStoreRef = useRef(false)

  const visiblePharmacies = useMemo(() => {
    if (!snapshot) return []
    const assigned = snapshot.admin.assignedStoreIds
    if (!assigned?.length || snapshot.admin.roleKey === 'ADMIN') return snapshot.pharmacies
    return snapshot.pharmacies.filter((item) => assigned.includes(item.id))
  }, [snapshot])

  const filteredSnapshot = useMemo(() => {
    if (!snapshot) return null
    if (visiblePharmacies.length === snapshot.pharmacies.length) return snapshot
    const visibleIds = new Set(visiblePharmacies.map((item) => item.id))
    return {
      ...snapshot,
      pharmacies: visiblePharmacies,
      medicines: snapshot.medicines.filter((item) => !item.storeId || visibleIds.has(item.storeId)),
      orders: snapshot.orders.filter((item) => visibleIds.has(item.pharmacyId)),
      prescriptions: snapshot.prescriptions.filter((item) => visibleIds.has(item.pharmacyId)),
      locations: snapshot.locations.filter((item) => visibleIds.has(item.pharmacyId)),
    }
  }, [snapshot, visiblePharmacies])

  const activeStore = filteredSnapshot?.pharmacies.find((item) => item.id === activeStoreId) ?? null

  const toast = useCallback((text: string) => {
    const id = makeId()
    setToasts((current) => [...current, { id, text }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
      toastTimer.current = toastTimer.current.filter((item) => item !== timer)
    }, 2800)
    toastTimer.current.push(timer)
  }, [])

  /** Clears the session. Used by sign out and when the token expires mid-session. */
  const expireSession = useCallback(() => {
    setAuthToken('')
    setSnapshot(null)
    setActiveStoreId(null)
    setToasts([])
    autoStoreRef.current = false
    setSignedIn(false)
  }, [])

  const reload = useCallback(async () => {
    const next = await api.getSnapshot()
    setSnapshot(next)
    setError('')
    return next
  }, [api])

  useEffect(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    let cancel = false
    api
      .getSnapshot()
      .then((next) => {
        if (cancel) return
        setSnapshot(next)
        setError('')
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancel) return
        if (isAuthError(err)) expireSession()
        setError(errorText(err, 'Could not load the dashboard'))
        setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [api, signedIn, expireSession])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable (private mode) */
    }
  }, [theme])

  useEffect(() => {
    const syncHash = () => {
      setPage(pageFromHash())
      setActiveStoreId(workspaceFromHash() || null)
    }
    window.addEventListener('popstate', syncHash)
    window.addEventListener('hashchange', syncHash)
    return () => {
      window.removeEventListener('popstate', syncHash)
      window.removeEventListener('hashchange', syncHash)
    }
  }, [])

  useEffect(() => {
    return () => {
      toastTimer.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!activeStoreId || !filteredSnapshot) return
    if (!filteredSnapshot.pharmacies.some((item) => item.id === activeStoreId)) {
      setActiveStoreId(null)
      const hash = buildHash(page, '', '')
      if (window.location.hash !== hash) history.replaceState(null, '', hash)
    }
  }, [activeStoreId, filteredSnapshot, page])

  const go = useCallback((next: PageId, search = '') => {
    setPage(next)
    const hash = buildHash(next, search, activeStoreId ?? '')
    if (window.location.hash !== hash) history.pushState(null, '', hash)
  }, [activeStoreId])

  const openStore = useCallback((id: string, nextPage: PageId = 'overview') => {
    setActiveStoreId(id)
    setPage(nextPage)
    const hash = buildHash(nextPage, '', id)
    if (window.location.hash !== hash) history.pushState(null, '', hash)
  }, [])

  const exitStore = useCallback(() => {
    setActiveStoreId(null)
    setPage('pharmacies')
    const hash = buildHash('pharmacies')
    if (window.location.hash !== hash) history.pushState(null, '', hash)
  }, [])

  useEffect(() => {
    if (!filteredSnapshot || activeStoreId || autoStoreRef.current) return
    const assigned = filteredSnapshot.admin.assignedStoreIds
    if (assigned?.length === 1 && filteredSnapshot.pharmacies.some((item) => item.id === assigned[0])) {
      autoStoreRef.current = true
      const id = assigned[0]
      setActiveStoreId(id)
      const nextPage = pageFromHash()
      setPage(nextPage)
      const hash = buildHash(nextPage, '', id)
      if (window.location.hash !== hash) history.replaceState(null, '', hash)
    }
  }, [filteredSnapshot, activeStoreId])

  const run = useCallback(
    async (task: (client: PharmacyAdminApi) => Promise<void>, success: string) => {
      // Step 1: the action itself. If this fails, nothing was saved.
      try {
        await task(api)
      } catch (err) {
        if (isAuthError(err)) expireSession()
        toast(errorText(err))
        return false
      }
      // Step 2: refresh the list. The action already succeeded, so never report failure here
      // (otherwise the user retries and e.g. restocks twice).
      try {
        await reload()
        toast(success)
      } catch (err) {
        if (isAuthError(err)) {
          expireSession()
          return true
        }
        toast(`${success}, but the list could not refresh. Please reload the page.`)
      }
      return true
    },
    [api, reload, toast, expireSession],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({
      snapshot: filteredSnapshot,
      loading,
      error,
      theme,
      page,
      activeStoreId,
      activeStore,
      signedIn,
      remote: usesRemoteApi(),
      toasts,
      go,
      openStore,
      exitStore,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
      signIn: async (email: string, password: string) => {
        try {
          await loginRequest(email, password)
          setError('')
          setLoading(true)
          setSignedIn(true)
          return true
        } catch (err) {
          toast(errorText(err, 'Sign in failed'))
          return false
        }
      },
      signOut: expireSession,
      reload,
      notify: toast,
      run,
      updateOrderStatus: (id, status) => run((client) => client.updateOrderStatus(id, status), 'Order updated'),
      assignRider: (orderId, riderId) =>
        run((client) => client.assignRider(orderId, riderId), riderId ? 'Rider assigned' : 'Rider removed'),
      createMedicine: async (input) => {
        let id: string
        try {
          const created = await api.createMedicine(input)
          if (!created?.id) {
            toast('Medicine was not saved')
            return null
          }
          id = created.id
        } catch (err) {
          if (isAuthError(err)) expireSession()
          toast(errorText(err))
          return null
        }
        // The medicine is saved. A failed refresh must not look like a failed save,
        // or the user adds it again and creates a duplicate.
        try {
          await reload()
          toast('Medicine added')
        } catch (err) {
          if (isAuthError(err)) {
            expireSession()
            return id
          }
          toast('Medicine added, but the list could not refresh. Please reload the page.')
        }
        return id
      },
      updateMedicine: (id, patch) => run((client) => client.updateMedicine(id, patch), 'Medicine updated'),
      deactivateMedicine: (id) => run((client) => client.deactivateMedicine(id), 'Medicine deactivated'),
      deleteMedicine: (id) => run((client) => client.deleteMedicine(id), 'Medicine deleted'),
      decidePrescription: (id, status, options) =>
        run(
          (client) => client.decidePrescription(id, status, options),
          status === 'rejected' ? 'Prescription rejected' : status === 'needs_clearer_photo' ? 'Asked for a clearer photo' : 'Prescription updated',
        ),
      setPharmacyOpen: (id, isOpen) =>
        run((client) => client.setPharmacyOpen(id, isOpen), isOpen ? 'Store is open' : 'Store is closed'),
      createPharmacy: async (input) => {
        try {
          const created = await api.createPharmacy(input)
          if (!created?.id) {
            toast('Store was not saved')
            return null
          }
          const next = await reload()
          const confirmed = next.pharmacies.some((item) => item.id === created.id)
          if (!confirmed) {
            toast('Store save could not be confirmed. Refresh and try again.')
            return null
          }
          toast(input.status === 'draft' ? 'Draft store saved' : 'Store added')
          return created.id
        } catch (err) {
          if (isAuthError(err)) expireSession()
          toast(errorText(err, 'Could not add store'))
          return null
        }
      },
      deletePharmacy: (id) => run((client) => client.deletePharmacy(id), 'Store removed'),
      updatePharmacy: (id, patch) => run((client) => client.updatePharmacy(id, patch), 'Store details saved'),
      toggleReminder: (id) => run((client) => client.toggleReminder(id), 'Reminder updated'),
      toggleCampaign: (id) => run((client) => client.toggleCampaign(id), 'Campaign updated'),
      redeemCare: (points) => run((client) => client.redeemCare(points), 'Care points redeemed'),
      sendMessage: (threadId, text) => run((client) => client.sendMessage(threadId, text), 'Message sent'),
      markNoticesRead: () => run((client) => client.markNoticesRead(), 'Notifications cleared'),
      updateSettings: (patch) => run((client) => client.updateSettings(patch), 'Settings saved'),
      recordPayout: (amount, note) => run((client) => client.recordPayout(amount, note), 'Payout recorded'),
      restock: (medicineId, quantity) => run((client) => client.restock(medicineId, quantity), 'Stock updated'),
    }),
    [api, filteredSnapshot, loading, error, theme, page, activeStoreId, activeStore, signedIn, toasts, go, openStore, exitStore, reload, run, toast, expireSession],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used inside DashboardProvider')
  return context
}