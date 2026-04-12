import { useState, lazy, Suspense } from 'react'
import {
  Home, ClipboardCheck, ShieldCheck, AlertTriangle, Wrench,
  ClipboardList, LayoutDashboard, BarChart2, Coffee, Building2,
} from 'lucide-react'
import BottomNav      from './components/BottomNav'
import AdminBottomNav from './components/AdminBottomNav'
import type { User, Page } from './types'

const LoginPage            = lazy(() => import('./pages/LoginPage'))
const DashboardPage        = lazy(() => import('./pages/DashboardPage'))
const DailyWorkPage        = lazy(() => import('./pages/DailyWorkPage'))
const HygienePage          = lazy(() => import('./pages/HygienePage'))
const InspectionPage       = lazy(() => import('./pages/InspectionPage'))
const AnomalyPage          = lazy(() => import('./pages/AnomalyPage'))
const EquipmentPage        = lazy(() => import('./pages/EquipmentPage'))
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard'))
const RecordsPage          = lazy(() => import('./pages/admin/RecordsPage'))
const AnomalyManagePage    = lazy(() => import('./pages/admin/AnomalyManagePage'))
const StatsPage            = lazy(() => import('./pages/admin/StatsPage'))
const MysteryManagePage    = lazy(() => import('./pages/admin/MysteryManagePage'))
const StoreStatusPage      = lazy(() => import('./pages/admin/StoreStatusPage'))
const MysteryFormPage      = lazy(() => import('./pages/MysteryFormPage'))
const SubManagerManagePage = lazy(() => import('./pages/SubManagerManagePage'))
const SubManagerFormPage   = lazy(() => import('./pages/SubManagerFormPage'))
const CoffeeCheckPage      = lazy(() => import('./pages/CoffeeCheckPage'))

function PageLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
    </div>
  )
}

// 若 URL 帶有 token 參數，直接顯示神秘客表單（無需登入）
const URL_TOKEN = new URLSearchParams(window.location.search).get('token')
// 若 URL 帶有 sub-token 參數，直接顯示小店長工作日誌（無需登入）
const SUB_TOKEN = new URLSearchParams(window.location.search).get('sub-token')

const NAV_PAGES: Page[]       = ['dashboard', 'daily-work', 'hygiene', 'anomaly', 'equipment', 'inspection', 'stats', 'sub-manager-manage', 'coffee-check']
const ADMIN_NAV_PAGES: Page[] = ['admin-dashboard', 'admin-records', 'admin-anomaly', 'admin-stats', 'mystery-manage', 'admin-store-status']

const staffTabs = [
  { page: 'dashboard'    as Page, icon: Home,          label: '首頁'   },
  { page: 'daily-work'   as Page, icon: ClipboardCheck, label: '每日確認' },
  { page: 'hygiene'      as Page, icon: ShieldCheck,    label: '衛生管理' },
  { page: 'inspection'   as Page, icon: ClipboardList,  label: '店鋪點檢' },
  { page: 'anomaly'      as Page, icon: AlertTriangle,  label: '異常回報' },
  { page: 'equipment'    as Page, icon: Wrench,         label: '設備保養' },
  { page: 'coffee-check' as Page, icon: Coffee,         label: '咖啡自檢' },
]

const adminTabs = [
  { page: 'admin-dashboard'   as Page, icon: LayoutDashboard, label: '總覽'   },
  { page: 'admin-store-status'as Page, icon: Building2,       label: '店鋪狀況' },
  { page: 'admin-records'     as Page, icon: ClipboardList,   label: '紀錄查閱' },
  { page: 'admin-anomaly'     as Page, icon: AlertTriangle,   label: '異常管理' },
  { page: 'admin-stats'       as Page, icon: BarChart2,       label: '數據統計' },
]

function App() {
  const [user, setUser]               = useState<User | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('login')

  const handleLogin  = (u: User) => {
    setUser(u)
    setCurrentPage(u.role === 'supervisor' || u.role === 'admin' ? 'admin-dashboard' : 'dashboard')
  }
  const handleLogout = () => { setUser(null); setCurrentPage('login') }
  const goBack       = () => setCurrentPage(
    ADMIN_NAV_PAGES.includes(currentPage) ? 'admin-dashboard' : 'dashboard'
  )

  // 神秘客公開表單（無需登入）
  if (URL_TOKEN) return <Suspense fallback={<PageLoading />}><MysteryFormPage token={URL_TOKEN} /></Suspense>
  // 小店長公開表單（無需登入）
  if (SUB_TOKEN) return <Suspense fallback={<PageLoading />}><SubManagerFormPage token={SUB_TOKEN} /></Suspense>

  if (!user) return <Suspense fallback={<PageLoading />}><LoginPage onLogin={handleLogin} /></Suspense>

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':       return <DashboardPage     user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
      case 'daily-work':      return <DailyWorkPage     user={user} onBack={goBack} />
      case 'hygiene':         return <HygienePage       user={user} onBack={goBack} />
      case 'inspection':      return <InspectionPage    user={user} onBack={goBack} />
      case 'anomaly':         return <AnomalyPage       user={user} onBack={goBack} />
      case 'equipment':       return <EquipmentPage     user={user} onBack={goBack} />
      case 'stats':           return <StatsPage         user={user} onBack={goBack} />
      case 'admin-dashboard': return <AdminDashboard    user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
      case 'admin-records':   return <RecordsPage       user={user} onBack={goBack} />
      case 'admin-anomaly':   return <AnomalyManagePage user={user} onBack={goBack} />
      case 'admin-stats':     return <StatsPage         user={user} onBack={goBack} />
      case 'mystery-manage':      return <MysteryManagePage    user={user} onBack={goBack} />
      case 'admin-store-status': return <StoreStatusPage      user={user} onBack={goBack} />
      case 'sub-manager-manage': return <SubManagerManagePage user={user} onBack={goBack} />
      case 'coffee-check':       return <CoffeeCheckPage      user={user} onBack={goBack} />
      default:                   return <DashboardPage        user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
    }
  }

  const showBottomNav      = NAV_PAGES.includes(currentPage)
  const showAdminBottomNav = ADMIN_NAV_PAGES.includes(currentPage)
  const activeTabs         = showBottomNav ? staffTabs : showAdminBottomNav ? adminTabs : []

  return (
    <div className="flex min-h-dvh bg-gray-50">
      <Suspense fallback={<PageLoading />}>
      {/* Desktop sidebar */}
      {activeTabs.length > 0 && (
        <aside className="hidden md:flex flex-col w-56 fixed inset-y-0 left-0 bg-white border-r border-gray-100 z-20">
          <div className="h-1 w-full shrink-0" style={{ background: 'linear-gradient(90deg, #00a040, #007d30)' }} />
          <div className="px-2 py-4 flex-1 flex flex-col gap-0.5 overflow-y-auto">
            {activeTabs.map(({ page, icon: Icon, label }) => {
              const active = currentPage === page
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full transition-all ${
                    active
                      ? 'bg-green-50 text-green-700 font-semibold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-sm">{label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-600" />}
                </button>
              )
            })}
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className={`flex-1 min-w-0 ${activeTabs.length > 0 ? 'md:ml-56' : ''}`}>
        <div className={activeTabs.length > 0 ? 'pb-16 md:pb-0' : ''}>
          {renderPage()}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {showBottomNav      && <BottomNav      currentPage={currentPage} onNavigate={setCurrentPage} />}
      {showAdminBottomNav && <AdminBottomNav currentPage={currentPage} onNavigate={setCurrentPage} />}
      </Suspense>
    </div>
  )
}

export default App
