import { useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { money } from '../lib/format'

const tile = { border: '1px solid rgba(128,128,128,0.25)', borderRadius: 12, padding: 14 } as const

/**
 * Parallel = all pharmacies side by side.
 * Every number comes from the same orders, medicines and prescriptions the other pages use.
 * BFP rules per store are shown too, so the extra charge can be checked in one place.
 */
export function ParallelPage() {
  const { snapshot } = useDashboard()
  const data = snapshot!

  const rows = useMemo(() => {
    return data.pharmacies.map((store) => {
      const orders = data.orders.filter((order) => order.pharmacyId === store.id)
      const live = orders.filter((order) => order.status !== 'cancelled')
      const meds = data.medicines.filter((medicine) => medicine.storeId === store.id)
      const rx = data.prescriptions.filter((item) => item.pharmacyId === store.id)
      const fees = store.fees ?? []
      return {
        store,
        orders: live.length,
        cancelled: orders.length - live.length,
        revenue: live.reduce((sum, order) => sum + order.total, 0),
        bfp: live.reduce((sum, order) => sum + (order.bfpCharge ?? 0), 0),
        medicines: meds.length,
        outOfStock: meds.filter((medicine) => medicine.stock <= 0).length,
        lowStock: meds.filter((medicine) => medicine.stock > 0 && medicine.stock <= 12).length,
        pendingRx: rx.filter((item) => item.status === 'pending' || item.status === 'needs_clearer_photo').length,
        bfpRules: fees.filter((fee) => fee.kind === 'BFP'),
      }
    })
  }, [data])

  const best = rows.reduce((top, row) => (row.revenue > (top?.revenue ?? -1) ? row : top), rows[0])
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Parallel</h1>
          <p className="sub">All pharmacies side by side: sales, stock, prescriptions and BFP charge.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <article className="card"><div className="empty">No pharmacies yet.</div></article>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={tile}><small>Pharmacies</small><div style={{ fontSize: 22, fontWeight: 700 }}>{rows.length}</div></div>
            <div style={tile}><small>Total sales (all)</small><div style={{ fontSize: 22, fontWeight: 700 }}>{money(totalRevenue)}</div></div>
            <div style={tile}><small>Top store</small><div style={{ fontSize: 22, fontWeight: 700 }}>{best && best.revenue > 0 ? best.store.name : '—'}</div></div>
          </div>

          <article className="card mt">
            <h2>Store comparison</h2>
            <p className="sub">Sales count delivered and open orders. Cancelled orders are left out.</p>
            <div className="table-wrap table-static mt">
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy</th><th>Status</th><th>Orders</th><th>Cancelled</th><th>Sales</th><th>Share</th>
                    <th>BFP collected</th><th>Medicines</th><th>Low stock</th><th>Out of stock</th><th>Rx waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.store.id}>
                      <td><strong>{row.store.name}</strong><br /><small>{row.store.code ?? ''}</small></td>
                      <td>{row.store.status ?? (row.store.isOpen ? 'open' : 'closed')}{row.store.acceptingOrders === false ? ' · not taking orders' : ''}</td>
                      <td>{row.orders}</td>
                      <td>{row.cancelled}</td>
                      <td>{money(row.revenue)}</td>
                      <td>{totalRevenue > 0 ? `${Math.round((row.revenue / totalRevenue) * 100)}%` : '—'}</td>
                      <td>{money(row.bfp)}</td>
                      <td>{row.medicines}</td>
                      <td>{row.lowStock}</td>
                      <td>{row.outOfStock}</td>
                      <td>{row.pendingRx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card mt">
            <h2>BFP charge per pharmacy</h2>
            <p className="sub">
              BFP is an extra charge added to the order total. Example: products 2,000 + BFP 50 = 2,050.
              Set or remove a BFP rule in Pharmacies → Delivery and fees.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
              {rows.map((row) => (
                <div key={row.store.id} style={tile}>
                  <strong>{row.store.name}</strong>
                  {row.bfpRules.length === 0 ? (
                    <div className="sub">No BFP rule. No BFP is charged here.</div>
                  ) : (
                    row.bfpRules.map((rule, index) => (
                      <div key={index} className="sub">
                        {rule.label}: {rule.mode === 'PERCENT' ? `${rule.amount}% of ${String(rule.percentBase ?? '').replaceAll('_', ' ').toLowerCase()}` : `${money(rule.amount)} fixed`}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </>
  )
}
