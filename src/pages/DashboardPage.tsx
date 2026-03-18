import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardList, ShieldCheck, Zap, AlertTriangle, CheckSquare,
  Bell, Thermometer, Clock, TrendingUp, ChevronRight, RefreshCw,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User, Page } from '../types'

interface Props {
  user: User
  onNavigate: (page: Page) => void
  onLogout: () => void
}

interface AlertItem {
  type: 'error' | 'warn' | 'info'
  msg: string
  time: string
}

interface TempReading { time: string; value: number | null; isNormal: boolean | null }
interface TempEntry { location: string; required: string; zone: string; readings?: TempReading[]; value?: number | null; isNormal?: boolean | null }

const todayStr = new Date().toISOString().split('T')[0]

export default function DashboardPage({ user, onNavigate, onLogout }: Props) {
  const now      = new Date()
  const dateStr  = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const hour     = now.getHours()
  const shiftNow = hour >= 7 && hour < 15 ? '早班' : hour >= 15 && hour < 23 ? '晚班' : '大夜班'

  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts]   = useState<AlertItem[]>([])

  const [tempStatus, setTempStatus] = useState([
    { label: '冷藏', value: '—', ok: true },
    { label: '冷凍', value: '—', ok: true },
    { label: '熱食', value: '—', ok: true },
  ])

  const [counts, setCounts] = useState({
    dailyWork:  { done: 0, total: 3 },  // 3 班次
    hygiene:    { done: 0, total: 3 },  // 3 時段
    equipment:  { done: 0, total: 4 },  // 4 區域
    openAnomaly: 0,                      // 待處理異常數
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const [dailyRes, hygieneRes, equipRes, anomalyRes] = await Promise.all([
        supabase.from('daily_work_logs')
          .select('*')
          .eq('store_id', user.storeId)
          .eq('log_date', todayStr),

        supabase.from('hygiene_records')
          .select('id, shift')
          .eq('store_id', user.storeId)
          .eq('record_date', todayStr),

        supabase.from('equipment_logs')
          .select('zone')
          .eq('store_id', user.storeId)
          .eq('log_date', todayStr),

        supabase.from('anomaly_reports')
          .select('*')
          .eq('store_id', user.storeId)
          .eq('status', 'open')
          .order('reported_at', { ascending: false })
          .limit(5),
      ])

      const newAlerts: AlertItem[] = []

      // ── 每日工作確認 ──
      const dailyLogs  = dailyRes.data   || []
      const dailyDone  = dailyLogs.filter((l: any) => l.submitted_at).length

      // 最近一筆溫度資料
      const latestLog = [...dailyLogs]
        .filter((l: any) => l.submitted_at)
        .sort((a: any, b: any) =>
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        )[0]

      if (latestLog) {
        const temps: TempEntry[] = latestLog.temperatures || []

        const fmt = (v: number | null) => v === null ? '—' : `${v > 0 ? '+' : ''}${v}°C`

        // 取每個設備最新一筆有效 reading（支援新格式 readings[]，也兼容舊格式 value/isNormal）
        const latestReading = (t: TempEntry): { value: number | null; isNormal: boolean | null } => {
          if (Array.isArray(t.readings) && t.readings.length > 0) {
            const filled = [...t.readings].reverse().find(r => r.value !== null)
            return filled ? { value: filled.value, isNormal: filled.isNormal } : { value: null, isNormal: null }
          }
          return { value: t.value ?? null, isNormal: t.isNormal ?? null }
        }

        const coldItem   = temps.find(t => t.location.includes('4°C') || t.location.includes('WI'))
        const frozenItem = temps.find(t => t.location.includes('冷凍') && !t.location.includes('冰淇淋'))
        const hotItem    = temps.find(t => t.location.includes('蒸箱') || t.location.includes('關東煮') || t.location.includes('鮮食'))

        setTempStatus([
          { label: '冷藏', value: coldItem   ? fmt(latestReading(coldItem).value)   : '—', ok: coldItem   ? latestReading(coldItem).isNormal   !== false : true },
          { label: '冷凍', value: frozenItem ? fmt(latestReading(frozenItem).value) : '—', ok: frozenItem ? latestReading(frozenItem).isNormal !== false : true },
          { label: '熱食', value: hotItem    ? fmt(latestReading(hotItem).value)    : '—', ok: hotItem    ? latestReading(hotItem).isNormal    !== false : true },
        ])

        // 溫度異常 → 只看最後一筆有效 reading，若最新已回正常則不通知
        temps.forEach(t => {
          const logTime = new Date(latestLog.submitted_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          if (Array.isArray(t.readings)) {
            const lastFilled = [...t.readings].reverse().find(r => r.value !== null)
            if (lastFilled?.isNormal === false) {
              newAlerts.push({
                type: 'error',
                msg:  `${t.location} 溫度異常（${fmt(lastFilled.value)} @ ${lastFilled.time}），請30分鐘後複核`,
                time: logTime,
              })
            }
          } else if (t.isNormal === false) {
            // 兼容舊格式
            newAlerts.push({
              type: 'error',
              msg:  `${t.location} 溫度異常（${fmt(t.value ?? null)}），請30分鐘後複核`,
              time: logTime,
            })
          }
        })
      }

      // ── 衛生管理 ──
      const hygieneDone = (hygieneRes.data || []).length   // 每時段一筆

      // ── 設備保養 ──
      const zones     = new Set((equipRes.data || []).map((r: any) => r.zone))
      const equipDone = zones.size

      // ── 異常回報 → 黃色通知 ──
      const openAnomalies = anomalyRes.data || []
      openAnomalies
        .filter((a: any) => !['設備報修', '品質異常回報', '外部機關稽查'].includes(a.category))
        .forEach((a: any) => {
          const isUrgent = a.severity === 'critical' || a.severity === 'high'
          newAlerts.push({
            type: isUrgent ? 'error' : 'warn',
            msg:  `[${a.category}] ${a.description.slice(0, 28)}${a.description.length > 28 ? '…' : ''}`,
            time: new Date(a.reported_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          })
        })

      // 提醒：今日尚未填寫
      if (dailyDone  === 0) newAlerts.push({ type: 'info', msg: '今日每日工作確認尚未填寫',  time: '' })
      if (hygieneDone === 0) newAlerts.push({ type: 'warn', msg: '今日衛生自主管理尚未填寫', time: '' })

      setCounts({
        dailyWork:   { done: dailyDone,   total: 3 },
        hygiene:     { done: hygieneDone, total: 3 },
        equipment:   { done: equipDone,   total: 4 },
        openAnomaly: openAnomalies.length,
      })
      setAlerts(newAlerts.slice(0, 5))
      setLoading(false)
    }

    load()
  }, [user.storeId])

  type ModuleEntry = {
    page: Page; icon: React.ElementType; label: string; desc: string
    color: string; bg: string
    done: number | null; total: number | null
    badge?: string
  }

  const modules: ModuleEntry[] = [
    { page: 'daily-work', icon: CheckSquare,  label: '每日工作確認', desc: '班次・溫度・清單',   color: '#00a040', bg: '#e8f7ee', done: counts.dailyWork.done,  total: counts.dailyWork.total  },
    { page: 'hygiene',    icon: ShieldCheck,  label: '衛生自主管理', desc: '場所・品質・人員',   color: '#007d30', bg: '#d4efdf', done: counts.hygiene.done,    total: counts.hygiene.total    },
    { page: 'inspection', icon: ClipboardList,label: '店鋪點檢',     desc: '年度稽查・評分',    color: '#00a040', bg: '#e8f7ee', done: null, total: null },
    { page: 'equipment',  icon: Zap,          label: '設備清潔保養', desc: '節電・週期保養',    color: '#f59e0b', bg: '#fffbeb', done: counts.equipment.done,  total: counts.equipment.total  },
    {
      page: 'anomaly', icon: AlertTriangle, label: '異常回報', desc: '事件・追蹤・結案',
      color: '#ef4444', bg: '#fef2f2', done: null, total: null,
      badge: counts.openAnomaly > 0 ? `${counts.openAnomaly} 待處理` : undefined,
    },
    { page: 'stats',      icon: TrendingUp,   label: '月報統計',     desc: '數據・績效分析',    color: '#007d30', bg: '#d4efdf', done: null, total: null },
  ]

  const countable    = modules.filter(m => m.done !== null && m.total !== null && (m.total ?? 0) > 0)
  const allDoneCount = countable.filter(m => m.done === m.total).length
  const pct          = countable.length > 0 ? Math.round(allDoneCount / countable.length * 100) : 0
  const tempAllOk    = tempStatus.every(t => t.ok)
  const roleLabel    = { staff: '店員', manager: '店長', supervisor: '督導', admin: '管理員' }[user.role]

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="店鋪工作日誌FamilyMart"
        subtitle={`${user.storeName}・${user.name}（${roleLabel}）`}
        onLogout={onLogout}
        rightElement={
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 mr-1">
            <Bell className="w-5 h-5 text-gray-500" />
            {alerts.some(a => a.type !== 'info') && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 text-white overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #007d30 0%, #00a040 100%)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-200 text-sm flex items-center gap-1 mb-1">
                <Clock className="w-4 h-4" /> {dateStr}
              </p>
              <h2 className="text-3xl font-bold">{shiftNow}</h2>
              <p className="text-green-100 text-base mt-1">歡迎，{user.name}</p>
            </div>
            <div className="text-right">
              {loading
                ? <RefreshCw className="w-6 h-6 text-green-200 animate-spin" />
                : (
                  <>
                    <p className="text-green-200 text-sm mb-1">今日完成率</p>
                    <p className="text-5xl font-black">{pct}<span className="text-xl font-normal">%</span></p>
                    <p className="text-green-200 text-sm">{allDoneCount}/{countable.length} 模組完成</p>
                  </>
                )
              }
            </div>
          </div>
          {!loading && (
            <div className="mt-4 bg-white/20 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </motion.div>

        {/* Temperature strip */}
        <div className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#e8f7ee' }}>
            <Thermometer className="w-5 h-5" style={{ color: '#00a040' }} />
          </div>
          <div className="flex-1 flex gap-4">
            {tempStatus.map(t => (
              <div key={t.label} className="flex flex-col items-center">
                <span className="text-sm text-gray-400">{t.label}</span>
                <span className="text-base font-bold" style={{ color: t.ok ? '#10b981' : '#ef4444' }}>{t.value}</span>
              </div>
            ))}
          </div>
          {loading
            ? <RefreshCw className="w-5 h-5 text-gray-300 animate-spin shrink-0" />
            : (
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 ${tempAllOk ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {tempAllOk ? '全部正常' : '有異常'}
              </span>
            )
          }
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-400 px-1 uppercase tracking-wide">最新通知</p>

          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-300">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-base">載入中...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-5 rounded-2xl bg-green-50 text-center">
              <p className="text-base font-semibold text-green-600">✓ 今日一切正常，無待處理事項</p>
            </div>
          ) : (
            alerts.map((a, i) => {
              const styleMap = {
                error: { bg: '#fef2f2', color: '#dc2626', dot: '🔴', label: '警示' },
                warn:  { bg: '#fffbeb', color: '#d97706', dot: '🟡', label: '注意' },
                info:  { bg: '#eff6ff', color: '#2563eb', dot: '🔵', label: '待辦' },
              } as const
              const s = styleMap[a.type]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-3 px-4 py-4 rounded-2xl"
                  style={{ background: s.bg }}
                >
                  <span className="text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5" style={{ background: s.color, color: '#fff' }}>{s.label}</span>
                  <p className="flex-1 text-base font-medium" style={{ color: s.color }}>{a.msg}</p>
                  {a.time && <span className="text-sm text-gray-400 shrink-0">{a.time}</span>}
                </motion.div>
              )
            })
          )}
        </div>

        {/* Module grid */}
        <div>
          <p className="text-sm font-bold text-gray-400 px-1 uppercase tracking-wide mb-3">功能模組</p>
          <div className="grid grid-cols-1 gap-3">
            {modules.map(({ page, icon: Icon, label, desc, color, bg, done, total, badge }, i) => (
              <motion.button
                key={page + i}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigate(page)}
                className="bg-white rounded-2xl p-5 text-left shadow-sm relative"
              >
                {badge && (
                  <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-lg bg-red-500 text-white">
                    {badge}
                  </span>
                )}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon className="w-7 h-7" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-800 leading-tight">{label}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
                    {done !== null && total !== null ? (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${(total ?? 0) > 0 ? (done ?? 0) / (total ?? 1) * 100 : 0}%`, background: color }} />
                        </div>
                        <p className="text-xs mt-1 font-semibold" style={{ color }}>{done}/{total} 完成</p>
                      </div>
                    ) : (
                      !badge && (
                        <div className="mt-2 flex items-center gap-1">
                          <ChevronRight className="w-4 h-4" style={{ color }} />
                          <p className="text-xs font-semibold" style={{ color }}>查看報表</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
