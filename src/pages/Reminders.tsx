import { useState } from 'react'
import { Check, Gift } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import type { CareProgram } from '../types'

export function RemindersPage() {
  const { snapshot, toggleCampaign, toggleReminder, redeemCare } = useDashboard()
  const care = snapshot!.care
  const reminders = snapshot!.reminders
  const [tier, setTier] = useState<keyof CareProgram['tiers']>(care.tier)
  const [open, setOpen] = useState(false)
  const active = care.campaigns.filter((campaign) => campaign.active).length
  const progress = Math.min(100, Math.round((care.points / (care.points + care.pointsToNext)) * 100))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Care program</h1>
          <p className="sub">Earn adherence points when patients stay on their reminders, then unlock better support.</p>
        </div>
      </div>
      <section className="hero-row">
        <div className="hero-coral">
          <div className="hero-top">
            <span className="pill-lite">{care.tier} member</span>
            <span>Member since {care.memberSince}</span>
          </div>
          <div className="hero-points"><CountUp value={care.points} /> <span>points</span></div>
          <div className="hero-meta">
            <span>{care.tier}</span>
            <span>{care.pointsToNext.toLocaleString()} pts to {care.nextTier}</span>
          </div>
          <div className="hero-track"><span style={{ width: `${progress}%` }} /></div>
          <div>
            <button className="btn-coral" type="button" onClick={() => setOpen(true)}><Gift size={15} /> Redeem points</button>
            <span style={{ marginLeft: 10, fontWeight: 650 }}>${care.rewardValue} in delivery credits</span>
          </div>
        </div>
        <article className="card">
          <h2>Tier benefits</h2>
          <div className="tier-tabs">
            {(['Silver', 'Gold', 'Platinum'] as const).map((name) => (
              <button key={name} className={tier === name ? 'is-on' : ''} type="button" onClick={() => setTier(name)}>
                {tier === name ? <span className="nav-item-bg" /> : null}
                <span className="nav-item-label">{name}</span>
              </button>
            ))}
          </div>
          {care.tiers[tier].map((perk) => (
            <div className="perk" key={perk}><Check size={16} /> {perk}</div>
          ))}
          <p className="mini mt">{tier === care.tier ? 'This is the current tier.' : 'Preview of this tier.'}</p>
        </article>
      </section>

      <section className="care-grid">
        <article className="card">
          <div className="block-head">
            <div>
              <h2>Offers for patients</h2>
              <p className="sub">Turn a campaign on and it applies to the next eligible order.</p>
            </div>
            <span className="count-pill">{active} active</span>
          </div>
          <div className="offers">
            {care.campaigns.map((campaign) => (
              <div key={campaign.id} className={campaign.active ? 'offer is-on' : 'offer'}>
                <h3>{campaign.title}</h3>
                <p>{campaign.detail}</p>
                <div className="spacer">
                  <span className="mini">{campaign.ends}</span>
                  <button className={campaign.active ? 'btn-soft' : 'btn-dark'} type="button" onClick={() => void toggleCampaign(campaign.id)}>
                    {campaign.active ? 'Activated' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>Points history</h2>
          <div className="history">
            {care.history.map((event) => (
              <div className="history-row" key={event.id}>
                <span className="history-ico"><Gift size={14} /></span>
                <div>
                  <b>{event.title}</b>
                  <div className="mini">{event.date}</div>
                </div>
                <span className={event.points >= 0 ? 'plus' : 'minus'}>{event.points >= 0 ? '+' : ''}{event.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="card mt">
        <div className="block-head">
          <div>
            <h2>Patient reminders</h2>
            <p className="sub">The same schedules patients manage in the mobile app.</p>
          </div>
        </div>
        {reminders.map((reminder) => (
          <div className="control-row" key={reminder.id}>
            <span className="control-ico">{reminder.adherence}</span>
            <div>
              <strong>{reminder.medicine}</strong>
              <p>{reminder.customerName} · {reminder.time} · {reminder.frequency}</p>
            </div>
            <Toggle on={reminder.enabled} label={`${reminder.medicine} for ${reminder.customerName}`} onClick={() => void toggleReminder(reminder.id)} />
          </div>
        ))}
      </article>

      <Modal open={open} title="Redeem care points" subtitle="Sends a refill reminder batch and spends 320 points." onClose={() => setOpen(false)}>
        <p className="sub">Patients with an active reminder and adherence above 80% will get a refill nudge.</p>
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-dark" type="button" onClick={() => { void redeemCare(320).then((ok) => { if (ok) setOpen(false) }) }}>Redeem 320 pts</button>
        </div>
      </Modal>
    </>
  )
}
