import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardList,
  Clock,
  HeartPulse,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Split,
  Moon,
  Pill,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Smartphone,
  Sun,
  Truck,
  UserCog,
  Users,
} from 'lucide-react'
import { useDashboard } from '../context/DashboardContext'
import { STORE_TOP_NAV, TOP_NAV } from '../nav'
import type { PageId } from '../types'
import { AuditPage } from '../pages/Audit'
import { CustomersPage } from '../pages/Customers'
import { MedicinesPage } from '../pages/Medicines'
import { MessagesPage } from '../pages/Messages'
import { MobileAppPage } from '../pages/MobileApp'
import { OrdersPage } from '../pages/Orders'
import { OverviewPage } from '../pages/Overview'
import { ParallelPage } from '../pages/Parallel'
import { PharmaciesPage } from '../pages/Pharmacies'
import { PrescriptionsPage } from '../pages/Prescriptions'
import { RemindersPage } from '../pages/Reminders'
import { ReportsPage } from '../pages/Reports'
import { SettingsPage } from '../pages/Settings'
import { TeamAccessPage } from '../pages/TeamAccess'

const PAGES: Record<PageId, () => ReactNode> = {
  overview: OverviewPage,
  orders: OrdersPage,
  medicines: MedicinesPage,
  prescriptions: PrescriptionsPage,
  customers: CustomersPage,
  pharmacies: PharmaciesPage,
  team: TeamAccessPage,
  parallel: ParallelPage,
  reminders: RemindersPage,
  mobile: MobileAppPage,
  reports: ReportsPage,
  audit: AuditPage,
  messages: MessagesPage,
  settings: SettingsPage,
}

const RAIL: { id: PageId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'medicines', label: 'Medicines', icon: Pill },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'pharmacies', label: 'Stores', icon: MapPin },
  { id: 'parallel', label: 'Parallel', icon: Split },
  { id: 'reminders', label: 'Reminders', icon: HeartPulse },
  { id: 'mobile', label: 'Mobile App', icon: Smartphone },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const STORE_RAIL: { id: PageId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'medicines', label: 'Products', icon: Pill },
  { id: 'pharmacies', label: 'Delivery', icon: Truck },
  { id: 'team', label: 'Team & Access', icon: UserCog },
  { id: 'settings', label: 'Store', icon: Settings },
]

type Panel = 'notices' | 'activity' | 'user' | 'search' | null

export function Shell() {
  const dash = useDashboard()
  const [panel, setPanel] = useState<Panel>(null)
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('ava@hera.care')
  const [password, setPassword] = useState('HeraAdmin!234')
  const [signingIn, setSigningIn] = useState(false)
  const {
    snapshot,
    page,
    go,
    theme,
    setTheme,
    signOut,
    signedIn,
    signIn,
    loading,
    error,
    reload,
    toasts,
    markNoticesRead,
    activeStore,
    activeStoreId,
    exitStore,
  } = dash
  const inStore = Boolean(activeStoreId && activeStore)
  const topNav = inStore ? STORE_TOP_NAV : TOP_NAV
  const isOwner = snapshot?.admin.roleKey === 'ADMIN'
  const rail = inStore ? STORE_RAIL : RAIL.filter((item) => item.id !== 'audit' || isOwner)

  useEffect(() => {
    setPanel(null)
  }, [page])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === 'Escape') setPanel(null)
      if (!typing && event.key === '/') {
        event.preventDefault()
        setPanel('search')
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPanel('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    if (!snapshot) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    const items: { id: string; group: string; title: string; meta: string; page: PageId; search?: string }[] = []
    snapshot.orders.forEach((order) => {
      if (`${order.id} ${order.customerName} ${order.itemSummary}`.toLowerCase().includes(q)) {
        items.push({ id: order.id, group: 'Orders', title: order.id, meta: `${order.customerName} · ${order.itemSummary}`, page: 'orders' })
      }
    })
    snapshot.medicines.forEach((medicine) => {
      if (`${medicine.name} ${medicine.sku}`.toLowerCase().includes(q)) {
        items.push({ id: medicine.id, group: 'Medicines', title: medicine.name, meta: medicine.sku, page: 'medicines' })
      }
    })
    snapshot.customers.forEach((customer) => {
      if (`${customer.name} ${customer.email}`.toLowerCase().includes(q)) {
        items.push({ id: customer.id, group: 'Customers', title: customer.name, meta: customer.email, page: 'customers', search: `customer=${customer.id}` })
      }
    })
    snapshot.pharmacies.forEach((pharmacy) => {
      if (pharmacy.name.toLowerCase().includes(q)) {
        items.push({ id: pharmacy.id, group: 'Stores', title: pharmacy.name, meta: pharmacy.address, page: 'pharmacies' })
      }
    })
    return items.slice(0, 12)
  }, [query, snapshot])

  if (!signedIn) {
    return (
      <div className="signed">
        <div className="signed-glow" aria-hidden="true" />
        <div className="signed-grid" aria-hidden="true" />
        <div className="signed-shell">
          <aside className="signed-hero">
            <div className="signed-hero-mark">h</div>
            <p className="signed-kicker">Pharmacy operations</p>
            <h1 className="signed-brand">hera.</h1>
            <p className="signed-lead">Manage medicines, stock, charges, and every store order from one calm desk.</p>
            <ul className="signed-points">
              <li>Live catalog sync to the app</li>
              <li>Store-level delivery & service charges</li>
              <li>Order status and patient detail</li>
            </ul>
          </aside>
          <form
            className="signed-card"
            onSubmit={(event) => {
              event.preventDefault()
              setSigningIn(true)
              void signIn(email, password).finally(() => setSigningIn(false))
            }}
          >
            <p className="signed-card-kicker">Admin access</p>
            <h2>Sign in</h2>
            <p className="signed-card-sub">Pharmacy leads and store staff use their Hera account.</p>
            <label className="field signed-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="you@hera.care" />
            </label>
            <label className="field signed-field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" />
            </label>
            <button className="signed-submit" type="submit" disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Continue to admin'}
            </button>
            <p className="signed-hint">Demo · ava@hera.care · store staff · leo@hera.care</p>
          </form>
        </div>
      </div>
    )
  }

  const unread = snapshot?.notices.filter((notice) => !notice.read).length ?? 0
  const mail = snapshot?.threads.some((thread) => thread.unread > 0) ?? false
  const Page = PAGES[page]

  return (
    <div className="canvas">
      <div className="shell">
        <header className="topbar">
          <button className="brand" type="button" onClick={() => (inStore ? go('overview') : go('overview'))}>
            <span className="brand-mark">h</span>
            <span className="brand-copy">
              <b>hera</b>
              <small>
                {inStore
                  ? `${activeStore!.name}${activeStore!.code ? ` (${activeStore!.code})` : ''}`
                  : 'Pharmacy admin'}
              </small>
            </span>
          </button>
          {inStore ? (
            <button className="store-exit" type="button" onClick={exitStore}>
              <ArrowLeft size={14} />
              All stores
            </button>
          ) : null}
          <nav className="nav-pill" aria-label="Primary">
            {topNav.map((item) => {
              const active = page === item.id
              return (
                <button key={item.id} className={active ? 'nav-item is-active' : 'nav-item'} type="button" onClick={() => go(item.id)} aria-current={active ? 'page' : undefined}>
                  {active ? <motion.span layoutId="top-pill" className="nav-item-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                  <span className="nav-item-label">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="tool-group">
            <button
              className="icon-btn"
              type="button"
              aria-label="Refresh orders and data"
              title="Refresh data"
              onClick={() => void reload()}
            >
              <RefreshCw size={16} />
            </button>
            <button className="icon-btn" type="button" aria-label="Search" onClick={() => setPanel('search')}><Search size={16} /></button>
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => setPanel(panel === 'notices' ? null : 'notices')}>
              <Bell size={16} />
              {unread > 0 ? <i className="ping" /> : null}
            </button>
            <button className="icon-btn" type="button" aria-label="Recent activity" onClick={() => setPanel(panel === 'activity' ? null : 'activity')}><Clock size={16} /></button>
          </div>
          <button className="user-chip" type="button" onClick={() => setPanel(panel === 'user' ? null : 'user')}>
            <span className="avatar">{snapshot?.admin.initials ?? 'AP'}</span>
            <span>
              <b>{snapshot?.admin.name ?? 'Ava Patel'}</b>
              <small>
                {inStore
                  ? `${activeStore!.name}${activeStore!.code ? ` · ${activeStore!.code}` : ''}`
                  : (snapshot?.admin.email ?? 'ava@hera.care')}
              </small>
            </span>
            <ChevronDown size={16} />
          </button>
        </header>

        <div className="workspace">
          <aside className="rail-col">
            <div className="theme-pill" aria-label="Theme">
              <button className={theme === 'light' ? 'is-on' : ''} type="button" aria-label="Light theme" onClick={() => setTheme('light')}><Sun size={16} /></button>
              <button className={theme === 'dark' ? 'is-on' : ''} type="button" aria-label="Dark theme" onClick={() => setTheme('dark')}><Moon size={16} /></button>
            </div>
            <div className="rail" aria-label="Sections">
              {rail.map((item) => {
                const Icon = item.icon
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    className={active ? 'rail-btn is-on' : 'rail-btn'}
                    type="button"
                    onClick={() => go(item.id)}
                    aria-label={item.label}
                    title={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="rail-btn-circle" aria-hidden="true" />
                    <Icon size={20} strokeWidth={1.85} />
                    {item.id === 'messages' && mail ? <i className="ping" /> : null}
                    <span className="rail-tip">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="logout-pill grow">
              {inStore ? (
                <button className="rail-btn" type="button" aria-label="All stores" title="All stores" onClick={exitStore}>
                  <span className="rail-btn-circle" aria-hidden="true" />
                  <MapPin size={20} strokeWidth={1.85} />
                  <span className="rail-tip">All stores</span>
                </button>
              ) : null}
              <button className="rail-btn" type="button" aria-label="Sign out" title="Sign out" onClick={signOut}>
                <span className="rail-btn-circle" aria-hidden="true" />
                <LogOut size={20} strokeWidth={1.85} />
                <span className="rail-tip">Sign out</span>
              </button>
            </div>
          </aside>

          <main className="content">
            {error ? (
              <div className="error-banner">
                {error}
                <button className="btn-soft" type="button" onClick={() => void reload()} style={{ marginLeft: 8 }}>Retry</button>
              </div>
            ) : null}
            {loading || !snapshot ? (
              <div className="grid-3">
                <div className="skel" />
                <div className="skel" />
                <div className="skel" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeStoreId ?? 'all'}-${page}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Page />
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        <AnimatePresence>
          {panel === 'notices' && snapshot ? (
            <motion.div className="popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
              <div className="pop-head">
                <strong>Notifications</strong>
                <button className="btn-ghost" type="button" onClick={() => void markNoticesRead()}>Mark read</button>
              </div>
              {snapshot.notices.map((notice) => (
                <button key={notice.id} className={notice.read ? 'notice' : 'notice unread'} type="button" onClick={() => go(notice.page)}>
                  <b>{notice.title}</b>
                  <span>{notice.body}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
          {panel === 'activity' && snapshot ? (
            <motion.div className="popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="pop-head"><strong>Recent orders</strong></div>
              {snapshot.orders
                .filter((order) => !activeStoreId || order.pharmacyId === activeStoreId)
                .slice(0, 5)
                .map((order) => (
                <button key={order.id} className="notice" type="button" onClick={() => go('orders')}>
                  <b>{order.id} · ${order.total.toFixed(2)}</b>
                  <span>{order.customerName} · {order.itemSummary}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
          {panel === 'user' ? (
            <motion.div className="popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ width: 240 }}>
              <button className="notice" type="button" onClick={() => go('settings')}><b>Settings</b><span>Store preferences</span></button>
              <button className="notice" type="button" onClick={signOut}><b>Sign out</b><span>End this demo session</span></button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {panel === 'search' ? (
          <motion.div className="modal-backdrop" onMouseDown={() => setPanel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="palette" onMouseDown={(event) => event.stopPropagation()} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="search">
                <Search size={16} />
                <input autoFocus placeholder="Search orders, medicines, patients…" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="mt">
                {query.trim() && results.length === 0 ? <div className="empty">Nothing matches “{query}”.</div> : null}
                {results.map((result, index) => {
                  const showGroup = index === 0 || results[index - 1].group !== result.group
                  return (
                    <div key={`${result.group}-${result.id}`}>
                      {showGroup ? <div className="group-label">{result.group}</div> : null}
                      <button className="result" type="button" onClick={() => { setQuery(''); go(result.page, result.search) }}>
                        <span><b>{result.title}</b><span>{result.meta}</span></span>
                      </button>
                    </div>
                  )
                })}
                {!query.trim() ? <div className="empty">Try a patient, SKU, or order id.</div> : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {(panel === 'notices' || panel === 'activity' || panel === 'user') ? (
        <button className="pop-backdrop" aria-label="Close menu" type="button" onClick={() => setPanel(null)} />
      ) : null}

      <div className="toast-wrap" aria-live="polite">
        <AnimatePresence>
          {toasts.map((item) => (
            <motion.div key={item.id} className="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {item.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}