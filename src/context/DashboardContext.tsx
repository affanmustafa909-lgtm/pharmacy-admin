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

export function DashboardProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => createPharmacyApi(), [])
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState<PageId>(() => pageFromHash())
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => workspaceFromHash() || null)
  const [signedIn, setSignedIn] = useState(() => Boolean(authToken()))
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const toastTimer = useRef<number[]>([])
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
  const autoStoreRef = useRef(false)

  const toast = useCallback((text: string) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, text }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 2800)
    toastTimer.current.push(timer)
  }, [])

  const reload = useCallback(async () => {
    const next = await api.getSnapshot()
    setSnapshot(next)
    setError('')
    return next
  }, [api])

  // Live auto-refresh so new orders placed from the mobile app appear automatically
  useEffect(() => {
    if (!signedIn) return
    let busy = false

    const syncNow = () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      api
        .getSnapshot()
        .then((next) => {
          setSnapshot(next)
          setError('')
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false
        })
    }

    const interval = window.setInterval(syncNow, 4000)
    const onFocus = () => syncNow()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncNow()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [api, signedIn])

  useEffect(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    let cancel = false
    const timer = window.setTimeout(() => {
      api
        .getSnapshot()
        .then((next) => {
          if (cancel) return
          setSnapshot(next)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (cancel) return
          if (err instanceof Error && err.message === 'Sign in required') {
            setAuthToken('')
            setSignedIn(false)
          }
          setError(err instanceof Error ? err.message : 'Could not load the dashboard')
          setLoading(false)
        })
    }, 280)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [api, signedIn])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
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
    void reload().catch(() => undefined)
  }, [activeStoreId, reload])

  const openStore = useCallback((id: string, nextPage: PageId = 'overview') => {
    setActiveStoreId(id)
    setPage(nextPage)
    const hash = buildHash(nextPage, '', id)
    if (window.location.hash !== hash) history.pushState(null, '', hash)
    void reload().catch(() => undefined)
  }, [reload])

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
      try {
        await task(api)
        await reload()
        toast(success)
        return true
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Something went wrong')
        return false
      }
    },
    [api, reload, toast],
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
          toast(err instanceof Error ? err.message : 'Sign in failed')
          return false
        }
      },
      signOut: () => {
        setAuthToken('')
        setSnapshot(null)
        setActiveStoreId(null)
        setSignedIn(false)
      },
      reload,
      notify: toast,
      run,
      updateOrderStatus: (id, status) => run((client) => client.updateOrderStatus(id, status), 'Order updated'),
      createMedicine: async (input) => {
        try {
          const created = await api.createMedicine(input)
          await reload()
          toast('Medicine added')
          return created.id
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Something went wrong')
          return null
        }
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
          await reload()
          const next = await api.getSnapshot()
          const confirmed = next.pharmacies.some((item) => item.id === created.id)
          if (!confirmed) {
            toast('Store save could not be confirmed. Refresh and try again.')
            return null
          }
          setSnapshot(next)
          toast(input.status === 'draft' ? 'Draft store saved' : 'Store added')
          return created.id
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Could not add store')
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
    [api, filteredSnapshot, loading, error, theme, page, activeStoreId, activeStore, signedIn, toasts, go, openStore, exitStore, reload, run, toast],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used inside DashboardProvider')
  return context
}
