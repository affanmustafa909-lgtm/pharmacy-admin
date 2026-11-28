import { formatWhen, isPickupOrder, money, orderFlowStatuses, orderLabel } from '../lib/format'
import { useDashboard } from '../context/DashboardContext'
import type { AdminOrder, OrderStatus } from '../types'

export function OrderTable({ orders, onOpen }: { orders: AdminOrder[]; onOpen: (id: string) => void }) {
  const { updateOrderStatus } = useDashboard()

  if (orders.length === 0) {
    return <div className="empty">No orders match this view.</div>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Products</th>
            <th>Delivery</th>
            <th>Total</th>
            <th>Rider</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} onClick={() => onOpen(order.id)}>
              <td className="id-cell">{order.id}</td>
              <td>
                <strong>{order.customerName}</strong>
                <div className="mini">{order.customerPhone || order.customerEmail || order.channel}</div>
              </td>
              <td>
                {order.itemSummary}
                <div className="mini">{order.pharmacyName}{order.deliveryType ? ` · ${order.deliveryType}` : ''}</div>
              </td>
              <td>{money(order.productSubtotal ?? 0)}</td>
              <td>{money(order.deliveryCharge ?? 0)}</td>
              <td><strong>{money(order.total)}</strong></td>
              <td>
                {isPickupOrder(order) ? '—' : order.riderName ? <strong>{order.riderName}</strong> : <span className="mini">Not assigned</span>}
              </td>
              <td onClick={(event) => event.stopPropagation()}>
                <label className="status-edit">
                  <i className={`dot ${order.status}`} />
                  <select
                    className="select status-select"
                    value={order.status}
                    aria-label={`Status for ${order.id}`}
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
                </label>
              </td>
              <td>{formatWhen(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
