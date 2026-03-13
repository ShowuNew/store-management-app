import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
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

export default function StatsPage({ onBack }: Props) {
  const [weekStats, setWeekStats] = useState<DayStats[]>([])
  const [anomalyStats, setAnomalyStats] = useState<AnomalyCategory[]>([])
  const [hygieneRate, setHygieneRate] = useState({ pass: 0, fail: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Build last 7 days
      const days: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
      }

      // Query all three tables for last 7 days
      const [dwRes, hyRes, eqRes, anRes] = await Promise.all([
        supabase.from('daily_work_logs').select('log_date').gte('log_date', days[0]),
        supabase.from('hygiene_records').select('record_date, results').gte('record_date', days[0]),
        supabase.from('equipment_logs').select('log_date').gte('log_date', days[0]),
        supabase.from('anomaly_reports').select('category'),
      ])

      const dwByDay = groupByDate(dwRes.data || [], 'log_date')
      const hyByDay = groupByDate(hyRes.data || [], 'record_date')
      const eqByDay = groupByDate(eqRes.data || [], 'log_date')

      const stats: DayStats[] = days.map(d => ({
        date: d,
        label: new Date(d + 'T12:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
        dailyWork: dwByDay[d] || 0,
        hygiene:   hyByDay[d] || 0,
        equipment: eqByDay[d] || 0,
      }))
      setWeekStats(stats)

      // Hygiene pass/fail rate (all records in last 7 days)
      let totalPass = 0, totalFail = 0
      for (const row of (hyRes.data || [])) {
        const vals = Object.values(row.results || {})
        totalPass += vals.filter(v => v === 'pass').length
        totalFail += vals.filter(v => v === 'fail').length
      }
      setHygieneRate({ pass: totalPass, fail: totalFail, total: totalPass + totalFail })

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
  }, [])

  const maxCount = Math.max(...weekStats.map(d => Math.max(d.dailyWork, d.hygiene, d.equipment)), 1)

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
            <p className="text-xs text-gray-400">近 7 天趨勢分析</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">計算中...</span>
          </div>
        ) : (
          <>
            {/* Weekly bar chart */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-800 mb-1">近 7 天提交量</p>
              <div className="flex items-center gap-3 mb-4">
                {[
                  { label: '每日工作', color: '#3b82f6' },
                  { label: '衛生記錄', color: '#10b981' },
                  { label: '設備保養', color: '#8b5cf6' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
                    <span className="text-[10px] text-gray-400">{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 h-28">
                {weekStats.map((d, i) => (
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
              <p className="text-sm font-bold text-gray-800 mb-3">衛生檢查合格率（近 7 天）</p>
              {hygieneRate.total === 0 ? (
                <p className="text-xs text-gray-400">暫無資料</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-black text-green-600">
                      {Math.round(hygieneRate.pass / hygieneRate.total * 100)}%
                    </span>
                    <div>
                      <p className="text-xs text-gray-400">符合 <span className="font-bold text-green-600">{hygieneRate.pass}</span> 項</p>
                      <p className="text-xs text-gray-400">缺失 <span className="font-bold text-red-500">{hygieneRate.fail}</span> 項</p>
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
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>合格</span>
                    <span>缺失</span>
                  </div>
                </>
              )}
            </div>

            {/* Anomaly category distribution */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">異常類別分布（全部）</p>
              {anomalyStats.length === 0 ? (
                <p className="text-xs text-gray-400">暫無資料</p>
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
                        <div className="flex justify-between text-xs mb-1">
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

function groupByDate(rows: any[], key: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const d = row[key]
    map[d] = (map[d] || 0) + 1
  }
  return map
}
