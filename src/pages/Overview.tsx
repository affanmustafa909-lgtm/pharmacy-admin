import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, RefreshCw, ShoppingBag, Wallet } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { Modal } from '../components/Modal'
import { OrderDetail } from '../components/OrderDetail'
import { OrderTable } from '../components/OrderTable'
import { SalesChart } from '../components/SalesChart'
import { useDashboard } from '../context/DashboardContext'
import { deltaText, greeting, money } from '../lib/format'
import type { OrderStatus } from '../types'

function parseExpiry(value: string): Date | null {
  const text = (value ?? '').trim()
  if (!text) return null
  let m = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (m) return m[3] ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[1], +m[2], 0)
  m = text.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[2], +m[1], 0)
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d
}

function Delta({ value, note }: { value: number; note: string }) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <div className={up ? 'delta good' : 'delta bad'}>
      <Icon size={14} />
      {deltaText(value)} <em>{note}</em>
    </div>
  )
}

export function OverviewPage() {
  const { snapshot, recordPayout, restock, activeStoreId, activeStore } = useDashboard()
  const data = snapshot!
  const [store, setStore] = useState(activeStoreId ?? 'all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [amount, setAmount] = useState('2400')
  const [note, setNote] = useState('Friday settlement')
  const scopedMeds = data.medicines.filter((item) => !activeStoreId || item.storeId === activeStoreId)
  const [medicineId, setMedicineId] = useState(scopedMeds[0]?.id ?? '')
  const [quantity, setQuantity] = useState('24')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiryAlerts = scopedMeds
    .map((item) => {
      const date = parseExpiry(item.expiry)
      if (!date) return null
      const days = Math.ceil((date.getTime() - today.getTime()) / 86400000)
      return { id: item.id, name: item.name, batch: item.batch, stock: item.stock, days }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null && row.days <= 90)
    .sort((a, b) => a.days - b.days)

  useEffect(() => {
    setStore(activeStoreId ?? 'all')
  }, [activeStoreId])

  useEffect(() => {
    if (!scopedMeds.some((item) => item.id === medicineId)) {
      setMedicineId(scopedMeds[0]?.id ?? '')
    }
  }, [scopedMeds, medicineId])

  const metrics = data.metrics[store] ?? data.metrics.all
  const chart = data.chart[store] ?? data.chart.all
  const orders = useMemo(() => {
    return data.orders.filter((order) => {
      const storeOk = store === 'all' || order.pharmacyId === store
      const statusOk = status === 'all' || order.status === status
      const text = `${order.id} ${order.customerName} ${order.itemSummary}`.toLowerCase()
      return storeOk && statusOk && text.includes(query.trim().toLowerCase())
    })
  }, [data.orders, query, status, store])
  const progress = Math.min(100, Math.round((metrics.dispensed / metrics.capacity) * 100))
  const openOrder = data.orders.find((order) => order.id === openId) ?? null

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="greeting">{activeStore ? activeStore.name : greeting(data.admin.firstName)}</h1>
          <p className="sub">
            {activeStore
              ? `Store desk — orders, stock, and sales for ${activeStore.name}.`
              : 'Stay on top of orders, stock, and patient reminders.'}
          </p>
        </div>
      </div>
      {data.dashboardCounts ? (
        <section className="grid-4" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <article className="card lift">
            <div className="stat-top">Pending Rx</div>
            <div className="stat-value">{data.dashboardCounts.pendingRx}</div>
          </article>
          <article className="card lift">
            <div className="stat-top">Low stock</div>
            <div className="stat-value">{data.dashboardCounts.lowStock}</div>
          </article>
          <article className="card lift">
            <div className="stat-top">Expiring batches</div>
           <div className="stat-value">{expiryAlerts.length}</div>
          </article>
          <article className="card lift">
            <div className="stat-top">Orders today</div>
            <div className="stat-value">{data.dashboardCounts.ordersToday}</div>
          </article>
        </section>
      ) : null}

      <article className="card" style={{ marginBottom: 16 }}>
        <h2>Expiry alerts</h2>
        <p className="sub">Batches expired or expiring within 90 days.</p>
        {expiryAlerts.length === 0 ? (
          <div className="empty">No batches near expiry.</div>
        ) : (
          <div className="table-wrap table-static">
            <table>
              <thead><tr><th>Medicine</th><th>Batch</th><th>Stock</th><th>Status</th></tr></thead>
              <tbody>
                {expiryAlerts.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.batch || '-'}</td>
                    <td>{row.stock}</td>
                    <td>
                      <span className={row.days < 0 ? 'tag off' : 'tag on'}>
                        {row.days < 0 ? `Expired ${-row.days}d ago` : `${row.days} days left`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <section className="grid-3">
        <article className="card">
          <div className="card-label">
            Net sales
            {activeStoreId ? (
              <span className="count-pill">{activeStore?.name}</span>
            ) : (
              <select className="select" value={store} onChange={(event) => setStore(event.target.value)} aria-label="Store">
                <option value="all">All stores</option>
                {data.pharmacies.map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name.replace('Hera ', '')}</option>
                ))}
              </select>
            )}
          </div>
          <div className="balance-value"><CountUp value={metrics.netSales} prefix="$" decimals={2} /></div>
          <Delta value={metrics.salesDelta} note="vs last month" />
          <div className="btn-row mt">
            <button className="btn-dark" type="button" onClick={() => setPayoutOpen(true)}><Wallet size={15} /> Payout</button>
            <button className="btn-soft" type="button" onClick={() => setRestockOpen(true)}><RefreshCw size={15} /> Restock</button>
          </div>
          <div className="wallets">
            <header>
              <strong>{activeStoreId ? 'This store' : 'Stores'}</strong>
              <span>{activeStoreId ? '1 location' : `${data.locations.length} locations`}</span>
            </header>
            <div className="wallet-row">
              {data.locations
                .filter((location) => !activeStoreId || location.pharmacyId === activeStoreId)
                .map((location) => (
                <button
                  key={location.pharmacyId}
                  className={store === location.pharmacyId ? 'wallet is-on' : 'wallet'}
                  type="button"
                  onClick={() => { if (!activeStoreId) setStore(location.pharmacyId) }}
                >
                  <span className="code" style={{ background: location.code === 'MDT' || location.code === 'ALI' ? '#ff4d3a' : location.code === 'CHS' || location.code === 'CTY' ? '#2563eb' : '#0f766e' }}>{location.code}</span>
                  <b>{money(location.revenue, 0)}</b>
                  <small>{location.delta}</small>
                  <div className={location.active ? 'tag on' : 'tag off'}>{location.active ? 'Active' : 'Inactive'}</div>
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="quad">
            <div className="stat-tile coral lift">
              <div className="stat-top">Today’s sales <span className="mini-ico"><ShoppingBag size={14} /></span></div>
              <div className="stat-value"><CountUp value={metrics.ordersToday} prefix="$" /></div>
              <Delta value={metrics.ordersDelta} note="this month" />
            </div>
            <div className="stat-tile lift">
              <div className="stat-top">Refunds</div>
              <div className="stat-value"><CountUp value={metrics.refunds} prefix="$" /></div>
              <Delta value={metrics.refundsDelta} note="this month" />
            </div>
            <div className="stat-tile lift">
              <div className="stat-top">Prescription sales</div>
              <div className="stat-value"><CountUp value={metrics.rxRevenue} prefix="$" /></div>
              <Delta value={metrics.rxDelta} note="this month" />
            </div>
            <div className="stat-tile lift">
              <div className="stat-top">Retail sales</div>
              <div className="stat-value"><CountUp value={metrics.retailRevenue} prefix="$" /></div>
              <Delta value={metrics.retailDelta} note="this month" />
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-label">
            <div>
              <h2>Performance</h2>
              <p className="sub">Sales and returns for the selected store.</p>
            </div>
          </div>
          <div className="block-head mt">
            <strong>Sales and returns</strong>
            <div className="legend">
              <span><i className="swatch sales" />Sales</span>
              <span><i className="swatch returns" />Returns</span>
            </div>
          </div>
          <div className="chart-wrap">
            <SalesChart data={chart} />
          </div>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="card">
          <h2>Monthly dispensing</h2>
          <p className="sub">Filled prescriptions against this month’s capacity.</p>
          <div className="limit-top">
            <span>{metrics.dispensed.toLocaleString()} dispensed</span>
            <span>{metrics.capacity.toLocaleString()}</span>
          </div>
          <div className="track" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} role="meter">
            <span style={{ width: `${progress}%` }} />
          </div>
        </article>
        <article className="card">
          <div className="table-head">
            <h2>Recent orders</h2>
            <div className="table-tools">
              <label className="search">
                <span className="sr-only">Search orders</span>
                <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | 'all')} aria-label="Filter status">
                <option value="all">Filter</option>
                <option value="placed">Placed</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready pickup</option>
                <option value="collected">Collected</option>
                <option value="out_for_delivery">On the way</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <OrderTable orders={orders.slice(0, 5)} onOpen={setOpenId} />
        </article>
      </section>

      <OrderDetail order={openOrder} onClose={() => setOpenId(null)} />
      <Modal open={payoutOpen} title="Record a payout" subtitle="Demo only — this stays in the dashboard until an API is connected." onClose={() => setPayoutOpen(false)}>
        <label className="field">Amount
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="field">Note
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setPayoutOpen(false)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              const value = Number(amount)
              void recordPayout(value, note).then((ok) => {
                if (ok) setPayoutOpen(false)
              })
            }}
          >
            Save payout
          </button>
        </div>
      </Modal>
      <Modal open={restockOpen} title="Restock a medicine" subtitle="Units are added to the catalog immediately." onClose={() => setRestockOpen(false)}>
        <label className="field">Medicine
          <select value={medicineId} onChange={(event) => setMedicineId(event.target.value)}>
            {scopedMeds.map((medicine) => (
              <option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.stock} in stock</option>
            ))}
          </select>
        </label>
        <label className="field">Quantity
          <input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setRestockOpen(false)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              void restock(medicineId, Number(quantity)).then((ok) => {
                if (ok) setRestockOpen(false)
              })
            }}
          >
            Add stock
          </button>
        </div>
      </Modal>
    </>
  )
}