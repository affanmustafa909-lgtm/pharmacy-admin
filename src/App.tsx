import { DashboardProvider } from './context/DashboardContext'
import { Shell } from './components/Shell'

export function App() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}
