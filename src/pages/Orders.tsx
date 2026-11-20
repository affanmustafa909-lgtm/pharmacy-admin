import { useMemo, useState } from 'react'
import { OrderDetail } from '../components/OrderDetail'
import { OrderTable } from '../components/OrderTable'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'
import { hashQuery } from '../nav'
import type { OrderStatus } from '../types'

const FILTERS: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready pickup' },
  { id: 'collected', label: 'Collected' },
  { id: 'out_for_delivery', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function OrdersPage() {
  const { snapshot, activeStoreId, activeStore } = useDashboard()
  const data = snapshot!
  const preset = hashQuery('customer')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const orders = useMemo(() => {
    return data.orders.filter((order) => {
      const statusOk = status === 'all' || order.status === status
      const customerOk = !preset || order.customerId === preset
      const storeOk = !activeStoreId || order.pharmacyId === activeStoreId
      const text = `${order.id} ${order.customerName} ${order.itemSummary} ${order.pharmacyName}`.toLowerCase()
      return statusOk && customerOk && storeOk && text.includes(query.trim().toLowerCase())
    })
  }, [data.orders, preset, query, status, activeStoreId])

  const totals = useMemo(() => {
    const active = orders.filter((order) => order.status !== 'cancelled')
    return {
      count: orders.length,
      products: active.reduce((sum, order) => sum + (order.productSubtotal ?? 0), 0),
      delivery: active.reduce((sum, order) => sum + (order.deliveryCharge ?? 0), 0),
      total: active.reduce((sum, order) => sum + order.total, 0),
    }
  }, [orders])

  const customer = data.customers.find((item) => item.id === preset)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p className="sub">
            {customer
              ? `Orders for ${customer.name}.`
              : activeStore
                ? `Orders for ${activeStore.name} — items, delivery charge, and totals.`
                : 'Who ordered, which items, product price, delivery charge, and total — open any row for full detail.'}
          </p>
        </div>
      </div>

      <section className="order-summary-strip">
        <article className="card">
          <div className="stat-top">Orders</div>
          <div className="order-strip-value">{totals.count}</div>
        </article>
        <article className="card">
          <div className="stat-top">Products subtotal</div>
          <div className="order-strip-value">{money(totals.products)}</div>
        </article>
        <article className="card">
          <div className="stat-top">Delivery charges</div>
          <div className="order-strip-value">{money(totals.delivery)}</div>
        </article>
        <article className="card">
          <div className="stat-top">Total revenue</div>
          <div className="order-strip-value">{money(totals.total)}</div>
        </article>
      </section>

      <article className="card">
        <div className="table-head">
          <div className="inline-actions">
            {FILTERS.map((filter) => (
              <button key={filter.id} className={status === filter.id ? 'chip is-on' : 'chip'} type="button" onClick={() => setStatus(filter.id)}>
                {filter.label}
              </button>
            ))}
          </div>
          <label className="search">
            <span className="sr-only">Search orders</span>
            <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <OrderTable orders={orders} onOpen={setOpenId} />
      </article>
      <OrderDetail order={data.orders.find((order) => order.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </>
  )
}
