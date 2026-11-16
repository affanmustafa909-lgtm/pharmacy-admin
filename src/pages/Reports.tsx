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
  const [reportError, setReportError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
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
    if (from) params.set('from', from)
    if (to) params.set('to', `${to}T23:59:59.999Z`)
    if (store !== 'all') params.set('storeId', store)
    if (recordType !== 'all') params.set('type', recordType)
    if (status !== 'all') params.set('status', status)
    if (paymentMethod.trim()) params.set('paymentMethod', paymentMethod.trim())
    if (productId) params.set('productId', productId)
    if (query.trim()) params.set('q', query.trim())
    params.set('pageSize', '50')
    return params
  }, [from, to, store, recordType, status, paymentMethod, productId, query])

  useEffect(() => {
    let cancel = false
    setReportLoading(true)
    apiFetch(`/admin/reports?${filters.toString()}`)
      .then((payload) => {
        if (cancel) return
        setItems((payload as { items: ReportItem[] }).items)
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
    const blob = (await apiFetch(`/admin/reports/export?${filters.toString()}`)) as Blob
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hera-report.xlsx'
    link.click()
    URL.revokeObjectURL(url)
    notify('Report exported')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="sub">Chain performance, stock value, and settlement history.</p>
        </div>
        <button className="btn-dark" type="button" onClick={() => void exportWorkbook()}><Download size={16} /> Export Excel</button>
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
          <h2>Combined records</h2>
          <span className="count-pill">{reportLoading ? 'Loading' : `${items.length} shown`}</span>
        </div>
        <div className="btn-row mt">
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
              <thead><tr><th>When</th><th>Store</th><th>Type</th><th>Status</th><th>Name</th><th>Amount</th><th>Reference</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.recordType}-${item.id}`}>
                    <td>{formatWhen(item.occurredAt)}</td>
                    <td>{item.storeName}</td>
                    <td>{item.recordType}</td>
                    <td>{item.status}</td>
                    <td>{item.name}</td>
                    <td>{money(item.amount)}</td>
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
