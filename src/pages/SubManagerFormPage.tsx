import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import DailyWorkPage from './DailyWorkPage'
import type { User } from '../types'

interface Props { token: string }

interface SubManagerSession {
  id: string
  token: string
  store_id: string
  store_name: string
  created_by: string
  expires_at: string
  status: 'pending' | 'completed' | 'expired'
}

const FM_GREEN = '#00a040'
const FM_GREEN_DARK = '#007d30'

export default function SubManagerFormPage({ token }: Props) {
  const [session, setSession] = useState<SubManagerSession | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('sub_manager_sessions')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !data) { setLoadErr('連結無效或已失效'); setLoading(false); return }

      if (new Date(data.expires_at) < new Date()) {
        await supabase.from('sub_manager_sessions').update({ status: 'expired' }).eq('token', token)
        setLoadErr('此連結已過期'); setLoading(false); return
      }
      if (data.status === 'expired') { setLoadErr('此連結已過期'); setLoading(false); return }

      setSession(data)
      setLoading(false)
    }
    load()
  }, [token])

  // Called by DailyWorkPage when successfully saved
  const handleBack = async () => {
    if (session) {
      await supabase.from('sub_manager_sessions').update({ status: 'completed' }).eq('token', token)
    }
    setDone(true)
  }

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
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl bg-red-50">⚠️</div>
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
          <h2 className="text-xl font-bold text-gray-800">填寫完成！</h2>
          <p className="text-base text-gray-500">工作日誌已成功儲存，謝謝您的填寫。</p>
        </div>
      </div>
    )
  }

  // Synthetic user built from session — no role restriction needed for DailyWorkPage
  const syntheticUser: User = {
    id:        'sub-manager',
    name:      '小店長',
    role:      'staff',
    storeId:   session!.store_id,
    storeName: session!.store_name || `全家 ${session!.store_id} 店`,
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Banner */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${FM_GREEN_DARK}, ${FM_GREEN})` }}
      >
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight">{syntheticUser.storeName}</p>
          <p className="text-green-200 text-sm">小店長工作日誌（臨時入口）</p>
        </div>
      </div>

      <DailyWorkPage user={syntheticUser} onBack={handleBack} />
    </div>
  )
}
