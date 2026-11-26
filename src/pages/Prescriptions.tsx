import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext'
import { formatWhen, rxLabel } from '../lib/format'
import { API_BASE, apiFetch } from '../services/http'
import type { CatalogProduct, PrescriptionStatus, VerifiedRxItem } from '../types'

type VerifiedLine = {
  productId: string
  approvedQty: string
}

type StatusFilter = 'all' | PrescriptionStatus

const emptyLine = (): VerifiedLine => ({ productId: '', approvedQty: '1' })

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'needs_clearer_photo', label: 'Needs photo' },
  { id: 'approved', label: 'Verified' },
  { id: 'dispensed', label: 'Dispensed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

export function PrescriptionsPage() {
  const { snapshot, decidePrescription, activeStoreId, activeStore } = useDashboard()
  // Order staff can look at prescriptions but only pharmacists and managers decide on them.
  const canDecide = snapshot!.admin.deskRole !== 'ORDER_STAFF'
  const items = useMemo(
    () => snapshot!.prescriptions.filter((item) => !activeStoreId || item.pharmacyId === activeStoreId),
    [snapshot, activeStoreId],
  )
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [notes, setNotes] = useState('')
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [lines, setLines] = useState<VerifiedLine[]>([emptyLine()])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach((item) => {
      map[item.status] = (map[item.status] ?? 0) + 1
    })
    return map
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false
      if (!q) return true
      return `${item.id} ${item.customerName} ${item.medicineName} ${item.scannedText ?? ''}`.toLowerCase().includes(q)
    })
    // Waiting prescriptions: oldest first, so nobody is left waiting. Everything else: newest first.
    const oldestFirst = filter === 'pending' || filter === 'needs_clearer_photo'
    return [...list].sort((a, b) => (oldestFirst ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)))
  }, [items, filter, query])

  const current = visible.find((item) => item.id === selected) ?? visible[0]
  const currentId = current?.id
  const imageSrc = useMemo(() => {
    if (!current?.imageUrl) return ''
    if (current.imageUrl.startsWith('http')) return current.imageUrl
    return `${API_BASE}${current.imageUrl}`
  }, [current?.imageUrl])

  const storeId = activeStoreId || current?.pharmacyId || ''
  const isOpenCase = current?.status === 'pending' || current?.status === 'needs_clearer_photo'

  // Whenever a different prescription is shown, start its form fresh.
  useEffect(() => {
    if (!current) return
    setFormError('')
    setCatalogQuery('')
    setNotes('')
    setLines(
      current.verifiedItems?.length
        ? current.verifiedItems.map((entry) => ({
            productId: entry.productId ?? '',
            approvedQty: String(entry.approvedQty ?? entry.quantity ?? '1'),
          }))
        : [emptyLine()],
    )
  }, [currentId])

  useEffect(() => {
    if (!storeId) return
    let cancel = false
    const path = `/admin/stores/${encodeURIComponent(storeId)}/products-catalog`
    void apiFetch(path)
      .then((payload) => {
        if (cancel) return
        const products = (payload as { products?: CatalogProduct[] }).products ?? (payload as CatalogProduct[])
        setCatalog(Array.isArray(products) ? products : [])
      })
      .catch(() => {
        if (cancel) return
        void apiFetch(`/admin/products?storeId=${encodeURIComponent(storeId)}`)
          .then((payload) => {
            if (cancel) return
            const list = (payload as { products?: CatalogProduct[] }).products ?? (payload as CatalogProduct[])
            setCatalog(Array.isArray(list) ? list : [])
          })
          .catch(() => {
            if (!cancel) {
              setCatalog(
                snapshot!.medicines
                  .filter((med) => med.storeId === storeId)
                  .map((med) => ({
                    id: med.id,
                    sku: med.sku,
                    name: med.name,
                    strength: med.strength,
                    unitLabel: med.unitLabel,
                    packSize: med.unitLabel,
                    price: med.price,
                    stock: med.stock,
                    rxRequired: med.rxRequired,
                  })),
              )
            }
          })
      })
    return () => {
      cancel = true
    }
  }, [storeId, snapshot])

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    if (!q) return catalog.slice(0, 80)
    return catalog.filter((item) => `${item.name} ${item.sku} ${item.strength ?? ''}`.toLowerCase().includes(q)).slice(0, 80)
  }, [catalog, catalogQuery])

  /** The list for one line. The medicine already picked stays in it even if the search hides it. */
  function optionsFor(productId: string) {
    if (!productId || filteredCatalog.some((entry) => entry.id === productId)) return filteredCatalog
    const picked = catalog.find((entry) => entry.id === productId)
    return picked ? [picked, ...filteredCatalog] : filteredCatalog
  }

  function buildVerifiedItems(): VerifiedRxItem[] {
    const result: VerifiedRxItem[] = []
    for (const line of lines) {
      const product = catalog.find((entry) => entry.id === line.productId)
      if (!product) continue
      const qty = line.approvedQty.trim() || '1'
      result.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        strength: product.strength,
        unitLabel: product.unitLabel,
        packSize: product.packSize ?? product.unitLabel,
        quantity: qty,
        approvedQty: Number(qty) || undefined,
      })
    }
    return result
  }

  function validate(status: PrescriptionStatus) {
    if (status === 'rejected' && notes.trim().length < 3) {
      return 'Write a short reason. The patient will see it.'
    }
    if (status === 'needs_clearer_photo' && notes.trim().length < 3) {
      return 'Tell the patient what to fix in the photo, for example: the text is blurry.'
    }
    if (status === 'approved') {
      const chosen = lines.filter((line) => line.productId)
      if (chosen.length === 0) return 'Pick at least one medicine from the catalog.'
      const seen = new Set<string>()
      for (const line of chosen) {
        const name = catalog.find((entry) => entry.id === line.productId)?.name ?? 'This medicine'
        const qty = Number(line.approvedQty)
        if (line.approvedQty.trim() === '' || !Number.isInteger(qty) || qty <= 0) {
          return `${name}: approved quantity must be a whole number above 0.`
        }
        if (seen.has(line.productId)) return `${name} is added twice. Keep one line for each medicine.`
        seen.add(line.productId)
      }
    }
    return ''
  }

  async function decide(status: PrescriptionStatus) {
    if (!current || busy || !canDecide) return
    const problem = validate(status)
    if (problem) {
      setFormError(problem)
      return
    }
    setFormError('')
    if (status === 'approved') {
      const short = lines
        .filter((line) => line.productId)
        .map((line) => ({ product: catalog.find((entry) => entry.id === line.productId), qty: Number(line.approvedQty) }))
        .filter((entry) => entry.product && entry.qty > entry.product.stock)
      if (short.length > 0) {
        const names = short.map((entry) => entry.product!.name).join(', ')
        if (!window.confirm(`Not enough stock for: ${names}. Verify anyway?`)) return
      }
    }
    if (status === 'rejected' && !window.confirm('Reject this prescription? The patient will be told.')) return

    setBusy(true)
    try {
      await decidePrescription(current.id, status, {
        notes: notes.trim() || undefined,
        // Dispense reuses the items that were already verified, so nothing is rebuilt by mistake.
        verifiedItems: status === 'approved' ? buildVerifiedItems() : status === 'dispensed' ? current.verifiedItems : undefined,
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the decision. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Photo Requests</h1>
          <p className="sub">
            {activeStore
              ? `${activeStore.name}${activeStore.code ? ` (${activeStore.code})` : ''} — open the submitted photo, link a catalog product, and reply with availability.`
              : 'Medicine packaging and prescription uploads from the mobile app. Catalog creation stays under Medicines.'}
          </p>
        </div>
      </div>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        {FILTERS.map((item) => (
          <button key={item.id} className={filter === item.id ? 'chip is-on' : 'chip'} type="button" onClick={() => setFilter(item.id)}>
            {item.label} ({item.id === 'all' ? items.length : (counts[item.id] ?? 0)})
          </button>
        ))}
      </div>
      <section className="rx-layout">
        <article className="card">
          <div className="table-head">
            <h2>Queue</h2>
            <label className="search">
              <span className="sr-only">Search prescriptions</span>
              <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          {visible.length === 0 ? <div className="empty">No prescriptions here. Try another filter.</div> : null}
          {visible.map((item) => (
            <button
              key={item.id}
              className={current?.id === item.id ? 'list-btn is-on' : 'list-btn'}
              type="button"
              onClick={() => setSelected(item.id)}
            >
              <span>
                <b>{item.customerName}</b>
                <span className="mini">
                  {item.medicineName} · {item.quantity || 'Qty TBD'}
                </span>
                <span className="mini">
                  {!activeStoreId ? `${item.pharmacyName} · ` : ''}
                  {formatWhen(item.submittedAt)}
                </span>
              </span>
              <span className="status">
                <i className={`dot ${item.status}`} />
                {rxLabel(item.status)}
              </span>
            </button>
          ))}
        </article>
        {current ? (
          <article className="card">
            <p className="kicker">
              {current.id} · {current.uploadType === 'medicine_packaging' ? 'Medicine packaging' : 'Prescription'}
            </p>
            <h2>{current.medicineName || 'Awaiting verification'}</h2>
            <p className="sub">{current.customerNote || 'No patient note.'}</p>
            {imageSrc ? (
              <div className="rx-image-wrap">
                <a href={imageSrc} target="_blank" rel="noreferrer" title="Open full-size photo">
                  <img src={imageSrc} alt="Customer photo upload" className="rx-image" />
                </a>
                <p className="sub">
                  <a href={imageSrc} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open the original photo
                  </a>
                </p>
              </div>
            ) : (
              <div className="empty">No photo uploaded.</div>
            )}
            {current.detectedDetails?.name ? (
              <div className="profile-stat">
                <span>Detected details</span>
                <b>
                  {[current.detectedDetails.name, current.detectedDetails.strength, current.detectedDetails.form, current.detectedDetails.packSize]
                    .filter(Boolean)
                    .join(' · ')}
                </b>
              </div>
            ) : null}
            <div className="profile-stat">
              <span>Scanned text (from this same photo)</span>
              <b style={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{current.scannedText || 'No scanned text yet.'}</b>
            </div>
            <div className="profile-stat">
              <span>Patient</span>
              <b>{current.customerName}</b>
            </div>
            <div className="profile-stat">
              <span>Prescriber</span>
              <b>{current.prescriber || '—'}</b>
            </div>
            <div className="profile-stat">
              <span>Pharmacy</span>
              <b>{current.pharmacyName}</b>
            </div>
            <div className="profile-stat">
              <span>Submitted</span>
              <b>{formatWhen(current.submittedAt)}</b>
            </div>
            <div className="profile-stat">
              <span>Status</span>
              <b>{rxLabel(current.status)}</b>
            </div>
            {current.notes ? (
              <div className="profile-stat">
                <span>Note on record</span>
                <b style={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{current.notes}</b>
              </div>
            ) : null}
            {current.verifiedItems && current.verifiedItems.length > 0 ? (
              <div className="mt">
                <h3>Verified items</h3>
                {current.verifiedItems.map((entry, index) => (
                  <div className="profile-stat" key={`${entry.sku}-${index}`}>
                    <span>{entry.name}</span>
                    <b>
                      {entry.strength ? `${entry.strength} · ` : ''}
                      {entry.unitLabel || entry.packSize || '—'} · qty {entry.approvedQty ?? entry.quantity ?? '—'}
                    </b>
                  </div>
                ))}
              </div>
            ) : null}

            {!canDecide ? (
              <p className="sub mt">Your role can view prescriptions but cannot verify, reject or dispense them.</p>
            ) : null}

            {canDecide && isOpenCase ? (
              <>
                <label className="field">
                  <span>Search catalog</span>
                  <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Name or SKU" />
                </label>
                {lines.map((line, index) => {
                  const product = catalog.find((entry) => entry.id === line.productId)
                  const qty = Number(line.approvedQty)
                  const tooMany = Boolean(product) && Number.isInteger(qty) && qty > (product?.stock ?? 0)
                  return (
                    <div className="fee-row" key={`line-${index}`} style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <label className="field" style={{ flex: 2 }}>
                        Product
                        <select
                          value={line.productId}
                          onChange={(event) => {
                            const next = [...lines]
                            next[index] = { ...next[index], productId: event.target.value }
                            setLines(next)
                          }}
                        >
                          <option value="">Select from catalog…</option>
                          {optionsFor(line.productId).map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}{entry.strength ? ` · ${entry.strength}` : ''} · {entry.unitLabel} ({entry.sku})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ flex: 1 }}>
                        Approved qty
                        <input
                          inputMode="numeric"
                          value={line.approvedQty}
                          onChange={(event) => {
                            const next = [...lines]
                            next[index] = { ...next[index], approvedQty: event.target.value }
                            setLines(next)
                          }}
                        />
                      </label>
                      <button
                        className="btn-soft"
                        type="button"
                        aria-label="Remove line"
                        onClick={() => setLines(lines.filter((_, rowIndex) => rowIndex !== index))}
                        disabled={lines.length === 1}
                      >
                        <Trash2 size={14} />
                      </button>
                      {product ? (
                        <p className="sub" style={{ width: '100%', color: tooMany ? '#d92d20' : undefined }}>
                          {product.name} · {product.strength || '—'} · {product.unitLabel} · stock {product.stock}
                          {tooMany ? ' · more than the stock on hand' : ''}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
                <button className="btn-soft" type="button" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus size={14} /> Add medicine line
                </button>
                <label className="field">
                  <span>Pharmacist note (required to reject or ask for a clearer photo; the patient sees it)</span>
                  <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
              </>
            ) : null}

            {formError ? <p style={{ color: '#d92d20' }}>{formError}</p> : null}

            <div className="modal-actions">
              {canDecide && isOpenCase ? (
                <>
                  <button className="btn-soft" type="button" disabled={busy} onClick={() => void decide('rejected')}>
                    Mark unavailable
                  </button>
                  <button className="btn-soft" type="button" disabled={busy} onClick={() => void decide('needs_clearer_photo')}>
                    Request clearer photo
                  </button>
                  <button
                    className="btn-dark"
                    type="button"
                    disabled={busy || buildVerifiedItems().length === 0}
                    onClick={() => void decide('approved')}
                  >
                    {busy ? 'Saving…' : 'Link product · Available'}
                  </button>
                </>
              ) : null}
              {canDecide && current.status === 'approved' ? (
                <button className="btn-dark" type="button" disabled={busy} onClick={() => void decide('dispensed')}>
                  {busy ? 'Saving…' : 'Dispense'}
                </button>
              ) : null}
              {current.status === 'dispensed' || current.status === 'rejected' ? (
                <span className="muted">This prescription is closed.</span>
              ) : null}
            </div>
          </article>
        ) : null}
      </section>
    </>
  )
}
