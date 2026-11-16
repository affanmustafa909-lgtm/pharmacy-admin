import { useCallback, useEffect, useState } from 'react'
import { Mail, Shield, UserMinus, UserPlus } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import { useDashboard } from '../context/DashboardContext'
import { deskRoleLabel, formatWhen } from '../lib/format'
import { apiFetch } from '../services/http'
import type { DeskRole, StaffInvite, TeamMember } from '../types'

const ROLES: DeskRole[] = ['OWNER', 'STORE_MANAGER', 'PHARMACIST', 'ORDER_STAFF']

export function TeamAccessPage() {
  const { activeStore, activeStoreId, notify } = useDashboard()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<StaffInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<DeskRole>('ORDER_STAFF')
  const [invitePrice, setInvitePrice] = useState(false)
  const [inviteRefund, setInviteRefund] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState<DeskRole>('ORDER_STAFF')
  const [editPrice, setEditPrice] = useState(false)
  const [editRefund, setEditRefund] = useState(false)

  const loadTeam = useCallback(async () => {
    if (!activeStoreId) return
    setLoading(true)
    try {
      const payload = (await apiFetch(`/admin/stores/${encodeURIComponent(activeStoreId)}/team`)) as {
        members: TeamMember[]
        invites: StaffInvite[]
      }
      setMembers(payload.members)
      setInvites(payload.invites)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load team')
    } finally {
      setLoading(false)
    }
  }, [activeStoreId, notify])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  if (!activeStoreId || !activeStore) {
    return (
      <div className="empty">
        <p className="sub">Open a store workspace to manage team access.</p>
      </div>
    )
  }

  const pendingInvites = invites.filter((item) => item.status === 'pending')
  const acceptedInvites = invites.filter((item) => item.status === 'accepted')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team & Access</h1>
          <p className="sub">
            {activeStore.code ? (
              <>
                <strong>{activeStore.code}</strong>
                {' · '}
              </>
            ) : null}
            {activeStore.name} — invite staff, set desk roles, and control price or refund permissions.
          </p>
        </div>
        <button className="btn-dark" type="button" onClick={() => setInviteOpen(true)}>
          <UserPlus size={15} /> Invite member
        </button>
      </div>

      {loading ? (
        <div className="empty">Loading team…</div>
      ) : (
        <section className="split-2">
          <article className="card">
            <div className="block-head">
              <h2>Active members</h2>
              <span className="count-pill">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <p className="sub">No members assigned yet.</p>
            ) : (
              members.map((member) => (
                <div className="fee-row" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <p className="sub">
                      <Mail size={12} /> {member.email} · {deskRoleLabel(member.deskRole)}
                      {member.canChangePrice ? ' · price' : ''}
                      {member.canRefund ? ' · refunds' : ''}
                    </p>
                  </div>
                  <p className="sub">Since {formatWhen(member.createdAt)}</p>
                  <div className="btn-row">
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        setEditMember(member)
                        setEditRole(member.deskRole)
                        setEditPrice(member.canChangePrice)
                        setEditRefund(member.canRefund)
                      }}
                    >
                      Change role
                    </button>
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        if (!confirm(`Remove ${member.name} from this store?`)) return
                        void apiFetch(`/admin/assignments/${member.id}`, { method: 'DELETE' })
                          .then(loadTeam)
                          .then(() => notify('Member removed'))
                          .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not remove member'))
                      }}
                    >
                      <UserMinus size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="card">
            <div className="block-head">
              <h2>Pending invites</h2>
              <span className="count-pill">{pendingInvites.length}</span>
            </div>
            {pendingInvites.length === 0 ? (
              <p className="sub">No pending invites.</p>
            ) : (
              pendingInvites.map((invite) => (
                <div className="fee-row" key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <p className="sub">
                      {deskRoleLabel(invite.deskRole)} · sent {formatWhen(invite.createdAt)}
                    </p>
                  </div>
                  <div className="btn-row">
                    <span className="tag off">Pending</span>
                    <button
                      className="btn-soft"
                      type="button"
                      onClick={() => {
                        void apiFetch(`/admin/invites/${invite.id}/revoke`, { method: 'POST' })
                          .then(loadTeam)
                          .then(() => notify('Invite revoked'))
                          .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not revoke invite'))
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="block-head mt" style={{ marginTop: 24 }}>
              <h2>Recently accepted</h2>
              <span className="count-pill">{acceptedInvites.length}</span>
            </div>
            {acceptedInvites.length === 0 ? (
              <p className="sub">No accepted invites on record.</p>
            ) : (
              acceptedInvites.slice(0, 8).map((invite) => (
                <div className="profile-stat" key={invite.id}>
                  <span>{invite.email}</span>
                  <b>{invite.acceptedAt ? formatWhen(invite.acceptedAt) : 'Accepted'}</b>
                </div>
              ))
            )}
          </article>
        </section>
      )}

      <Modal open={inviteOpen} title="Invite team member" subtitle="They receive an email to join this store desk." onClose={() => setInviteOpen(false)}>
        <label className="field">Email
          <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="colleague@hera.care" />
        </label>
        <label className="field">Desk role
          <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as DeskRole)}>
            {ROLES.filter((role) => role !== 'OWNER').map((role) => (
              <option key={role} value={role}>{deskRoleLabel(role)}</option>
            ))}
          </select>
        </label>
        {inviteRole === 'STORE_MANAGER' ? (
          <>
            <div className="control-row">
              <span className="control-ico"><Shield size={16} /></span>
              <div>
                <strong>Can change prices</strong>
                <p>Allow catalog price edits at the desk.</p>
              </div>
              <Toggle on={invitePrice} label="Can change prices" onClick={() => setInvitePrice((value) => !value)} />
            </div>
            <div className="control-row">
              <span className="control-ico"><Shield size={16} /></span>
              <div>
                <strong>Can issue refunds</strong>
                <p>Allow refund actions on orders.</p>
              </div>
              <Toggle on={inviteRefund} label="Can issue refunds" onClick={() => setInviteRefund((value) => !value)} />
            </div>
          </>
        ) : null}
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              const email = inviteEmail.trim()
              if (!email) {
                notify('Enter an email')
                return
              }
              void apiFetch(`/admin/stores/${encodeURIComponent(activeStoreId)}/invites`, {
                method: 'POST',
                body: JSON.stringify({
                  email,
                  deskRole: inviteRole,
                  canChangePrice: inviteRole === 'STORE_MANAGER' ? invitePrice : undefined,
                  canRefund: inviteRole === 'STORE_MANAGER' ? inviteRefund : undefined,
                }),
              })
                .then(async () => {
                  setInviteOpen(false)
                  setInviteEmail('')
                  setInviteRole('ORDER_STAFF')
                  setInvitePrice(false)
                  setInviteRefund(false)
                  await loadTeam()
                  notify('Invite sent')
                })
                .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not send invite'))
            }}
          >
            Send invite
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editMember)}
        title={editMember ? `Edit ${editMember.name}` : 'Edit member'}
        subtitle="Update desk role and manager permissions."
        onClose={() => setEditMember(null)}
      >
        <label className="field">Desk role
          <select value={editRole} onChange={(event) => setEditRole(event.target.value as DeskRole)}>
            {ROLES.filter((role) => role !== 'OWNER').map((role) => (
              <option key={role} value={role}>{deskRoleLabel(role)}</option>
            ))}
          </select>
        </label>
        {editRole === 'STORE_MANAGER' ? (
          <>
            <div className="control-row">
              <span className="control-ico"><Shield size={16} /></span>
              <div><strong>Can change prices</strong></div>
              <Toggle on={editPrice} label="Can change prices" onClick={() => setEditPrice((value) => !value)} />
            </div>
            <div className="control-row">
              <span className="control-ico"><Shield size={16} /></span>
              <div><strong>Can issue refunds</strong></div>
              <Toggle on={editRefund} label="Can issue refunds" onClick={() => setEditRefund((value) => !value)} />
            </div>
          </>
        ) : null}
        <div className="modal-actions">
          <button className="btn-soft" type="button" onClick={() => setEditMember(null)}>Cancel</button>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              if (!editMember) return
              void apiFetch(`/admin/assignments/${editMember.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  deskRole: editRole,
                  canChangePrice: editRole === 'STORE_MANAGER' ? editPrice : false,
                  canRefund: editRole === 'STORE_MANAGER' ? editRefund : false,
                }),
              })
                .then(async () => {
                  setEditMember(null)
                  await loadTeam()
                  notify('Member updated')
                })
                .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not update member'))
            }}
          >
            Save
          </button>
        </div>
      </Modal>
    </>
  )
}