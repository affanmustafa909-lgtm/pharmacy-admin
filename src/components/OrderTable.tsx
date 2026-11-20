import { formatWhen, money, orderFlowStatuses, orderLabel } from '../lib/format'
import { useDashboard } from '../context/DashboardContext'
import type { AdminOrder, OrderStatus } from '../types'

export function OrderTable({ orders, onOpen }: { orders: AdminOrder[]; onOpen: (id: string) => void }) {
  const { updateOrderStatus } = useDashboard()

  if (orders.length === 0) {
    return <div className="empty">No orders match this view.</div>
  }

  return (
    <div className="table-wrap orders-table">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th className="num-col">Products</th>
            <th className="num-col">Delivery</th>
            <th className="num-col">Total</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} onClick={() => onOpen(order.id)}>
              <td className="id-cell">
                <div>{order.id}</div>
                <div className="mini">{order.paymentLabel || order.paymentStatus || order.channel}</div>
              </td>
              <td>
                <strong>{order.customerName}</strong>
                <div className="mini">{order.customerPhone || order.customerEmail || order.channel}</div>
              </td>
              <td>
                <div className="order-items-cell">{order.itemSummary}</div>
                <div className="mini">
                  {order.pharmacyName}
                  {order.deliveryType ? ` · ${order.deliveryType}` : ''}
                  {order.deliveryDistanceKm != null ? ` · ${order.deliveryDistanceKm.toFixed(1)} km` : ''}
                </div>
              </td>
              <td className="num-col">{money(order.productSubtotal ?? 0)}</td>
              <td className="num-col">
                <div>{money(order.deliveryCharge ?? 0)}</div>
                {order.deliveryDistanceKm != null ? (
                  <div className="mini">{order.deliveryDistanceKm.toFixed(1)} km</div>
                ) : null}
              </td>
              <td className="num-col">
                <strong>{money(order.total)}</strong>
                {(order.discount ?? 0) > 0 ? (
                  <div className="mini">-{money(order.discount ?? 0)}</div>
                ) : null}
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
              <td className="date-col">{formatWhen(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
