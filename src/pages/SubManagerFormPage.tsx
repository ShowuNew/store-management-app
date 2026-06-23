import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import DashboardPage  from './DashboardPage'
import DailyWorkPage  from './DailyWorkPage'
import HygienePage    from './HygienePage'
import InspectionPage from './InspectionPage'
import AnomalyPage    from './AnomalyPage'
import EquipmentPage  from './EquipmentPage'
import StatsPage       from './admin/StatsPage'
import CoffeeCheckPage from './CoffeeCheckPage'
import RecordsPage     from './admin/RecordsPage'
import BottomNav       from '../components/BottomNav'
import type { User, Page } from '../types'

interface Props { token: string }

interface SubManagerSession {
  id: string
  token: string
  store_id: string
  store_name: string
  created_by: string
  starts_at?: string
  expires_at: string
  status: 'pending' | 'completed' | 'expired' | 'cancelled'
}

const NAV_PAGES: Page[] = ['dashboard', 'daily-work', 'hygiene', 'anomaly', 'equipment', 'inspection', 'stats', 'coffee-check', 'admin-records']

export default function SubManagerFormPage({ token }: Props) {
  const [session, setSession]     = useState<SubManagerSession | null>(null)
  const [loadErr, setLoadErr]     = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [done, setDone]           = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('sub_manager_sessions')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !data) { setLoadErr('連結無效或已失效'); setLoading(false); return }

      const now = new Date()
      if (data.status === 'expired' || data.status === 'cancelled') {
        setLoadErr('此連結已停用'); setLoading(false); return
      }
      if (new Date(data.expires_at) < now) {
        await supabase.from('sub_manager_sessions').update({ status: 'expired' }).eq('token', token)
        setLoadErr('此連結已過期'); setLoading(false); return
      }
      if (data.starts_at && new Date(data.starts_at) > now) {
        setLoadErr('此連結尚未開放使用'); setLoading(false); return
      }

      setSession(data)
      setLoading(false)
    }
    load()
  }, [token])

  const handleLogout = async () => {
    if (session) {
      await supabase.from('sub_manager_sessions').update({ status: 'completed' }).eq('token', token)
    }
    setDone(true)
  }

  const goBack = () => setCurrentPage('dashboard')

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-base">驗證連結中...</p>
        </div>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800">連結無法使用</h2>
          <p className="text-base text-gray-500">{loadErr}</p>
          <p className="text-sm text-gray-400">請聯絡店長重新產生連結</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
          <h2 className="text-xl font-bold text-gray-800">已結束使用</h2>
          <p className="text-base text-gray-500">感謝您的填寫，此連結已關閉。</p>
        </div>
      </div>
    )
  }

  // 以 sub-manager role 建立 synthetic user（DashboardPage 不會顯示「小店長連結」模組）
  const user: User = {
    id:        'sub-manager',
    name:      '小店長',
    role:      'sub-manager',
    storeId:   session!.store_id,
    storeName: session!.store_name || `全家 ${session!.store_id} 店`,
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'daily-work':  return <DailyWorkPage  user={user} onBack={goBack} />
      case 'hygiene':     return <HygienePage     user={user} onBack={goBack} />
      case 'inspection':  return <InspectionPage  user={user} onBack={goBack} />
      case 'anomaly':     return <AnomalyPage     user={user} onBack={goBack} />
      case 'equipment':   return <EquipmentPage   user={user} onBack={goBack} />
      case 'stats':        return <StatsPage       user={user} onBack={goBack} />
      case 'coffee-check':  return <CoffeeCheckPage user={user} onBack={goBack} />
      case 'admin-records': return <RecordsPage     user={user} onBack={goBack} />
      default:              return <DashboardPage   user={user} onNavigate={setCurrentPage} onLogout={handleLogout} />
    }
  }

  const showNav = NAV_PAGES.includes(currentPage)

  return (
    <div className="flex min-h-dvh bg-gray-50">
      <main className="flex-1 min-w-0">
        <div className={showNav ? 'pb-16' : ''}>
          {renderPage()}
        </div>
      </main>
      {showNav && <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />}
    </div>
  )
}
