import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, TrendingUp, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

interface DayStats {
  date: string
  label: string
  dailyWork: number
  hygiene: number
  equipment: number
}

interface AnomalyCategory {
  category: string
  count: number
  color: string
}

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#6b7280']

function groupByDate(rows: any[], key: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const d = row[key]
    map[d] = (map[d] || 0) + 1
  }
  return map
}

function getMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function buildDateRange(fromDate: string): string[] {
  const days: string[] = []
  const from = new Date(fromDate + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const cur = new Date(from)
  while (cur <= today) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// Group daily data into ~5 week buckets for monthly bar chart
function groupByWeek(days: string[], dwByDay: Record<string, number>, hyByDay: Record<string, number>, eqByDay: Record<string, number>): DayStats[] {
  if (days.length <= 7) {
    return days.map(d => ({
      date: d, label: new Date(d + 'T12:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      dailyWork: dwByDay[d] || 0, hygiene: hyByDay[d] || 0, equipment: eqByDay[d] || 0,
    }))
  }
  // Group into chunks of ~7
  const chunkSize = Math.ceil(days.length / 5)
  const result: DayStats[] = []
  for (let i = 0; i < days.length; i += chunkSize) {
    const chunk = days.slice(i, i + chunkSize)
    const label = new Date(chunk[0] + 'T12:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    result.push({
      date: chunk[0], label,
      dailyWork: chunk.reduce((s, d) => s + (dwByDay[d] || 0), 0),
      hygiene:   chunk.reduce((s, d) => s + (hyByDay[d] || 0), 0),
      equipment: chunk.reduce((s, d) => s + (eqByDay[d] || 0), 0),
    })
  }
  return result
}

export default function StatsPage({ user, onBack }: Props) {
  const [tab, setTab] = useState<'7d' | 'month'>('7d')
  const [barStats, setBarStats] = useState<DayStats[]>([])
  const [anomalyStats, setAnomalyStats] = useState<AnomalyCategory[]>([])
  const [hygieneRate, setHygieneRate] = useState({ pass: 0, fail: 0, total: 0 })
  const [monthCompletion, setMonthCompletion] = useState({ full: 0, total: 0 })
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const isSupervisor = user.role === 'supervisor' || user.role === 'admin'

      const fromDate = tab === '7d'
        ? (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0] })()
        : getMonthStart()

      const days = buildDateRange(fromDate)

      const q = (table: string, select: string) => {
        const base = supabase.from(table).select(select)
        return isSupervisor ? base.gte(table === 'anomaly_reports' ? 'created_at' : (table === 'hygiene_records' ? 'record_date' : 'log_date'), fromDate)
          : base.eq('store_id', user.storeId).gte(table === 'anomaly_reports' ? 'created_at' : (table === 'hygiene_records' ? 'record_date' : 'log_date'), fromDate)
      }

      const [dwRes, hyRes, eqRes, anRes] = await Promise.all([
        q('daily_work_logs', 'log_date'),
        q('hygiene_records', 'record_date, results'),
        q('equipment_logs', 'log_date'),
        isSupervisor
          ? supabase.from('anomaly_reports').select('category, created_at').gte('created_at', fromDate)
          : supabase.from('anomaly_reports').select('category, created_at').eq('store_id', user.storeId).gte('created_at', fromDate),
      ])

      const dwByDay = groupByDate(dwRes.data || [], 'log_date')
      const hyByDay = groupByDate(hyRes.data || [], 'record_date')
      const eqByDay = groupByDate(eqRes.data || [], 'log_date')

      setBarStats(groupByWeek(days, dwByDay, hyByDay, eqByDay))

      // Hygiene pass/fail rate
      let totalPass = 0, totalFail = 0
      for (const row of ((hyRes.data as any[]) || [])) {
        const vals = Object.values(row.results || {})
        totalPass += vals.filter(v => v === 'pass').length
        totalFail += vals.filter(v => v === 'fail').length
      }
      setHygieneRate({ pass: totalPass, fail: totalFail, total: totalPass + totalFail })

      // Monthly completion: days where all 3 modules have ≥1 entry
      if (tab === 'month') {
        const fullDays = days.filter(d => (dwByDay[d] || 0) > 0 && (hyByDay[d] || 0) > 0 && (eqByDay[d] || 0) > 0)
        setMonthCompletion({ full: fullDays.length, total: days.length })

        // Score: hygiene rate 50% + completion rate 50%
        const completionRate = days.length > 0 ? fullDays.length / days.length : 0
        const hyRate = (totalPass + totalFail) > 0 ? totalPass / (totalPass + totalFail) : 0
        setScore(Math.round((completionRate * 50 + hyRate * 50)))
      } else {
        setMonthCompletion({ full: 0, total: 0 })
        setScore(null)
      }

      // Anomaly by category
      const catMap: Record<string, number> = {}
      for (const row of (anRes.data || [])) {
        catMap[row.category] = (catMap[row.category] || 0) + 1
      }
      const cats = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count], i) => ({ category, count, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      setAnomalyStats(cats)

      setLoading(false)
    }
    load()
  }, [tab, user.role, user.storeId])

  const maxCount = Math.max(...barStats.map(d => Math.max(d.dailyWork, d.hygiene, d.equipment)), 1)

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            ←
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">數據統計</h1>
            <p className="text-base text-gray-400">趨勢分析與績效評估</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex mt-3 bg-gray-100 rounded-xl p-1 gap-1">
          {(['7d', 'month'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-lg text-base font-semibold transition-all"
              style={{
                background: tab === t ? '#ffffff' : 'transparent',
                color: tab === t ? '#111827' : '#6b7280',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t === '7d' ? '近 7 天' : '本月'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">計算中...</span>
          </div>
        ) : (
          <>
            {/* Monthly score card */}
            {tab === 'month' && score !== null && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 flex items-center gap-4"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: score >= 80 ? '#dcfce7' : score >= 60 ? '#fef9c3' : '#fee2e2' }}
                >
                  <Award className="w-7 h-7" style={{ color: score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626' }} />
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-400 mb-0.5">本月綜合評分</p>
                  <p className="text-3xl font-black" style={{ color: score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626' }}>
                    {score} <span className="text-base font-normal text-gray-400">/ 100</span>
                  </p>
                  <p className="text-base text-gray-400 mt-0.5">全勤日 {monthCompletion.full}/{monthCompletion.total} 天 · 衛生合格率 {hygieneRate.total > 0 ? Math.round(hygieneRate.pass / hygieneRate.total * 100) : 0}%</p>
                </div>
              </motion.div>
            )}

            {/* Monthly completion rate */}
            {tab === 'month' && (
              <div className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <p className="text-base font-bold text-gray-800">本月全勤完成率</p>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-blue-600">
                    {monthCompletion.total > 0 ? Math.round(monthCompletion.full / monthCompletion.total * 100) : 0}%
                  </span>
                  <span className="text-base text-gray-400 mb-1">{monthCompletion.full} / {monthCompletion.total} 天三項全填</span>
                </div>
                <div className="h-2.5 bg-blue-50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${monthCompletion.total > 0 ? monthCompletion.full / monthCompletion.total * 100 : 0}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-2.5 bg-blue-500 rounded-full"
                  />
                </div>
                <p className="text-base text-gray-400 mt-1">每日工作、衛生記錄、設備保養均填寫計為全勤</p>
              </div>
            )}

            {/* Bar chart */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-base font-bold text-gray-800 mb-1">{tab === '7d' ? '近 7 天' : '本月'}提交量</p>
              <div className="flex items-center gap-3 mb-4">
                {[
                  { label: '每日工作', color: '#3b82f6' },
                  { label: '衛生記錄', color: '#10b981' },
                  { label: '設備保養', color: '#8b5cf6' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
                    <span className="text-base text-gray-400">{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 h-28">
                {barStats.map((d, i) => (
                  <motion.div
                    key={d.date}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="w-full flex items-end gap-0.5 h-20">
                      {[
                        { val: d.dailyWork, color: '#3b82f6' },
                        { val: d.hygiene,   color: '#10b981' },
                        { val: d.equipment, color: '#8b5cf6' },
                      ].map((b, j) => (
                        <div
                          key={j}
                          className="flex-1 rounded-t-sm transition-all"
                          style={{
                            height: `${Math.max(b.val / maxCount * 100, b.val > 0 ? 8 : 0)}%`,
                            background: b.color,
                            opacity: 0.85,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{d.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Hygiene pass rate */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-base font-bold text-gray-800 mb-3">衛生檢查合格率（{tab === '7d' ? '近 7 天' : '本月'}）</p>
              {hygieneRate.total === 0 ? (
                <p className="text-base text-gray-400">暫無資料</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-black text-green-600">
                      {Math.round(hygieneRate.pass / hygieneRate.total * 100)}%
                    </span>
                    <div>
                      <p className="text-base text-gray-400">符合 <span className="font-bold text-green-600">{hygieneRate.pass}</span> 項</p>
                      <p className="text-base text-gray-400">缺失 <span className="font-bold text-red-500">{hygieneRate.fail}</span> 項</p>
                    </div>
                  </div>
                  <div className="h-3 bg-red-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${hygieneRate.pass / hygieneRate.total * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-3 bg-green-500 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between text-base text-gray-400 mt-1">
                    <span>合格</span>
                    <span>缺失</span>
                  </div>
                </>
              )}
            </div>

            {/* Anomaly category distribution */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-base font-bold text-gray-800 mb-3">異常類別分布（{tab === '7d' ? '近 7 天' : '本月'}）</p>
              {anomalyStats.length === 0 ? (
                <p className="text-base text-gray-400">暫無資料</p>
              ) : (
                <div className="space-y-2.5">
                  {anomalyStats.map((cat, i) => {
                    const total = anomalyStats.reduce((s, c) => s + c.count, 0)
                    const pct = Math.round(cat.count / total * 100)
                    return (
                      <motion.div
                        key={cat.category}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="flex justify-between text-base mb-1">
                          <span className="font-semibold text-gray-700">{cat.category}</span>
                          <span className="text-gray-400">{cat.count} 件 ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            className="h-2 rounded-full"
                            style={{ background: cat.color }}
                          />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
