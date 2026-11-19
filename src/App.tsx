
import { DashboardProvider } from './context/DashboardContext'
import { Shell } from './components/Shell'
import { CustomerApp } from './customer/CustomerApp'
import { CustomerLogin } from './customer/CustomerLogin'

export function App() {
  const path = window.location.pathname

  if (path === '/customer-login') {
    return <CustomerLogin />
  }

  if (path === '/customer') {
    return <CustomerApp />
  }

  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}
