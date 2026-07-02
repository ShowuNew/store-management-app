import { useState, useEffect, lazy, Suspense } from 'react'
import {
  Home, ClipboardCheck, ShieldCheck, AlertTriangle, Wrench,
  ClipboardList, LayoutDashboard, BarChart2, Coffee, Building2,
  ListChecks, Store, ChevronDown,
} from 'lucide-react'
import { useDevice } from './hooks/useDevice'
import MobileLayout  from './components/layouts/MobileLayout'
import TabletLayout  from './components/layouts/TabletLayout'
import DesktopLayout from './components/layouts/DesktopLayout'
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
const FillCheckPage        = lazy(() => import('./pages/admin/FillCheckPage'))
const FeatureClickPage     = lazy(() => import('./pages/admin/FeatureClickPage'))
const SupervisorImportPage = lazy(() => import('./pages/admin/SupervisorImportPage'))
const MysteryFormPage      = lazy(() => import('./pages/MysteryFormPage'))
const SubManagerManagePage = lazy(() => import('./pages/SubManagerManagePage'))
const SubManagerFormPage   = lazy(() => import('./pages/SubManagerFormPage'))
const CoffeeCheckPage      = lazy(() => import('./pages/CoffeeCheckPage'))
const C15CheckPage         = lazy(() => import('./pages/C15CheckPage'))

function PageLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
    </div>
  )
}

const URL_TOKEN = new URLSearchParams(window.location.search).get('token')
const SUB_TOKEN = new URLSearchParams(window.location.search).get('sub-token')

const NAV_PAGES: Page[]       = ['dashboard', 'daily-work', 'hygiene', 'anomaly', 'equipment', 'inspection', 'stats', 'sub-manager-manage', 'coffee-check', 'c15-check', 'admin-records']
const ADMIN_NAV_PAGES: Page[] = ['admin-dashboard', 'admin-records', 'admin-anomaly', 'admin-stats', 'mystery-manage', 'admin-store-status', 'admin-feature-clicks', 'admin-fill-check', 'supervisor-import']

const staffTabs = [
  { page: 'dashboard'    as Page, icon: Home,          label: '首頁'   },
  { page: 'daily-work'   as Page, icon: ClipboardCheck, label: '每日確認' },
  { page: 'hygiene'      as Page, icon: ShieldCheck,    label: '衛生管理' },
  { page: 'equipment'    as Page, icon: Wrench,         label: '設備保養' },
  { page: 'coffee-check' as Page, icon: Coffee,         label: '咖啡自檢' },
  { page: 'c15-check'    as Page, icon: ListChecks,     label: 'C15確認'  },
  { page: 'inspection'   as Page, icon: ClipboardList,  label: '店鋪點檢' },
  { page: 'anomaly'      as Page, icon: AlertTriangle,  label: '異常回報' },
]

const managerExtraTabs = [
  { page: 'admin-records' as Page, icon: ClipboardList, label: '紀錄查閱' },
]

const adminTabs = [
  { page: 'admin-dashboard'    as Page, icon: LayoutDashboard, label: '總覽'   },
  { page: 'admin-store-status' as Page, icon: Building2,       label: '店鋪狀況' },
  { page: 'admin-records'      as Page, icon: ClipboardList,   label: '紀錄查閱' },
  { page: 'admin-anomaly'      as Page, icon: AlertTriangle,   label: '異常管理' },
  { page: 'admin-stats'        as Page, icon: BarChart2,       label: '數據統計' },
]

function App() {
  const device = useDevice()
  const [user, setUser]               = useState<User | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('login')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showStorePicker, setShowStorePicker] = useState(false)
  const [switchStoreId, setSwitchStoreId]     = useState('')

  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 320)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleLogin  = (u: User) => {
    setUser(u)
    setCurrentPage(u.role === 'supervisor' || u.role === 'admin' ? 'admin-dashboard' : 'dashboard')
  }
  const handleLogout = () => { setUser(null); setCurrentPage('login') }
  const openStorePicker = () => {
    setSwitchStoreId(user?.storeId ?? '')
    setShowStorePicker(true)
  }
  const confirmSwitchStore = () => {
    if (!user || !switchStoreId) return
    const target = user.managedStores?.find(s => s.store_id === switchStoreId)
    if (!target) return
    setUser({ ...user, storeId: target.store_id, storeName: target.store_name })
    setShowStorePicker(false)
    setCurrentPage('dashboard')
  }
  const isManager = user?.role === 'manager' || user?.role === 'sub-manager'
  const goBack    = () => setCurrentPage(
    ADMIN_NAV_PAGES.includes(currentPage) && !isManager ? 'admin-dashboard' : 'dashboard'
  )

  if (URL_TOKEN) return <Suspense fallback={<PageLoading />}><MysteryFormPage token={URL_TOKEN} /></Suspense>
  if (SUB_TOKEN) return <Suspense fallback={<PageLoading />}><SubManagerFormPage token={SUB_TOKEN} /></Suspense>

  if (!user) return <Suspense fallback={<PageLoading />}><LoginPage onLogin={handleLogin} /></Suspense>

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':            return <DashboardPage     user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
      case 'daily-work':           return <DailyWorkPage     user={user} onBack={goBack} />
      case 'hygiene':              return <HygienePage       user={user} onBack={goBack} />
      case 'inspection':           return <InspectionPage    user={user} onBack={goBack} />
      case 'anomaly':              return <AnomalyPage       user={user} onBack={goBack} />
      case 'equipment':            return <EquipmentPage     user={user} onBack={goBack} />
      case 'stats':                return <StatsPage         user={user} onBack={goBack} />
      case 'admin-dashboard':      return <AdminDashboard    user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
      case 'admin-records':        return <RecordsPage       user={user} onBack={goBack} />
      case 'admin-anomaly':        return <AnomalyManagePage user={user} onBack={goBack} />
      case 'admin-stats':          return <StatsPage         user={user} onBack={goBack} />
      case 'mystery-manage':       return <MysteryManagePage    user={user} onBack={goBack} />
      case 'admin-store-status':   return <StoreStatusPage      user={user} onBack={goBack} />
      case 'admin-fill-check':     return <FillCheckPage        user={user} onBack={goBack} />
      case 'admin-feature-clicks': return <FeatureClickPage     user={user} onBack={goBack} />
      case 'supervisor-import':    return <SupervisorImportPage user={user} onBack={goBack} />
      case 'sub-manager-manage':   return <SubManagerManagePage user={user} onBack={goBack} />
      case 'coffee-check':         return <CoffeeCheckPage      user={user} onBack={goBack} />
      case 'c15-check':            return <C15CheckPage         user={user} onBack={goBack} />
      default:                     return <DashboardPage        user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
    }
  }

  const showAdminBottomNav = ADMIN_NAV_PAGES.includes(currentPage) && !isManager
  const showBottomNav      = NAV_PAGES.includes(currentPage) && !showAdminBottomNav
  const baseStaffTabs      = isManager ? [...staffTabs, ...managerExtraTabs] : staffTabs
  const activeTabs         = showBottomNav ? baseStaffTabs : showAdminBottomNav ? adminTabs : []

  const LayoutComponent = device === 'desktop' ? DesktopLayout
                        : device === 'tablet'  ? TabletLayout
                        : MobileLayout
  const dataTheme = device === 'desktop' ? 'desktop'
                  : device === 'tablet'  ? 'tablet'
                  : undefined

  return (
    <div data-theme={dataTheme} style={{ display: 'contents' }}>
      <Suspense fallback={<PageLoading />}>
        <LayoutComponent
          currentPage={currentPage}
          activeTabs={activeTabs}
          isAdminNav={showAdminBottomNav}
          isManager={isManager}
          user={user}
          onNavigate={setCurrentPage}
          onOpenStorePicker={openStorePicker}
          showScrollTop={showScrollTop}
        >
          {renderPage()}
        </LayoutComponent>
      </Suspense>

      {showStorePicker && user?.managedStores && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full bg-white rounded-3xl p-6 space-y-4" style={{ maxWidth: 400 }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">切換操作門市</p>
                <p className="text-sm text-gray-400">目前：{user.storeName}</p>
              </div>
            </div>
            <div className="relative border-2 border-gray-100 rounded-2xl px-4 bg-gray-50" style={{ minHeight: '52px' }}>
              <select
                className="w-full bg-transparent text-base text-gray-800 outline-none appearance-none py-3"
                style={{ minHeight: '52px' }}
                value={switchStoreId}
                onChange={e => setSwitchStoreId(e.target.value)}
              >
                {user.managedStores.map(s => (
                  <option key={s.store_id} value={s.store_id}>{s.store_id} {s.store_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStorePicker(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-base bg-gray-100 text-gray-600"
              >取消</button>
              <button
                onClick={confirmSwitchStore}
                className="flex-1 py-3.5 rounded-2xl font-bold text-base text-white"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))' }}
              >確認切換</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
