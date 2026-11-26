import { useEffect, useMemo, useState } from 'react'
import { MapPin, Phone, Star } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { money, storeStatusLabel } from '../lib/format'
import { API_BASE, apiFetch } from '../services/http'
import type { PharmacyFee, StoreStatus } from '../types'

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function phoneHint(phone: string) {
  if (!phone.trim()) return ''
  return /^\+?[\d\s().-]{7,}$/.test(phone.trim())
    ? ''
    : 'Use digits, spaces, or +country code.'
}

function codeConflict(
  code: string,
  pharmacies: { id: string; code?: string }[],
  ignoreId = '',
) {
  const needle = normalizeCode(code)
  if (!needle) return false

  return pharmacies.some(
    (item) =>
      item.id !== ignoreId &&
      normalizeCode(item.code ?? '') === needle,
  )
}

interface ServiceRow {
  id: string
  name: string
  description: string
  active: boolean
}

interface RuleRow {
  id: string
  kind: string
  label: string
  mode: string
  amount: number
  percentBase: string | null
  deliveryType: string | null
  minDistanceKm?: number | null
  maxDistanceKm?: number | null
  perKmRate?: number | null
  active: boolean
}

interface RiderRow {
  id: string
  name: string
  phone: string
  vehicle: string
  notes: string
  active: boolean
  email?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  idDocumentUrl?: string
  licenseDocumentUrl?: string
  vehicleDocumentUrl?: string
  preferredStoreName?: string | null
  storeId?: string | null
}

function docUrl(path?: string) {
  if (!path) return ''
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

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

function feeSummary(
  fee: Pick<
    PharmacyFee,
    'label' | 'kind' | 'mode' | 'amount' | 'percentBase' | 'deliveryType' | 'minDistanceKm' | 'maxDistanceKm' | 'perKmRate'
  >,
) {
  const kind =
    fee.kind === 'DELIVERY'
      ? 'Delivery'
      : fee.kind === 'SERVICE'
        ? 'Service'
        : fee.kind

  const perKmSuffix =
    fee.kind === 'DELIVERY' && fee.perKmRate && fee.perKmRate > 0
      ? ` + ${money(fee.perKmRate)}/km`
      : ''

  const amount =
    fee.mode === 'PERCENT'
      ? `${fee.amount}% of ${percentBaseLabel(fee.percentBase)}${perKmSuffix}`
      : `${money(fee.amount)}${perKmSuffix}`

  const distanceRange =
    fee.kind === 'DELIVERY' && (fee.minDistanceKm != null || fee.maxDistanceKm != null)
      ? fee.maxDistanceKm != null
        ? ` · ${fee.minDistanceKm ?? 0}–${fee.maxDistanceKm} km`
        : ` · ${fee.minDistanceKm ?? 0}+ km`
      : ''

  const delivery = `${fee.deliveryType ? ` · ${fee.deliveryType}` : ''}${distanceRange}`

  return {
    kind,
    amount,
    delivery,
    label: fee.label,
  }
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

const scheduleDays = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]
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
  const [pendingRiders, setPendingRiders] = useState<RiderRow[]>([])

  const [serviceName, setServiceName] = useState('')

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [rule, setRule] = useState({
    kind: 'DELIVERY',
    label: '',
    mode: 'FIXED',
    amount: '2.00',
    percentBase: 'PRODUCT_SUBTOTAL',
    deliveryType: 'standard',
    minDistanceKm: '0',
    maxDistanceKm: '3',
    perKmRate: '0',
  })

  const [riderForm, setRiderForm] = useState({
    name: '',
    phone: '',
    vehicle: 'Bike',
    notes: '',
  })

  const [areaForm, setAreaForm] = useState({
    city: '',
    country: '',
    maxDeliveryDistanceKm: '30',
  })
  const [weeklyHours, setWeeklyHours] = useState<
    Record<string, { open: string; close: string } | null>
  >({})
  const [closedDays, setClosedDays] = useState<string[]>([])
  const [holidayHoursText, setHolidayHoursText] = useState('[]')

  useEffect(() => {
    if (!activeStore) return
    setAreaForm({
      city: activeStore.city ?? '',
      country: activeStore.country ?? '',
      maxDeliveryDistanceKm: String(activeStore.maxDeliveryDistanceKm ?? 30),
    })
  }, [activeStore?.id, activeStore?.city, activeStore?.country, activeStore?.maxDeliveryDistanceKm])

  useEffect(() => {
    if (!activeStore) return
    setWeeklyHours(activeStore.weeklyHours ?? {})
    setClosedDays(activeStore.closedDays ?? [])
    setHolidayHoursText(JSON.stringify(activeStore.holidayHours ?? [], null, 2))
  }, [activeStore?.id])
  const [storeQuery, setStoreQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoreStatus | 'all'>('all')
  const [saveAsDraft, setSaveAsDraft] = useState(true)

  async function refreshPendingRiders() {
    const payload = (await apiFetch('/admin/riders?pending=1')) as {
      riders: RiderRow[]
    }
    setPendingRiders(payload.riders)
  }

  useEffect(() => {
    let cancel = false
    void apiFetch('/admin/riders?pending=1')
      .then((payload) => {
        if (cancel) return
        setPendingRiders((payload as { riders: RiderRow[] }).riders)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [deskStoreId])

  useEffect(() => {
    if (!deskStoreId) return

    let cancel = false

    Promise.all([
      apiFetch(`/admin/services?storeId=${encodeURIComponent(deskStoreId)}`),
      apiFetch(`/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`),
    ])
      .then(([servicesPayload, ridersPayload]) => {
        if (cancel) return

        const data = servicesPayload as {
          services: ServiceRow[]
          rules: RuleRow[]
        }

        setServices(data.services)
        setRules(data.rules)

        setRiders(
          (ridersPayload as { riders: RiderRow[] }).riders,
        )
      })
      .catch((error: unknown) =>
        notify(
          error instanceof Error
            ? error.message
            : 'Could not load delivery setup',
        ),
      )

    return () => {
      cancel = true
    }
  }, [deskStoreId, notify])

  async function refresh() {
    if (!deskStoreId) return

    const [data, ridersPayload] = await Promise.all([
      apiFetch(
        `/admin/services?storeId=${encodeURIComponent(deskStoreId)}`,
      ) as Promise<{
        services: ServiceRow[]
        rules: RuleRow[]
      }>,

      apiFetch(
        `/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`,
      ) as Promise<{ riders: RiderRow[] }>,
    ])

    setServices(data.services)
    setRules(data.rules)
    setRiders(ridersPayload.riders)

    await reload()
  }

  async function refreshRiders() {
    if (!deskStoreId) return

    const ridersPayload = (await apiFetch(
      `/admin/riders?storeId=${encodeURIComponent(deskStoreId)}`,
    )) as { riders: RiderRow[] }

    setRiders(ridersPayload.riders)
  }

  const listedStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase()

    return snapshot!.pharmacies.filter((item) => {
      const status = item.status ?? 'active'

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false
      }

      if (!q) return true

      return `${item.name} ${item.code ?? ''} ${item.address}`
        .toLowerCase()
        .includes(q)
    })
  }, [snapshot, storeQuery, statusFilter])

  const createCodeTaken = codeConflict(
    createForm.code,
    snapshot!.pharmacies,
  )

  const createPhoneIssue = phoneHint(createForm.phone)

  async function setStoreStatus(
    id: string,
    status: StoreStatus,
    acceptingOrders?: boolean,
  ) {
    await updatePharmacy(id, {
      status,
      acceptingOrders,
    })

    await reload()
  }

  if (activeStore && deskStoreId) {
    const productCount = snapshot!.medicines.filter(
      (med) => med.storeId === deskStoreId,
    ).length

    const lowStock = snapshot!.medicines.filter(
      (med) =>
        med.storeId === deskStoreId &&
        med.lowStockAlerts &&
        med.stock <= snapshot!.settings.lowStockThreshold,
    ).length

    return (
      <>
        <div className="page-head">
          <div>
            <h1>Delivery</h1>

            <p className="sub">
              <strong>{activeStore.code ?? '—'}</strong>
              {' · '}
              {activeStore.name}
              {' · riders, fees, and open hours · '}
              {productCount} products
              {lowStock ? ` · ${lowStock} low stock` : ''}
            </p>
          </div>

          <div className="btn-row">
            <span
              className={`tag ${
                activeStore.status === 'paused' ? 'off' : 'on'
              }`}
            >
              {storeStatusLabel(activeStore.status)}
            </span>

            <button
              className="btn-soft"
              type="button"
              onClick={() => go('medicines')}
            >
              Products
            </button>

            <button
              className="btn-soft"
              type="button"
              onClick={() => go('team')}
            >
              Team
            </button>

            <button
              className="btn-soft"
              type="button"
              onClick={() => go('settings')}
            >
              Store details
            </button>
          </div>
        </div>

        {pendingRiders.length > 0 ? (
          <article className="card" style={{ marginBottom: 16 }}>
            <div className="block-head">
              <h2>Pending rider applications</h2>
              <span className="count-pill">{pendingRiders.length} waiting</span>
            </div>
            <p className="sub">
              Review uploaded documents, assign this pharmacy, then approve so the rider can sign in.
            </p>
            {pendingRiders.map((rider) => (
              <div className="fee-row" key={rider.id}>
                <div>
                  <strong>{rider.name}</strong>
                  <p className="sub">
                    {rider.email || 'No email'}
                    {rider.phone ? ` · ${rider.phone}` : ''}
                    {` · ${rider.vehicle}`}
                    {rider.preferredStoreName
                      ? ` · preferred ${rider.preferredStoreName}`
                      : ''}
                  </p>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    {rider.idDocumentUrl ? (
                      <a
                        className="btn-soft"
                        href={docUrl(rider.idDocumentUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ID doc
                      </a>
                    ) : null}
                    {rider.licenseDocumentUrl ? (
                      <a
                        className="btn-soft"
                        href={docUrl(rider.licenseDocumentUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        License
                      </a>
                    ) : null}
                    {rider.vehicleDocumentUrl ? (
                      <a
                        className="btn-soft"
                        href={docUrl(rider.vehicleDocumentUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Vehicle
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      void apiFetch(`/admin/riders/${rider.id}/approve`, {
                        method: 'POST',
                        body: JSON.stringify({
                          storeId: deskStoreId,
                          isPrimary: false,
                        }),
                      })
                        .then(refreshPendingRiders)
                        .then(refreshRiders)
                        .then(() => notify(`${rider.name} approved for this store`))
                        .catch((error: unknown) =>
                          notify(
                            error instanceof Error
                              ? error.message
                              : 'Could not approve rider',
                          ),
                        )
                    }}
                  >
                    Approve for this store
                  </button>
                  <button
                    className="btn-soft"
                    type="button"
                    onClick={() => {
                      const reason =
                        window.prompt(
                          'Rejection reason (shown to rider on login)',
                          'Documents were not accepted',
                        ) ?? ''
                      if (!reason.trim()) return
                      void apiFetch(`/admin/riders/${rider.id}/reject`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: reason.trim() }),
                      })
                        .then(refreshPendingRiders)
                        .then(() => notify(`${rider.name} rejected`))
                        .catch((error: unknown) =>
                          notify(
                            error instanceof Error
                              ? error.message
                              : 'Could not reject rider',
                          ),
                        )
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </article>
        ) : null}

        <section className="split-2">
          <article className="card">
            <div className="block-head">
              <h2>Riders</h2>

              <span className="count-pill">
                {riders.filter((item) => item.active).length} active
                {' · '}
                {riders.length} total
              </span>
            </div>

            {riders.length === 0 ? (
              <p className="sub">
                No riders yet — add who delivers for this store.
              </p>
            ) : (
              riders.map((rider) => (
                <div className="fee-row" key={rider.id}>
                  <div>
                    <strong>{rider.name}</strong>

                    <p className="sub">
                      {rider.vehicle}
                      {rider.phone ? ` · ${rider.phone}` : ''}
                      {rider.notes ? ` · ${rider.notes}` : ''}
                    </p>
                  </div>

                  <div className="btn-row">
                    <span className={rider.active ? 'tag on' : 'tag off'}>
                      {rider.active ? 'Active' : 'Off'}
                    </span>

                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        void apiFetch(`/admin/riders/${rider.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            active: !rider.active,
                          }),
                        })
                          .then(refreshRiders)
                          .then(() =>
                            notify(
                              rider.active
                                ? 'Rider set off-duty'
                                : 'Rider set active',
                            ),
                          )
                          .catch((error: unknown) =>
                            notify(
                              error instanceof Error
                                ? error.message
                                : 'Could not update rider',
                            ),
                          )
                      }}
                    >
                      {rider.active ? 'Set off' : 'Activate'}
                    </button>

                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        if (!confirm(`Remove ${rider.name}?`)) return

                        void apiFetch(`/admin/riders/${rider.id}`, {
                          method: 'DELETE',
                        })
                          .then(refreshRiders)
                          .then(() => notify('Rider removed'))
                          .catch((error: unknown) =>
                            notify(
                              error instanceof Error
                                ? error.message
                                : 'Could not remove rider',
                            ),
                          )
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

            <label className="field">
              Name
              <input
                value={riderForm.name}
                onChange={(event) =>
                  setRiderForm({
                    ...riderForm,
                    name: event.target.value,
                  })
                }
                placeholder="Alex Rivera"
              />
            </label>

            <label className="field">
              Phone
              <input
                value={riderForm.phone}
                onChange={(event) =>
                  setRiderForm({
                    ...riderForm,
                    phone: event.target.value,
                  })
                }
                placeholder="+1 (212) 555-0201"
              />
            </label>

            <label className="field">
              Vehicle
              <select
                value={riderForm.vehicle}
                onChange={(event) =>
                  setRiderForm({
                    ...riderForm,
                    vehicle: event.target.value,
                  })
                }
              >
                <option value="Bike">Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Car">Car</option>
                <option value="Walk">Walk</option>
              </select>
            </label>

            <label className="field">
              Notes
              <input
                value={riderForm.notes}
                onChange={(event) =>
                  setRiderForm({
                    ...riderForm,
                    notes: event.target.value,
                  })
                }
                placeholder="Evening shift, express only…"
              />
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
                      setRiderForm({
                        name: '',
                        phone: '',
                        vehicle: 'Bike',
                        notes: '',
                      })

                      await refreshRiders()
                      notify('Rider added')
                    })
                    .catch((error: unknown) =>
                      notify(
                        error instanceof Error
                          ? error.message
                          : 'Could not add rider',
                      ),
                    )
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

              <span className={activeStore.isOpen ? 'tag on' : 'tag off'}>
                {activeStore.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>

            <p className="sub">
              <MapPin size={13} /> {activeStore.address}
            </p>

            <div className="profile-stat">
              <span>Store code</span>
              <b>{activeStore.code ?? '—'}</b>
            </div>

            <div className="profile-stat">
              <span>Pharmacist</span>
              <b>{activeStore.pharmacist || '—'}</b>
            </div>

            <div className="profile-stat">
              <span>Phone</span>
              <b>{activeStore.phone || '—'}</b>
            </div>

            <div className="profile-stat">
              <span>Orders today</span>
              <b>{activeStore.ordersToday}</b>
            </div>

            <div className="profile-stat">
              <span>Delivery city limit</span>
              <b>
                {activeStore.city || 'Not set'} · max {activeStore.maxDeliveryDistanceKm ?? 30} km
              </b>
            </div>

            <div className="split-2 mt">
              <label className="field">
                Allowed delivery city
                <input
                  value={areaForm.city}
                  onChange={(event) =>
                    setAreaForm({ ...areaForm, city: event.target.value })
                  }
                  placeholder="New York"
                />
              </label>

              <label className="field">
                Country
                <input
                  value={areaForm.country}
                  onChange={(event) =>
                    setAreaForm({ ...areaForm, country: event.target.value })
                  }
                  placeholder="United States"
                />
              </label>
            </div>

            <label className="field">
              Max delivery distance (km) — orders beyond this or outside city are blocked
              <input
                inputMode="decimal"
                value={areaForm.maxDeliveryDistanceKm}
                onChange={(event) =>
                  setAreaForm({
                    ...areaForm,
                    maxDeliveryDistanceKm: event.target.value,
                  })
                }
                placeholder="30"
              />
            </label>

            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  const maxKm = Number(areaForm.maxDeliveryDistanceKm)
                  if (!areaForm.city.trim()) {
                    notify('Enter the store delivery city')
                    return
                  }
                  if (!Number.isFinite(maxKm) || maxKm <= 0) {
                    notify('Max delivery distance must be greater than 0')
                    return
                  }
                  void updatePharmacy(activeStore.id, {
                    city: areaForm.city.trim(),
                    country: areaForm.country.trim(),
                    maxDeliveryDistanceKm: maxKm,
                  } as never)
                    .then(() => notify('Delivery city & radius saved'))
                    .catch((error: unknown) =>
                      notify(
                        error instanceof Error
                          ? error.message
                          : 'Could not save delivery area',
                      ),
                    )
                }}
              >
                Save delivery area
              </button>
            </div>

            <div className="mt">
              <div className="block-head">
                <h2>Store working hours</h2>
                <span className="count-pill">Pakistan time</span>
              </div>
              <p className="sub">
                Timezone: Asia/Karachi. Opening time is included; closing time is excluded.
                Leave a day blank for no weekly time restriction.
              </p>

              {scheduleDays.map((day) => {
                const hours = weeklyHours[day.key] ?? null
                return (
                  <div className="profile-stat" key={day.key}>
                    <strong>{day.label}</strong>
                    <label className="field">
                      <input
                        type="checkbox"
                        checked={closedDays.includes(day.key)}
                        onChange={(event) =>
                          setClosedDays((current) =>
                            event.target.checked
                              ? [...current, day.key]
                              : current.filter((item) => item !== day.key),
                          )
                        }
                      />
                      Closed
                    </label>
                    <div className="split-2">
                      <label className="field">
                        Opens
                        <input
                          type="time"
                          value={hours?.open ?? ''}
                          onChange={(event) =>
                            setWeeklyHours((current) => ({
                              ...current,
                              [day.key]: {
                                open: event.target.value,
                                close: current[day.key]?.close ?? '',
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        Closes
                        <input
                          type="time"
                          value={hours?.close ?? ''}
                          onChange={(event) =>
                            setWeeklyHours((current) => ({
                              ...current,
                              [day.key]: {
                                open: current[day.key]?.open ?? '',
                                close: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                )
              })}

              <label className="field mt">
                Holiday hours (JSON)
                <textarea
                  rows={5}
                  value={holidayHoursText}
                  onChange={(event) => setHolidayHoursText(event.target.value)}
                  placeholder={'[{"date":"2026-12-25","closed":true}]'}
                />
              </label>
              <p className="sub">
                Closed holiday: {`[{"date":"2026-12-25","closed":true}]`}
                {' '}Special hours: {`[{"date":"2026-12-25","open":"10:00","close":"16:00"}]`}
              </p>

              <div className="modal-actions">
                <button
                  className="btn-dark"
                  type="button"
                  onClick={() => {
                    const nextWeekly: Record<string, { open: string; close: string }> = {}
                    const validTime = (value: string) =>
                      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

                    for (const day of scheduleDays) {
                      const open = weeklyHours[day.key]?.open?.trim() ?? ''
                      const close = weeklyHours[day.key]?.close?.trim() ?? ''
                      if (!open && !close) continue
                      if (!validTime(open) || !validTime(close)) {
                        notify(`Enter valid opening and closing times for ${day.label}`)
                        return
                      }
                      if (close <= open) {
                        notify(`Closing time must be after opening time on ${day.label}`)
                        return
                      }
                      nextWeekly[day.key] = { open, close }
                    }

                    let nextHolidayHours: unknown[]
                    try {
                      const parsed: unknown = JSON.parse(holidayHoursText)
                      if (!Array.isArray(parsed)) {
                        notify('Holiday hours must be a JSON array')
                        return
                      }
                      nextHolidayHours = parsed
                    } catch {
                      notify('Holiday hours JSON is invalid')
                      return
                    }

                    void updatePharmacy(activeStore.id, {
                      weeklyHours: nextWeekly,
                      closedDays,
                      holidayHours: nextHolidayHours,
                    })
                  }}
                >
                  Save schedule
                </button>
              </div>
            </div>
            <div className="profile-stat">
              <span>Revenue today</span>
              <b>{money(activeStore.revenueToday, 0)}</b>
            </div>

            <div className="control-row mt">
              <span className="control-ico">
                <Phone size={16} />
              </span>

              <div>
                <strong>Accepting app orders</strong>

                <p>
                  {activeStore.isOpen
                    ? 'Products show in the app for this store.'
                    : 'Closed — hidden from mobile checkout.'}
                </p>
              </div>

              <Toggle
                on={activeStore.isOpen}
                label={`Accepting orders at ${activeStore.name}`}
                onClick={() =>
                  void setPharmacyOpen(
                    deskStoreId,
                    !activeStore.isOpen,
                  )
                }
              />
            </div>
          </article>

          <article className="card">
            <div className="block-head">
              <h2>Current delivery charges</h2>

              <span className="count-pill">
                {rules.length ? `${rules.length} set` : 'None'}
              </span>
            </div>

            {rules.length === 0 ? (
              <p className="sub">
                No delivery or service fee set yet.
              </p>
            ) : (
              rules.map((item) => {
                const summary = feeSummary(item)

                return (
                  <div className="fee-row" key={item.id}>
                    <div>
                      <strong>{summary.label}</strong>

                      <p className="sub">
                        {summary.kind}
                        {summary.delivery}
                      </p>
                    </div>

                    <div className="btn-row">
                      <b
                        className={
                          item.mode === 'PERCENT'
                            ? 'fee-percent'
                            : ''
                        }
                      >
                        {summary.amount}
                      </b>

                      <button
                        className="btn-soft"
                        type="button"
                        onClick={() => {
                          setEditingRuleId(item.id)
                          setRule({
                            kind: item.kind,
                            label: item.label,
                            mode: item.mode,
                            amount: String(item.amount),
                            percentBase: item.percentBase ?? 'PRODUCT_SUBTOTAL',
                            deliveryType: item.deliveryType ?? '',
                            minDistanceKm:
                              item.minDistanceKm != null ? String(item.minDistanceKm) : '',
                            maxDistanceKm:
                              item.maxDistanceKm != null ? String(item.maxDistanceKm) : '',
                            perKmRate:
                              item.perKmRate != null ? String(item.perKmRate) : '0',
                          })
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className="btn-soft"
                        type="button"
                        onClick={() => {
                          void apiFetch(
                            `/admin/charge-rules/${item.id}`,
                            { method: 'DELETE' },
                          )
                            .then(refresh)
                            .then(() => notify('Charge removed'))
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
                    void apiFetch(
                      `/admin/services/${service.id}`,
                      { method: 'DELETE' },
                    )
                      .then(refresh)
                      .then(() => notify('Service removed'))
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

            <label className="field">
              Service name
              <input
                value={serviceName}
                onChange={(event) =>
                  setServiceName(event.target.value)
                }
                placeholder="Consultation"
              />
            </label>

            <div className="modal-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  if (!serviceName.trim()) return

                  void apiFetch('/admin/services', {
                    method: 'POST',
                    body: JSON.stringify({
                      storeId: deskStoreId,
                      name: serviceName.trim(),
                    }),
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
            <h2>{editingRuleId ? 'Edit delivery / fee' : 'Add delivery / fee'}</h2>

            {rule.kind === 'DELIVERY' ? (
              <div className="btn-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn-soft"
                  type="button"
                  onClick={() =>
                    setRule({
                      ...rule,
                      label: `Nearby ${rule.deliveryType || 'standard'} (0-3 km)`,
                      minDistanceKm: '0',
                      maxDistanceKm: '3',
                      amount: rule.deliveryType === 'express' ? '4.00' : '2.00',
                      perKmRate: '0',
                    })
                  }
                >
                  Nearby (0-3 km)
                </button>
                <button
                  className="btn-soft"
                  type="button"
                  onClick={() =>
                    setRule({
                      ...rule,
                      label: `Mid-range ${rule.deliveryType || 'standard'} (3-8 km)`,
                      minDistanceKm: '3',
                      maxDistanceKm: '8',
                      amount: rule.deliveryType === 'express' ? '7.50' : '4.50',
                      perKmRate: '0',
                    })
                  }
                >
                  Mid-range (3-8 km)
                </button>
                <button
                  className="btn-soft"
                  type="button"
                  onClick={() =>
                    setRule({
                      ...rule,
                      label: `Far ${rule.deliveryType || 'standard'} (8+ km)`,
                      minDistanceKm: '8',
                      maxDistanceKm: '',
                      amount: rule.deliveryType === 'express' ? '11.00' : '7.50',
                      perKmRate: rule.deliveryType === 'express' ? '0.75' : '0.50',
                    })
                  }
                >
                  Far (8+ km)
                </button>
              </div>
            ) : null}

            <label className="field">
              Charge label
              <input
                value={rule.label}
                onChange={(event) =>
                  setRule({
                    ...rule,
                    label: event.target.value,
                  })
                }
                placeholder="Standard delivery"
              />
            </label>

            <label className="field">
              Kind
              <select
                value={rule.kind}
                onChange={(event) =>
                  setRule({
                    ...rule,
                    kind: event.target.value,
                  })
                }
              >
                <option value="DELIVERY">Delivery</option>
                <option value="SERVICE">Service</option>
                <option value="BFP">BFP</option>
              </select>
            </label>

            <label className="field">
              Mode
              <select
                value={rule.mode}
                onChange={(event) =>
                  setRule({
                    ...rule,
                    mode: event.target.value,
                  })
                }
              >
                <option value="FIXED">Fixed amount</option>
                <option value="PERCENT">Percent (%)</option>
              </select>
            </label>

            <label className="field">
              {rule.mode === 'PERCENT'
                ? 'Fee percent (%)'
                : 'Fixed amount'}

              <input
                inputMode="decimal"
                value={rule.amount}
                onChange={(event) =>
                  setRule({
                    ...rule,
                    amount: event.target.value,
                  })
                }
              />
            </label>

            {rule.mode === 'PERCENT' ? (
              <label className="field">
                Percentage of
                <select
                  value={rule.percentBase}
                  onChange={(event) =>
                    setRule({
                      ...rule,
                      percentBase: event.target.value,
                    })
                  }
                >
                  <option value="PRODUCT_SUBTOTAL">
                    Product subtotal
                  </option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="SERVICE">Service</option>
                  <option value="PRODUCT_AND_DELIVERY">
                    Products plus delivery
                  </option>
                  <option value="SUBTOTAL_BEFORE_BFP">
                    Subtotal before BFP
                  </option>
                </select>
              </label>
            ) : null}

            {rule.kind === 'DELIVERY' ? (
              <>
                <label className="field">
                  Delivery type
                  <select
                    value={rule.deliveryType}
                    onChange={(event) =>
                      setRule({
                        ...rule,
                        deliveryType: event.target.value,
                      })
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                    <option value="pickup">Store pickup</option>
                    <option value="">Any</option>
                  </select>
                </label>

                <div className="split-2">
                  <label className="field">
                    Min distance (km)
                    <input
                      inputMode="decimal"
                      value={rule.minDistanceKm}
                      placeholder="0"
                      onChange={(event) =>
                        setRule({
                          ...rule,
                          minDistanceKm: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    Max distance (km, blank = unlimited)
                    <input
                      inputMode="decimal"
                      value={rule.maxDistanceKm}
                      placeholder="e.g. 3, 8, or blank"
                      onChange={(event) =>
                        setRule({
                          ...rule,
                          maxDistanceKm: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  Extra per km beyond min distance ($)
                  <input
                    inputMode="decimal"
                    value={rule.perKmRate}
                    placeholder="0.50"
                    onChange={(event) =>
                      setRule({
                        ...rule,
                        perKmRate: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            <div className="modal-actions">
              {editingRuleId ? (
                <button
                  className="btn-soft"
                  type="button"
                  onClick={() => {
                    setEditingRuleId(null)
                    setRule({
                      kind: 'DELIVERY',
                      label: '',
                      mode: 'FIXED',
                      amount: '2.00',
                      percentBase: 'PRODUCT_SUBTOTAL',
                      deliveryType: 'standard',
                      minDistanceKm: '0',
                      maxDistanceKm: '3',
                      perKmRate: '0',
                    })
                  }}
                >
                  Cancel edit
                </button>
              ) : null}

              <button
                className="btn-dark"
                type="button"
                onClick={() => {
                  if (!rule.label.trim()) return

                  const parsedMin =
                    rule.kind === 'DELIVERY' && rule.minDistanceKm.trim() !== ''
                      ? Number(rule.minDistanceKm)
                      : null
                  const parsedMax =
                    rule.kind === 'DELIVERY' && rule.maxDistanceKm.trim() !== ''
                      ? Number(rule.maxDistanceKm)
                      : null
                  const parsedPerKm =
                    rule.kind === 'DELIVERY' && rule.perKmRate.trim() !== ''
                      ? Number(rule.perKmRate)
                      : null

                  const payload = {
                    storeId: deskStoreId,
                    kind: rule.kind,
                    label: rule.label.trim(),
                    mode: rule.mode,
                    amount: Number(rule.amount),
                    percentBase:
                      rule.mode === 'PERCENT'
                        ? rule.percentBase
                        : null,
                    deliveryType:
                      rule.kind === 'DELIVERY' && rule.deliveryType
                        ? rule.deliveryType
                        : null,
                    minDistanceKm: parsedMin,
                    maxDistanceKm: parsedMax,
                    perKmRate: parsedPerKm,
                  }

                  const req = editingRuleId
                    ? apiFetch(`/admin/charge-rules/${editingRuleId}`, {
                        method: 'PATCH',
                        body: JSON.stringify(payload),
                      })
                    : apiFetch('/admin/charge-rules', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                      })

                  void req
                    .then(async () => {
                      setEditingRuleId(null)
                      setRule({
                        ...rule,
                        label: '',
                      })

                      await refresh()
                      notify(
                        editingRuleId
                          ? 'Delivery charge updated'
                          : 'Delivery charge saved',
                      )
                    })
                    .catch((error: unknown) =>
                      notify(
                        error instanceof Error
                          ? error.message
                          : 'Could not save the charge',
                      ),
                    )
                }}
              >
                {editingRuleId ? 'Save changes' : 'Add charge'}
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
            Open any store to manage its products, stock, expiry,
            opening time, and delivery — full header and sidebar
            for that store.
          </p>
        </div>

        {isMainAdmin ? (
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              setCreateForm(emptyCreate())
              setSaveAsDraft(true)
              setCreateOpen(true)
            }}
          >
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

        {(
          ['all', 'draft', 'active', 'paused', 'archived'] as const
        ).map((filter) => (
          <button
            key={filter}
            className={
              statusFilter === filter ? 'chip is-on' : 'chip'
            }
            type="button"
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'all' ? 'All' : storeStatusLabel(filter)}
          </button>
        ))}
      </div>

      {/* Stores Table */}
      <section className="card table-wrap table-static pharmacy-table">
        <table>
          <thead>
            <tr>
              <th>STORE</th>
              <th>LOCATION</th>
              <th>PHARMACIST</th>
              <th>PRODUCTS</th>
              <th>ORDERS TODAY</th>
              <th>REVENUE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {listedStores.map((item) => {
              const storeStatus = item.status ?? 'active'
              const fees = item.fees ?? []

              const productCount = snapshot!.medicines.filter(
                (med) => med.storeId === item.id,
              ).length

              const lowStock = snapshot!.medicines.filter(
                (med) =>
                  med.storeId === item.id &&
                  med.lowStockAlerts &&
                  med.stock <= snapshot!.settings.lowStockThreshold,
              ).length

              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>

                    <p className="sub">
                      {item.code ?? '—'}
                    </p>

                    <span className="stars">
                      <Star size={14} /> {item.rating.toFixed(1)}
                    </span>
                  </td>

                  <td>
                    <MapPin size={13} /> {item.address}

                    <p className="sub">
                      Open until: {item.openUntil}
                    </p>
                  </td>

                  <td>
                    {item.pharmacist}

                    <p className="sub">
                      <Phone size={13} /> {item.phone}
                    </p>
                  </td>

                  <td>
                    <strong>{productCount}</strong>

                    {lowStock > 0 ? (
                      <p className="sub">
                        {lowStock} low stock
                      </p>
                    ) : null}
                  </td>

                  <td>{item.ordersToday}</td>

                  <td>{money(item.revenueToday, 0)}</td>

                  <td>
                    <span
                      className={
                        storeStatus === 'active'
                          ? 'tag on'
                          : 'tag off'
                      }
                    >
                      {storeStatusLabel(storeStatus)}
                    </span>

                    <p className="sub">
                      {storeStatus === 'archived'
                        ? 'Orders disabled'
                        : item.isOpen
                          ? 'Accepting orders'
                          : 'Not accepting orders'}
                    </p>

                    {storeStatus === 'archived' ? (
                      <span className="tag off">
                        Archived — toggle disabled
                      </span>
                    ) : (
                      <Toggle
                        on={item.isOpen}
                        label={`Accepting orders at ${item.name}`}
                        onClick={() =>
                          void setPharmacyOpen(
                            item.id,
                            !item.isOpen,
                          )
                        }
                      />
                    )}
                  </td>

                  <td>
                    <div className="btn-row">
                      <button
                        className="btn-dark"
                        type="button"
                        onClick={() =>
                          openStore(item.id, 'overview')
                        }
                      >
                        Open
                      </button>

                      {isMainAdmin ? (
                        <>
                          {storeStatus === 'draft' ? (
                            <button
                              className="btn-soft"
                              type="button"
                              onClick={() =>
                                void setStoreStatus(
                                  item.id,
                                  'active',
                                  true,
                                )
                              }
                            >
                              Publish
                            </button>
                          ) : null}

                          {storeStatus === 'active' ? (
                            <button
                              className="btn-soft"
                              type="button"
                              onClick={() =>
                                void setStoreStatus(
                                  item.id,
                                  'paused',
                                  false,
                                )
                              }
                            >
                              Pause
                            </button>
                          ) : null}

                          {storeStatus === 'paused' ? (
                            <button
                              className="btn-soft"
                              type="button"
                              onClick={() =>
                                void setStoreStatus(
                                  item.id,
                                  'active',
                                  true,
                                )
                              }
                            >
                              Resume
                            </button>
                          ) : null}

                          {storeStatus === 'archived' ? (
                            <button
                              className="btn-dark"
                              type="button"
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Unarchive ${item.name} and reopen it for orders?`,
                                  )
                                ) {
                                  return
                                }

                                void setStoreStatus(
                                  item.id,
                                  'active',
                                  true,
                                )
                              }}
                            >
                              Unarchive
                            </button>
                          ) : (
                            <button
                              className="btn-soft"
                              type="button"
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Are you sure you want to archive ${item.name}?`,
                                  )
                                ) {
                                  return
                                }

                                void setStoreStatus(
                                  item.id,
                                  'archived',
                                  false,
                                )
                              }}
                            >
                              Archive
                            </button>
                          )}

                          <button
                            className="btn-soft"
                            type="button"
                            onClick={() => {
                              if (
                                !confirm(
                                  `Delete or close ${item.name}? Stores with orders are closed instead of deleted.`,
                                )
                              ) {
                                return
                              }

                              void deletePharmacy(item.id)
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>

                    {fees.length > 0 ? (
                      <details>
                        <summary>
                          Delivery & fees ({fees.length})
                        </summary>

                        {fees.map((fee) => {
                          const summary = feeSummary(fee)

                          return (
                            <div
                              className="fee-row"
                              key={fee.id}
                            >
                              <strong>{summary.label}</strong>
                              <span>{summary.amount}</span>
                            </div>
                          )
                        })}
                      </details>
                    ) : null}
                  </td>
                </tr>
              )
            })}

            {listedStores.length === 0 ? (
              <tr>
                <td colSpan={8}>No stores found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <Modal
        open={createOpen}
        title="Add store"
        subtitle="New stores start as draft until you publish. Delivery fees are created automatically when you publish."
        onClose={() => setCreateOpen(false)}
      >
        <label className="field">
          Store name
          <input
            value={createForm.name}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                name: event.target.value,
              })
            }
            placeholder="Ali Pharmacy"
          />
        </label>

        <label className="field">
          Store code
          <input
            value={createForm.code}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                code: event.target.value,
              })
            }
            placeholder="ALI"
          />
        </label>

        {createCodeTaken ? (
          <p
            className="sub"
            style={{ color: 'var(--danger, #c2410c)' }}
          >
            That code is already used — pick another.
          </p>
        ) : null}

        {createPhoneIssue ? (
          <p
            className="sub"
            style={{ color: 'var(--danger, #c2410c)' }}
          >
            {createPhoneIssue}
          </p>
        ) : null}

        <label className="check">
          <input
            type="checkbox"
            checked={saveAsDraft}
            onChange={(event) =>
              setSaveAsDraft(event.target.checked)
            }
          />
          Save as draft (recommended until hours and catalog are ready)
        </label>

        <label className="field">
          Address
          <input
            value={createForm.address}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                address: event.target.value,
              })
            }
          />
        </label>

        <label className="field">
          Open until
          <input
            value={createForm.openUntil}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                openUntil: event.target.value,
              })
            }
            placeholder="9:00 PM"
          />
        </label>

        <label className="field">
          Phone
          <input
            value={createForm.phone}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                phone: event.target.value,
              })
            }
          />
        </label>

        <label className="field">
          Pharmacist
          <input
            value={createForm.pharmacist}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                pharmacist: event.target.value,
              })
            }
          />
        </label>

        <label className="field">
          Standard delivery ($)
          <input
            value={createForm.standardDelivery}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                standardDelivery: event.target.value,
              })
            }
          />
        </label>

        <label className="field">
          Express delivery ($)
          <input
            value={createForm.expressDelivery}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                expressDelivery: event.target.value,
              })
            }
          />
        </label>

        <div className="modal-actions">
          <button
            className="btn-soft"
            type="button"
            onClick={() => setCreateOpen(false)}
          >
            Cancel
          </button>

          <button
            className="btn-dark"
            type="button"
            onClick={(event) => {
              if (
                !createForm.name.trim() ||
                !createForm.code.trim() ||
                !createForm.address.trim()
              ) {
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
                openUntil:
                  createForm.openUntil.trim() || '9:00 PM',
                phone: createForm.phone.trim(),
                pharmacist: createForm.pharmacist.trim(),
                standardDelivery:
                  Number(createForm.standardDelivery) || 0,
                expressDelivery:
                  Number(createForm.expressDelivery) || 0,
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
