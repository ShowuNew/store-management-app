import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, ShieldCheck, Zap, AlertTriangle, CheckSquare,
  Clock, TrendingUp, ChevronRight, RefreshCw, UserPlus, Coffee, X, BookOpen, ListChecks,
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
  photoUrl?: string
}

interface Anomaly {
  id: string; category: string; description: string; severity: string; reported_at: string; status: string
}

function renderDescription(text: string) {
  const urlRe = /(https?:\/\/[^\s\]）)]+)/g
  const parts = text.split(urlRe)
  return parts.map((part, i) => {
    if (urlRe.test(part)) {
      urlRe.lastIndex = 0
      return <img key={i} src={part} alt="現場照片" className="mt-2 w-full rounded-xl object-cover max-h-48" />
    }
    const clean = part.replace(/\[現場照片：?$/, '').replace(/^\s*\]?\s*/, '')
    return clean ? <span key={i}>{clean}</span> : null
  })
}

interface TempReading { time: string; value: number | null; isNormal: boolean | null }
interface TempEntry { location: string; required: string; zone: string; readings?: TempReading[]; value?: number | null; isNormal?: boolean | null }

export default function DashboardPage({ user, onNavigate, onLogout }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const now      = new Date()
  const dateStr  = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const hour     = now.getHours()
  const shiftNow = hour >= 7 && hour < 15 ? '早班' : hour >= 15 && hour < 23 ? '晚班' : '大夜班'

  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts]   = useState<AlertItem[]>([])
  const [anomalyModal, setAnomalyModal] = useState<Anomaly[]>([])
  const anomalyShownRef = useRef(false)

  const [shiftFillStatus, setShiftFillStatus] = useState<
    { shift: string; submitted: boolean; staffName: string; time: string }[]
  >([])

  const [counts, setCounts] = useState({
    dailyWork:  { done: 0, total: 3 },  // 3 班次
    hygiene:    { done: 0, total: 3 },  // 3 時段
    equipment:  { done: 0, total: 4 },  // 4 區域
    openAnomaly: 0,                      // 待處理異常數
  })
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const [dailyRes, hygieneRes, equipRes, anomalyRes, coffeeRes] = await Promise.all([
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

        supabase.from('coffee_check_records')
          .select('machine_no, overall_ok, medium_hot_set_temp_ok, medium_hot_set_weight_ok, medium_latte_temp_ok, medium_latte_weight_ok, created_at')
          .eq('store_id', user.storeId)
          .eq('check_date', todayStr)
          .order('created_at', { ascending: false })
          .limit(20),
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

        // 溫度異常 → 只看最後一筆有效 reading，若最新已回正常則不通知
        temps.forEach(t => {
          const logTime = new Date(latestLog.submitted_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          if (Array.isArray(t.readings)) {
            const lastFilled = [...t.readings].reverse().find(r => r.value !== null)
            if (lastFilled?.isNormal === false) {
              newAlerts.push({
                type: 'error',
                msg:  `${t.location} 溫度異常（${fmt(lastFilled.value)} @ ${lastFilled.time}），請30分鐘後複檢`,
                time: logTime,
              })
            }
          } else if (t.isNormal === false) {
            // 兼容舊格式
            newAlerts.push({
              type: 'error',
              msg:  `${t.location} 溫度異常（${fmt(t.value ?? null)}），請30分鐘後複檢`,
              time: logTime,
            })
          }
        })
      }

      // #33 — 班次填寫狀況（店長/小店長用）
      const isManager = user.role === 'manager' || user.role === 'sub-manager'
      if (isManager) {
        const shifts33 = ['早班', '晚班', '大夜班']
        setShiftFillStatus(shifts33.map(s => {
          const log = dailyLogs.find((l: any) => l.shift === s && l.submitted_at)
          const ts  = log?.submitted_at ? new Date(log.submitted_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''
          return { shift: s, submitted: !!log, staffName: log?.staff_name || '', time: ts }
        }))
      }

      // ── 衛生管理 ──
      if (hygieneRes.error) console.error('[Dashboard] hygiene_records SELECT error:', hygieneRes.error)
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
          const urlMatch = a.description.match(/(https?:\/\/[^\s\]）)]+)/)
          const cleanDesc = a.description.replace(/(https?:\/\/[^\s\]）)]+)/g, '').replace(/\[現場照片：?\]?/g, '').trim()
          newAlerts.push({
            type: isUrgent ? 'error' : 'warn',
            msg:  `[${a.category}] ${cleanDesc.slice(0, 28)}${cleanDesc.length > 28 ? '…' : ''}`,
            time: new Date(a.reported_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            photoUrl: urlMatch?.[1],
          })
        })

      // ── 咖啡自檢異常通知 ──
      const coffeeChecks = coffeeRes.data || []
      const latestByMachine: Record<string, any> = {}
      for (const c of coffeeChecks) {
        const key = c.machine_no?.trim() || '未設定'
        if (!latestByMachine[key]) latestByMachine[key] = c
      }
      for (const [machineNo, c] of Object.entries(latestByMachine)) {
        if (!c.overall_ok) {
          const issues: string[] = []
          if (!c.medium_hot_set_temp_ok)   issues.push('中熱套溫度')
          if (!c.medium_hot_set_weight_ok) issues.push('中熱套重量')
          if (!c.medium_latte_temp_ok)     issues.push('中熱拿鐵溫度')
          if (!c.medium_latte_weight_ok)   issues.push('中熱拿鐵重量')
          const time = new Date(c.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          newAlerts.push({
            type: 'error',
            msg:  `咖啡機 ${machineNo} 自檢異常（${issues.length > 0 ? issues.join('、') : '整體異常'}），請30分鐘後複檢`,
            time,
          })
        }
      }

      // #26 — 店長/小店長首次載入時顯示當天異常 modal
      if (isManager && openAnomalies.length > 0 && !anomalyShownRef.current) {
        anomalyShownRef.current = true
        setAnomalyModal(openAnomalies as Anomaly[])
      }

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

    const loadClicks = async () => {
      const { data } = await supabase
        .from('feature_usage_logs')
        .select('feature')
        .eq('store_id', user.storeId)
        .gte('clicked_at', todayStr)
      if (data) {
        const map: Record<string, number> = {}
        data.forEach((r: any) => { map[r.feature] = (map[r.feature] ?? 0) + 1 })
        setClickCounts(map)
      }
    }

    load()
    loadClicks()
  }, [user.storeId])

  const trackClick = async (page: Page) => {
    setClickCounts(prev => ({ ...prev, [page]: (prev[page] ?? 0) + 1 }))
    await supabase.from('feature_usage_logs').insert({
      store_id: user.storeId,
      user_name: user.name,
      feature: page,
    })
  }

  type ModuleEntry = {
    page: Page; icon: React.ElementType; label: string; desc: string
    color: string; bg: string
    done: number | null; total: number | null
    badge?: string
  }

  const modules: ModuleEntry[] = [
    { page: 'daily-work',   icon: CheckSquare,  label: '每日工作確認', desc: '班次・溫度・清單',   color: '#00a040', bg: '#e8f7ee', done: counts.dailyWork.done,  total: counts.dailyWork.total  },
    { page: 'hygiene',      icon: ShieldCheck,  label: '衛生自主管理', desc: '場所・品質・人員',   color: '#007d30', bg: '#d4efdf', done: counts.hygiene.done,    total: counts.hygiene.total    },
    { page: 'inspection',   icon: ClipboardList,label: '店鋪點檢',     desc: '年度稽查・評分',    color: '#00a040', bg: '#e8f7ee', done: null, total: null },
    { page: 'coffee-check', icon: Coffee,       label: '咖啡機自檢',   desc: '溫度・重量・狀態確認', color: '#7c3aed', bg: '#f5f3ff', done: null, total: null },
    { page: 'c15-check',    icon: ListChecks,   label: 'C15確認',      desc: '品保・服務・環境確認', color: '#0891b2', bg: '#e0f7fa', done: null, total: null },
    { page: 'equipment',    icon: Zap,          label: '設備清潔保養', desc: '節電・週期保養',    color: '#f59e0b', bg: '#fffbeb', done: counts.equipment.done,  total: counts.equipment.total  },
    {
      page: 'anomaly', icon: AlertTriangle, label: '異常回報', desc: '事件・追蹤・結案',
      color: '#ef4444', bg: '#fef2f2', done: null, total: null,
      badge: counts.openAnomaly > 0 ? `${counts.openAnomaly} 待處理` : undefined,
    },
    { page: 'stats',        icon: TrendingUp,   label: '月報統計',     desc: '數據・績效分析',    color: '#007d30', bg: '#d4efdf', done: null, total: null },
  ]

  const countable    = modules.filter(m => m.done !== null && m.total !== null && (m.total ?? 0) > 0)
  const allDoneCount = countable.filter(m => m.done === m.total).length
  const pct          = countable.length > 0 ? Math.round(allDoneCount / countable.length * 100) : 0
  const roleLabel    = { staff: '店員', manager: '店長', 'sub-manager': '小店長', supervisor: '擔當', admin: '管理員' }[user.role]

  // 小店長連結模組（只對店長顯示）
  const subManagerModule: ModuleEntry | null = user.role === 'manager'
    ? { page: 'sub-manager-manage' as Page, icon: UserPlus, label: '小店長連結', desc: '產生臨時人員入口連結', color: '#7c3aed', bg: '#f5f3ff', done: null, total: null }
    : null

  // 紀錄查閱模組（店長/小店長顯示）
  const recordsModule: ModuleEntry | null = (user.role === 'manager' || user.role === 'sub-manager')
    ? { page: 'admin-records' as Page, icon: BookOpen, label: '紀錄查閱', desc: '日誌・衛生・異常紀錄', color: '#0369a1', bg: '#e0f2fe', done: null, total: null }
    : null

  return (
    <div className="min-h-dvh bg-gray-100">
      <PageHeader
        title="店鋪工作日誌"
        subtitle={`${user.storeName}・${user.name}（${roleLabel}）`}
        onLogout={onLogout}
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
              <p className="text-green-200 text-base flex items-center gap-1 mb-1">
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
                    <p className="text-green-200 text-base mb-1">今日完成率</p>
                    <p className="text-5xl font-black">{pct}<span className="text-xl font-normal">%</span></p>
                    <p className="text-green-200 text-base">{allDoneCount}/{countable.length} 模組完成</p>
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


        {/* Alerts */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-400 px-1 uppercase tracking-[0.08em]">最新通知</p>

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
                error: { bg: '#fef2f2', color: '#dc2626', label: '警示' },
                warn:  { bg: '#fffbeb', color: '#d97706', label: '注意' },
                info:  { bg: '#eff6ff', color: '#2563eb', label: '待辦' },
              } as const
              const s = styleMap[a.type]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: s.bg }}
                >
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: s.color, color: '#fff' }}>{s.label}</span>
                  <p className="flex-1 text-sm font-medium leading-snug line-clamp-2" style={{ color: s.color }}>{a.msg}</p>
                  {a.photoUrl && <img src={a.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                  {a.time && <span className="text-xs text-gray-400 shrink-0">{a.time}</span>}
                </motion.div>
              )
            })
          )}
        </div>

        {/* #33 — 班次填寫狀況（只對店長/小店長顯示）*/}
        {(user.role === 'manager' || user.role === 'sub-manager') && shiftFillStatus.length > 0 && (
          <div className="bg-white rounded-2xl px-4 py-4">
            <p className="text-sm font-bold text-gray-500 mb-3">今日班次填寫狀況</p>
            <div className="space-y-2">
              {shiftFillStatus.map(s => (
                <div key={s.shift} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: s.submitted ? '#ecfdf5' : '#f9fafb' }}>
                  <span className="text-base" style={{ color: s.submitted ? '#10b981' : '#d1d5db' }}>
                    {s.submitted ? '✓' : '○'}
                  </span>
                  <span className="text-sm font-bold" style={{ color: s.submitted ? '#059669' : '#9ca3af' }}>
                    {s.shift}
                  </span>
                  {s.submitted ? (
                    <span className="ml-auto text-sm text-gray-500">{s.staffName} · {s.time}</span>
                  ) : (
                    <span className="ml-auto text-sm text-gray-300">尚未提交</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Module grid */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <span className="w-1 h-5 rounded-full" style={{ background: '#00a040' }} />
            <p className="text-base font-bold text-gray-700">今日填寫項目</p>
            <p className="ml-auto text-sm text-gray-400">點擊進入填寫</p>
          </div>
          <div className="flex flex-col gap-2">
            {[...modules, ...(recordsModule ? [recordsModule] : []), ...(subManagerModule ? [subManagerModule] : [])].map(({ page, icon: Icon, label, desc, color, bg, done, total, badge }, i) => {
              const isCompleted = done !== null && total !== null && (total ?? 0) > 0 && done === total
              return (
              <motion.button
                key={page + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { trackClick(page); onNavigate(page) }}
                className={`rounded-2xl p-4 text-left shadow-sm flex items-center gap-4 ${isCompleted ? 'bg-green-50' : 'bg-white'}`}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-800 leading-tight">{label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
                  {done !== null && total !== null && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(total ?? 0) > 0 ? (done ?? 0) / (total ?? 1) * 100 : 0}%`, background: color }} />
                      </div>
                      <p className="text-sm mt-0.5 font-semibold" style={{ color }}>{done}/{total} 完成</p>
                    </div>
                  )}
                </div>
                {badge
                  ? <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white shrink-0">{badge}</span>
                  : isCompleted
                    ? <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-100 text-green-600 shrink-0">✓ 完成</span>
                    : <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                }
              </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* #26 — 當天異常事項 modal（店長/小店長登入時顯示）*/}
      <AnimatePresence>
        {anomalyModal.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="w-full bg-white rounded-3xl overflow-hidden"
              style={{ maxWidth: 440, maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800">當天異常事項</p>
                    <p className="text-sm text-gray-400">{anomalyModal.length} 筆待處理</p>
                  </div>
                </div>
                <button onClick={() => setAnomalyModal([])} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-3 space-y-2 flex-1">
                {anomalyModal.map(a => {
                  const sevColor = a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f97316' : a.severity === 'medium' ? '#f59e0b' : '#6b7280'
                  const sevBg    = a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fff7ed' : a.severity === 'medium' ? '#fffbeb' : '#f9fafb'
                  const sevLabel = a.severity === 'critical' ? '緊急' : a.severity === 'high' ? '高' : a.severity === 'medium' ? '中' : '低'
                  return (
                    <div key={a.id} className="rounded-2xl p-3.5" style={{ background: sevBg }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sevColor }}>{sevLabel}</span>
                        <span className="text-sm font-semibold text-gray-600">{a.category}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(a.reported_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-base text-gray-700 leading-snug">{renderDescription(a.description)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="px-5 pb-5 pt-2 shrink-0">
                <button
                  onClick={() => { setAnomalyModal([]); onNavigate('anomaly') }}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-base"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  前往異常回報處理
                </button>
                <button onClick={() => setAnomalyModal([])} className="w-full mt-2 py-3 text-base text-gray-500 font-semibold">
                  稍後處理
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
