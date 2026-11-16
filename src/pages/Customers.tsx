import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { hashQuery } from '../nav'
import { money } from '../lib/format'

export function CustomersPage() {
  const { snapshot, go } = useDashboard()
  const customers = snapshot!.customers
  const preset = hashQuery('customer')
  const [selected, setSelected] = useState(preset || customers[0]?.id || '')
  const [query, setQuery] = useState('')
  const visible = customers.filter((customer) => `${customer.name} ${customer.email} ${customer.city}`.toLowerCase().includes(query.trim().toLowerCase()))
  const current = customers.find((customer) => customer.id === selected) ?? visible[0]
  const orders = snapshot!.orders.filter((order) => order.customerId === current?.id)
  const thread = snapshot!.threads.find((item) => item.customerId === current?.id)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="sub">Patients who order from the Hera app and the pharmacy counter.</p>
        </div>
      </div>
      <section className="split-2">
        <article className="card">
          <div className="table-head">
            <h2>Directory</h2>
            <label className="search">
              <span className="sr-only">Search customers</span>
              <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>City</th><th>Orders</th><th>Spend</th><th>Status</th></tr>
              </thead>
              <tbody>
                {visible.map((customer) => (
                  <tr key={customer.id} onClick={() => setSelected(customer.id)}>
                    <td className="id-cell">{customer.name}</td>
                    <td>{customer.city}</td>
                    <td>{customer.orders}</td>
                    <td>{money(customer.spend)}</td>
                    <td><span className="status"><i className={`dot ${customer.status}`} />{customer.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? <div className="empty">No customers match.</div> : null}
          </div>
        </article>
        {current ? (
          <article className="card">
            <div className="avatar lg">{current.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
            <h2 className="mt">{current.name}</h2>
            <p className="sub">{current.email}</p>
            <div className="profile-stat"><span>Phone</span><b>{current.phone}</b></div>
            <div className="profile-stat"><span>City</span><b>{current.city}</b></div>
            <div className="profile-stat"><span>Customer since</span><b>{current.since}</b></div>
            <div className="profile-stat"><span>Orders</span><b>{orders.length} in this view</b></div>
            <div className="modal-actions">
              <button className="btn-soft" type="button" onClick={() => go('orders', `customer=${current.id}`)}>View orders</button>
              <button className="btn-dark" type="button" disabled={!thread} onClick={() => thread && go('messages', `thread=${thread.id}`)}>Message</button>
            </div>
          </article>
        ) : null}
      </section>
    </>
  )
}
