import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { usesRemoteApi } from '../services/api'

export function SettingsPage() {
  const { snapshot, updateSettings, updatePharmacy, setPharmacyOpen, activeStore, activeStoreId } = useDashboard()
  const settings = snapshot!.settings
  const storeMeds = snapshot!.medicines.filter((medicine) => !activeStoreId || medicine.storeId === activeStoreId)
  const low = storeMeds.filter((medicine) => medicine.lowStockAlerts && medicine.stock <= settings.lowStockThreshold)
  const [threshold, setThreshold] = useState(String(settings.lowStockThreshold))
  const [name, setName] = useState(settings.storeName)
  const [details, setDetails] = useState({
    name: activeStore?.name ?? '',
    address: activeStore?.address ?? '',
    openUntil: activeStore?.openUntil ?? '',
    phone: activeStore?.phone ?? '',
    pharmacist: activeStore?.pharmacist ?? '',
  })

  useEffect(() => {
    setThreshold(String(settings.lowStockThreshold))
    setName(settings.storeName)
  }, [settings.lowStockThreshold, settings.storeName])

  useEffect(() => {
    if (!activeStore) return
    setDetails({
      name: activeStore.name,
      address: activeStore.address,
      openUntil: activeStore.openUntil,
      phone: activeStore.phone,
      pharmacist: activeStore.pharmacist,
    })
  }, [activeStore])

  if (activeStore && activeStoreId) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Store setup</h1>
            <p className="sub">Name, address, opening time, pharmacist, and whether this store accepts app orders.</p>
          </div>
        </div>
        <section className="split-2">
          <article className="card">
            <h2>{activeStore.name}</h2>
            <label className="field">Store name
              <input value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} />
            </label>
            <label className="field">Address
              <input value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} />
            </label>
            <label className="field">Open until
              <input value={details.openUntil} onChange={(event) => setDetails({ ...details, openUntil: event.target.value })} placeholder="9:00 PM" />
            </label>
            <label className="field">Phone
              <input value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} />
            </label>
            <label className="field">Pharmacist
              <input value={details.pharmacist} onChange={(event) => setDetails({ ...details, pharmacist: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => void updatePharmacy(activeStoreId, details)}
              >
                Save store
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Accepting app orders</strong>
                <p>{activeStore.isOpen ? 'Store is open in the mobile app.' : 'Closed — catalog hidden from checkout.'}</p>
              </div>
              <Toggle
                on={activeStore.isOpen}
                label={`Accepting orders at ${activeStore.name}`}
                onClick={() => void setPharmacyOpen(activeStoreId, !activeStore.isOpen)}
              />
            </div>
          </article>
          <article className="card">
            <h2>Stock alerts</h2>
            <label className="field">Low-stock threshold
              <input inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
            </label>
            <p className="sub">{low.length} watched {low.length === 1 ? 'product is' : 'products are'} at or under this threshold for this store.</p>
            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => void updateSettings({ lowStockThreshold: Number(threshold) })}
              >
                Save threshold
              </button>
            </div>
            <div className="profile-stat"><span>Store code</span><b>{activeStore.code ?? '—'}</b></div>
            <div className="profile-stat"><span>Products</span><b>{storeMeds.length}</b></div>
            <div className="profile-stat"><span>Orders today</span><b>{activeStore.ordersToday}</b></div>
          </article>
        </section>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Preferences for this admin session. Open a store from Stores to edit that pharmacy’s hours and details.</p>
        </div>
      </div>
      <section className="split-2">
        <article className="card">
          <h2>Store</h2>
          <label className="field">Display name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">Low-stock threshold
            <input inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </label>
          <p className="sub">{low.length} watched {low.length === 1 ? 'medicine is' : 'medicines are'} at or under this threshold.</p>
          <div className="modal-actions">
            <button
              className="btn-dark"
              type="button"
              onClick={() => void updateSettings({ storeName: name.trim() || settings.storeName, lowStockThreshold: Number(threshold) })}
            >
              Save changes
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Email alerts</strong>
              <p>Send low-stock and new prescription notices to {snapshot!.admin.email}.</p>
            </div>
            <Toggle on={settings.alertEmail} label="Email alerts" onClick={() => void updateSettings({ alertEmail: !settings.alertEmail })} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Auto-approve refills</strong>
              <p>Refills from known prescribers skip the manual queue.</p>
            </div>
            <Toggle on={settings.autoApproveRefills} label="Auto-approve refills" onClick={() => void updateSettings({ autoApproveRefills: !settings.autoApproveRefills })} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Show out-of-stock items</strong>
              <p>Keep unavailable medicines visible in the mobile catalog.</p>
            </div>
            <Toggle on={settings.showOutOfStock} label="Show out of stock" onClick={() => void updateSettings({ showOutOfStock: !settings.showOutOfStock })} />
          </div>
        </article>
        <article className="card">
          <h2>API connection</h2>
          <p className="sub">
            This dashboard is connected to the shared pharmacy API at http://localhost:4000.
          </p>
          <div className="profile-stat"><span>Mode</span><b>{usesRemoteApi() ? 'Remote API' : 'Local'}</b></div>
          <div className="profile-stat"><span>Signed in as</span><b>{snapshot!.admin.name}</b></div>
          <div className="profile-stat"><span>Role</span><b>{snapshot!.admin.role}</b></div>
          <div className="profile-stat"><span>Store name</span><b>{settings.storeName}</b></div>
        </article>
      </section>
    </>
  )
}
