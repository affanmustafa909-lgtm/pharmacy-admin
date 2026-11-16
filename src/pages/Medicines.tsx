import { useEffect, useMemo, useState } from 'react'
import { Copy, Eye, Pause, Plus, RotateCw, Shield, ShoppingBag, Bell, Pencil, Trash2, PackagePlus, ImagePlus } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ProductImport } from '../components/ProductImport'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { hashQuery } from '../nav'
import { API_BASE, apiFetch } from '../services/http'

const CATEGORY_OPTIONS = ['Medicines', 'Vitamins', 'Supplements', 'Devices']

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
  price: '12',
  unitLabel: '30 tablets',
  stock: '20',
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
  const [storeFilter, setStoreFilter] = useState(activeStoreId || presetStore || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(snapshot!.medicines[0]?.id ?? null)

  useEffect(() => {
    if (activeStoreId) setStoreFilter(activeStoreId)
    else if (presetStore) setStoreFilter(presetStore)
  }, [activeStoreId, presetStore])
  const [flipped, setFlipped] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockQty, setRestockQty] = useState('10')
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [imageEditOpen, setImageEditOpen] = useState(false)
  const [categories, setCategories] = useState<string[]>(CATEGORY_OPTIONS)
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low' | 'out'>('all')
  const threshold = snapshot!.settings.lowStockThreshold

  const medicines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return snapshot!.medicines.filter((item) => {
      if (storeFilter !== 'all' && item.storeId !== storeFilter) return false
      const outOfStock = item.stock === 0 && item.onlineSale && !item.held
      const low = item.lowStockAlerts && item.stock > 0 && item.stock <= threshold
      if (stockFilter === 'out' && !outOfStock) return false
      if (stockFilter === 'low' && !low) return false
      if (stockFilter === 'in_stock' && (outOfStock || item.stock === 0)) return false
      if (!q) return true
      return `${item.name} ${item.sku} ${item.brand} ${item.category}`.toLowerCase().includes(q)
    })
  }, [snapshot, storeFilter, search, stockFilter, threshold])

  const index = Math.max(0, medicines.findIndex((item) => item.id === selectedId))
  const medicine = medicines.find((item) => item.id === selectedId) ?? medicines[0]

  useEffect(() => {
    apiFetch('/admin/categories')
      .then((payload) => setCategories((payload as { categories: string[] }).categories))
      .catch(() => setCategories(CATEGORY_OPTIONS))
  }, [snapshot?.medicines.length])

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

  const low = medicines.filter((item) => item.lowStockAlerts && item.stock <= threshold)

  function selectMedicine(id: string) {
    setSelectedId(id)
    setFlipped(false)
  }

  async function uploadImage(productId: string, file: File) {
    const body = new FormData()
    body.append('image', file)
    const payload = (await apiFetch(`/admin/products/${productId}/image`, { method: 'POST', body })) as { imageUrl: string }
    return payload.imageUrl
  }

  async function changeMedicineImage(file: File | null) {
    if (!medicine || !file) return
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
    setEditing(false)
    setPendingImage(null)
    setForm({
      ...emptyForm(),
      storeId: activeStoreId || (storeFilter !== 'all' ? storeFilter : snapshot!.pharmacies[0]?.id ?? ''),
    })
    setOpen(true)
  }

  function openEdit(targetId?: string) {
    const target = targetId
      ? snapshot!.medicines.find((item) => item.id === targetId)
      : medicine
    if (!target) return
    setSelectedId(target.id)
    setEditing(true)
    setPendingImage(null)
    setForm({
      storeId: target.storeId ?? snapshot!.pharmacies[0]?.id ?? '',
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
      expiry: target.expiry,
      rxRequired: target.rxRequired,
      onlineSale: target.onlineSale,
      imageUrl: target.imageUrl ?? '',
    })
    setOpen(true)
  }

  function resolvedCategory() {
    return form.category === '__custom__' ? form.customCategory.trim() || 'Medicines' : form.category
  }

  async function saveMedicine() {
    if (!form.name.trim()) {
      notify('Enter a medicine name')
      return
    }
    const payload = {
      storeId: form.storeId || snapshot!.pharmacies[0]?.id || '',
      name: form.name.trim(),
      brand: form.brand.trim() || 'hera.',
      genericName: form.genericName.trim() || undefined,
      strength: form.strength.trim() || undefined,
      category: resolvedCategory(),
      price: Number(form.price),
      unitLabel: form.unitLabel.trim() || '1 unit',
      stock: Number(form.stock),
      sku: form.sku.trim() || undefined,
      description: form.description.trim() || undefined,
      batch: form.batch.trim() || undefined,
      expiry: form.expiry.trim() || undefined,
      rxRequired: form.rxRequired,
      onlineSale: form.onlineSale,
      imageUrl: form.imageUrl.trim() || undefined,
    }
    if (editing && medicine) {
      const ok = await updateMedicine(medicine.id, payload)
      if (!ok) return
      if (pendingImage) {
        try {
          await uploadImage(medicine.id, pendingImage)
          await reload()
          notify('Image uploaded')
        } catch (error: unknown) {
          notify(error instanceof Error ? error.message : 'Image upload failed')
        }
      }
      setOpen(false)
      setPendingImage(null)
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
    setStoreFilter(payload.storeId || 'all')
    setSelectedId(id)
    setOpen(false)
    setPendingImage(null)
  }

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
              {snapshot!.pharmacies.map((pharmacy) => (
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
          placeholder="Search name, SKU, brand…"
          aria-label="Search medicines"
        />
        {(['all', 'in_stock', 'low', 'out'] as const).map((filter) => (
          <button key={filter} className={stockFilter === filter ? 'chip is-on' : 'chip'} type="button" onClick={() => setStockFilter(filter)}>
            {filter === 'all' ? 'All stock' : filter === 'in_stock' ? 'In stock' : filter === 'low' ? 'Low' : 'Out of stock'}
          </button>
        ))}
        <span className="count-pill">{medicines.length} shown{low.length ? ` · ${low.length} low` : ''}</span>
      </div>

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
                  <th>Status</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((item) => {
                  const outOfStock = item.stock === 0 && item.onlineSale && !item.held
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
                    <td>{item.sku}</td>
                    <td>{item.storeName ?? '—'}</td>
                    <td>{item.category}</td>
                    <td>{money(item.price)}</td>
                    <td>{item.stock}</td>
                    <td>
                      {outOfStock ? (
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
                    <div><small>SKU</small><b>{medicine.sku}</b></div>
                    <div><small>EXP</small><b>{medicine.expiry}</b></div>
                    <div><small>STOCK</small><b>{medicine.stock}</b></div>
                  </div>
                </div>
                <div className="face back">
                  <div className="face-top"><span className="pill-lite">{medicine.unitLabel}</span><b>{money(medicine.price)}</b></div>
                  <h3>Batch {medicine.batch}</h3>
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
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(medicine.sku).then(
                  () => notify(`Copied ${medicine.sku}`),
                  () => notify('Could not copy the SKU'),
                )
              }}
            >
              <Copy size={16} /> Copy SKU
            </button>
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

      <Modal open={open} title={editing ? 'Edit medicine' : 'New medicine'} subtitle="Prices and stock save to the shared catalog and appear in the app when online sales are on." onClose={() => setOpen(false)}>
        <label className="field">Pharmacy
          <select
            value={form.storeId}
            disabled={Boolean(activeStoreId)}
            onChange={(event) => setForm({ ...form, storeId: event.target.value })}
          >
            {snapshot!.pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
            ))}
          </select>
        </label>
        <label className="field">Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">Brand
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        </label>
        <label className="field">Generic name
          <input value={form.genericName} onChange={(event) => setForm({ ...form, genericName: event.target.value })} placeholder="e.g. Paracetamol" />
        </label>
        <label className="field">Strength
          <input value={form.strength} onChange={(event) => setForm({ ...form, strength: event.target.value })} placeholder="e.g. 500mg" />
        </label>
        <label className="field">SKU
          <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Auto if blank" />
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
        <label className="field">Pack
          <input value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} />
        </label>
        <label className="field">Price
          <input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
        </label>
        <label className="field">Stock
          <input inputMode="numeric" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
        </label>
        <label className="field">Batch
          <input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} placeholder="e.g. CC-26-041" />
        </label>
        <label className="field">Expiry
          <input value={form.expiry} onChange={(event) => setForm({ ...form, expiry: event.target.value })} placeholder="e.g. 08/27" />
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
          <button className="btn-soft" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" onClick={() => { void saveMedicine() }}>
            {editing ? 'Save changes' : 'Add medicine'}
          </button>
        </div>
      </Modal>

      <Modal open={restockOpen} title="Restock medicine" subtitle="Units are added to stock and sync to the app immediately." onClose={() => setRestockOpen(false)}>
        <label className="field">Quantity to add
          <input inputMode="numeric" value={restockQty} onChange={(event) => setRestockQty(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setRestockOpen(false)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              if (!medicine) return
              const quantity = Number(restockQty)
              if (!Number.isFinite(quantity) || quantity <= 0) {
                notify('Enter a positive quantity')
                return
              }
              void restock(medicine.id, quantity).then((ok) => {
                if (ok) setRestockOpen(false)
              })
            }}
          >
            Add stock
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
              const file = event.target.files?.[0] ?? null
              void changeMedicineImage(file)
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
