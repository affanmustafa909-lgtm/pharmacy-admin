import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { SalesChart } from '../components/SalesChart'
import { useDashboard } from '../context/DashboardContext'
import { formatWhen, money } from '../lib/format'
import { apiFetch } from '../services/http'

const RANGES = [
  { id: 3, label: '3 months' },
  { id: 6, label: '6 months' },
  { id: 9, label: 'This year' },
] as const

interface ReportItem {
  id: string
  occurredAt: string
  storeName: string
  recordType: string
  status: string
  name: string
  amount: number
  reference: string
  paymentLabel?: string
  paymentStatus?: string
}

interface Bucket {
  count: number
  total: number
}

interface ReportSummary {
  orders: number
  completed: Bucket
  cancelled: Bucket
  unpaid: Bucket
  refunded: Bucket
  charges: { delivery: number; service: number; bfp: number }
}

const tileStyle = {
  border: '1px solid rgba(128,128,128,0.25)',
  borderRadius: 12,
  padding: 14,
} as const

/** Dates are read in the person's own time zone, so "23 Nov" means 23 Nov on their clock. */
function startOfDay(date: string) {
  return new Date(`${date}T00:00:00`).toISOString()
}

function endOfDay(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString()
}

export function ReportsPage() {
  const { snapshot, notify } = useDashboard()
  const data = snapshot!
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>(9)
  const [store, setStore] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [recordType, setRecordType] = useState('all')
  const [status, setStatus] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [productId, setProductId] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ReportItem[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const chart = (data.chart[store] ?? data.chart.all).slice(-range)
  const categories = useMemo(() => {
    const totals = new Map<string, number>()
    data.medicines.forEach((medicine) => {
      totals.set(medicine.category, (totals.get(medicine.category) ?? 0) + medicine.price * medicine.stock)
    })
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [data.medicines])
  const max = Math.max(...categories.map(([, value]) => value), 1)

  const filters = useMemo(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', startOfDay(from))
    if (to) params.set('to', endOfDay(to))
    if (store !== 'all') params.set('storeId', store)
    if (recordType !== 'all') params.set('type', recordType)
    if (status !== 'all') params.set('status', status)
    if (paymentMethod.trim()) params.set('paymentMethod', paymentMethod.trim())
    if (productId) params.set('productId', productId)
    if (query.trim()) params.set('q', query.trim())
    return params
  }, [from, to, store, recordType, status, paymentMethod, productId, query])

  const scopeText = useMemo(() => {
    const storeName = store === 'all' ? 'All stores' : (data.pharmacies.find((pharmacy) => pharmacy.id === store)?.name ?? 'Store')
    const dates = from || to ? `${from || 'the beginning'} to ${to || 'today'}` : 'All dates'
    return `${storeName} · ${dates}`
  }, [store, from, to, data.pharmacies])

  useEffect(() => {
    let cancel = false
    setReportLoading(true)
    const params = new URLSearchParams(filters)
    params.set('pageSize', '50')
    apiFetch(`/admin/reports?${params.toString()}`)
      .then((payload) => {
        if (cancel) return
        const result = payload as { items: ReportItem[]; total: number; summary: ReportSummary; truncated: boolean }
        setItems(result.items)
        setTotal(result.total)
        setSummary(result.summary)
        setTruncated(Boolean(result.truncated))
        setReportError('')
      })
      .catch((error: unknown) => {
        if (cancel) return
        setReportError(error instanceof Error ? error.message : 'Could not load the report')
      })
      .finally(() => {
        if (!cancel) setReportLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [filters])

  async function exportWorkbook() {
    if (exporting) return
    setExporting(true)
    try {
      // Same filters as the table above, so the file matches what is on the screen.
      const blob = (await apiFetch(`/admin/reports/export?${filters.toString()}`)) as Blob
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'hera-report.xlsx'
      link.click()
      URL.revokeObjectURL(url)
      notify('Report exported with the filters shown on this page')
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : 'Could not export the report')
    } finally {
      setExporting(false)
    }
  }

  const tiles = summary
    ? [
        { label: 'Completed', note: 'Delivered or collected. This is revenue.', bucket: summary.completed },
        { label: 'Cancelled', note: 'Cancelled orders. Not counted as revenue.', bucket: summary.cancelled },
        { label: 'Unpaid', note: 'Payment pending or failed, cancelled orders left out.', bucket: summary.unpaid },
        { label: 'Refunded', note: 'Payment marked as refunded.', bucket: summary.refunded },
      ]
    : []

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="sub">Chain performance, stock value, and settlement history.</p>
        </div>
        <button className="btn-dark" type="button" disabled={exporting} onClick={() => void exportWorkbook()}>
          <Download size={16} /> {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>
      <section className="report-grid">
        <article className="card">
          <div className="block-head">
            <h2>Sales and returns</h2>
            <div className="inline-actions">
              {RANGES.map((item) => (
                <button key={item.id} className={range === item.id ? 'chip is-on' : 'chip'} type="button" onClick={() => setRange(item.id)}>{item.label}</button>
              ))}
            </div>
          </div>
          <select className="select mb" value={store} onChange={(event) => setStore(event.target.value)} aria-label="Store">
            <option value="all">All stores</option>
            {data.pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
            ))}
          </select>
          <SalesChart data={chart} />
        </article>
        <article className="card">
          <h2>Stock value</h2>
          <p className="sub">Retail price times units currently on hand.</p>
          <div className="mt">
            {categories.map(([name, value]) => (
              <div key={name} className="mt">
                <div className="limit-top"><span>{name}</span><span>{money(value, 0)}</span></div>
                <div className="track"><span style={{ width: `${(value / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="card mt">
        <div className="block-head">
          <h2>Order totals</h2>
          <span className="count-pill">{scopeText}</span>
        </div>
        <p className="sub">
          These totals use the store, dates and filters chosen in Combined records below. The Excel file uses the same filters.
        </p>
        {summary ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 12 }}>
              {tiles.map((tile) => (
                <div key={tile.label} style={tileStyle}>
                  <small>{tile.label}</small>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{money(tile.bucket.total)}</div>
                  <div className="sub">{tile.bucket.count} {tile.bucket.count === 1 ? 'order' : 'orders'}</div>
                  <div className="sub" style={{ marginTop: 6 }}>{tile.note}</div>
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 16 }}>Charges on completed orders</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 8 }}>
              <div style={tileStyle}><small>Delivery</small><div style={{ fontSize: 20, fontWeight: 700 }}>{money(summary.charges.delivery)}</div></div>
              <div style={tileStyle}><small>Service</small><div style={{ fontSize: 20, fontWeight: 700 }}>{money(summary.charges.service)}</div></div>
              <div style={tileStyle}><small>BFP</small><div style={{ fontSize: 20, fontWeight: 700 }}>{money(summary.charges.bfp)}</div></div>
            </div>
            <p className="sub" style={{ marginTop: 12 }}>
              An order can be both Completed and Unpaid, so the four boxes are not meant to add up to one total.
              {summary.orders === 0 ? ' No order records match these filters.' : ` ${summary.orders} order records counted.`}
            </p>
          </>
        ) : (
          <div className="empty">{reportLoading ? 'Loading totals…' : 'No totals yet.'}</div>
        )}
      </article>

      <article className="card mt">
        <div className="block-head">
          <h2>Combined records</h2>
          <span className="count-pill">{reportLoading ? 'Loading' : `${items.length} of ${total} shown`}</span>
        </div>
        {truncated ? (
          <p className="sub mt" style={{ color: '#d92d20' }}>
            There are more records than the report can load. Narrow the dates or choose one store.
          </p>
        ) : null}
        <div className="btn-row mt">
          <label className="field">Store
            <select value={store} onChange={(event) => setStore(event.target.value)}>
              <option value="all">All stores</option>
              {data.pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
              ))}
            </select>
          </label>
          <label className="field">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="field">Type
            <select value={recordType} onChange={(event) => setRecordType(event.target.value)}>
              <option value="all">All records</option>
              <option value="order">Orders</option>
              <option value="charge">Charges</option>
              <option value="prescription">Prescriptions</option>
              <option value="product">Products</option>
              <option value="service">Services</option>
            </select>
          </label>
          <label className="field">Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Any status</option>
              <option value="placed">Placed</option>
              <option value="preparing">Preparing</option>
              <option value="ready_for_pickup">Ready for pickup</option>
              <option value="collected">Collected</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="held">Held</option>
            </select>
          </label>
          <label className="field">Payment
            <input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Apple Pay, Visa…" />
          </label>
          <label className="field">Product or service
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">All products</option>
              {data.medicines.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>{medicine.name}</option>
              ))}
            </select>
          </label>
          <label className="field">Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SKU, order" />
          </label>
        </div>
        {reportError ? <p className="sub mt">{reportError}</p> : null}
        {!reportLoading && items.length === 0 ? <div className="empty">No records match these filters.</div> : (
          <div className="table-wrap table-static mt">
            <table>
              <thead><tr><th>When</th><th>Store</th><th>Type</th><th>Status</th><th>Name</th><th>Amount</th><th>Payment</th><th>Reference</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.recordType}-${item.id}`}>
                    <td>{formatWhen(item.occurredAt)}</td>
                    <td>{item.storeName}</td>
                    <td>{item.recordType}</td>
                    <td>{item.status}</td>
                    <td>{item.name}</td>
                    <td>{money(item.amount)}</td>
                    <td>{item.paymentLabel ? `${item.paymentLabel}${item.paymentStatus ? ` · ${item.paymentStatus}` : ''}` : '—'}</td>
                    <td>{item.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <article className="card mt">
        <h2>Payouts</h2>
        {data.payouts.length === 0 ? <div className="empty">No payouts yet.</div> : (
          <div className="table-wrap table-static">
            <table>
              <thead><tr><th>When</th><th>Note</th><th>Amount</th></tr></thead>
              <tbody>
                {data.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>{formatWhen(payout.at)}</td>
                    <td>{payout.note}</td>
                    <td>{money(payout.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  )
}
