import { Modal } from './Modal'
import { formatWhen, isPickupOrder, money, orderFlowStatuses, orderLabel } from '../lib/format'
import { useDashboard } from '../context/DashboardContext'
import type { AdminOrder, OrderStatus } from '../types'

function nextActions(order: AdminOrder): { label: string; status: OrderStatus }[] {
  const pickup = isPickupOrder(order)
  switch (order.status) {
    case 'placed':
      return [
        { label: 'Start preparing', status: 'preparing' },
        { label: 'Cancel order', status: 'cancelled' },
      ]
    case 'preparing':
      return pickup
        ? [
            { label: 'Ready for pickup', status: 'ready_for_pickup' },
            { label: 'Cancel order', status: 'cancelled' },
          ]
        : [
            { label: 'Send with rider', status: 'out_for_delivery' },
            { label: 'Cancel order', status: 'cancelled' },
          ]
    case 'ready_for_pickup':
      return [{ label: 'Mark collected', status: 'collected' }]
    case 'out_for_delivery':
      return [{ label: 'Mark delivered', status: 'delivered' }]
    default:
      return []
  }
}

export function OrderDetail({ order, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  const { updateOrderStatus } = useDashboard()
  const actions = order ? nextActions(order) : []

  return (
    <Modal
      open={Boolean(order)}
      wide
      title={order?.id ?? 'Order'}
      subtitle={order ? `${order.customerName} · ${order.pharmacyName}` : undefined}
      onClose={onClose}
    >
      {order ? (
        <>
          <div className="order-detail-strip">
            <div className="order-detail-kpi">
              <span>Products</span>
              <b>{money(order.productSubtotal ?? 0)}</b>
            </div>
            <div className="order-detail-kpi">
              <span>
                Delivery
                {order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : ''}
              </span>
              <b>{money(order.deliveryCharge ?? 0)}</b>
            </div>
            <div className="order-detail-kpi">
              <span>Service / Promo</span>
              <b>
                {(order.discount ?? 0) > 0
                  ? `-${money(order.discount ?? 0)}`
                  : money((order.serviceCharge ?? 0) + (order.bfpCharge ?? 0))}
              </b>
            </div>
            <div className="order-detail-kpi is-total">
              <span>Final Total</span>
              <b>{money(order.total)}</b>
            </div>
          </div>

          <div className="order-detail-grid">
            <div>
              <h4 className="detail-section">Customer & Delivery</h4>
              <div className="profile-stat"><span>Customer</span><b>{order.customerName}</b></div>
              {order.customerEmail ? <div className="profile-stat"><span>Email</span><b>{order.customerEmail}</b></div> : null}
              {order.customerPhone ? <div className="profile-stat"><span>Phone</span><b>{order.customerPhone}</b></div> : null}
              <div className="profile-stat"><span>Channel</span><b>{order.channel}</b></div>
              <div className="profile-stat"><span>Pharmacy</span><b>{order.pharmacyName}</b></div>
              <div className="profile-stat">
                <span>Delivery</span>
                <b>
                  {order.deliveryType || '—'}
                  {order.deliveryDistanceKm != null ? ` · ${order.deliveryDistanceKm.toFixed(1)} km` : ''}
                </b>
              </div>
              <div className="profile-stat"><span>Payment</span><b>{order.paymentLabel || order.paymentStatus || '—'}</b></div>
              <div className="profile-stat"><span>Address</span><b className="detail-wrap">{order.addressLine || '—'}</b></div>
              {order.prescriptionNumber ? (
                <div className="profile-stat"><span>Prescription</span><b>{order.prescriptionNumber}</b></div>
              ) : null}
              <div className="profile-stat">
                <span>Status</span>
                <select
                  className="select status-select"
                  value={order.status}
                  aria-label="Order status"
                  onChange={(event) => {
                    const next = event.target.value as OrderStatus
                    if (next === order.status) return
                    void updateOrderStatus(order.id, next)
                  }}
                >
                  {orderFlowStatuses(order).map((status) => (
                    <option key={status} value={status}>{orderLabel(status)}</option>
                  ))}
                </select>
              </div>
              <div className="profile-stat"><span>Placed</span><b>{formatWhen(order.createdAt)}</b></div>
            </div>

            <div>
              <h4 className="detail-section">Ordered Items</h4>
              {order.items && order.items.length > 0 ? (
                <div className="table-wrap">
                  <table className="table-static">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th className="num-col">Unit</th>
                        <th className="num-col">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={`${item.sku}-${item.name}`}>
                          <td>
                            <strong>{item.name}</strong>
                            <div className="mini">{item.sku}</div>
                          </td>
                          <td>{item.quantity}</td>
                          <td className="num-col">{money(item.unitPrice)}</td>
                          <td className="num-col"><strong>{money(item.lineTotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="profile-stat"><span>Items</span><b>{order.itemSummary}</b></div>
              )}

              <h4 className="detail-section">Price & Charge Breakdown</h4>
              <div className="profile-stat"><span>Products subtotal</span><b>{money(order.productSubtotal ?? 0)}</b></div>
              <div className="profile-stat">
                <span>
                  Delivery charge
                  {order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : ''}
                </span>
                <b>{money(order.deliveryCharge ?? 0)}</b>
              </div>
              <div className="profile-stat"><span>Service charge</span><b>{money(order.serviceCharge ?? 0)}</b></div>
              {(order.bfpCharge ?? 0) > 0 ? (
                <div className="profile-stat"><span>BFP</span><b>{money(order.bfpCharge ?? 0)}</b></div>
              ) : null}
              {(order.discount ?? 0) > 0 ? (
                <div className="profile-stat"><span>Promo discount</span><b>-{money(order.discount ?? 0)}</b></div>
              ) : null}
              {order.charges?.filter((charge) => charge.amount > 0).map((charge) => (
                <div className="profile-stat" key={`${charge.kind}-${charge.label}`}>
                  <span>{charge.label}{charge.mode === 'PERCENT' ? ` (${charge.rate}%)` : ''}</span>
                  <b>{money(charge.amount)}</b>
                </div>
              ))}
              <div className="profile-stat order-final-row"><span>Final total</span><b>{money(order.total)}</b></div>
            </div>
          </div>

          <div className="modal-actions">
            {actions.length === 0 ? <span className="muted">No further actions.</span> : null}
            {actions.map((action) => (
              <button
                key={action.status}
                className={action.status === 'cancelled' ? 'btn-soft' : 'btn-dark'}
                type="button"
                onClick={() => {
                  void updateOrderStatus(order.id, action.status).then((ok) => {
                    if (ok) onClose()
                  })
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  )
}
