import { motion } from 'framer-motion'
import {
  ClipboardList, ShieldCheck, Zap, AlertTriangle, CheckSquare,
  Bell, Thermometer, Clock, TrendingUp, ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import type { User, Page } from '../types'

interface Props {
  user: User
  onNavigate: (page: Page) => void
  onLogout: () => void
}

const now = new Date()
const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
const hour = now.getHours()
const shiftNow = hour >= 7 && hour < 15 ? '早班' : hour >= 15 && hour < 23 ? '中班' : '大夜班'

const modules = [
  { page: 'daily-work' as Page, icon: CheckSquare,  label: '每日工作確認', desc: '班次・溫度・清單',    color: '#3b82f6', bg: '#eff6ff', done: 2, total: 3 },
  { page: 'hygiene'    as Page, icon: ShieldCheck,   label: '衛生自主管理', desc: '場所・品質・人員',    color: '#10b981', bg: '#ecfdf5', done: 1, total: 1 },
  { page: 'inspection' as Page, icon: ClipboardList, label: '店鋪點檢',     desc: '年度稽查・評分',    color: '#8b5cf6', bg: '#f5f3ff', done: 0, total: 1 },
  { page: 'equipment'  as Page, icon: Zap,           label: '設備清潔保養', desc: '節電・週期保養',    color: '#f59e0b', bg: '#fffbeb', done: 3, total: 5 },
  { page: 'anomaly'    as Page, icon: AlertTriangle, label: '異常回報',     desc: '事件・追蹤・結案',  color: '#ef4444', bg: '#fef2f2', done: 0, total: 2 },
  { page: 'dashboard'  as Page, icon: TrendingUp,    label: '月報統計',     desc: '數據・績效分析',    color: '#6366f1', bg: '#eef2ff', done: null, total: null },
]

const alerts = [
  { type: 'error', msg: '冷凍庫溫度偏高（-15°C），請確認', time: '09:23' },
  { type: 'warn',  msg: '今日設備保養尚有 2 項未完成',       time: '08:00' },
  { type: 'info',  msg: '衛生管理表單已填寫完畢',             time: '07:30' },
]

const tempStatus = [
  { label: '冷藏', value: '4°C', ok: true },
  { label: '冷凍', value: '-19°C', ok: true },
  { label: '熱食', value: '68°C', ok: true },
]

export default function DashboardPage({ user, onNavigate, onLogout }: Props) {
  const countable = modules.filter(m => m.done !== null && m.total !== null)
  const doneCount = countable.filter(m => m.done === m.total).length

  const roleLabel = { staff: '店員', manager: '店長', supervisor: '督導', admin: '管理員' }[user.role]

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="店鋪管理系統"
        subtitle={`${user.storeName}・${user.name}（${roleLabel}）`}
        onLogout={onLogout}
        rightElement={
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 mr-1">
            <Bell className="w-5 h-5 text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #004d30 0%, #00a86b 100%)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-200 text-xs flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> {dateStr}
              </p>
              <h2 className="text-2xl font-bold">{shiftNow}</h2>
              <p className="text-green-100 text-sm mt-0.5">歡迎，{user.name}</p>
            </div>
            <div className="text-right">
              <p className="text-green-200 text-xs mb-1">今日完成率</p>
              <p className="text-4xl font-black">{Math.round(doneCount / countable.length * 100)}<span className="text-lg font-normal">%</span></p>
              <p className="text-green-200 text-xs">{doneCount}/{countable.length} 模組完成</p>
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-white transition-all"
              style={{ width: `${doneCount / countable.length * 100}%` }}
            />
          </div>
        </motion.div>

        {/* Temperature strip */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Thermometer className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 flex gap-4">
            {tempStatus.map(t => (
              <div key={t.label} className="flex flex-col items-center">
                <span className="text-xs text-gray-400">{t.label}</span>
                <span className="text-sm font-bold" style={{ color: t.ok ? '#10b981' : '#ef4444' }}>{t.value}</span>
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-green-50 text-green-600">全部正常</span>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 px-1 uppercase tracking-wide">最新通知</p>
          {alerts.map((a, i) => {
            const styleMap = {
              error: { bg: '#fef2f2', color: '#dc2626', dot: '🔴' },
              warn:  { bg: '#fffbeb', color: '#d97706', dot: '🟡' },
              info:  { bg: '#eff6ff', color: '#2563eb', dot: '🔵' },
            } as const
            const styles = styleMap[a.type as keyof typeof styleMap]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: styles.bg }}
              >
                <span>{styles.dot}</span>
                <p className="flex-1 text-xs font-medium" style={{ color: styles.color }}>{a.msg}</p>
                <span className="text-[10px] text-gray-400 shrink-0">{a.time}</span>
              </motion.div>
            )
          })}
        </div>

        {/* Module grid */}
        <div>
          <p className="text-xs font-bold text-gray-400 px-1 uppercase tracking-wide mb-3">功能模組</p>
          <div className="grid grid-cols-2 gap-3">
            {modules.map(({ page, icon: Icon, label, desc, color, bg, done, total }, i) => (
              <motion.button
                key={page + i}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigate(page)}
                className="bg-white rounded-2xl p-4 text-left shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                {done !== null && total !== null && (
                  <div className="mt-3">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1 rounded-full" style={{ width: `${total > 0 ? done / total * 100 : 0}%`, background: color }} />
                    </div>
                    <p className="text-[10px] mt-1 font-semibold" style={{ color }}>{done}/{total} 完成</p>
                  </div>
                )}
                {done === null && (
                  <div className="mt-3 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" style={{ color }} />
                    <p className="text-[10px] font-semibold" style={{ color }}>查看報表</p>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
