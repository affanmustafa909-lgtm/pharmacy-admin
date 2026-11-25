import { useState } from 'react'
import { API_BASE } from '../services/http'

export function CustomerLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError('')
    setPassword('')
    setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError('')

    if (isRegister) {
      if (name.trim().length < 2) return setError('Enter your full name')
      if (password.length < 8) return setError('Password must be at least 8 characters')
      if (password !== confirm) return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? { name: name.trim(), email, password } : { email, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.token) {
        throw new Error(data.message || (isRegister ? 'Could not create account' : 'Login failed'))
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

  const input = { width: '100%', padding: 12, margin: '8px 0 16px', boxSizing: 'border-box' } as const

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7f5', padding: 20 }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 400, background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px #00000010' }}
      >
        <h1>hera. Pharmacy</h1>
        <h2>{isRegister ? 'Create account' : 'Customer Login'}</h2>
        <p>{isRegister ? 'Sign up to order medicines.' : 'Sign in to manage your orders.'}</p>

        {isRegister && (
          <>
            <label>Full name</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" style={input} />
          </>
        )}

        <label>Email</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" style={input} />

        <label>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={isRegister ? 'At least 8 characters' : 'Enter password'}
          style={input}
        />

        {isRegister && (
          <>
            <label>Confirm password</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={input} />
          </>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 14, background: '#174c3c', color: 'white', border: 0, borderRadius: 8, cursor: 'pointer' }}
        >
          {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Login'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          {isRegister ? 'Already have an account? ' : 'New here? '}
          <button type="button" onClick={switchMode} style={{ background: 'none', border: 0, color: '#174c3c', cursor: 'pointer', textDecoration: 'underline' }}>
            {isRegister ? 'Login' : 'Create account'}
          </button>
        </p>
      </form>
    </div>
  )
}
