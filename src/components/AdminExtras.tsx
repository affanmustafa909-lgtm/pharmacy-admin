import { useCallback, useEffect, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { apiFetch } from '../services/http'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const box: React.CSSProperties = { border: '1px solid rgba(128,128,128,0.3)', borderRadius: 12, padding: 16, marginTop: 16 }
const cell: React.CSSProperties = { padding: '6px 8px', borderTop: '1px solid rgba(128,128,128,0.2)', fontSize: 14, textAlign: 'left' }
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const when = (v: string | null) => (v ? new Date(v).toLocaleString() : '—')

/* ---------- ADM-05: Promo campaigns ---------- */
export function PromoCampaigns() {
  const { snapshot } = useDashboard()
  const stores = snapshot?.pharmacies ?? []
  const blank = { code: '', label: '', discount: '', startsAt: '', endsAt: '', maxUses: '', perCustomerLimit: '', storeIds: [] as string[] }
  const [promos, setPromos] = useState<Row[]>([])
  const [f, setF] = useState(blank)
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState<Record<string, string>>({})
  const [checkStore, setCheckStore] = useState('')

  const load = useCallback(async () => {
    try {
      setPromos(((await apiFetch('/admin/mobile-config')) as Row).promos ?? [])
    } catch (e) {
      setMsg(err(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    setMsg('')
    if (!f.code.trim() || !f.label.trim() || !(Number(f.discount) > 0)) return setMsg('Enter code, label and a discount above 0')
    try {
      await apiFetch('/admin/promos', {
        method: 'POST',
        body: JSON.stringify({
          code: f.code,
          label: f.label,
          discount: Number(f.discount),
          startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
          endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
          maxUses: f.maxUses ? Number(f.maxUses) : null,
          perCustomerLimit: f.perCustomerLimit ? Number(f.perCustomerLimit) : null,
          storeIds: f.storeIds,
        }),
      })
      setF(blank)
      setMsg('Promo saved')
      await load()
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function patch(id: string, body: object) {
    try {
      await apiFetch(`/admin/promos/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      await load()
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function remove(id: string) {
    if (!confirm('Delete this promo?')) return
    try {
      await apiFetch(`/admin/promos/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function usage(id: string) {
    try {
      const r = (await apiFetch(`/admin/promos/${id}/redemptions`)) as Row
      const list = (r.items as Row[]).slice(0, 5).map((i) => `${i.orderNumber}${i.counted ? '' : ' (cancelled)'}`).join(', ')
      setInfo((p) => ({ ...p, [id]: `Used ${r.used} times, total discount $${r.totalDiscount}. ${list}` }))
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function check(id: string) {
    if (!checkStore) return setMsg('Choose a store in "Test in store" first')
    try {
      const r = (await apiFetch(`/admin/promos/${id}/check?storeId=${checkStore}`)) as Row
      setInfo((p) => ({ ...p, [id]: r.eligible ? `Works in this store. Discount $${r.discount}` : `Does NOT work: ${r.reason}` }))
    } catch (e) {
      setMsg(err(e))
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: 0 }}>Promo campaigns</h2>
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>New promo</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Code (SAVE10)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <input placeholder="Label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <input placeholder="Discount $" type="number" min="0" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
          <label>Start <input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></label>
          <label>End <input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></label>
          <input placeholder="Total uses limit" type="number" min="1" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} />
          <input placeholder="Per customer limit" type="number" min="1" value={f.perCustomerLimit} onChange={(e) => setF({ ...f, perCustomerLimit: e.target.value })} />
        </div>
        <p style={{ marginBottom: 4 }}>Stores (leave all unticked = every store):</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {stores.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={f.storeIds.includes(s.id)}
                onChange={(e) => setF({ ...f, storeIds: e.target.checked ? [...f.storeIds, s.id] : f.storeIds.filter((x) => x !== s.id) })}
              />{' '}
              {s.name}
            </label>
          ))}
        </div>
        <button style={{ marginTop: 10 }} onClick={() => void create()}>Save promo</button>
        {msg && <p>{msg}</p>}
      </div>
      <div style={box}>
        <label>
          Test in store:{' '}
          <select value={checkStore} onChange={(e) => setCheckStore(e.target.value)}>
            <option value="">Choose store</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>{['Code', 'Discount', 'Status', 'Schedule', 'Used / limit', 'Stores', ''].map((h) => <th key={h} style={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td style={cell}><b>{p.code}</b><br />{p.label}</td>
                <td style={cell}>${p.discount}</td>
                <td style={cell}>{String(p.status).replace('_', ' ')}</td>
                <td style={cell}>{when(p.startsAt)}<br />to {when(p.endsAt)}</td>
                <td style={cell}>{p.used} / {p.maxUses ?? '∞'}<br />per customer: {p.perCustomerLimit ?? '∞'}</td>
                <td style={cell}>
                  {(p.storeIds as string[]).length
                    ? (p.storeIds as string[]).map((id) => stores.find((s) => s.id === id)?.name ?? id).join(', ')
                    : 'All stores'}
                </td>
                <td style={cell}>
                  <button onClick={() => void patch(p.id, { active: !p.active })}>{p.active ? 'Pause' : 'Resume'}</button>{' '}
                  <button onClick={() => void usage(p.id)}>Usage</button>{' '}
                  <button onClick={() => void check(p.id)}>Test</button>{' '}
                  <button onClick={() => void remove(p.id)}>Delete</button>
                  {info[p.id] && <div style={{ fontSize: 12, marginTop: 4 }}>{info[p.id]}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------- ADM-01: Complaints ---------- */
const STATUSES = ['open', 'in_review', 'responded', 'resolved', 'closed']

export function ComplaintsPanel() {
  const [items, setItems] = useState<Row[]>([])
  const [counts, setCounts] = useState<Row>({})
  const [staff, setStaff] = useState<Row[]>([])
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<Row | null>(null)
  const [msg, setMsg] = useState('')
  const [reply, setReply] = useState('')
  const [resolution, setResolution] = useState('')
  const [n, setN] = useState({ customerName: '', orderNumber: '', category: 'Delivery', subject: '', description: '', priority: 'normal' })

  const load = useCallback(async () => {
    try {
      const r = (await apiFetch(`/admin/complaints${filter ? `?status=${filter}` : ''}`)) as Row
      setItems(r.items)
      setCounts(r.counts)
    } catch (e) {
      setMsg(err(e))
    }
  }, [filter])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    apiFetch('/admin/complaints/staff')
      .then((r) => setStaff((r as Row).staff))
      .catch(() => undefined)
  }, [])

  async function openOne(id: string) {
    try {
      const c = (await apiFetch(`/admin/complaints/${id}`)) as Row
      setOpen(c)
      setResolution(c.resolution ?? '')
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function run(fn: () => Promise<unknown>, id: string) {
    setMsg('')
    try {
      await fn()
      await load()
      await openOne(id)
    } catch (e) {
      setMsg(err(e))
    }
  }
  const patch = (id: string, body: object) => run(() => apiFetch(`/admin/complaints/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), id)
  const note = (id: string, kind: string) =>
    run(async () => {
      await apiFetch(`/admin/complaints/${id}/notes`, { method: 'POST', body: JSON.stringify({ text: reply, kind }) })
      setReply('')
    }, id)

  async function create() {
    setMsg('')
    try {
      await apiFetch('/admin/complaints', { method: 'POST', body: JSON.stringify(n) })
      setN({ ...n, customerName: '', orderNumber: '', subject: '', description: '' })
      await load()
    } catch (e) {
      setMsg(err(e))
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: 0 }}>Complaints</h2>
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Log a complaint</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Order number (RX-10481)" value={n.orderNumber} onChange={(e) => setN({ ...n, orderNumber: e.target.value })} />
          <input placeholder="Customer name" value={n.customerName} onChange={(e) => setN({ ...n, customerName: e.target.value })} />
          <select value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>
            {['Delivery', 'Wrong medicine', 'Quality', 'Refund', 'Staff', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={n.priority} onChange={(e) => setN({ ...n, priority: e.target.value })}>
            {['low', 'normal', 'high'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Subject" value={n.subject} onChange={(e) => setN({ ...n, subject: e.target.value })} />
          <input placeholder="Details" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} />
          <button onClick={() => void create()}>Add</button>
        </div>
        {msg && <p>{msg}</p>}
      </div>
      <div style={box}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('')}>All</button>
          {STATUSES.map((s) => <button key={s} onClick={() => setFilter(s)}>{s.replace('_', ' ')} ({counts[s] ?? 0})</button>)}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>{['No.', 'Customer', 'Order', 'Subject', 'Priority', 'Status', 'Assigned'].map((h) => <th key={h} style={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} onClick={() => void openOne(c.id)} style={{ cursor: 'pointer' }}>
                <td style={cell}>{c.number}</td>
                <td style={cell}>{c.customerName}</td>
                <td style={cell}>{c.orderNumber || '—'}</td>
                <td style={cell}>{c.subject}</td>
                <td style={cell}>{c.priority}</td>
                <td style={cell}>{String(c.status).replace('_', ' ')}</td>
                <td style={cell}>{c.assignedToName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p>No complaints.</p>}
      </div>
      {open && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>
            {open.number}: {open.subject} <button onClick={() => setOpen(null)}>Close view</button>
          </h3>
          <p>
            {open.description || 'No details'} · {open.customerName} · {open.category} · Status: <b>{String(open.status).replace('_', ' ')}</b>
          </p>
          {open.status !== 'closed' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={open.assignedToId ?? ''} onChange={(e) => void patch(open.id, { assignedToId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={open.priority} onChange={(e) => void patch(open.id, { priority: e.target.value })}>
                  {['low', 'normal', 'high'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <button onClick={() => void patch(open.id, { status: 'in_review' })}>Start review</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <textarea rows={2} style={{ width: '100%' }} placeholder="Write a reply or an internal note" value={reply} onChange={(e) => setReply(e.target.value)} />
                <button onClick={() => void note(open.id, 'response')}>Send reply to customer</button>{' '}
                <button onClick={() => void note(open.id, 'internal')}>Save internal note</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <textarea rows={2} style={{ width: '100%' }} placeholder="Resolution (needed to resolve)" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                <button onClick={() => void patch(open.id, { status: 'resolved', resolution })}>Mark resolved</button>{' '}
                {open.status === 'resolved' && <button onClick={() => void patch(open.id, { status: 'closed' })}>Close complaint</button>}
              </div>
            </>
          )}
          <h4>History</h4>
          {(open.notes as Row[]).map((x) => (
            <div key={x.id} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid rgba(128,128,128,0.2)' }}>
              <b>{x.author}</b> · {x.kind} · {when(x.createdAt)}
              <br />
              {x.text}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- ADM-02: Controlled drugs ---------- */
export function CompliancePanel() {
  const [data, setData] = useState<Row>({ products: [], sales: [] })
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Row[]>([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      setData((await apiFetch('/admin/compliance')) as Row)
    } catch (e) {
      setMsg(err(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function search() {
    try {
      setFound(((await apiFetch(`/admin/products?q=${encodeURIComponent(q)}`)) as Row).items)
    } catch (e) {
      setMsg(err(e))
    }
  }
  async function mark(id: string, controlled: boolean) {
    try {
      await apiFetch(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify({ controlled }) })
      await load()
      await search()
    } catch (e) {
      setMsg(err(e))
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: 0 }}>Controlled medicines and Rx rules</h2>
      <p style={{ opacity: 0.7 }}>
        Controlled medicine: needs an approved prescription with the prescriber name, not older than 30 days, quantity within the approved amount, and one prescription = one order.
      </p>
      <div style={box}>
        <input placeholder="Search medicine name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />{' '}
        <button onClick={() => void search()}>Search</button>
        {msg && <p>{msg}</p>}
        {found.map((p) => (
          <div key={p.id} style={{ ...cell, display: 'flex', justifyContent: 'space-between' }}>
            <span>{p.name} ({p.sku}) · {p.storeName} {p.controlled ? '· CONTROLLED' : ''}</span>
            <button onClick={() => void mark(p.id, !p.controlled)}>{p.controlled ? 'Remove controlled' : 'Mark controlled'}</button>
          </div>
        ))}
      </div>
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Controlled medicines ({(data.products as Row[]).length})</h3>
        {(data.products as Row[]).map((p) => <div key={p.id} style={cell}>{p.name} ({p.sku}) · {p.storeName} · stock {p.stock}</div>)}
      </div>
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Controlled sales log</h3>
        {(data.sales as Row[]).length === 0 ? <p>No controlled sales yet.</p> : (data.sales as Row[]).map((s) => <div key={s.id} style={cell}>{when(s.createdAt)} · {s.storeName} · {s.detail}</div>)}
      </div>
    </section>
  )
}
