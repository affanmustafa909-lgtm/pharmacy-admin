import { useEffect, useMemo, useState } from 'react'
import { MapPin, Phone, Star } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { money, storeStatusLabel } from '../lib/format'
import { apiFetch } from '../services/http'
import type { PharmacyFee, StoreStatus } from '../types'

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function phoneHint(phone: string) {
  if (!phone.trim()) return ''
  return /^\+?[\d\s().-]{7,}$/.test(phone.trim()) ? '' : 'Use digits, spaces, or +country code.'
}

function codeConflict(code: string, pharmacies: { id: string; code?: string }[], ignoreId = '') {
  const needle = normalizeCode(code)
  if (!needle) return false
  return pharmacies.some((item) => item.id !== ignoreId && normalizeCode(item.code ?? '') === needle)
}

interface ServiceRow { id: string; name: string; description: string; active: boolean }
interface RuleRow { id: string; kind: string; label: string; mode: string; amount: number; percentBase: string | null; deliveryType: string | null; active: boolean }
interface RiderRow { id: string; name: string; phone: string; vehicle: string; notes: string; active: boolean }

function percentBaseLabel(base: string | null | undefined) {
  switch (base) {
    case 'PRODUCT_SUBTOTAL':
      return 'product subtotal'
    case 'DELIVERY':
      return 'delivery'
    case 'SERVICE':
      return 'service'
    case 'PRODUCT_AND_DELIVERY':
      return 'products + delivery'
    default:
      return 'selected base'
  }
}

function feeSummary(fee: Pick<PharmacyFee, 'label' | 'kind' | 'mode' | 'amount' | 'percentBase' | 'deliveryType'>) {
  const kind = fee.kind === 'DELIVERY' ? 'Delivery' : fee.kind === 'SERVICE' ? 'Service' : fee.kind
  const amount =
    fee.mode === 'PERCENT'
      ? `${fee.amount}% of ${percentBaseLabel(fee.percentBase)}`
      : money(fee.amount)
  const delivery = fee.deliveryType ? ` ┬╖ ${fee.deliveryType}` : ''
  return { kind, amount, delivery, label: fee.label }
}

const emptyCreate = () => ({
  code: '',
  name: '',
  address: '',
  openUntil: '9:00 PM',
  phone: '',
  pharmacist: '',
  standardDelivery: '3.50',
  expressDelivery: '6.50',
})

export function PharmaciesPage() {
  const {
    snapshot,
    setPharmacyOpen,
    createPharmacy,
    deletePharmacy,
    notify,
    reload,
    openStore,
    activeStore,
    activeStoreId,
    go,
    updatePharmacy,
  } = useDashboard()
  const isMainAdmin = snapshot!.admin.roleKey !== 'STAFF'
  const deskStoreId = activeStoreId
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [riders, setRiders] = useState<RiderRow[]>([])
  const [serviceName, setServiceName] = useState('')
  const [rule, setRule] = useState({ kind: 'DELIVERY', label: '', mode: 'FIXED', amount: '0', percentBase: 'PRODUCT_SUBTOTAL', deliveryType: 'standard' })
  const [riderForm, setRiderForm] = useState({ name: '', phone: '', vehicle: 'Bike', notes: '' })
  const [storeQuery, setStoreQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoreStatus | 'all'>('all')
  const [saveAsDraft, setSaveAsDraft] = useState(true)

  useEffect(() => {
    if (!deskStoreId) return
    let cancel = false
    Promise.all([
      apiFetch(`/admin/services?storeId=${encodeURIComponent(deskStoreId)}`),
      apiFetch(`/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`),
    ])
      .then(([servicesPayload, ridersPayload]) => {
        if (cancel) return
        const data = servicesPayload as { services: ServiceRow[]; rules: RuleRow[] }
        setServices(data.services)
        setRules(data.rules)
        setRiders((ridersPayload as { riders: RiderRow[] }).riders)
      })
      .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not load delivery setup'))
    return () => {
      cancel = true
    }
  }, [deskStoreId, notify])

  async function refresh() {
    if (!deskStoreId) return
    const [data, ridersPayload] = await Promise.all([
      apiFetch(`/admin/services?storeId=${encodeURIComponent(deskStoreId)}`) as Promise<{ services: ServiceRow[]; rules: RuleRow[] }>,
      apiFetch(`/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`) as Promise<{ riders: RiderRow[] }>,
    ])
    setServices(data.services)
    setRules(data.rules)
    setRiders(ridersPayload.riders)
    await reload()
  }

  async function refreshRiders() {
    if (!deskStoreId) return
    const ridersPayload = (await apiFetch(`/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`)) as { riders: RiderRow[] }
    setRiders(ridersPayload.riders)
  }

  const listedStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase()
    return snapshot!.pharmacies.filter((item) => {
      const status = item.status ?? 'active'
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!q) return true
      return `${item.name} ${item.code ?? ''} ${item.address}`.toLowerCase().includes(q)
    })
  }, [snapshot, storeQuery, statusFilter])

  const createCodeTaken = codeConflict(createForm.code, snapshot!.pharmacies)
  const createPhoneIssue = phoneHint(createForm.phone)

  async function setStoreStatus(id: string, status: StoreStatus, acceptingOrders?: boolean) {
    await updatePharmacy(id, { status, acceptingOrders })
  }

  if (activeStore && deskStoreId) {
    const productCount = snapshot!.medicines.filter((med) => med.storeId === deskStoreId).length
    const lowStock = snapshot!.medicines.filter(
      (med) => med.storeId === deskStoreId && med.lowStockAlerts && med.stock <= snapshot!.settings.lowStockThreshold,
    ).length
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Delivery</h1>
            <p className="sub">
              <strong>{activeStore.code ?? 'ΓÇö'}</strong> ┬╖ {activeStore.name} ┬╖ riders, fees, and open hours ┬╖ {productCount} products
              {lowStock ? ` ┬╖ ${lowStock} low stock` : ''}
            </p>
          </div>
          <div className="btn-row">
            <span className={`tag ${activeStore.status === 'paused' ? 'off' : 'on'}`}>{storeStatusLabel(activeStore.status)}</span>
            <button className="btn-soft" type="button" onClick={() => go('medicines')}>Products</button>
            <button className="btn-soft" type="button" onClick={() => go('team')}>Team</button>
            <button className="btn-soft" type="button" onClick={() => go('settings')}>Store details</button>
          </div>
        </div>

        <section className="split-2">
          <article className="card">
            <div className="block-head">
              <h2>Riders</h2>
              <span className="count-pill">{riders.filter((item) => item.active).length} active ┬╖ {riders.length} total</span>
            </div>
            {riders.length === 0 ? (
              <p className="sub">No riders yet ΓÇö add who delivers for this store.</p>
            ) : (
              riders.map((rider) => (
                <div className="fee-row" key={rider.id}>
                  <div>
                    <strong>{rider.name}</strong>
                    <p className="sub">
                      {rider.vehicle}{rider.phone ? ` ┬╖ ${rider.phone}` : ''}{rider.notes ? ` ┬╖ ${rider.notes}` : ''}
                    </p>
                  </div>
                  <div className="btn-row">
                    <span className={rider.active ? 'tag on' : 'tag off'}>{rider.active ? 'Active' : 'Off'}</span>
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        void apiFetch(`/admin/riders/${rider.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ active: !rider.active }),
                        })
                          .then(refreshRiders)
                          .then(() => notify(rider.active ? 'Rider set off-duty' : 'Rider set active'))
                          .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not update rider'))
                      }}
                    >
                      {rider.active ? 'Set off' : 'Activate'}
                    </button>
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        if (!confirm(`Remove ${rider.name}?`)) return
                        void apiFetch(`/admin/riders/${rider.id}`, { method: 'DELETE' })
                          .then(refreshRiders)
                          .then(() => notify('Rider removed'))
                          .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not remove rider'))
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="card">
            <h2>Add rider</h2>
            <label className="field">Name
              <input value={riderForm.name} onChange={(event) => setRiderForm({ ...riderForm, name: event.target.value })} placeholder="Alex Rivera" />
            </label>
            <label className="field">Phone
              <input value={riderForm.phone} onChange={(event) => setRiderForm({ ...riderForm, phone: event.target.value })} placeholder="+1 (212) 555-0201" />
            </label>
            <label className="field">Vehicle
              <select value={riderForm.vehicle} onChange={(event) => setRiderForm({ ...riderForm, vehicle: event.target.value })}>
                <option value="Bike">Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Car">Car</option>
                <option value="Walk">Walk</option>
              </select>
            </label>
            <label className="field">Notes
              <input value={riderForm.notes} onChange={(event) => setRiderForm({ ...riderForm, notes: event.target.value })} placeholder="Evening shift, express onlyΓÇª" />
            </label>
            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  if (!riderForm.name.trim()) {
                    notify('Enter rider name')
                    return
                  }
                  void apiFetch('/admin/riders', {
                    method: 'POST',
                    body: JSON.stringify({
                      storeId: deskStoreId,
                      name: riderForm.name.trim(),
                      phone: riderForm.phone.trim(),
                      vehicle: riderForm.vehicle,
                      notes: riderForm.notes.trim(),
                    }),
                  })
                    .then(async () => {
                      setRiderForm({ name: '', phone: '', vehicle: 'Bike', notes: '' })
                      await refreshRiders()
                      notify('Rider added')
                    })
                    .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not add rider'))
                }}
              >
                Add rider
              </button>
            </div>
          </article>
        </section>

        <section className="split-2 mt">
          <article className="card">
            <div className="block-head">
              <h2>Store snapshot</h2>
              <span className={activeStore.isOpen ? 'tag on' : 'tag off'}>{activeStore.isOpen ? 'Open' : 'Closed'}</span>
            </div>
            <p className="sub"><MapPin size={13} /> {activeStore.address}</p>
            <div className="profile-stat"><span>Store code</span><b>{activeStore.code ?? 'ΓÇö'}</b></div>
            <div className="profile-stat"><span>Pharmacist</span><b>{activeStore.pharmacist || 'ΓÇö'}</b></div>
            <div className="profile-stat"><span>Phone</span><b>{activeStore.phone || 'ΓÇö'}</b></div>
            <div className="profile-stat"><span>Orders today</span><b>{activeStore.ordersToday}</b></div>
            <div className="profile-stat"><span>Revenue today</span><b>{money(activeStore.revenueToday, 0)}</b></div>
            <div className="control-row mt">
              <span className="control-ico"><Phone size={16} /></span>
              <div>
                <strong>Accepting app orders</strong>
                <p>{activeStore.isOpen ? 'Products show in the app for this store.' : 'Closed ΓÇö hidden from mobile checkout.'}</p>
              </div>
              <Toggle on={activeStore.isOpen} label={`Accepting orders at ${activeStore.name}`} onClick={() => void setPharmacyOpen(deskStoreId, !activeStore.isOpen)} />
            </div>
          </article>

          <article className="card">
            <div className="block-head">
              <h2>Current delivery charges</h2>
              <span className="count-pill">{rules.length ? `${rules.length} set` : 'None'}</span>
            </div>
            {rules.length === 0 ? (
              <p className="sub">No delivery or service fee set yet.</p>
            ) : (
              rules.map((item) => {
                const summary = feeSummary(item)
                return (
                  <div className="fee-row" key={item.id}>
                    <div>
                      <strong>{summary.label}</strong>
                      <p className="sub">{summary.kind}{summary.delivery}</p>
                    </div>
                    <div className="btn-row">
                      <b className={item.mode === 'PERCENT' ? 'fee-percent' : ''}>{summary.amount}</b>
                      <button
                        className="btn-soft"
                        type="button"
                        onClick={() => {
                          void apiFetch(`/admin/charge-rules/${item.id}`, { method: 'DELETE' }).then(refresh).then(() => notify('Charge removed'))
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            )}
            {services.map((service) => (
              <div className="profile-stat" key={service.id}>
                <span>{service.name}</span>
                <button
                  className="btn-soft"
                  type="button"
                  onClick={() => {
                    void apiFetch(`/admin/services/${service.id}`, { method: 'DELETE' }).then(refresh).then(() => notify('Service removed'))
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </article>
        </section>

        <section className="split-2 mt">
          <article className="card">
            <h2>Add service</h2>
            <label className="field">Service name
              <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Consultation" />
            </label>
            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  if (!serviceName.trim()) return
                  void apiFetch('/admin/services', {
                    method: 'POST',
                    body: JSON.stringify({ storeId: deskStoreId, name: serviceName.trim() }),
                  }).then(async () => {
                    setServiceName('')
                    await refresh()
                    notify('Service added')
                  })
                }}
              >
                Add service
              </button>
            </div>
          </article>

          <article className="card">
            <h2>Add delivery / fee</h2>
            <label className="field">Charge label
              <input value={rule.label} onChange={(event) => setRule({ ...rule, label: event.target.value })} placeholder="Standard delivery" />
            </label>
            <label className="field">Kind
              <select value={rule.kind} onChange={(event) => setRule({ ...rule, kind: event.target.value })}>
                <option value="DELIVERY">Delivery</option>
                <option value="SERVICE">Service</option>
                <option value="BFP">BFP</option>
              </select>
            </label>
            <label className="field">Mode
              <select value={rule.mode} onChange={(event) => setRule({ ...rule, mode: event.target.value })}>
                <option value="FIXED">Fixed amount</option>
                <option value="PERCENT">Percent (%)</option>
              </select>
            </label>
            <label className="field">{rule.mode === 'PERCENT' ? 'Fee percent (%)' : 'Fixed amount'}
              <input inputMode="decimal" value={rule.amount} onChange={(event) => setRule({ ...rule, amount: event.target.value })} />
            </label>
            {rule.mode === 'PERCENT' ? (
              <label className="field">Percentage of
                <select value={rule.percentBase} onChange={(event) => setRule({ ...rule, percentBase: event.target.value })}>
                  <option value="PRODUCT_SUBTOTAL">Product subtotal</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="SERVICE">Service</option>
                  <option value="PRODUCT_AND_DELIVERY">Products plus delivery</option>
                  <option value="SUBTOTAL_BEFORE_BFP">Subtotal before BFP</option>
                </select>
              </label>
            ) : null}
            {rule.kind === 'DELIVERY' ? (
              <label className="field">Delivery type
                <select value={rule.deliveryType} onChange={(event) => setRule({ ...rule, deliveryType: event.target.value })}>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="pickup">Store pickup</option>
                  <option value="">Any</option>
                </select>
              </label>
            ) : null}
            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  if (!rule.label.trim()) return
                  void apiFetch('/admin/charge-rules', {
                    method: 'POST',
                    body: JSON.stringify({
                      storeId: deskStoreId,
                      kind: rule.kind,
                      label: rule.label.trim(),
                      mode: rule.mode,
                      amount: Number(rule.amount),
                      percentBase: rule.mode === 'PERCENT' ? rule.percentBase : null,
                      deliveryType: rule.kind === 'DELIVERY' && rule.deliveryType ? rule.deliveryType : null,
                    }),
                  }).then(async () => {
                    setRule({ ...rule, label: '' })
                    await refresh()
                    notify('Delivery charge saved')
                  }).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not save the charge'))
                }}
              >
                Add charge
              </button>
            </div>
          </article>
        </section>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stores</h1>
          <p className="sub">
            Open any store to manage its products, stock, expiry, opening time, and delivery ΓÇö full header and sidebar for that store.
          </p>
        </div>
        {isMainAdmin ? (
          <button className="btn-dark" type="button" onClick={() => { setCreateForm(emptyCreate()); setSaveAsDraft(true); setCreateOpen(true) }}>
            Add store
          </button>
        ) : null}
      </div>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <input
          className="select"
          style={{ minWidth: 220 }}
          value={storeQuery}
          onChange={(event) => setStoreQuery(event.target.value)}
          placeholder="Search name or code"
          aria-label="Search stores"
        />
        {(['all', 'draft', 'active', 'paused', 'archived'] as const).map((filter) => (
          <button
            key={filter}
            className={statusFilter === filter ? 'chip is-on' : 'chip'}
            type="button"
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'all' ? 'All' : storeStatusLabel(filter)}
          </button>
        ))}
      </div>
      <section className="pharmacy-grid">
        {listedStores.map((item) => {
          const storeStatus = item.status ?? 'active'
          const fees = item.fees ?? []
          const percentFees = fees.filter((fee) => fee.mode === 'PERCENT')
          const productCount = snapshot!.medicines.filter((med) => med.storeId === item.id).length
          const lowStock = snapshot!.medicines.filter(
            (med) => med.storeId === item.id && med.lowStockAlerts && med.stock <= snapshot!.settings.lowStockThreshold,
          ).length
          return (
            <article key={item.id} className="card pharm lift">
              <div className="block-head">
                <span className="stars"><Star size={14} /> {item.rating.toFixed(1)}</span>
                <span className={item.isOpen ? 'tag on' : 'tag off'}>{item.isOpen ? 'Open' : 'Closed'}</span>
                <span className={storeStatus === 'active' ? 'tag on' : 'tag off'}>{storeStatusLabel(storeStatus)}</span>
              </div>
              <h3>{item.name}</h3>
              {item.code ? <p className="kicker">{item.code}</p> : null}
              <p className="sub"><MapPin size={13} /> {item.address}</p>
              <div className="profile-stat"><span>Store code</span><b>{item.code ?? 'ΓÇö'}</b></div>
              <div className="profile-stat"><span>Open until</span><b>{item.openUntil}</b></div>
              <div className="profile-stat"><span>Pharmacist</span><b>{item.pharmacist}</b></div>
              <div className="profile-stat"><span>Phone</span><b>{item.phone}</b></div>
              <div className="profile-stat"><span>Products</span><b>{productCount}{lowStock ? ` ┬╖ ${lowStock} low` : ''}</b></div>
              <div className="profile-stat"><span>Orders today</span><b>{item.ordersToday}</b></div>
              <div className="profile-stat"><span>Revenue today</span><b>{money(item.revenueToday, 0)}</b></div>

              <div className="fee-box">
                <div className="block-head" style={{ marginBottom: 8 }}>
                  <strong>Delivery & fees</strong>
                  <span className="count-pill">{fees.length ? `${fees.length} set` : 'None'}{percentFees.length ? ` ┬╖ ${percentFees.length}%` : ''}</span>
                </div>
                {fees.length === 0 ? (
                  <p className="sub">No delivery or service fee set yet.</p>
                ) : (
                  fees.map((fee) => {
                    const summary = feeSummary(fee)
                    return (
                      <div className="fee-row" key={fee.id}>
                        <div>
                          <strong>{summary.label}</strong>
                          <p className="sub">{summary.kind}{summary.delivery}</p>
                        </div>
                        <b className={fee.mode === 'PERCENT' ? 'fee-percent' : ''}>{summary.amount}</b>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="control-row">
                <span className="control-ico"><Phone size={16} /></span>
                <div>
                  <strong>Accepting app orders</strong>
                  <p>{item.isOpen ? 'Store open ΓÇö products show in the app.' : 'Closed ΓÇö hidden from mobile checkout.'}</p>
                </div>
                <Toggle on={item.isOpen} label={`Accepting orders at ${item.name}`} onClick={() => void setPharmacyOpen(item.id, !item.isOpen)} />
              </div>
              <div className="btn-row mt">
                <button className="btn-dark" type="button" onClick={() => openStore(item.id, 'overview')}>
                  Open store
                </button>
                {isMainAdmin ? (
                  <>
                    {storeStatus === 'draft' ? (
                      <button className="btn-soft" type="button" onClick={() => void setStoreStatus(item.id, 'active', true)}>
                        Publish
                      </button>
                    ) : null}
                    {storeStatus === 'active' ? (
                      <button className="btn-soft" type="button" onClick={() => void setStoreStatus(item.id, 'paused', false)}>
                        Pause orders
                      </button>
                    ) : null}
                    {storeStatus === 'paused' ? (
                      <button className="btn-soft" type="button" onClick={() => void setStoreStatus(item.id, 'active', true)}>
                        Resume
                      </button>
                    ) : null}
                    {storeStatus !== 'archived' ? (
                      <button className="btn-soft" type="button" onClick={() => void setStoreStatus(item.id, 'archived', false)}>
                        Archive
                      </button>
                    ) : null}
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        if (!confirm(`Delete or close ${item.name}? Stores with orders are closed instead of deleted.`)) return
                        void deletePharmacy(item.id)
                      }}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>

      <Modal open={createOpen} title="Add store" subtitle="New stores start as draft until you publish. Delivery fees are created automatically when you publish." onClose={() => setCreateOpen(false)}>
        <label className="field">Store name
          <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Ali Pharmacy" />
        </label>
        <label className="field">Store code
          <input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="ALI" />
        </label>
        {createCodeTaken ? <p className="sub" style={{ color: 'var(--danger, #c2410c)' }}>That code is already used ΓÇö pick another.</p> : null}
        {createPhoneIssue ? <p className="sub" style={{ color: 'var(--danger, #c2410c)' }}>{createPhoneIssue}</p> : null}
        <label className="check">
          <input type="checkbox" checked={saveAsDraft} onChange={(event) => setSaveAsDraft(event.target.checked)} />
          Save as draft (recommended until hours and catalog are ready)
        </label>
        <label className="field">Address
          <input value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
        </label>
        <label className="field">Open until
          <input value={createForm.openUntil} onChange={(e) => setCreateForm({ ...createForm, openUntil: e.target.value })} placeholder="9:00 PM" />
        </label>
        <label className="field">Phone
          <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
        </label>
        <label className="field">Pharmacist
          <input value={createForm.pharmacist} onChange={(e) => setCreateForm({ ...createForm, pharmacist: e.target.value })} />
        </label>
        <label className="field">Standard delivery ($)
          <input value={createForm.standardDelivery} onChange={(e) => setCreateForm({ ...createForm, standardDelivery: e.target.value })} />
        </label>
        <label className="field">Express delivery ($)
          <input value={createForm.expressDelivery} onChange={(e) => setCreateForm({ ...createForm, expressDelivery: e.target.value })} />
        </label>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={(event) => {
              if (!createForm.name.trim() || !createForm.code.trim() || !createForm.address.trim()) {
                notify('Enter store name, code, and address')
                return
              }
              if (createCodeTaken) {
                notify('Store code must be unique')
                return
              }
              if (createPhoneIssue) {
                notify(createPhoneIssue)
                return
              }
              const button = event.currentTarget
              button.disabled = true
              void createPharmacy({
                code: normalizeCode(createForm.code),
                name: createForm.name.trim(),
                address: createForm.address.trim(),
                openUntil: createForm.openUntil.trim() || '9:00 PM',
                phone: createForm.phone.trim(),
                pharmacist: createForm.pharmacist.trim(),
                standardDelivery: Number(createForm.standardDelivery) || 0,
                expressDelivery: Number(createForm.expressDelivery) || 0,
                status: saveAsDraft ? 'draft' : 'active',
              })
                .then((id) => {
                  if (!id) return
                  setCreateOpen(false)
                  setCreateForm(emptyCreate())
                  openStore(id, 'overview')
                })
                .finally(() => {
                  button.disabled = false
                })
            }}
          >
            {saveAsDraft ? 'Save draft & open' : 'Create & open'}
          </button>
        </div>
      </Modal>
    </>
  )
}
