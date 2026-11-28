import { useCallback, useEffect, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { apiFetch } from '../services/http'

interface Analytics {
  from: string
  to: string
  summary: { orders: number; cancelled: number; revenue: number }
  topProducts: { sku: string; name: string; quantity: number; revenue: number; orders: number }[]
  hours: { hour: number; orders: number; revenue: number }[]
  riders: {
    id: string
    name: string
    storeId: string
    storeName: string
    active: boolean
    assigned: number
    delivered: number
    cancelled: number
    avgMinutes: number | null
    revenue: number
  }[]
  unassigned: { number: string; storeId: string; storeName: string; status: string; total: number }[]
}

const day = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
const daysAgo = (n: number) => day(new Date(Date.now() - n * 86400000))
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`

const box: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, marginTop: 16, background: 'transparent' }
const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontSize: 12, opacity: 0.7 }
const td: React.CSSProperties = { padding: '6px 8px', borderTop: '1px solid #eee', fontSize: 14 }

export function AdvancedAnalytics() {
  const { snapshot, activeStoreId } = useDashboard()
  const stores = snapshot?.pharmacies ?? []
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(day(new Date()))
  const [storeId, setStoreId] = useState(activeStoreId ?? '')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from, to, tz: String(new Date().getTimezoneOffset()) })
      if (storeId) qs.set('storeId', storeId)
      setData((await apiFetch(`/admin/analytics?${qs}`)) as Analytics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [from, to, storeId])

  useEffect(() => {
    void load()
  }, [load])

  async function assign(orderNumber: string, riderId: string) {
    if (!riderId) return
    setAssigning(orderNumber)
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(orderNumber)}/rider`, { method: 'POST', body: JSON.stringify({ riderId }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign rider')
    } finally {
      setAssigning('')
    }
  }

  const preset = (days: number) => {
    setFrom(daysAgo(days - 1))
    setTo(day(new Date()))
  }
  const maxHour = Math.max(1, ...(data?.hours.map((h) => h.orders) ?? [1]))
  const peak = data && data.hours.some((h) => h.orders > 0) ? data.hours.reduce((a, b) => (b.orders > a.orders ? b : a)) : null

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: 0 }}>Advanced analytics</h2>
      <p style={{ opacity: 0.7, marginTop: 4 }}>Top products, peak hours and rider performance (cancelled orders are not counted).</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => preset(1)}>Today</button>
        <button onClick={() => preset(7)}>7 days</button>
        <button onClick={() => preset(30)}>30 days</button>
        <label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">All stores</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
        <button onClick={() => void load()}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {error && <p style={{ color: '#b42318' }}>{error}</p>}

      {data && (
        <>
          <div style={{ ...box, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div><div style={{ opacity: 0.6, fontSize: 12 }}>Orders</div><strong style={{ fontSize: 22 }}>{data.summary.orders}</strong></div>
            <div><div style={{ opacity: 0.6, fontSize: 12 }}>Revenue</div><strong style={{ fontSize: 22 }}>${data.summary.revenue.toFixed(2)}</strong></div>
            <div><div style={{ opacity: 0.6, fontSize: 12 }}>Cancelled</div><strong style={{ fontSize: 22 }}>{data.summary.cancelled}</strong></div>
            <div><div style={{ opacity: 0.6, fontSize: 12 }}>Peak hour</div><strong style={{ fontSize: 22 }}>{peak ? `${hourLabel(peak.hour)} (${peak.orders})` : '—'}</strong></div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Top products</h3>
            {data.topProducts.length === 0 ? <p>No orders in this period.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>#</th><th style={th}>Product</th><th style={th}>SKU</th><th style={th}>Units sold</th><th style={th}>Revenue</th></tr></thead>
                <tbody>
                  {data.topProducts.map((row, i) => (
                    <tr key={row.sku + row.name}>
                      <td style={td}>{i + 1}</td><td style={td}>{row.name}</td><td style={td}>{row.sku}</td>
                      <td style={td}>{row.quantity}</td><td style={td}>${row.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Peak business hours</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
              {data.hours.map((h) => (
                <div key={h.hour} title={`${hourLabel(h.hour)}: ${h.orders} orders, $${h.revenue.toFixed(2)}`} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
                  <div style={{ height: Math.max(2, (h.orders / maxHour) * 110), background: peak && h.hour === peak.hour ? '#1f3864' : '#9db4d9', borderRadius: 3 }} />
                  <div style={{ opacity: 0.7 }}>{h.hour}</div>
                </div>
              ))}
            </div>
            <p style={{ opacity: 0.6, fontSize: 12, marginBottom: 0 }}>Hour of day (0–23) on your computer's time. Dark bar = busiest hour.</p>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Rider performance</h3>
            {data.riders.length === 0 ? <p>No riders added yet.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Rider</th><th style={th}>Store</th><th style={th}>Assigned</th><th style={th}>Delivered</th><th style={th}>Cancelled</th><th style={th}>Avg delivery</th><th style={th}>Revenue</th></tr></thead>
                <tbody>
                  {data.riders.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.name}{!r.active && ' (inactive)'}</td><td style={td}>{r.storeName}</td>
                      <td style={td}>{r.assigned}</td><td style={td}>{r.delivered}</td><td style={td}>{r.cancelled}</td>
                      <td style={td}>{r.avgMinutes == null ? '—' : `${r.avgMinutes} min`}</td><td style={td}>${r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Delivery orders without a rider</h3>
            {data.unassigned.length === 0 ? <p>All open delivery orders have a rider.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Order</th><th style={th}>Store</th><th style={th}>Status</th><th style={th}>Assign rider</th></tr></thead>
                <tbody>
                  {data.unassigned.map((o) => (
                    <tr key={o.number}>
                      <td style={td}>{o.number}</td><td style={td}>{o.storeName}</td><td style={td}>{o.status.replaceAll('_', ' ')}</td>
                      <td style={td}>
                        <select disabled={assigning === o.number} defaultValue="" onChange={(e) => void assign(o.number, e.target.value)}>
                          <option value="">Choose rider…</option>
                          {data.riders.filter((r) => r.storeId === o.storeId && r.active).map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  )
}
