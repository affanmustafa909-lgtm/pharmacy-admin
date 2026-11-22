
import { useState } from 'react'
import { API_BASE } from '../services/http'

export function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.token) {
        throw new Error(data.message || 'Login failed')
      }

      if (data.user.role !== 'CUSTOMER') {
        throw new Error('Customer account required')
      }

      sessionStorage.setItem('hera-customer-token', data.token)
      sessionStorage.setItem('hera-customer-user', JSON.stringify(data.user))

      window.location.href = '/customer'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f5f7f5',
      padding: 20
    }}>
      <form onSubmit={handleLogin} style={{
        width: '100%',
        maxWidth: 400,
        background: 'white',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 4px 20px #00000010'
      }}>
        <h1>hera. Pharmacy</h1>
        <h2>Customer Login</h2>
        <p>Sign in to manage your orders.</p>

        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter your email"
          style={{ width: '100%', padding: 12, margin: '8px 0 16px' }}
        />

        <label>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
          style={{ width: '100%', padding: 12, margin: '8px 0 16px' }}
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: '#174c3c',
            color: 'white',
            border: 0,
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
