import { useEffect, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { apiFetch } from '../services/http'

interface TopProduct {
  rank: number
  sku: string
  name: string
  units: number
  revenue: number
}

interface HourRow {
  hour: number
  label: string
  orders: number
  revenue: number
}

interface RiderRow {
  id: string
  name: string
  vehicle: string
  active: boolean
  assigned: number
  delivered: number
  cancelled: number
  inProgress: number
  avgDeliveryMinutes: number | null
  revenue: number
}

interface UnassignedRow {
  number: string
  status: string
  customer: string
  createdAt: string
}

function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return isoDay(date)
}

export function AnalyticsPage() {
  const { snapshot, activeStoreId, activeStore } = useDashboard()
  const pharmacies = snapshot?.pharmacies ?? []

  const [storeId, setStoreId] = useState<string>(activeStoreId || pharmacies[0]?.id || '')
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(daysAgo(0))
  const [products, setProducts] = useState<TopProduct[]>([])
  const [hours, setHours] = useState<HourRow[]>([])
  const [riderRows, setRiderRows] = useState<RiderRow[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeStoreId) setStoreId(activeStoreId)
    else if (!storeId && pharmacies[0]?.id) setStoreId(pharmacies[0].id)
  }, [activeStoreId, pharmacies, storeId])

  useEffect(() => {
    if (!storeId) return
    if (from > to) {
      setError('The start date must be on or before the end date')
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const qs = `storeId=${encodeURIComponent(storeId)}&from=${from}&to=${to}`
        const [top, peak, riderData] = await Promise.all([
          apiFetch(`/admin/analytics/top-products?${qs}&limit=10`) as Promise<{ products: TopProduct[] }>,
          apiFetch(`/admin/analytics/peak-hours?${qs}`) as Promise<{ hours: HourRow[] }>,
          apiFetch(`/admin/analytics/riders?${qs}`) as Promise<{ riders: RiderRow[]; unassigned: UnassignedRow[] }>,
        ])
        if (cancelled) return
        setProducts(top.products)
        setHours(peak.hours)
        setRiderRows(riderData.riders)
        setUnassigned(riderData.unassigned)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [storeId, from, to])

  const maxOrders = Math.max(1, ...hours.map((h) => h.orders))
  const busiest = [...hours].filter((h) => h.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 3)
  const storeName = activeStore?.name ?? pharmacies.find((p) => p.id === storeId)?.name ?? '—'

  function setRange(days: number) {
    setFrom(daysAgo(days - 1))
    setTo(daysAgo(0))
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Top products, busiest hours and rider performance for the selected store and dates.</p>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {activeStoreId ? (
          <span className="count-pill">{activeStore?.name}</span>
        ) : (
          <select className="select" value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Store">
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
            ))}
          </select>
        )}
        <label className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          From
          <input className="select" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          To
          <input className="select" type="date" value={to} min={from} max={daysAgo(0)} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="chip" type="button" onClick={() => setRange(7)}>Last 7 days</button>
        <button className="chip" type="button" onClick={() => setRange(30)}>Last 30 days</button>
        <button className="chip" type="button" onClick={() => setRange(90)}>Last 90 days</button>
      </div>

      <p className="sub" style={{ marginBottom: 16 }}>
        Store: {storeName} · {from} to {to} · Cancelled orders are not counted · Times are in business time (UTC+5)
      </p>
      {error ? <p style={{ color: '#d92d20', marginBottom: 12 }}>{error}</p> : null}
      {loading ? <div className="empty">Loading analytics…</div> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="block-head">
          <h2>Top products</h2>
          <span className="count-pill">{products.length} shown</span>
        </div>
        {products.length === 0 ? (
          <div className="empty">No orders in this period.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Units sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={`${row.sku}-${row.name}`}>
                    <td>{row.rank}</td>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.sku}</td>
                    <td>{row.units}</td>
                    <td>{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="block-head">
          <h2>Peak business hours</h2>
          {busiest.length ? (
            <span className="count-pill">
              Busiest: {busiest.map((h) => `${h.label} (${h.orders})`).join(', ')}
            </span>
          ) : null}
        </div>
        {busiest.length === 0 ? (
          <div className="empty">No orders in this period.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 170 }}>
              {hours.map((h) => (
                <div
                  key={h.hour}
                  title={`${h.label}: ${h.orders} orders, ${money(h.revenue)}`}
                  style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 10, marginBottom: 2 }}>{h.orders > 0 ? h.orders : ''}</span>
                  <div
                    style={{
                      width: '100%',
                      height: `${(h.orders / maxOrders) * 100}%`,
                      minHeight: h.orders > 0 ? 4 : 0,
                      background: '#ff4d3a',
                      borderRadius: 3,
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {hours.map((h) => (
                <span key={h.hour} style={{ flex: 1, fontSize: 10, textAlign: 'center' }}>
                  {h.hour % 3 === 0 ? h.label : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="block-head">
          <h2>Rider performance</h2>
        </div>
        {riderRows.length === 0 ? (
          <div className="empty">No riders added for this store yet. Add riders under Stores → Delivery.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rider</th>
                  <th>Assigned</th>
                  <th>Delivered</th>
                  <th>In progress</th>
                  <th>Cancelled</th>
                  <th>Avg delivery</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {riderRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="mini">{row.vehicle}{row.active ? '' : ' · off duty'}</div>
                    </td>
                    <td>{row.assigned}</td>
                    <td>{row.delivered}</td>
                    <td>{row.inProgress}</td>
                    <td>{row.cancelled}</td>
                    <td>{row.avgDeliveryMinutes == null ? '—' : `${row.avgDeliveryMinutes} min`}</td>
                    <td>{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub" style={{ marginTop: 8 }}>
          Counts orders created in the selected dates that have a rider. Avg delivery is the time from "out for delivery" to "delivered".
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="block-head">
          <h2>Delivery orders without a rider</h2>
          <span className="count-pill">{unassigned.length}</span>
        </div>
        {unassigned.length === 0 ? (
          <div className="empty">All open delivery orders have a rider.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((row) => (
                  <tr key={row.number}>
                    <td className="id-cell">{row.number}</td>
                    <td>{row.customer}</td>
                    <td>{row.status.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub" style={{ marginTop: 8 }}>Open an order from the Orders page to assign a rider.</p>
      </section>
    </>
  )
}
