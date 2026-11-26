import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { apiFetch } from '../services/http'

type PaymentRow = {
  id: string
  transactionId: string
  amount: number
  method: string
  paymentLabel: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  cardLast4: string
  cardBrand: string
  cardholderName: string
  failureMessage?: string
  orderNumber?: string
  orderNumbers: string[]
  storeNames: string[]
  paidAt: string | null
  createdAt: string
  customer?: { id: string; name: string; email: string }
}

type Payload = {
  testMode: true
  summary: {
    totalAttempts: number
    succeeded: number
    failed: number
    succeededAmount: number
    failedAmount: number
  }
  transactions: PaymentRow[]
}

export function PaymentsPage() {
  const { activeStoreId, notify } = useDashboard()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [summary, setSummary] = useState<Payload['summary'] | null>(null)
  const [status, setStatus] = useState<'all' | 'succeeded' | 'failed'>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (query.trim()) params.set('q', query.trim())
      if (activeStoreId) params.set('storeId', activeStoreId)
      const data = (await apiFetch(`/admin/payments?${params.toString()}`)) as Payload
      setRows(data.transactions)
      setSummary(data.summary)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load payments')
    } finally {
      setLoading(false)
    }
  }, [activeStoreId, notify, query, status])

  useEffect(() => {
    void load()
  }, [load])

  const filteredNote = useMemo(() => {
    if (!summary) return ''
    return `${summary.succeeded} paid · ${summary.failed} failed`
  }, [summary])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p className="sub">
            Simulated card transactions (TEST MODE). Full PANs and CVVs are never stored — only brand and last 4 digits.
          </p>
        </div>
        <button className="btn-soft" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <section className="order-summary-strip">
        <article className="card">
          <div className="stat-top">Attempts</div>
          <div className="order-strip-value">{summary?.totalAttempts ?? 0}</div>
        </article>
        <article className="card">
          <div className="stat-top">Successful</div>
          <div className="order-strip-value">{money(summary?.succeededAmount ?? 0)}</div>
          <p className="sub">{summary?.succeeded ?? 0} payments</p>
        </article>
        <article className="card">
          <div className="stat-top">Failed</div>
          <div className="order-strip-value">{money(summary?.failedAmount ?? 0)}</div>
          <p className="sub">{summary?.failed ?? 0} attempts</p>
        </article>
        <article className="card">
          <div className="stat-top">Filter</div>
          <div className="order-strip-value" style={{ fontSize: 16 }}>{filteredNote || '—'}</div>
        </article>
      </section>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="succeeded">Successful</option>
          <option value="failed">Failed</option>
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search txn, order, customer…"
          style={{ minWidth: 240 }}
        />
      </div>

      <div className="card table-card">
        {rows.length === 0 ? (
          <div className="empty">{loading ? 'Loading payments…' : 'No payment transactions yet.'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Transaction</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Card</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>
                    <code>{row.transactionId}</code>
                  </td>
                  <td>
                    <div>{row.customer?.name || row.cardholderName || '—'}</div>
                    <div className="sub">{row.customer?.email || ''}</div>
                  </td>
                  <td>{row.paymentLabel || row.method}</td>
                  <td>
                    {row.cardBrand ? `${row.cardBrand} •••• ${row.cardLast4}` : '—'}
                  </td>
                  <td>
                    <span className={`pill ${row.status === 'succeeded' ? 'ok' : row.status === 'failed' ? 'warn' : ''}`}>
                      {row.status}
                    </span>
                    {row.failureMessage ? <div className="sub">{row.failureMessage}</div> : null}
                  </td>
                  <td>{money(row.amount)}</td>
                  <td>
                    {row.orderNumbers.length
                      ? row.orderNumbers.join(', ')
                      : row.orderNumber || (row.status === 'failed' ? 'Not placed' : '—')}
                    {row.storeNames.length ? <div className="sub">{row.storeNames.join(' · ')}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
