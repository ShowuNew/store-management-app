import { useState } from 'react'
import LoginPage      from './pages/LoginPage'
import DashboardPage  from './pages/DashboardPage'
import DailyWorkPage  from './pages/DailyWorkPage'
import HygienePage    from './pages/HygienePage'
import InspectionPage from './pages/InspectionPage'
import AnomalyPage    from './pages/AnomalyPage'
import EquipmentPage  from './pages/EquipmentPage'
import BottomNav      from './components/BottomNav'
import type { User, Page } from './types'

const NAV_PAGES: Page[] = ['dashboard', 'daily-work', 'hygiene', 'anomaly', 'equipment']

function App() {
  const [user, setUser]               = useState<User | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('login')

  const handleLogin   = (u: User) => { setUser(u); setCurrentPage('dashboard') }
  const handleLogout  = ()        => { setUser(null); setCurrentPage('login') }
  const goBack        = ()        => setCurrentPage('dashboard')

  if (!user) return <LoginPage onLogin={handleLogin} />

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':  return <DashboardPage  user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
      case 'daily-work': return <DailyWorkPage  user={user} onBack={goBack} />
      case 'hygiene':    return <HygienePage    user={user} onBack={goBack} />
      case 'inspection': return <InspectionPage user={user} onBack={goBack} />
      case 'anomaly':    return <AnomalyPage    user={user} onBack={goBack} />
      case 'equipment':  return <EquipmentPage  user={user} onBack={goBack} />
      default:           return <DashboardPage  user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
    }
  }

  const showBottomNav = NAV_PAGES.includes(currentPage)

  return (
    <div className="flex flex-col min-h-dvh">
      <div className={showBottomNav ? 'pb-16' : ''}>
        {renderPage()}
      </div>
      {showBottomNav && (
        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      )}
    </div>
  )
}

export default App
