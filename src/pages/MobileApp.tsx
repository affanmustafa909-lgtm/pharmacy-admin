import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import type { MobileConfig, PromoCode } from '../types'
import { apiFetch } from '../services/http'

const emptyPromo = { code: 'SAVE5', label: 'Save on next order', discount: 5 }

const FALLBACK_CONFIG: MobileConfig = {
  heroLight: 'Find Your',
  heroBold: 'Medicines Fast',
  quickActions: [
    { id: 'upload', label: 'Upload', icon: 'camera-outline', href: '/scan' },
    { id: 'order', label: 'Order', icon: 'bag-outline', href: '/(tabs)/cart' },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'location-outline', href: '/pharmacies' },
    { id: 'reminder', label: 'Reminder', icon: 'time-outline', href: '/reminders' },
  ],
  deliveryOptions: [
    { id: 'standard', title: 'Standard', eta: '45-60 min', priceLabel: 'From charges' },
    { id: 'express', title: 'Express', eta: '20-30 min', priceLabel: 'From charges', highlighted: true },
  ],
  paymentMethods: [
    { id: 'apple', type: 'apple_pay', label: 'Apple Pay' },
    { id: 'visa', type: 'card', label: 'Visa', detail: '•••• 4829' },
  ],
  aiMessages: [
    { id: 'm1', role: 'assistant', text: 'Hi — I’m Hera AI. Ask me about medicines, side effects, or what to take for common symptoms.' },
    { id: 'm2', role: 'user', text: 'I have a mild headache and fever. What should I take?' },
    { id: 'm3', role: 'assistant', text: 'For mild headache and fever, Yakapsule 500mg is commonly recommended.' },
  ],
  tracking: {
    riderName: 'Alex',
    expressEtaMinutes: 25,
    standardEtaMinutes: 45,
    defaultDistanceKm: 2.4,
  },
}

export function MobileAppPage() {
  const { snapshot, reload, notify } = useDashboard()
  const [config, setConfig] = useState<MobileConfig>(snapshot?.mobileConfig ?? FALLBACK_CONFIG)
  const [promos, setPromos] = useState<PromoCode[]>(snapshot?.promos ?? [])
  const [promoForm, setPromoForm] = useState(emptyPromo)
  const [reminderForm, setReminderForm] = useState({
    customerName: 'Michael Johnson',
    medicine: '',
    time: '8:00 AM',
    frequency: 'Once daily',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setConfig(snapshot?.mobileConfig ?? FALLBACK_CONFIG)
    setPromos(snapshot?.promos ?? [])
  }, [snapshot])

  async function saveConfig() {
    setSaving(true)
    try {
      await apiFetch('/admin/mobile-config', { method: 'PUT', body: JSON.stringify({ config }) })
      await reload()
      notify('Mobile app content saved')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save mobile content')
    } finally {
      setSaving(false)
    }
  }

  async function createPromo() {
    try {
      await apiFetch('/admin/promos', {
        method: 'POST',
        body: JSON.stringify(promoForm),
      })
      setPromoForm(emptyPromo)
      await reload()
      notify('Promo code added')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add promo')
    }
  }

  async function togglePromo(promo: PromoCode) {
    await apiFetch(`/admin/promos/${promo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !promo.active }),
    })
    await reload()
  }

  async function removePromo(id: string) {
    await apiFetch(`/admin/promos/${id}`, { method: 'DELETE' })
    await reload()
    notify('Promo removed')
  }

  async function createReminder() {
    try {
      await apiFetch('/admin/reminders', {
        method: 'POST',
        body: JSON.stringify(reminderForm),
      })
      setReminderForm((prev) => ({ ...prev, medicine: '' }))
      await reload()
      notify('Reminder created for the app')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create reminder')
    }
  }

  async function removeReminder(id: string) {
    await apiFetch(`/admin/reminders/${id}`, { method: 'DELETE' })
    await reload()
    notify('Reminder removed')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mobile app</h1>
          <p className="sub">Manage what customers see in the Hera app: home, checkout helpers, promos, AI copy, and reminders.</p>
        </div>
        <button className="btn-dark" type="button" disabled={saving} onClick={() => void saveConfig()}>
          {saving ? 'Saving…' : 'Save app content'}
        </button>
      </div>

      <section className="split-2">
        <article className="card">
          <h2>Home hero</h2>
          <label className="field">Light line
            <input value={config.heroLight} onChange={(e) => setConfig({ ...config, heroLight: e.target.value })} />
          </label>
          <label className="field">Bold line
            <input value={config.heroBold} onChange={(e) => setConfig({ ...config, heroBold: e.target.value })} />
          </label>
          <h2 className="mt">Quick actions</h2>
          {config.quickActions.map((action, index) => (
            <div className="setting-row" key={action.id}>
              <label className="field" style={{ flex: 1 }}>
                Label
                <input
                  value={action.label}
                  onChange={(e) => {
                    const quickActions = [...config.quickActions]
                    quickActions[index] = { ...action, label: e.target.value }
                    setConfig({ ...config, quickActions })
                  }}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                Icon
                <input
                  value={action.icon}
                  onChange={(e) => {
                    const quickActions = [...config.quickActions]
                    quickActions[index] = { ...action, icon: e.target.value }
                    setConfig({ ...config, quickActions })
                  }}
                />
              </label>
            </div>
          ))}
        </article>

        <article className="card">
          <h2>Delivery options</h2>
          {config.deliveryOptions.map((option, index) => (
            <div key={option.id} className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <strong>{option.id}</strong>
              <label className="field">Title
                <input
                  value={option.title}
                  onChange={(e) => {
                    const deliveryOptions = [...config.deliveryOptions]
                    deliveryOptions[index] = { ...option, title: e.target.value }
                    setConfig({ ...config, deliveryOptions })
                  }}
                />
              </label>
              <label className="field">ETA label
                <input
                  value={option.eta}
                  onChange={(e) => {
                    const deliveryOptions = [...config.deliveryOptions]
                    deliveryOptions[index] = { ...option, eta: e.target.value }
                    setConfig({ ...config, deliveryOptions })
                  }}
                />
              </label>
            </div>
          ))}
          <h2 className="mt">Payment methods</h2>
          {config.paymentMethods.map((method, index) => (
            <label className="field" key={method.id}>
              {method.id}
              <input
                value={method.label}
                onChange={(e) => {
                  const paymentMethods = [...config.paymentMethods]
                  paymentMethods[index] = { ...method, label: e.target.value }
                  setConfig({ ...config, paymentMethods })
                }}
              />
            </label>
          ))}
        </article>
      </section>

      <section className="split-2">
        <article className="card">
          <h2>AI starter chat</h2>
          {config.aiMessages.map((message, index) => (
            <label className="field" key={message.id}>
              {message.role}
              <textarea
                rows={3}
                value={message.text}
                onChange={(e) => {
                  const aiMessages = [...config.aiMessages]
                  aiMessages[index] = { ...message, text: e.target.value }
                  setConfig({ ...config, aiMessages })
                }}
              />
            </label>
          ))}
          <h2 className="mt">Live tracking defaults</h2>
          <label className="field">Rider name
            <input
              value={config.tracking.riderName}
              onChange={(e) => setConfig({ ...config, tracking: { ...config.tracking, riderName: e.target.value } })}
            />
          </label>
          <label className="field">Express ETA (minutes)
            <input
              inputMode="numeric"
              value={config.tracking.expressEtaMinutes}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tracking: { ...config.tracking, expressEtaMinutes: Number(e.target.value) || 0 },
                })
              }
            />
          </label>
        </article>

        <article className="card">
          <div className="block-head">
            <div>
              <h2>Promo codes</h2>
              <p className="sub">Applied in the app cart and saved on the order.</p>
            </div>
          </div>
          <div className="offers">
            {promos.map((promo) => (
              <div className={promo.active ? 'offer is-on' : 'offer'} key={promo.id}>
                <h3>{promo.code}</h3>
                <p>{promo.label} · ${promo.discount.toFixed(2)} off</p>
                <div className="spacer">
                  <Toggle on={promo.active} label={promo.code} onClick={() => void togglePromo(promo)} />
                  <button className="btn-soft" type="button" onClick={() => void removePromo(promo.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
            <input placeholder="Code" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} />
            <input placeholder="Label" value={promoForm.label} onChange={(e) => setPromoForm({ ...promoForm, label: e.target.value })} />
            <input
              placeholder="Discount"
              inputMode="decimal"
              value={promoForm.discount}
              onChange={(e) => setPromoForm({ ...promoForm, discount: Number(e.target.value) || 0 })}
            />
            <button className="btn-dark" type="button" onClick={() => void createPromo()}>
              <Plus size={14} /> Add promo
            </button>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="block-head">
          <div>
            <h2>Patient reminders</h2>
            <p className="sub">Create reminders that appear in the customer app.</p>
          </div>
        </div>
        <div className="history">
          {(snapshot?.reminders ?? []).map((reminder) => (
            <div className="history-row" key={reminder.id}>
              <div>
                <b>{reminder.medicine}</b>
                <div className="mini">{reminder.customerName} · {reminder.time} · {reminder.frequency}</div>
              </div>
              <button className="btn-soft" type="button" onClick={() => void removeReminder(reminder.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
          <input
            placeholder="Patient name"
            value={reminderForm.customerName}
            onChange={(e) => setReminderForm({ ...reminderForm, customerName: e.target.value })}
          />
          <input
            placeholder="Medicine"
            value={reminderForm.medicine}
            onChange={(e) => setReminderForm({ ...reminderForm, medicine: e.target.value })}
          />
          <input
            placeholder="Time"
            value={reminderForm.time}
            onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })}
          />
          <input
            placeholder="Frequency"
            value={reminderForm.frequency}
            onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })}
          />
          <button className="btn-dark" type="button" onClick={() => void createReminder()}>
            <Plus size={14} /> Add reminder
          </button>
        </div>
      </section>
    </>
  )
}
