import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, AlertTriangle, BarChart2, ShieldCheck, RefreshCw, LogOut, UserSearch, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User, Page } from '../../types'

interface Props {
  user: User
  onNavigate: (page: Page) => void
  onLogout: () => void
}

export default function AdminDashboard({ user, onNavigate, onLogout }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [stats, setStats] = useState({ dailyWork: 0, hygiene: 0, equipment: 0, openAnomalies: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [dw, hy, eq, an] = await Promise.all([
        supabase.from('daily_work_logs').select('id', { count: 'exact', head: true }).eq('log_date', todayStr),
        supabase.from('hygiene_records').select('id', { count: 'exact', head: true }).eq('record_date', todayStr),
        supabase.from('equipment_logs').select('id', { count: 'exact', head: true }).eq('log_date', todayStr),
        supabase.from('anomaly_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ])
      setStats({
        dailyWork:     dw.count  ?? 0,
        hygiene:       hy.count  ?? 0,
        equipment:     eq.count  ?? 0,
        openAnomalies: an.count  ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: '今日工作提交', value: stats.dailyWork,     unit: '筆', color: '#3b82f6', bg: '#eff6ff' },
    { label: '今日衛生記錄', value: stats.hygiene,       unit: '筆', color: '#10b981', bg: '#ecfdf5' },
    { label: '今日設備保養', value: stats.equipment,     unit: '筆', color: '#8b5cf6', bg: '#f5f3ff' },
    { label: '待處理異常',   value: stats.openAnomalies, unit: '件', color: '#ef4444', bg: '#fef2f2' },
  ]

  const quickLinks = [
    { page: 'admin-records'  as Page, label: '紀錄查閱', desc: '查看各門市提交的工作、衛生、設備紀錄', icon: <ClipboardList className="w-5 h-5" />, color: '#3b82f6', bg: '#eff6ff' },
    { page: 'admin-anomaly'  as Page, label: '異常管理', desc: '集中處理跨門市的異常事件與回報',         icon: <AlertTriangle  className="w-5 h-5" />, color: '#ef4444', bg: '#fef2f2' },
    { page: 'admin-stats'    as Page, label: '數據統計', desc: '查看近期完成率與合格率趨勢分析',         icon: <BarChart2      className="w-5 h-5" />, color: '#8b5cf6', bg: '#f5f3ff' },
    { page: 'mystery-manage'      as Page, label: '神秘客稽查', desc: '產生稽查連結，查看各門市評核結果', icon: <UserSearch  className="w-5 h-5" />, color: '#0891b2', bg: '#ecfeff' },
    { page: 'admin-store-status'  as Page, label: '店鋪完成狀況', desc: '即時查看各店鋪每日作業提交情形', icon: <Building2   className="w-5 h-5" />, color: '#16a34a', bg: '#f0fdf4' },
  ]

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #00a040, #007d30)' }} />
        <div className="px-4 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <span className="text-base font-bold text-green-600 uppercase tracking-wide">管理後台</span>
            </div>
            <h1 className="text-xl font-black text-gray-900">{user.name}</h1>
            <p className="text-base text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-base font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" /> 登出
          </button>
        </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-32 md:pb-8">
        {/* Stats — desktop only in main content */}
        <div className="hidden md:block">
          <p className="text-base font-bold text-gray-400 mb-2">今日統計</p>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-base">載入中...</span>
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-2">
              {statCards.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-4"
                  style={{ background: s.bg }}
                >
                  <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-base font-semibold mt-0.5" style={{ color: s.color }}>
                    {s.label} <span className="font-normal opacity-70">({s.unit})</span>
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div>
          <p className="text-base font-bold text-gray-400 mb-2">功能入口</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {quickLinks.map(({ page, label, desc, icon, color, bg }, i) => (
              <motion.button
                key={page}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(page)}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}>
                  {icon}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">{label}</p>
                  <p className="text-base text-gray-400 mt-0.5">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile fixed stats strip — above bottom nav */}
      <AnimatePresence>
        {!loading && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 200 }}
            className="md:hidden fixed bottom-16 left-0 right-0 z-20 bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {statCards.map(s => (
                <div key={s.label} className="flex flex-col items-center py-2.5 px-1">
                  <p className="text-lg font-black leading-tight" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs font-semibold text-center leading-tight mt-0.5 text-gray-500" style={{ fontSize: '10px' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
