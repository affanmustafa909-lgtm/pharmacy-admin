import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { apiFetch } from '../services/http'
import type { PharmacyLocation } from '../types'

const BASE = '/admin/purchasing'

type Notify = ReturnType<typeof useDashboard>['notify']

interface TabProps {
  storeId: string
  notify: Notify
}

function errText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function newRequestId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/* ============================== SUPPLIERS ============================== */

interface Supplier {
  id: string
  name: string
  contact: string
  address: string
  active: boolean
}

const emptySupplier = () => ({ name: '', contact: '', address: '', active: true })

function SuppliersTab({ storeId, notify }: TabProps) {
  const [rows, setRows] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptySupplier)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!storeId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ storeId })
      if (search.trim()) params.set('q', search.trim())
      const data = (await apiFetch(`${BASE}/suppliers?${params.toString()}`)) as { suppliers: Supplier[] }
      setRows(data.suppliers)
    } catch (error) {
      notify(errText(error, 'Could not load suppliers'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [storeId, search])

  function openNew() {
    setEditingId(null)
    setForm(emptySupplier())
    setOpen(true)
  }

  function openEdit(item: Supplier) {
    setEditingId(item.id)
    setForm({ name: item.name, contact: item.contact, address: item.address, active: item.active })
    setOpen(true)
  }

  async function save() {
    if (saving) return
    if (form.name.trim().length < 2) {
      notify('Supplier name is required')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        address: form.address.trim(),
        active: form.active,
      }
      if (editingId) {
        await apiFetch(`${BASE}/suppliers/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch(`${BASE}/suppliers`, { method: 'POST', body: JSON.stringify({ ...body, storeId }) })
      }
      setOpen(false)
      notify(editingId ? 'Supplier updated' : 'Supplier added')
      await load()
    } catch (error) {
      notify(errText(error, 'Could not save supplier'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <input
          className="select"
          style={{ minWidth: 240 }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search supplier name…"
          aria-label="Search suppliers"
        />
        <span className="count-pill">{rows.length} suppliers</span>
        <button className="btn-dark" type="button" onClick={openNew}>New supplier</button>
      </div>

      <section className="card">
        {loading ? (
          <div className="empty">Loading suppliers…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No suppliers yet. Add one to start recording purchases.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.contact || '—'}</td>
                    <td>{item.address || '—'}</td>
                    <td><span className={item.active ? 'tag on' : 'tag off'}>{item.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="btn-soft" type="button" onClick={() => openEdit(item)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title={editingId ? 'Edit supplier' : 'New supplier'} subtitle="Suppliers are kept per store." onClose={() => setOpen(false)}>
        <label className="field">Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">Contact (phone or email)
          <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
        </label>
        <label className="field">Address
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
          Active
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" disabled={saving} onClick={() => { void save() }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </>
  )
}

/* ============================== PURCHASES ============================== */

interface PurchaseRow {
  id: string
  number: string
  status: string
  supplierId: string
  supplierName: string
  createdAt: string
  receivedAt: string | null
  total: number
  paid: number
  balance: number
}

interface PurchaseDetail {
  invoice: {
    id: string
    number: string
    status: string
    note: string
    supplier: { name: string }
    lines: { id: string; batchNumber: string; expiry: string; quantity: number; unitCost: number | string }[]
    payments: { id: string; amount: number | string; receiptRef: string; note: string; paidAt: string }[]
  }
  total: number
  paid: number
  balance: number
}

interface LineForm {
  sku: string
  batchNumber: string
  expiry: string
  quantity: string
  unitCost: string
}

const emptyLine = (): LineForm => ({ sku: '', batchNumber: '', expiry: '', quantity: '', unitCost: '' })

function PurchasesTab({ storeId, notify }: TabProps) {
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [number, setNumber] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineForm[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<PurchaseDetail | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)

  async function load() {
    if (!storeId) return
    setLoading(true)
    try {
      const data = (await apiFetch(`${BASE}/purchases?storeId=${encodeURIComponent(storeId)}`)) as { purchases: PurchaseRow[] }
      setRows(data.purchases)
      const sup = (await apiFetch(`${BASE}/suppliers?storeId=${encodeURIComponent(storeId)}`)) as { suppliers: Supplier[] }
      setSuppliers(sup.suppliers)
    } catch (error) {
      notify(errText(error, 'Could not load purchases'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [storeId])

  function openNew() {
    setSupplierId(suppliers.find((item) => item.active)?.id ?? '')
    setNumber('')
    setNote('')
    setLines([emptyLine()])
    setOpen(true)
  }

  function setLine(index: number, patch: Partial<LineForm>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function createInvoice() {
    if (saving) return
    if (!supplierId) {
      notify('Choose a supplier (add one in the Suppliers tab first)')
      return
    }
    if (!number.trim()) {
      notify('Enter the invoice number')
      return
    }
    const payloadLines = []
    for (const [i, line] of lines.entries()) {
      const label = `Line ${i + 1}`
      const quantity = Number(line.quantity)
      const unitCost = Number(line.unitCost)
      if (!line.sku.trim()) return notify(`${label}: enter the SKU`)
      if (!line.batchNumber.trim()) return notify(`${label}: enter the batch number`)
      if (!line.expiry) return notify(`${label}: choose the expiry date`)
      if (line.quantity.trim() === '' || !Number.isInteger(quantity) || quantity <= 0) {
        return notify(`${label}: quantity must be a whole number above 0`)
      }
      if (line.unitCost.trim() === '' || !Number.isFinite(unitCost) || unitCost < 0) {
        return notify(`${label}: enter a valid unit cost`)
      }
      payloadLines.push({ sku: line.sku.trim(), batchNumber: line.batchNumber.trim(), expiry: line.expiry, quantity, unitCost })
    }
    setSaving(true)
    try {
      await apiFetch(`${BASE}/purchases`, {
        method: 'POST',
        body: JSON.stringify({ storeId, supplierId, number: number.trim(), note: note.trim(), lines: payloadLines }),
      })
      setOpen(false)
      notify('Draft invoice saved. Stock changes only when you press Receive.')
      await load()
    } catch (error) {
      notify(errText(error, 'Could not save invoice'))
    } finally {
      setSaving(false)
    }
  }

  async function receive(row: PurchaseRow) {
    if (busyId) return
    if (!window.confirm(`Receive invoice ${row.number}? Stock will go up.`)) return
    setBusyId(row.id)
    try {
      const result = (await apiFetch(`${BASE}/purchases/${row.id}/receive`, { method: 'POST', body: JSON.stringify({}) })) as {
        repeated: boolean
      }
      notify(result.repeated ? 'Already received. Stock was not changed again.' : 'Received. Stock updated.')
      await load()
    } catch (error) {
      notify(errText(error, 'Could not receive invoice'))
    } finally {
      setBusyId(null)
    }
  }

  async function cancelInvoice(row: PurchaseRow) {
    if (busyId) return
    if (!window.confirm(`Cancel draft invoice ${row.number}?`)) return
    setBusyId(row.id)
    try {
      await apiFetch(`${BASE}/purchases/${row.id}/cancel`, { method: 'POST', body: JSON.stringify({}) })
      notify('Invoice cancelled')
      await load()
    } catch (error) {
      notify(errText(error, 'Could not cancel invoice'))
    } finally {
      setBusyId(null)
    }
  }

  async function openDetail(id: string) {
    try {
      const data = (await apiFetch(`${BASE}/purchases/${id}`)) as PurchaseDetail
      setDetail(data)
      setPayAmount('')
      setPayRef('')
      setPayNote('')
    } catch (error) {
      notify(errText(error, 'Could not open invoice'))
    }
  }

  async function addPayment() {
    if (!detail || paying) return
    const amount = Number(payAmount)
    if (payAmount.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      notify('Enter an amount above 0')
      return
    }
    if (payRef.trim().length < 3) {
      notify('Enter the receipt reference (at least 3 characters)')
      return
    }
    setPaying(true)
    try {
      const result = (await apiFetch(`${BASE}/purchases/${detail.invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, receiptRef: payRef.trim(), note: payNote.trim() }),
      })) as { repeated: boolean }
      notify(result.repeated ? 'This receipt reference was already saved. Nothing added.' : 'Payment saved')
      await openDetail(detail.invoice.id)
      await load()
    } catch (error) {
      notify(errText(error, 'Could not save payment'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <span className="count-pill">{rows.length} invoices</span>
        <button className="btn-dark" type="button" onClick={openNew}>New purchase invoice</button>
      </div>

      <section className="card">
        {loading ? (
          <div className="empty">Loading purchases…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No purchase invoices yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.number}</strong></td>
                    <td>{row.supplierName}</td>
                    <td>{dateText(row.createdAt)}</td>
                    <td><span className={row.status === 'received' ? 'tag on' : 'tag off'}>{row.status}</span></td>
                    <td>{money(row.total)}</td>
                    <td>{money(row.paid)}</td>
                    <td style={{ fontWeight: 600, color: row.balance > 0 ? '#d92d20' : undefined }}>{money(row.balance)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn-soft" type="button" onClick={() => { void openDetail(row.id) }}>Payments</button>
                        {row.status === 'draft' ? (
                          <>
                            <button className="btn-soft" type="button" disabled={busyId === row.id} onClick={() => { void receive(row) }}>Receive</button>
                            <button className="btn-soft" type="button" disabled={busyId === row.id} onClick={() => { void cancelInvoice(row) }}>Cancel</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="New purchase invoice" subtitle="Saved as a draft. Stock goes up only when you press Receive." onClose={() => setOpen(false)}>
        <label className="field">Supplier
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Choose supplier…</option>
            {suppliers.filter((item) => item.active).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">Invoice number
          <input value={number} onChange={(event) => setNumber(event.target.value)} />
        </label>
        <label className="field">Note (optional)
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        {lines.map((line, index) => (
          <div key={index} className="card" style={{ marginBottom: 10 }}>
            <div className="block-head">
              <h2>Line {index + 1}</h2>
              {lines.length > 1 ? (
                <button className="btn-soft" type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remove</button>
              ) : null}
            </div>
            <label className="field">SKU
              <input value={line.sku} onChange={(event) => setLine(index, { sku: event.target.value })} />
            </label>
            <label className="field">Batch number
              <input value={line.batchNumber} onChange={(event) => setLine(index, { batchNumber: event.target.value })} />
            </label>
            <label className="field">Expiry
              <input type="date" min={todayIso()} value={line.expiry} onChange={(event) => setLine(index, { expiry: event.target.value })} />
            </label>
            <label className="field">Quantity
              <input inputMode="numeric" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
            </label>
            <label className="field">Unit cost
              <input inputMode="decimal" value={line.unitCost} onChange={(event) => setLine(index, { unitCost: event.target.value })} />
            </label>
          </div>
        ))}
        <button className="btn-soft" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>Add another line</button>

        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" disabled={saving} onClick={() => { void createInvoice() }}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </Modal>

      <Modal
        open={detail !== null}
        title={detail ? `Invoice ${detail.invoice.number}` : 'Invoice'}
        subtitle={detail ? `${detail.invoice.supplier.name} · ${detail.invoice.status}` : ''}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <>
            <div className="profile-stat"><span>Total</span><b>{money(detail.total)}</b></div>
            <div className="profile-stat"><span>Paid</span><b>{money(detail.paid)}</b></div>
            <div className="profile-stat"><span>Remaining balance</span><b>{money(detail.balance)}</b></div>

            <h3 style={{ marginTop: 16 }}>Lines</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Batch</th><th>Expiry</th><th>Qty</th><th>Unit cost</th></tr>
                </thead>
                <tbody>
                  {detail.invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.batchNumber}</td>
                      <td>{line.expiry}</td>
                      <td>{line.quantity}</td>
                      <td>{money(Number(line.unitCost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginTop: 16 }}>Payments</h3>
            {detail.invoice.payments.length === 0 ? (
              <div className="empty">No payments yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Receipt</th><th>Amount</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {detail.invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{dateText(payment.paidAt)}</td>
                        <td>{payment.receiptRef}</td>
                        <td>{money(Number(payment.amount))}</td>
                        <td>{payment.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail.invoice.status !== 'cancelled' && detail.balance > 0 ? (
              <>
                <h3 style={{ marginTop: 16 }}>Add payment</h3>
                <label className="field">Amount
                  <input inputMode="decimal" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} />
                </label>
                <label className="field">Receipt reference
                  <input value={payRef} onChange={(event) => setPayRef(event.target.value)} />
                </label>
                <label className="field">Note (optional)
                  <input value={payNote} onChange={(event) => setPayNote(event.target.value)} />
                </label>
                <div className="modal-actions">
                  <button className="btn-soft" type="button" onClick={() => setDetail(null)}>Close</button>
                  <button className="btn-dark" type="button" disabled={paying} onClick={() => { void addPayment() }}>
                    {paying ? 'Saving…' : 'Save payment'}
                  </button>
                </div>
              </>
            ) : (
              <div className="modal-actions">
                <button className="btn-soft" type="button" onClick={() => setDetail(null)}>Close</button>
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </>
  )
}

/* ============================== TRANSFERS ============================== */

interface Transfer {
  id: string
  fromStoreId: string
  toStoreId: string
  sku: string
  batchNumber: string
  expiry: string
  quantity: number
  status: string
  dispatchedAt: string
  receivedAt: string | null
}

function TransfersTab({ storeId, notify, pharmacies }: TabProps & { pharmacies: PharmacyLocation[] }) {
  const [rows, setRows] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [toStoreId, setToStoreId] = useState('')
  const [sku, setSku] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [quantity, setQuantity] = useState('')
  const [requestId, setRequestId] = useState(newRequestId)
  const [saving, setSaving] = useState(false)

  const storeName = (id: string) => pharmacies.find((item) => item.id === id)?.name ?? id
  const otherStores = pharmacies.filter((item) => item.id !== storeId)

  async function load() {
    if (!storeId) return
    setLoading(true)
    try {
      const data = (await apiFetch(`${BASE}/transfers?storeId=${encodeURIComponent(storeId)}`)) as { transfers: Transfer[] }
      setRows(data.transfers)
    } catch (error) {
      notify(errText(error, 'Could not load transfers'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [storeId])

  function openNew() {
    setToStoreId(otherStores[0]?.id ?? '')
    setSku('')
    setBatchNumber('')
    setQuantity('')
    setRequestId(newRequestId())
    setOpen(true)
  }

  async function dispatch() {
    if (saving) return
    const qty = Number(quantity)
    if (!toStoreId) return notify('Choose the destination store')
    if (!sku.trim()) return notify('Enter the SKU')
    if (!batchNumber.trim()) return notify('Enter the batch number')
    if (quantity.trim() === '' || !Number.isInteger(qty) || qty <= 0) return notify('Quantity must be a whole number above 0')
    setSaving(true)
    try {
      const result = (await apiFetch(`${BASE}/transfers/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ fromStoreId: storeId, toStoreId, sku: sku.trim(), batchNumber: batchNumber.trim(), quantity: qty, requestId }),
      })) as { repeated: boolean }
      notify(result.repeated ? 'This dispatch was already sent. Stock was not removed again.' : 'Dispatched. Stock removed from this store.')
      setOpen(false)
      await load()
    } catch (error) {
      notify(errText(error, 'Could not dispatch'))
    } finally {
      setSaving(false)
    }
  }

  async function receive(row: Transfer) {
    if (busyId) return
    setBusyId(row.id)
    try {
      const result = (await apiFetch(`${BASE}/transfers/${row.id}/receive`, { method: 'POST', body: JSON.stringify({}) })) as {
        repeated: boolean
      }
      notify(result.repeated ? 'Already received. Stock was not added again.' : 'Received. Stock added to this store.')
      await load()
    } catch (error) {
      notify(errText(error, 'Could not receive transfer'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <span className="count-pill">{rows.length} transfers</span>
        <button className="btn-dark" type="button" onClick={openNew}>New transfer</button>
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>
        To receive a transfer, switch to the destination store at the top, then press Receive.
      </p>

      <section className="card">
        {loading ? (
          <div className="empty">Loading transfers…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No transfers for this store yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Direction</th>
                  <th>From</th>
                  <th>To</th>
                  <th>SKU</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateText(row.dispatchedAt)}</td>
                    <td>{row.fromStoreId === storeId ? 'Out' : 'In'}</td>
                    <td>{storeName(row.fromStoreId)}</td>
                    <td>{storeName(row.toStoreId)}</td>
                    <td>{row.sku}</td>
                    <td>{row.batchNumber}</td>
                    <td>{row.quantity}</td>
                    <td><span className={row.status === 'received' ? 'tag on' : 'tag off'}>{row.status === 'in_transit' ? 'In transit' : row.status}</span></td>
                    <td>
                      {row.status === 'in_transit' && row.toStoreId === storeId ? (
                        <button className="btn-soft" type="button" disabled={busyId === row.id} onClick={() => { void receive(row) }}>Receive</button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="New transfer" subtitle={`From ${storeName(storeId)}. Stock leaves this store now and arrives when the other store presses Receive.`} onClose={() => setOpen(false)}>
        <label className="field">To store
          <select value={toStoreId} onChange={(event) => setToStoreId(event.target.value)}>
            <option value="">Choose store…</option>
            {otherStores.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">SKU
          <input value={sku} onChange={(event) => setSku(event.target.value)} />
        </label>
        <label className="field">Batch number (must exist in this store)
          <input value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        </label>
        <label className="field">Quantity
          <input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" disabled={saving} onClick={() => { void dispatch() }}>
            {saving ? 'Sending…' : 'Dispatch'}
          </button>
        </div>
      </Modal>
    </>
  )
}

/* ================================ PAGE ================================= */

type Tab = 'suppliers' | 'purchases' | 'transfers'

export function PurchasingPage() {
  const { snapshot, activeStoreId, notify } = useDashboard()
  const pharmacies = snapshot?.pharmacies ?? []
  const firstStoreId = pharmacies[0]?.id ?? ''
  const [storeId, setStoreId] = useState(activeStoreId || '')
  const [tab, setTab] = useState<Tab>('suppliers')

  useEffect(() => {
    if (activeStoreId) setStoreId(activeStoreId)
    else if (!storeId && firstStoreId) setStoreId(firstStoreId)
  }, [activeStoreId, firstStoreId, storeId])

  if (!snapshot) {
    return <div className="empty">Loading…</div>
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'transfers', label: 'Transfers' },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Purchasing</h1>
          <p className="sub">Suppliers, purchase invoices with payments, and stock transfers between stores.</p>
        </div>
        <div className="btn-row">
          {activeStoreId ? (
            <span className="count-pill">{pharmacies.find((item) => item.id === activeStoreId)?.name}</span>
          ) : (
            <select className="select" value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Store">
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'chip is-on' : 'chip'} type="button" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {!storeId ? (
        <div className="empty">Choose a store to continue.</div>
      ) : tab === 'suppliers' ? (
        <SuppliersTab storeId={storeId} notify={notify} />
      ) : tab === 'purchases' ? (
        <PurchasesTab storeId={storeId} notify={notify} />
      ) : (
        <TransfersTab storeId={storeId} notify={notify} pharmacies={pharmacies} />
      )}
    </>
  )
}
