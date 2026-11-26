import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../services/http'

const TOKEN_KEY = 'hera-customer-token'
const USER_KEY = 'hera-customer-user'

// Catalog routes ka prefix backend ki main file mein tay hota hai.
// Page khud ye prefixes try karta hai jab tak ek chal na jaye.
const CATALOG_PREFIXES = ['/catalog', '', '/mobile', '/customer', '/store']
let catalogPrefix: string | null = null

// Prescription routes ka prefix bhi isi tarah dhoondha jata hai.
const RX_PREFIXES = ['/prescriptions', '/customer/prescriptions', '/mobile/prescriptions', '/rx']
let rxPrefix: string | null = null

interface CustomerOrder {
  id: string
  total: number
  status: string
  storeName: string
  deliveryType: string
  paymentLabel: string
  createdAt: string
  itemCount: number
}

interface StoreItem {
  id: string
  name: string
  address?: string
  openUntil?: string
}

// Catalog product ki shakal exact pata nahi, isliye sab fields optional rakhi hain.
interface ProductItem {
  id: string
  storeId?: string
  name: string
  brand?: string
  strength?: string
  category?: string
  price: number
  unitLabel?: string
  stock?: number
  inStock?: boolean
  rxRequired?: boolean
  expired?: boolean
}

interface MyPrescription {
  number: string
  status: string
  storeName: string
  customerNote: string
  notes: string
  scannedText: string
  verifiedItems: { name: string; approvedQty?: number; quantity?: string }[]
  submittedAt: string
}

type CartLine = { product: ProductItem; quantity: number }
type Tab = 'medicines' | 'cart' | 'orders' | 'prescriptions'
type Quote = { total: number; productSubtotal: number; deliveryCharge: number; serviceCharge: number; bfpCharge: number; discount: number; etaMinutes?: number }

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function customerFetch(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) {
    window.location.href = '/customer-login'
    throw new ApiError('Sign in required', 401)
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY)
    window.location.href = '/customer-login'
    throw new ApiError('Sign in required', 401)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('API error', path, response.status, data)
    const detail = [data.message || 'Request failed', `[${response.status}${data.code ? ' ' + data.code : ''} ${init.method ?? 'GET'} ${path}]`].join(' ')
    throw new ApiError(detail, response.status)
  }
  return data
}

async function catalogFetch(path: string) {
  if (catalogPrefix !== null) return customerFetch(`${catalogPrefix}${path}`)
  let last: unknown
  for (const prefix of CATALOG_PREFIXES) {
    try {
      const data = await customerFetch(`${prefix}${path}`)
      catalogPrefix = prefix
      return data
    } catch (err) {
      last = err
      if (!(err instanceof ApiError) || err.status !== 404) throw err
    }
  }
  throw last instanceof Error ? last : new Error('Catalog route not found')
}

// Photo upload ke liye: FormData ke saath Content-Type browser khud lagata hai.
async function rxRequest(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) {
    window.location.href = '/customer-login'
    throw new ApiError('Sign in required', 401)
  }
  const isForm = init.body instanceof FormData
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (!isForm) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY)
    window.location.href = '/customer-login'
    throw new ApiError('Sign in required', 401)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.message || 'Request failed', response.status)
  return data
}

async function rxFetch(path: string, init: RequestInit = {}) {
  if (rxPrefix !== null) return rxRequest(`${rxPrefix}${path}`, init)
  let last: unknown
  for (const prefix of RX_PREFIXES) {
    try {
      const data = await rxRequest(`${prefix}${path}`, init)
      rxPrefix = prefix
      return data
    } catch (err) {
      last = err
      if (!(err instanceof ApiError) || err.status !== 404) throw err
    }
  }
  throw last instanceof Error ? last : new Error('Prescription route not found')
}

const RX_STATUS: Record<string, string> = {
  pending: 'Pending review',
  needs_clearer_photo: 'Needs a clearer photo',
  approved: 'Verified',
  dispensed: 'Dispensed',
  rejected: 'Rejected',
}

const MAX_RX_BYTES = 5 * 1024 * 1024

const card = { background: 'white', padding: 20, marginBottom: 15, borderRadius: 12 } as const
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer' } as const
const green = { ...btn, background: '#1f7a4d', color: 'white' } as const

export function CustomerApp() {
  const [tab, setTab] = useState<Tab>('medicines')
  const [stores, setStores] = useState<StoreItem[]>([])
  const [storeId, setStoreId] = useState('')
  const [products, setProducts] = useState<ProductItem[]>([])
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [deliveryType, setDeliveryType] = useState<'standard' | 'express' | 'pickup'>('standard')
  const [paymentLabel, setPaymentLabel] = useState('Cash on delivery')
  const [address, setAddress] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Prescriptions
  const [rxList, setRxList] = useState<MyPrescription[]>([])
  const [rxStoreId, setRxStoreId] = useState('')
  const [rxFile, setRxFile] = useState<File | null>(null)
  const [rxNote, setRxNote] = useState('')
  const [rxText, setRxText] = useState('')
  const [rxBusy, setRxBusy] = useState(false)
  const [rxError, setRxError] = useState('')

  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || '{}') as { name?: string }
    } catch {
      return {}
    }
  }, [])

  async function loadOrders() {
    const data = await customerFetch('/orders/mine')
    setOrders(data.orders || [])
  }

  async function loadRx() {
    try {
      const data = await rxFetch('/mine')
      setRxList(data.prescriptions || [])
      setRxError('')
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Could not load prescriptions')
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError('')
      try {
        const data = await catalogFetch('/stores')
        const list: StoreItem[] = data.stores || []
        setStores(list)
        if (list[0]) {
          setStoreId(list[0].id)
          setRxStoreId(list[0].id)
        }
        await loadOrders()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
      await loadRx()
    }
    void init()
  }, [])

  useEffect(() => {
    if (!storeId) return
    async function loadProducts() {
      setError('')
      try {
        const data = await catalogFetch(`/products?storeId=${encodeURIComponent(storeId)}&q=${encodeURIComponent(search)}`)
        setProducts(data.products || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load medicines')
      }
    }
    const timer = setTimeout(() => void loadProducts(), 250)
    return () => clearTimeout(timer)
  }, [storeId, search, refreshKey])

  const cartTotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0)

  // Checkout ka asli total (delivery/service charges ke saath) backend se
  useEffect(() => {
    if (cart.length === 0 || !storeId) {
      setQuote(null)
      return
    }
    customerFetch('/orders/quote', {
      method: 'POST',
      body: JSON.stringify({
        storeId,
        deliveryType,
        items: cart.map(l => ({ productId: l.product.id, quantity: l.quantity })),
      }),
    })
      .then(setQuote)
      .catch(() => setQuote(null))
  }, [cart, storeId, deliveryType])

  function changeStore(id: string) {
    if (cart.length > 0 && !window.confirm('Changing the store will empty your cart. Continue?')) return
    setCart([])
    setStoreId(id)
  }

  function addToCart(product: ProductItem) {
    setNotice('')
    setCart(prev => {
      const found = prev.find(l => l.product.id === product.id)
      if (found) return prev.map(l => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(id: string, delta: number) {
    setCart(prev => prev.map(l => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l)).filter(l => l.quantity > 0))
  }

  async function placeOrder() {
    if (cart.length === 0) return
    if (deliveryType !== 'pickup' && !address.trim()) {
      setError('Please enter a delivery address')
      return
    }
    setError('')
    setPlacing(true)
    try {
      const result = await customerFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          deliveryType,
          paymentLabel,
          addressLine: deliveryType === 'pickup' ? '' : address.trim(),
          items: cart.map(l => ({ productId: l.product.id, quantity: l.quantity })),
        }),
      })
      setCart([])
      setAddress('')
      setNotice(`Order ${result.id} placed successfully!`)
      await loadOrders()
      setRefreshKey(k => k + 1)
      setTab('orders')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order')
    } finally {
      setPlacing(false)
    }
  }

  async function cancelOrder(id: string) {
    if (!window.confirm('Cancel this order?')) return
    setError('')
    try {
      await customerFetch(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
      setNotice(`Order ${id} cancelled`)
      await loadOrders()
      setRefreshKey(k => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel order')
    }
  }

  function pickRxFile(file: File | null) {
    if (!file) {
      setRxFile(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setRxError('Please choose an image file')
      return
    }
    if (file.size > MAX_RX_BYTES) {
      setRxError('Image is too large (max 5 MB)')
      return
    }
    setRxError('')
    setRxFile(file)
  }

  async function uploadPrescription() {
    if (rxBusy) return
    if (!rxStoreId) {
      setRxError('Choose a store')
      return
    }
    if (!rxFile) {
      setRxError('Choose a prescription photo')
      return
    }
    setRxBusy(true)
    setRxError('')
    setNotice('')
    try {
      const form = new FormData()
      form.append('storeId', rxStoreId)
      form.append('image', rxFile)
      if (rxNote.trim()) form.append('customerNote', rxNote.trim())
      if (rxText.trim()) form.append('scannedText', rxText.trim())
      const result = await rxFetch('', { method: 'POST', body: form })
      setNotice(`Prescription ${result.prescription?.number ?? ''} uploaded. The pharmacist will review it.`)
      setRxFile(null)
      setRxNote('')
      setRxText('')
      await loadRx()
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Could not upload the prescription')
    } finally {
      setRxBusy(false)
    }
  }

  async function replaceRxPhoto(number: string, file: File | null) {
    if (!file || rxBusy) return
    if (!file.type.startsWith('image/') || file.size > MAX_RX_BYTES) {
      setRxError('Choose an image up to 5 MB')
      return
    }
    setRxBusy(true)
    setRxError('')
    try {
      const form = new FormData()
      form.append('image', file)
      await rxFetch(`/${encodeURIComponent(number)}/replace-image`, { method: 'POST', body: form })
      setNotice(`New photo sent for ${number}.`)
      await loadRx()
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Could not replace the photo')
    } finally {
      setRxBusy(false)
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    window.location.href = '/customer-login'
  }

  const tabBtn = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} style={{ ...btn, background: tab === id ? '#1f7a4d' : '#e3e8e4', color: tab === id ? 'white' : '#222' }}>
      {label}
    </button>
  )

  const soldOut = (p: ProductItem) => p.expired === true || p.inStock === false || (p.stock !== undefined && p.stock <= 0)
  const soldLabel = (p: ProductItem) => (p.expired === true ? 'Expired' : 'Out of stock')

  return (
    <main style={{ padding: 30, fontFamily: 'Arial', background: '#f5f7f5', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>hera. Customer Portal{user.name ? ` - ${user.name}` : ''}</h1>
        <button onClick={logout} style={btn}>Logout</button>
      </header>

      <nav style={{ display: 'flex', gap: 10, margin: '10px 0 20px' }}>
        {tabBtn('medicines', 'Medicines')}
        {tabBtn('cart', `Cart (${cartCount})`)}
        {tabBtn('orders', 'My Orders')}
        {tabBtn('prescriptions', 'Prescriptions')}
      </nav>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {notice && <p style={{ color: '#1f7a4d' }}>{notice}</p>}

      {tab === 'medicines' && !loading && (
        <section>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <select value={storeId} onChange={e => changeStore(e.target.value)} style={{ padding: 12 }}>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." style={{ flex: 1, minWidth: 220, maxWidth: 400, padding: 12 }} />
          </div>
          {stores.length === 0 && <p>No open stores found. Admin panel mein store active aur "open" hona chahiye.</p>}
          {products.length === 0 && stores.length > 0 && <p>No medicines found in this store.</p>}
          {products.map(p => (
            <article key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{p.name} {p.strength}</h3>
                <p style={{ margin: '4px 0' }}>{[p.brand, p.category].filter(Boolean).join(' • ')}</p>
                <p style={{ margin: '4px 0' }}>
                  ${Number(p.price).toFixed(2)} {p.unitLabel ? `/ ${p.unitLabel}` : ''}
                  {p.rxRequired ? ' • Prescription required' : ''}
                </p>
              </div>
              <button onClick={() => addToCart(p)} disabled={soldOut(p)} style={green}>
                {soldOut(p) ? soldLabel(p) : 'Add to cart'}
              </button>
            </article>
          ))}
        </section>
      )}

      {tab === 'cart' && (
        <section>
          {cart.length === 0 && <p>Your cart is empty.</p>}
          {cart.map(l => (
            <article key={l.product.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{l.product.name}</h3>
                <p style={{ margin: '4px 0' }}>${(l.product.price * l.quantity).toFixed(2)}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => changeQty(l.product.id, -1)} style={btn}>-</button>
                <strong>{l.quantity}</strong>
                <button onClick={() => changeQty(l.product.id, 1)} style={btn}>+</button>
              </div>
            </article>
          ))}

          {cart.length > 0 && (
            <div style={card}>
              <h3>Checkout</h3>
              <p>
                <label>
                  Delivery{' '}
                  <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as typeof deliveryType)}>
                    <option value="standard">Standard delivery</option>
                    <option value="express">Express delivery</option>
                    <option value="pickup">Store pickup</option>
                  </select>
                </label>
              </p>
              <p>
                <label>
                  Payment{' '}
                  <select value={paymentLabel} onChange={e => setPaymentLabel(e.target.value)}>
                    <option>Cash on delivery</option>
                    <option>Card</option>
                    <option>Wallet</option>
                  </select>
                </label>
              </p>
              {deliveryType !== 'pickup' && (
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" style={{ width: '100%', padding: 12, margin: '8px 0 12px' }} />
              )}
              {quote ? (
                <div>
                  <p style={{ margin: '4px 0' }}>Products: ${quote.productSubtotal.toFixed(2)}</p>
                  <p style={{ margin: '4px 0' }}>Delivery: ${quote.deliveryCharge.toFixed(2)}</p>
                  <p style={{ margin: '4px 0' }}>Service: ${quote.serviceCharge.toFixed(2)}</p>
                  {quote.bfpCharge > 0 && <p style={{ margin: '4px 0' }}>BFP: ${quote.bfpCharge.toFixed(2)}</p>}
                  <p><strong>Total: ${quote.total.toFixed(2)}</strong></p>
                </div>
              ) : (
                <p><strong>Subtotal: ${cartTotal.toFixed(2)}</strong></p>
              )}
              <button onClick={placeOrder} disabled={placing} style={green}>
                {placing ? 'Placing order...' : 'Place Order'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'orders' && !loading && (
        <section>
          {orders.length === 0 && <p>You have not placed any orders yet.</p>}
          {orders.map(order => (
            <article key={order.id} style={card}>
              <h3>Order #{order.id}</h3>
              <p>Store: {order.storeName}</p>
              <p>Items: {order.itemCount}</p>
              <p>Total: ${order.total.toFixed(2)}</p>
              <p>Status: {order.status}</p>
              <p>Delivery: {order.deliveryType}</p>
              <p>Payment: {order.paymentLabel}</p>
              <p>{new Date(order.createdAt).toLocaleString()}</p>
              {order.status === 'placed' && (
                <button onClick={() => cancelOrder(order.id)} style={btn}>Cancel order</button>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === 'prescriptions' && !loading && (
        <section>
          <div style={card}>
            <h3>Upload a prescription</h3>
            <p>
              <label>
                Store{' '}
                <select value={rxStoreId} onChange={e => setRxStoreId(e.target.value)} style={{ padding: 8 }}>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </p>
            <p>
              <input type="file" accept="image/*" onChange={e => pickRxFile(e.target.files?.[0] ?? null)} />
            </p>
            <input
              value={rxNote}
              onChange={e => setRxNote(e.target.value)}
              placeholder="Note for the pharmacist (optional)"
              style={{ width: '100%', padding: 12, margin: '4px 0 8px', boxSizing: 'border-box' }}
            />
            <textarea
              value={rxText}
              onChange={e => setRxText(e.target.value)}
              placeholder="Text written on the prescription (optional, helps the pharmacist)"
              rows={3}
              style={{ width: '100%', padding: 12, margin: '0 0 12px', boxSizing: 'border-box' }}
            />
            {rxError && <p style={{ color: 'red' }}>{rxError}</p>}
            <button onClick={uploadPrescription} disabled={rxBusy} style={green}>
              {rxBusy ? 'Uploading...' : 'Upload prescription'}
            </button>
          </div>

          <h3>My prescriptions</h3>
          {rxList.length === 0 && <p>You have not uploaded any prescriptions yet.</p>}
          {rxList.map(item => (
            <article key={item.number} style={card}>
              <h3 style={{ margin: 0 }}>{item.number}</h3>
              <p style={{ margin: '4px 0' }}>Store: {item.storeName}</p>
              <p style={{ margin: '4px 0' }}><strong>Status: {RX_STATUS[item.status] ?? item.status}</strong></p>
              {item.notes && <p style={{ margin: '4px 0' }}>Pharmacist note: {item.notes}</p>}
              {item.verifiedItems.length > 0 && (
                <p style={{ margin: '4px 0' }}>
                  Verified: {item.verifiedItems.map(v => `${v.name} x${v.approvedQty ?? v.quantity ?? ''}`).join(', ')}
                </p>
              )}
              <p style={{ margin: '4px 0' }}>{new Date(item.submittedAt).toLocaleString()}</p>
              {item.status === 'needs_clearer_photo' && (
                <p>
                  <label>
                    Upload a clearer photo{' '}
                    <input type="file" accept="image/*" onChange={e => void replaceRxPhoto(item.number, e.target.files?.[0] ?? null)} />
                  </label>
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  )
}