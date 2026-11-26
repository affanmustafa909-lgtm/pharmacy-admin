import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext'
import { formatWhen, rxLabel } from '../lib/format'
import { API_BASE, apiFetch } from '../services/http'
import type { CatalogProduct, PrescriptionStatus, VerifiedRxItem } from '../types'

type VerifiedLine = {
  productId: string
  approvedQty: string
}

const emptyLine = (): VerifiedLine => ({ productId: '', approvedQty: '1' })

export function PrescriptionsPage() {
  const { snapshot, decidePrescription, activeStoreId, activeStore } = useDashboard()
  const items = snapshot!.prescriptions.filter((item) => !activeStoreId || item.pharmacyId === activeStoreId)
  const [selected, setSelected] = useState(items.find((item) => item.status === 'pending')?.id ?? items[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState('')
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [lines, setLines] = useState<VerifiedLine[]>([emptyLine()])
  const visible = items.filter((item) =>
    `${item.id} ${item.customerName} ${item.medicineName} ${item.scannedText ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const current = items.find((item) => item.id === selected) ?? visible[0]
  const imageSrc = useMemo(() => {
    if (!current?.imageUrl) return ''
    if (current.imageUrl.startsWith('http')) return current.imageUrl
    return `${API_BASE}${current.imageUrl}`
  }, [current?.imageUrl])

  const storeId = activeStoreId || current?.pharmacyId || ''

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

  function hydrateLines(rxId: string) {
    const item = items.find((entry) => entry.id === rxId)
    if (!item) return
    setSelected(rxId)
    setNotes(item.notes || '')
    if (item.verifiedItems?.length) {
      setLines(
        item.verifiedItems.map((entry) => ({
          productId: entry.productId ?? catalog.find((product) => product.sku === entry.sku)?.id ?? '',
          approvedQty: String(entry.approvedQty ?? entry.quantity ?? '1'),
        })),
      )
      return
    }
    setLines([emptyLine()])
  }

  function buildVerifiedItems(): VerifiedRxItem[] {
    const items: VerifiedRxItem[] = []
    for (const line of lines) {
      const product = catalog.find((entry) => entry.id === line.productId)
      if (!product) continue
      const qty = line.approvedQty.trim() || '1'
      items.push({
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
    return items
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
      <section className="rx-layout">
        <article className="card">
          <div className="table-head">
            <h2>Queue</h2>
            <label className="search">
              <span className="sr-only">Search prescriptions</span>
              <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          {visible.length === 0 ? <div className="empty">No prescriptions match.</div> : null}
          {visible.map((item) => (
            <button
              key={item.id}
              className={current?.id === item.id ? 'list-btn is-on' : 'list-btn'}
              type="button"
              onClick={() => hydrateLines(item.id)}
            >
              <span>
                <b>{item.customerName}</b>
                <span className="mini">
                  {item.medicineName} · {item.quantity || 'Qty TBD'}
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
            <p className="sub">{current.customerNote || current.notes || 'No patient note.'}</p>
            {imageSrc ? (
              <div className="rx-image-wrap">
                <a href={imageSrc} target="_blank" rel="noreferrer" title="Open full-size photo">
                  <img src={imageSrc} alt="Customer photo upload" className="rx-image" />
                </a>
                <p className="mini">Tap image to zoom / open original</p>
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
              <span>Scanned text</span>
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
            {(current.status === 'pending' || current.status === 'needs_clearer_photo') && (
              <>
                <label className="field">
                  <span>Search catalog</span>
                  <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Name or SKU" />
                </label>
                {lines.map((line, index) => {
                  const product = catalog.find((entry) => entry.id === line.productId)
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
                          {filteredCatalog.map((entry) => (
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
                        <p className="sub" style={{ width: '100%' }}>
                          {product.name} · {product.strength || '—'} · {product.unitLabel} · stock {product.stock}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
                <button className="btn-soft" type="button" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus size={14} /> Add medicine line
                </button>
                <label className="field">
                  <span>Pharmacist note</span>
                  <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
              </>
            )}
            <div className="modal-actions">
              {current.status === 'pending' || current.status === 'needs_clearer_photo' ? (
                <>
                  <button className="btn-soft" type="button" onClick={() => void decide('rejected')}>
                    Mark unavailable
                  </button>
                  <button className="btn-soft" type="button" onClick={() => void decide('needs_clearer_photo')}>
                    Request clearer photo
                  </button>
                  <button className="btn-dark" type="button" onClick={() => void decide('approved')} disabled={buildVerifiedItems().length === 0}>
                    Link product · Available
                  </button>
                </>
              ) : null}
              {current.status === 'approved' ? (
                <button className="btn-dark" type="button" onClick={() => void decide('dispensed')}>
                  Dispense
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

  function decide(status: PrescriptionStatus) {
    if (!current) return
    void decidePrescription(current.id, status, {
      notes: notes.trim() || undefined,
      verifiedItems: status === 'approved' || status === 'dispensed' ? buildVerifiedItems() : undefined,
    })
  }
}