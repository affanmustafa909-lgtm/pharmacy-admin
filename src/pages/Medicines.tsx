import { useEffect, useMemo, useState } from 'react'
import { Eye, Pause, Plus, RotateCw, Shield, ShoppingBag, Bell, Pencil, Trash2, PackagePlus, ImagePlus } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ProductImport } from '../components/ProductImport'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { normalizeExpiry } from '../lib/expiry'
import { expiryLabel, expiryState, formatExpiry } from '../lib/expiry-Status'
import { hashQuery } from '../nav'
import { API_BASE, apiFetch } from '../services/http'

interface StockMove {
  id: string
  quantity: number
  reason: string
  note: string
  orderNumber: string
  staffName: string
  createdAt: string
}

const REASON_LABEL: Record<string, string> = {
  restock: 'Restock',
  order_fulfillment: 'Order deduction',
  cancellation_release: 'Cancellation release',
  damage: 'Damage',
  expiry: 'Expired write-off',
  manual_adjustment: 'Manual adjustment',
  import: 'Import',
  opening_balance: 'Opening balance',
  purchase_receive: 'Purchase received',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
}

function StockHistory({ productId, stock, onChanged }: { productId: string; stock: number; onChanged: () => void }) {
  const [rows, setRows] = useState<StockMove[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('restock')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const data = (await apiFetch(`/admin/stock/${productId}/history`)) as { movements: StockMove[] }
      setRows(data.movements)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stock history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [productId, stock])

  async function adjust() {
    const quantity = Number(qty)
    if (!Number.isInteger(quantity) || quantity === 0) {
      setError('Enter a whole number (not 0)')
      return
    }
    if (note.trim().length < 3) {
      setError('Add a short reason')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/admin/stock/${productId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ quantity, reason, note: note.trim() }),
      })
      setQty('')
      setNote('')
      onChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not adjust stock')
    } finally {
      setSaving(false)
    }
  }

  const shown = rows.filter((row) => filter === 'all' || row.reason === filter)

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="block-head">
        <h2>Stock history</h2>
        <select className="select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="History type">
          <option value="all">All movements</option>
          {Object.entries(REASON_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <select className="select" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Adjustment type">
          <option value="restock">Restock (+)</option>
          <option value="damage">Damage (-)</option>
          <option value="expiry">Expired write-off (-)</option>
          <option value="manual_adjustment">Manual adjustment (+ or -)</option>
        </select>
        <input className="select" style={{ width: 110 }} value={qty} onChange={(event) => setQty(event.target.value)} placeholder="Quantity" inputMode="numeric" />
        <input className="select" style={{ minWidth: 220 }} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (required)" />
        <button className="btn-dark" type="button" disabled={saving} onClick={() => void adjust()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error ? <p style={{ color: '#d92d20' }}>{error}</p> : null}

      {loading ? (
        <div className="empty">Loading history…</div>
      ) : shown.length === 0 ? (
        <div className="empty">No stock movements yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{REASON_LABEL[row.reason] ?? row.reason}</td>
                  <td style={{ color: row.quantity < 0 ? '#d92d20' : '#1f7a4d', fontWeight: 600 }}>
                    {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                  </td>
                  <td>{[row.note, row.orderNumber].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{row.staffName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const CATEGORY_OPTIONS = ['Medicines', 'Vitamins', 'Supplements', 'Devices']

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function todayIso() {
  return toIsoDate(new Date())
}

/** Converts any supported expiry format (YYYY-MM-DD or MM/YY) to YYYY-MM-DD for the date input. */
function expiryToIso(value?: string) {
  return normalizeExpiry(value) ?? ''
}

/** Same expiry rule as the Overview page (see lib/expiryStatus.ts). */
function expiryInfo(value?: string | null): { state: 'expired' | 'soon' | 'ok'; label: string } {
  const state = expiryState(value)
  return {
    state: state === 'expired' ? 'expired' : state === 'soon' ? 'soon' : 'ok',
    label: expiryLabel(value),
  }
}

/** Expiry alerts only count medicines that still have stock (same as the Overview page). */
function alertState(item: { stock: number; expiry?: string | null }) {
  return item.stock > 0 ? expiryInfo(item.expiry).state : 'ok'
}

function productImageSrc(imageUrl?: string) {
  if (!imageUrl) return ''
  return imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl}`
}

const emptyForm = () => ({
  storeId: '',
  name: '',
  brand: 'hera.',
  genericName: '',
  strength: '',
  category: 'Medicines',
  customCategory: '',
  price: '',
  unitLabel: '30 tablets',
  stock: '',
  sku: '',
  description: '',
  batch: '',
  expiry: '',
  rxRequired: false,
  onlineSale: true,
  imageUrl: '',
})

export function MedicinesPage() {
  const { snapshot, updateMedicine, createMedicine, deactivateMedicine, deleteMedicine, restock, notify, reload, activeStoreId, activeStore } = useDashboard()
  const presetStore = hashQuery('store')
  const allMedicines = snapshot?.medicines ?? []
  const pharmacies = snapshot?.pharmacies ?? []
  const threshold = snapshot?.settings.lowStockThreshold ?? 0

  const [storeFilter, setStoreFilter] = useState(activeStoreId || presetStore || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(allMedicines[0]?.id ?? null)

  useEffect(() => {
    if (activeStoreId) setStoreFilter(activeStoreId)
    else if (presetStore) setStoreFilter(presetStore)
  }, [activeStoreId, presetStore])
  const [flipped, setFlipped] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalExpiry, setOriginalExpiry] = useState('')
  const [saving, setSaving] = useState(false)
  const [restocking, setRestocking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockQty, setRestockQty] = useState('10')
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [imageEditOpen, setImageEditOpen] = useState(false)
  const [categories, setCategories] = useState<string[]>(CATEGORY_OPTIONS)
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low' | 'out' | 'expiring' | 'expired'>('all')
  const editing = editingId !== null

  const medicines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allMedicines.filter((item) => {
      if (storeFilter !== 'all' && item.storeId !== storeFilter) return false
      const outOfStock = item.stock <= 0
      const low = item.lowStockAlerts && item.stock > 0 && item.stock <= threshold
      if (stockFilter === 'out' && !outOfStock) return false
      if (stockFilter === 'low' && !low) return false
      if (stockFilter === 'in_stock' && outOfStock) return false
      const expState = alertState(item)
      if (stockFilter === 'expiring' && expState !== 'soon') return false
      if (stockFilter === 'expired' && expState !== 'expired') return false
      if (!q) return true
      return `${item.name} ${item.genericName ?? ''} ${item.sku} ${item.brand} ${item.category} ${item.batch ?? ''}`.toLowerCase().includes(q)
    })
  }, [allMedicines, storeFilter, search, stockFilter, threshold])

  const index = Math.max(0, medicines.findIndex((item) => item.id === selectedId))
  const medicine = medicines.find((item) => item.id === selectedId) ?? medicines[0]

  useEffect(() => {
    apiFetch('/admin/categories')
      .then((payload) => setCategories((payload as { categories: string[] }).categories))
      .catch(() => setCategories(CATEGORY_OPTIONS))
  }, [allMedicines.length])

  useEffect(() => {
    setFlipped(false)
  }, [selectedId])

  useEffect(() => {
    if (!medicines.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !medicines.some((item) => item.id === selectedId)) {
      setSelectedId(medicines[0].id)
    }
  }, [medicines, selectedId])

  if (!snapshot) {
    return <div className="empty">Loading medicines…</div>
  }

  const low = medicines.filter((item) => item.lowStockAlerts && item.stock > 0 && item.stock <= threshold)
  const expiredCount = medicines.filter((item) => alertState(item) === 'expired').length
  const expiringCount = medicines.filter((item) => alertState(item) === 'soon').length
  const storeMeds = allMedicines.filter((item) => storeFilter === 'all' || item.storeId === storeFilter)
  const alertOut = storeMeds.filter((item) => item.stock <= 0)
  const alertLow = storeMeds.filter((item) => item.lowStockAlerts && item.stock > 0 && item.stock <= threshold)
  const alertSoon = storeMeds.filter((item) => alertState(item) === 'soon')
  const alertExpired = storeMeds.filter((item) => alertState(item) === 'expired')
  const alertTiles = [
    { key: 'out' as const, label: 'Out of stock', list: alertOut },
    { key: 'low' as const, label: 'Low stock', list: alertLow },
    { key: 'expiring' as const, label: 'Expiring soon', list: alertSoon },
    { key: 'expired' as const, label: 'Expired', list: alertExpired },
  ]
  const scopeName = activeStore?.name ?? (storeFilter === 'all' ? 'All stores' : pharmacies.find((p) => p.id === storeFilter)?.name ?? '—')

  function selectMedicine(id: string) {
    setSelectedId(id)
    setFlipped(false)
  }

  function validImage(file: File) {
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file')
      return false
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify('Image is too large (max 5 MB)')
      return false
    }
    return true
  }

  async function uploadImage(productId: string, file: File) {
    const body = new FormData()
    body.append('image', file)
    const payload = (await apiFetch(`/admin/products/${productId}/image`, { method: 'POST', body })) as { imageUrl: string }
    return payload.imageUrl
  }

  async function changeMedicineImage(file: File | null) {
    if (!medicine || !file) return
    if (!validImage(file)) return
    try {
      await uploadImage(medicine.id, file)
      await reload()
      notify('Product image updated')
      setImageEditOpen(false)
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : 'Image upload failed')
    }
  }

  function openNew() {
    setEditingId(null)
    setOriginalExpiry('')
    setPendingImage(null)
    setForm({
      ...emptyForm(),
      storeId: activeStoreId || (storeFilter !== 'all' ? storeFilter : pharmacies[0]?.id ?? ''),
    })
    setOpen(true)
  }

  function openEdit(targetId?: string) {
    const target = targetId
      ? allMedicines.find((item) => item.id === targetId)
      : medicine
    if (!target) return
    const iso = expiryToIso(target.expiry)
    setSelectedId(target.id)
    setEditingId(target.id)
    setOriginalExpiry(iso)
    setPendingImage(null)
    setForm({
      storeId: target.storeId ?? pharmacies[0]?.id ?? '',
      name: target.name,
      brand: target.brand,
      genericName: target.genericName ?? '',
      strength: target.strength ?? '',
      category: categories.includes(target.category) ? target.category : '__custom__',
      customCategory: categories.includes(target.category) ? '' : target.category,
      price: String(target.price),
      unitLabel: target.unitLabel,
      stock: String(target.stock),
      sku: target.sku,
      description: target.description,
      batch: target.batch,
      expiry: iso,
      rxRequired: target.rxRequired,
      onlineSale: target.onlineSale,
      imageUrl: target.imageUrl ?? '',
    })
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setPendingImage(null)
  }

  async function saveMedicine() {
    if (saving) return

    const name = form.name.trim()
    if (!name) {
      notify('Enter a medicine name')
      return
    }
    if (name.length < 2 || !/[A-Za-z]{2}/.test(name) || !/^[A-Za-z0-9][A-Za-z0-9 .,'()/&+-]*$/.test(name)) {
      notify('Enter a valid medicine name (letters, at least 2 characters, no symbols like @ # $)')
      return
    }
    const sku = form.sku.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(sku)) {
      notify('Enter a SKU (2-40 characters: letters, numbers, - or _)')
      return
    }
    if (!form.batch.trim()) {
      notify('Enter the batch number')
      return
    }
    if (!form.expiry.trim()) {
      notify('Choose the expiry date')
      return
    }
    if (!form.strength.trim() || !/\d/.test(form.strength)) {
      notify('Enter the strength with a number, e.g. 500mg')
      return
    }
    if (!form.unitLabel.trim()) {
      notify('Enter the pack, e.g. 30 tablets')
      return
    }
    if (form.category === '__custom__' && !form.customCategory.trim()) {
      notify('Enter a custom category')
      return
    }
    const price = Number(form.price)
    if (form.price.trim() === '' || !Number.isFinite(price) || price <= 0) {
      notify('Enter a valid price greater than 0')
      return
    }
    const stock = Number(form.stock)
    if (form.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) {
      notify('Stock must be a whole number (0 or more)')
      return
    }
    const expiry = form.expiry.trim()
    if (expiry && expiry < todayIso() && (!editing || expiry !== originalExpiry)) {
      notify('Expiry date is in the past')
      return
    }
    if (pendingImage && !validImage(pendingImage)) return

    const storeId = form.storeId || pharmacies[0]?.id || ''
    const batch = form.batch.trim()
    const duplicate = allMedicines.some(
      (item) =>
        item.id !== editingId &&
        item.storeId === storeId &&
        item.name.trim().toLowerCase() === name.toLowerCase() &&
        (item.batch ?? '').trim().toLowerCase() === batch.toLowerCase(),
    )
    if (duplicate) {
      notify('This medicine with the same batch already exists in this store')
      return
    }
    const skuTaken = allMedicines.some(
      (item) => item.id !== editingId && item.storeId === storeId && (item.sku ?? '').trim().toLowerCase() === sku.toLowerCase(),
    )
    if (skuTaken) {
      notify('This SKU is already used by another medicine in this store')
      return
    }
    // SKU and batch belong to ONE medicine across ALL stores.
    // The same medicine (same name) may reuse them in other stores; a different medicine may not.
    const norm = (value?: string | null) => (value ?? '').trim().toLowerCase()
    const skuOwner = allMedicines.find(
      (item) => item.id !== editingId && norm(item.sku) === norm(sku) && norm(item.name) !== norm(name),
    )
    if (skuOwner) {
      notify(`SKU ${sku} already belongs to "${skuOwner.name}"${skuOwner.storeName ? ` (${skuOwner.storeName})` : ''}. Use a different SKU.`)
      return
    }
    const batchOwner = allMedicines.find(
      (item) => item.id !== editingId && norm(item.batch) === norm(batch) && norm(item.name) !== norm(name),
    )
    if (batchOwner) {
      notify(`Batch ${batch} already belongs to "${batchOwner.name}"${batchOwner.storeName ? ` (${batchOwner.storeName})` : ''}. Use a different batch.`)
      return
    }
    // The same medicine in another store must use the same SKU as there (batch may differ).
    const sameMedicineElsewhere = allMedicines.filter(
      (item) => item.id !== editingId && item.storeId !== storeId && norm(item.name) === norm(name),
    )
    if (sameMedicineElsewhere.length > 0 && !sameMedicineElsewhere.some((item) => norm(item.sku) === norm(sku))) {
      const first = sameMedicineElsewhere[0]
      notify(`"${first.name}" already exists in ${first.storeName ?? 'another store'} with SKU ${first.sku}. Use the same SKU.`)
      return
    }

    const payload = {
      storeId,
      name,
      brand: form.brand.trim() || 'hera.',
      genericName: form.genericName.trim() || undefined,
      strength: form.strength.trim() || undefined,
      category: form.category === '__custom__' ? form.customCategory.trim() : form.category,
      price,
      unitLabel: form.unitLabel.trim() || '1 unit',
      stock,
      sku,
      description: form.description.trim() || undefined,
      batch: batch || undefined,
      expiry: expiry || undefined,
      rxRequired: form.rxRequired,
      onlineSale: form.onlineSale,
      imageUrl: form.imageUrl.trim() || undefined,
    }

    setSaving(true)
    try {
      if (editingId) {
        const ok = await updateMedicine(editingId, payload)
        if (!ok) return
        if (pendingImage) {
          try {
            await uploadImage(editingId, pendingImage)
            await reload()
            notify('Image uploaded')
          } catch (error: unknown) {
            notify(error instanceof Error ? error.message : 'Image upload failed')
          }
        }
        closeForm()
        return
      }
      const id = await createMedicine(payload)
      if (!id) return
      if (pendingImage) {
        try {
          await uploadImage(id, pendingImage)
          await reload()
          notify('Image uploaded')
        } catch (error: unknown) {
          notify(error instanceof Error ? error.message : 'Image upload failed')
        }
      }
      setSearch('')
      setStockFilter('all')
      setStoreFilter(payload.storeId || 'all')
      setSelectedId(id)
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  async function submitRestock() {
    if (!medicine || restocking) return
    const quantity = Number(restockQty)
    if (restockQty.trim() === '' || !Number.isInteger(quantity) || quantity <= 0) {
      notify('Enter a whole number greater than 0')
      return
    }
    setRestocking(true)
    try {
      const ok = await restock(medicine.id, quantity)
      if (ok) setRestockOpen(false)
    } finally {
      setRestocking(false)
    }
  }

  const selectedExpiry = medicine ? expiryInfo(medicine.expiry) : null

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{activeStore ? 'Products' : 'Medicines'}</h1>
          <p className="sub">
            {activeStore
              ? `${activeStore.code ? `${activeStore.code} · ` : ''}Stock, expiry, and catalog for ${activeStore.name} — changes sync to the app.`
              : 'Add, edit, stock, and publish products that sync to the mobile app.'}
          </p>
        </div>
        <div className="btn-row">
          {activeStoreId ? (
            <span className="count-pill">{activeStore?.name}</span>
          ) : (
            <select className="select" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} aria-label="Store">
              <option value="all">All stores</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
              ))}
            </select>
          )}
          <button className="btn-soft" type="button" onClick={() => setImportOpen(true)}>Import</button>
          {medicine ? <button className="btn-soft" type="button" onClick={() => openEdit(medicine.id)}><Pencil size={15} /> Edit / Update</button> : null}
          {medicine ? <button className="btn-soft" type="button" onClick={() => setImageEditOpen(true)}><ImagePlus size={15} /> Edit pic</button> : null}
          {medicine ? <button className="btn-soft" type="button" onClick={() => setRestockOpen(true)}><PackagePlus size={15} /> Restock</button> : null}
          {medicine ? <button className="btn-soft" type="button" onClick={() => { void deactivateMedicine(medicine.id) }}><Pause size={15} /> Deactivate</button> : null}
          {medicine ? <button className="btn-soft" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</button> : null}
          <button className="btn-dark" type="button" onClick={openNew}><Plus size={16} /> New medicine</button>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <input
          className="select"
          style={{ minWidth: 240 }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, SKU, brand, batch…"
          aria-label="Search medicines"
        />
        {(['all', 'in_stock', 'low', 'out', 'expiring', 'expired'] as const).map((filter) => (
          <button key={filter} className={stockFilter === filter ? 'chip is-on' : 'chip'} type="button" onClick={() => setStockFilter(filter)}>
            {{ all: 'All stock', in_stock: 'In stock', low: 'Low stock', out: 'Out of stock', expiring: 'Expiring soon', expired: 'Expired' }[filter]}
          </button>
        ))}
        <span className="count-pill">
          {medicines.length} shown
          {low.length ? ` · ${low.length} low` : ''}
          {expiredCount ? ` · ${expiredCount} expired` : ''}
          {expiringCount ? ` · ${expiringCount} expiring` : ''}
        </span>
        <span className="count-pill">Store: {scopeName} · as of {new Date().toLocaleDateString()}</span>
      </div>

      {alertTiles.some((tile) => tile.list.length > 0) ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="block-head">
            <h2>Stock alerts</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {alertTiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                className="btn-soft"
                style={{ textAlign: 'left', padding: 14, opacity: tile.list.length ? 1 : 0.5 }}
                onClick={() => setStockFilter(tile.key)}
              >
                <strong style={{ fontSize: 22, color: tile.list.length ? '#d92d20' : undefined }}>{tile.list.length}</strong>
                <div>{tile.label}</div>
                <small>{tile.list.slice(0, 3).map((item) => item.name).join(', ')}{tile.list.length > 3 ? '…' : ''}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="block-head">
          <h2>All products</h2>
          <span className="count-pill">{medicines.length} total</span>
        </div>
        {medicines.length === 0 ? (
          <div className="empty">No medicines match. Add one or clear the search.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pic</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Store</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((item) => {
                  const outOfStock = item.stock <= 0
                  const exp = expiryInfo(item.expiry)
                  return (
                  <tr
                    key={item.id}
                    className={item.id === medicine?.id ? 'is-selected' : ''}
                    onClick={() => selectMedicine(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      {item.imageUrl ? (
                        <img className="product-thumb" src={productImageSrc(item.imageUrl)} alt="" />
                      ) : (
                        <span className="product-thumb product-thumb-empty">No pic</span>
                      )}
                    </td>
                    <td><strong>{item.name}</strong><div className="sub">{item.brand} · {item.unitLabel}</div></td>
                    <td>{item.sku || '—'}</td>
                    <td>{item.storeName ?? '—'}</td>
                    <td>{item.category}</td>
                    <td>{money(item.price)}</td>
                    <td>{item.stock}</td>
                    <td>
                      {exp.state === 'ok' ? (
                        formatExpiry(item.expiry)
                      ) : (
                        <span style={{ color: '#d92d20', fontWeight: 600 }}>
                          {exp.label}
                          <div className="sub" style={{ color: '#d92d20' }}>{formatExpiry(item.expiry)}</div>
                        </span>
                      )}
                    </td>
                    <td>
                      {outOfStock && item.onlineSale && !item.held ? (
                        <span className="tag off">Out of stock</span>
                      ) : (
                        <span className={item.held || !item.onlineSale ? 'tag off' : 'tag on'}>
                          {item.held ? 'Held' : item.onlineSale ? 'In app' : 'Offline'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="btn-row" onClick={(event) => event.stopPropagation()}>
                        <button className="btn-soft" type="button" onClick={() => openEdit(item.id)}><Pencil size={14} /> Edit</button>
                        <button className="btn-soft" type="button" onClick={() => { selectMedicine(item.id); setRestockOpen(true) }}><PackagePlus size={14} /> Restock</button>
                        <button className="btn-soft" type="button" onClick={() => void deactivateMedicine(item.id)}><Pause size={14} /> Deactivate</button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {medicine ? <section className="manage-grid">
        <article className="card">
          <div className="block-head">
            <h2>Selected medicine</h2>
            <span className="count-pill">{index + 1} / {medicines.length}</span>
          </div>
          <div className="med-stage">
            <div className="selected-photo">
              {medicine.imageUrl ? (
                <img src={productImageSrc(medicine.imageUrl)} alt={medicine.name} />
              ) : (
                <div className="selected-photo-empty">No product picture yet</div>
              )}
              <button className="btn-soft photo-edit-btn" type="button" onClick={() => setImageEditOpen(true)}>
                <ImagePlus size={14} /> {medicine.imageUrl ? 'Edit pic' : 'Add pic'}
              </button>
            </div>
            <div className="flip-scene">
              <div className={flipped ? 'flipper is-flipped' : 'flipper'}>
                <div className="face">
                  <div className="face-top">
                    <span className="pill-lite">{medicine.held ? 'On hold' : medicine.onlineSale ? 'Active' : 'Hidden'}</span>
                    <b>hera.</b>
                  </div>
                  <div className="brand-name">{medicine.storeName ? `${medicine.storeName} · ` : ''}{medicine.brand} · {medicine.category}</div>
                  <h3>{medicine.name}</h3>
                  <div className="sku-row">
                    <div>
                      <small>EXP</small>
                      <b style={selectedExpiry && selectedExpiry.state !== 'ok' ? { color: '#d92d20' } : undefined}>
                        {formatExpiry(medicine.expiry)}
                      </b>
                    </div>
                    <div><small>STOCK</small><b>{medicine.stock}</b></div>
                  </div>
                </div>
                <div className="face back">
                  <div className="face-top"><span className="pill-lite">{medicine.unitLabel}</span><b>{money(medicine.price)}</b></div>
                  <h3>Batch {medicine.batch || '—'}</h3>
                  <p>SKU: {medicine.sku || '—'}</p>
                  <p>{medicine.description}</p>
                </div>
              </div>
            </div>
            <p className="hint">Select any row above, then flip the card for batch detail</p>
            <div className="switcher">
              {medicines.map((item) => (
                <button key={item.id} className={item.id === medicine.id ? 'is-on' : ''} type="button" onClick={() => selectMedicine(item.id)} title={item.name}>
                  {item.name.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="action-grid">
            <button type="button" onClick={() => void updateMedicine(medicine.id, { held: !medicine.held })}>
              <Pause size={16} /> {medicine.held ? 'Release' : 'Hold'}
            </button>
            <button type="button" onClick={() => setFlipped(true)}><Eye size={16} /> Show detail</button>
            <button type="button" onClick={() => setFlipped((value) => !value)}><RotateCw size={16} /> Flip card</button>
          </div>
        </article>
        <article className="card">
          <div className="block-head">
            <h2>Listing controls</h2>
            <span className={medicine.held || !medicine.onlineSale ? 'tag off' : 'tag on'}>
              {medicine.held ? 'Held' : medicine.onlineSale ? 'In app' : 'Offline'}
            </span>
          </div>
          <div className="control-row">
            <span className="control-ico"><ShoppingBag size={16} /></span>
            <div>
              <strong>Online sales</strong>
              <p>Show this medicine in the mobile app catalog.</p>
            </div>
            <Toggle on={medicine.onlineSale} label="Online sales" onClick={() => void updateMedicine(medicine.id, { onlineSale: !medicine.onlineSale })} />
          </div>
          <div className="control-row">
            <span className="control-ico"><Shield size={16} /></span>
            <div>
              <strong>Prescription required</strong>
              <p>Patients must upload a prescription before checkout.</p>
            </div>
            <Toggle on={medicine.rxRequired} label="Prescription required" onClick={() => void updateMedicine(medicine.id, { rxRequired: !medicine.rxRequired })} />
          </div>
          <div className="control-row">
            <span className="control-ico"><Bell size={16} /></span>
            <div>
              <strong>Low-stock alerts</strong>
              <p>Notify the team when stock falls under {threshold} units.</p>
            </div>
            <Toggle on={medicine.lowStockAlerts} label="Low-stock alerts" onClick={() => void updateMedicine(medicine.id, { lowStockAlerts: !medicine.lowStockAlerts })} />
          </div>
          <div className="profile-stat"><span>Price</span><b>{money(medicine.price)}</b></div>
          <div className="profile-stat"><span>Stock</span><b>{medicine.stock}</b></div>
          <div className="profile-stat"><span>Store</span><b>{medicine.storeName ?? '—'}</b></div>
        </article>
      </section> : null}

      {medicine ? <StockHistory key={medicine.id} productId={medicine.id} stock={medicine.stock} onChanged={() => void reload()} /> : null}

      <Modal open={open} title={editing ? 'Edit medicine' : 'New medicine'} subtitle="Prices and stock save to the shared catalog and appear in the app when online sales are on." onClose={closeForm}>
        <label className="field">Pharmacy
          <select
            value={form.storeId}
            disabled={Boolean(activeStoreId)}
            onChange={(event) => setForm({ ...form, storeId: event.target.value })}
          >
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
            ))}
          </select>
        </label>
        <label className="field">Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">SKU (required)
          <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="e.g. OK-001" />
        </label>
        <label className="field">Brand
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        </label>
        <label className="field">Generic name
          <input value={form.genericName} onChange={(event) => setForm({ ...form, genericName: event.target.value })} placeholder="e.g. Paracetamol" />
        </label>
        <label className="field">Strength (required)
          <input value={form.strength} onChange={(event) => setForm({ ...form, strength: event.target.value })} placeholder="e.g. 500mg" />
        </label>
        <label className="field">Category
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        </label>
        {form.category === '__custom__' ? (
          <label className="field">Custom category
            <input value={form.customCategory} onChange={(event) => setForm({ ...form, customCategory: event.target.value })} />
          </label>
        ) : null}
        <label className="field">Pack (required)
          <input value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} />
        </label>
        <label className="field">Price (required)
          <input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="e.g. 12.50" />
        </label>
        <label className="field">Stock (required)
          <input inputMode="numeric" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} placeholder="e.g. 20" />
        </label>
        <label className="field">Batch (required)
          <input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} placeholder="e.g. CC-26-041" />
        </label>
        <label className="field">Expiry (required)
          <input
            type="date"
            min={editing ? undefined : todayIso()}
            value={form.expiry}
            onChange={(event) => setForm({ ...form, expiry: event.target.value })}
          />
        </label>
        <label className="field">Description
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <label className="field">Image URL
          <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="/uploads/products/… or https://…" />
        </label>
        <label className="field">Upload image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (file && !validImage(file)) {
                event.target.value = ''
                setPendingImage(null)
                return
              }
              setPendingImage(file)
            }}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.onlineSale} onChange={(event) => setForm({ ...form, onlineSale: event.target.checked })} />
          Available in the app
        </label>
        <label className="check">
          <input type="checkbox" checked={form.rxRequired} onChange={(event) => setForm({ ...form, rxRequired: event.target.checked })} />
          Requires a prescription
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={closeForm}>Cancel</button>
          <button className="btn-dark" type="button" disabled={saving} onClick={() => { void saveMedicine() }}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add medicine'}
          </button>
        </div>
      </Modal>

      <Modal open={restockOpen} title="Restock medicine" subtitle="Units are added to stock and sync to the app immediately." onClose={() => setRestockOpen(false)}>
        <label className="field">Quantity to add
          <input inputMode="numeric" value={restockQty} onChange={(event) => setRestockQty(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setRestockOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" disabled={restocking} onClick={() => { void submitRestock() }}>
            {restocking ? 'Adding…' : 'Add stock'}
          </button>
        </div>
      </Modal>

      <Modal open={confirmDelete} title="Delete this medicine" subtitle="Past orders keep the name and price that were charged. The product is removed from the catalog and cannot be ordered again." onClose={() => setConfirmDelete(false)}>
        <p className="sub">Prefer Deactivate if you only want to hide it from the app while keeping the record.</p>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn-dark" type="button" onClick={() => { if (!medicine) return; void deleteMedicine(medicine.id).then((ok) => { if (ok) setConfirmDelete(false) }) }}>Delete</button>
        </div>
      </Modal>

      <Modal open={imageEditOpen} title="Edit product picture" subtitle="This picture shows in admin and in the mobile app catalog." onClose={() => setImageEditOpen(false)}>
        {medicine?.imageUrl ? (
          <img className="product-preview" src={productImageSrc(medicine.imageUrl)} alt={medicine.name} />
        ) : (
          <div className="selected-photo-empty">No picture yet</div>
        )}
        <label className="field">Choose a new image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const input = event.target
              const file = input.files?.[0] ?? null
              void changeMedicineImage(file).finally(() => {
                input.value = ''
              })
            }}
          />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setImageEditOpen(false)}>Close</button>
        </div>
      </Modal>
      <ProductImport open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}