import { useEffect, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { formatWhen } from '../lib/format'
import { apiFetch } from '../services/http'

interface AuditItem {
  id: string
  action: string
  detail: string
  actor: string
  storeCode: string
  storeName: string
  createdAt: string
}

export function AuditPage() {
  const { snapshot } = useDashboard()
  const data = snapshot!
  const [store, setStore] = useState('all')
  const [items, setItems] = useState<AuditItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isOwner = data.admin.roleKey === 'ADMIN'

  useEffect(() => {
    if (!isOwner) return
    let cancel = false
    setLoading(true)
    const params = new URLSearchParams()
    if (store !== 'all') params.set('storeId', store)
    apiFetch(`/admin/audit-log?${params.toString()}`)
      .then((payload) => {
        if (cancel) return
        setItems((payload as { items: AuditItem[] }).items)
        setError('')
      })
      .catch((err: unknown) => {
        if (cancel) return
        setError(err instanceof Error ? err.message : 'Could not load the audit log')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [store, isOwner])

  if (!isOwner) {
    return (
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="sub">Only the pharmacy owner can view the audit log.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="sub">Who did what, where, and when. Latest 200 entries.</p>
        </div>
      </div>
      <article className="card">
        <div className="block-head">
          <h2>Activity</h2>
          <span className="count-pill">{loading ? 'Loading' : `${items.length} shown`}</span>
        </div>
        <div className="btn-row mt">
          <label className="field">Store
            <select value={store} onChange={(event) => setStore(event.target.value)}>
              <option value="all">All stores</option>
              {data.pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="sub mt">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <div className="empty">No audit entries yet.</div>
        ) : (
          <div className="table-wrap table-static mt">
            <table>
              <thead>
                <tr><th>When</th><th>Who</th><th>Action</th><th>Store</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatWhen(item.createdAt)}</td>
                    <td>{item.actor}</td>
                    <td>{item.action}</td>
                    <td>{item.storeName ? `${item.storeName}${item.storeCode ? ` (${item.storeCode})` : ''}` : '-'}</td>
                    <td>{item.detail}</td>
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