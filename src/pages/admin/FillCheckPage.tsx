import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

const FRIENDLY_SHIFT_KEYS: Record<string, string[]> = {
  '早班': ['t0930'],
  '中班': ['t1600', 't1630'],
  '夜班': ['t2300', 't2400'],
}

const FRIENDLY_LABELS: Record<string, string> = {
  t0930: '友善食光貼標（09:30）',
  t1600: '過期品下架（16:00）',
  t1630: '友善食光貼標（16:30）',
  t2300: '過期品下架（23:00）',
  t2400: '過期品下架（24:00）',
}

const CATEGORIES = ['溫度記錄', '廢棄物 / 制服', '機器清潔', '友善食光', '簽名確認'] as const

interface MissingGroup { category: string; items: string[] }

function analyzeMissing(record: any): MissingGroup[] {
  const groups: MissingGroup[] = []

  if (Array.isArray(record.temperatures) && record.temperatures.length > 0) {
    const missing = record.temperatures
      .filter((t: any) => !t.skipped && !(t.readings || []).some((r: any) => r.value !== null))
      .map((t: any) => t.location)
    if (missing.length) groups.push({ category: '溫度記錄', items: missing })
  }

  const waste = record.tasks_done?._waste || {}
  const wasteMissing: string[] = []
  if (!waste.wasteDeliveryTime) wasteMissing.push('廢棄物交付時間')
  if (!waste.cupCollectionTime) wasteMissing.push('收退循環杯時間')
  if (!waste.uniformScan)       wasteMissing.push('制服離店過刷時間')
  if (!waste.groundCleaning)    wasteMissing.push('地墊清潔')
  if (!waste.tapeSafety)        wasteMissing.push('貼膠安全')
  if (wasteMissing.length) groups.push({ category: '廢棄物 / 制服', items: wasteMissing })

  const cleaning = record.tasks_done?._cleaning || {}
  const cleaningEntries = Object.entries(cleaning)
  const emptyMachines = cleaningEntries.filter(([, v]) => !v).map(([k]) => k)
  if (cleaningEntries.length === 0 || emptyMachines.length === cleaningEntries.length) {
    groups.push({ category: '機器清潔', items: ['未填寫任何清潔時間'] })
  } else if (emptyMachines.length) {
    groups.push({ category: '機器清潔', items: emptyMachines })
  }

  const friendly = record.tasks_done?._friendly || {}
  const shiftKey = Object.keys(FRIENDLY_SHIFT_KEYS).find(k => (record.shift || '').startsWith(k))
  if (shiftKey) {
    const missing = FRIENDLY_SHIFT_KEYS[shiftKey].filter(k => !friendly[k]).map(k => FRIENDLY_LABELS[k])
    if (missing.length) groups.push({ category: '友善食光', items: missing })
  }

  const sigMissing: string[] = []
  if (!record.tasks_done?._signature)         sigMissing.push('員工簽名')
  if (!record.tasks_done?._manager_signature) sigMissing.push('店長簽名')
  if (sigMissing.length) groups.push({ category: '簽名確認', items: sigMissing })

  return groups
}

// ── 統計視圖 ──────────────────────────────────────────────
function StatsView({ records, storeLabel }: { records: any[]; storeLabel: (id: string) => string }) {
  const analyzed = useMemo(() => records.map(r => ({ r, missing: analyzeMissing(r) })), [records])

  const total    = records.length
  const okCount  = analyzed.filter(({ missing }) => missing.length === 0).length
  const okRate   = total > 0 ? Math.round(okCount / total * 100) : 0

  const categoryStats = useMemo(() =>
    CATEGORIES.map(cat => ({
      cat,
      count: analyzed.filter(({ missing }) => missing.some(g => g.category === cat)).length,
    })).sort((a, b) => b.count - a.count),
  [analyzed])

  const storeStats = useMemo(() => {
    const map: Record<string, { ok: number; total: number; missingItems: number }> = {}
    analyzed.forEach(({ r, missing }) => {
      const key = r.store_id
      if (!map[key]) map[key] = { ok: 0, total: 0, missingItems: 0 }
      map[key].total++
      map[key].missingItems += missing.reduce((s, g) => s + g.items.length, 0)
      if (missing.length === 0) map[key].ok++
    })
    return Object.entries(map).sort(([, a], [, b]) => b.missingItems - a.missingItems)
  }, [analyzed])

  const rateColor = okRate >= 80 ? '#16a34a' : okRate >= 50 ? '#d97706' : '#dc2626'

  if (total === 0) return (
    <div className="text-center py-16 text-gray-300">
      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
      <p className="text-base">查無當日提交紀錄</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 整體完成率 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-400 mb-3">整體完成率</p>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-5xl font-black" style={{ color: rateColor }}>{okRate}%</span>
          <span className="text-base text-gray-400 mb-1">{okCount} / {total} 筆完整</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${okRate}%`, background: rateColor }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-sm text-green-600 font-semibold">{okCount} 筆完整</span>
          <span className="text-sm text-red-500 font-semibold">{total - okCount} 筆缺項</span>
        </div>
      </div>

      {/* 各類別缺填次數 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-400 mb-3">各類別缺填次數（由高到低）</p>
        <div className="space-y-3">
          {categoryStats.map(({ cat, count }) => {
            const pct   = total > 0 ? count / total : 0
            const color = pct === 0 ? '#16a34a' : pct < 0.34 ? '#d97706' : pct < 0.67 ? '#ea580c' : '#dc2626'
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-medium text-gray-700">{cat}</span>
                  <span className="text-base font-bold" style={{ color: count === 0 ? '#16a34a' : color }}>
                    {count === 0 ? '✓ 全部完整' : `${count} / ${total} 筆`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 各門市缺填狀況 */}
      {storeStats.length > 1 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-400 mb-3">各門市缺填狀況</p>
          <div className="space-y-2">
            {storeStats.map(([storeId, s]) => {
              const isOk = s.missingItems === 0
              return (
                <div key={storeId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: isOk ? '#f0fdf4' : '#fafafa' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-800 truncate">{storeLabel(storeId)}</p>
                    <p className="text-sm text-gray-400">{s.ok}/{s.total} 班次完整</p>
                  </div>
                  {isOk ? (
                    <span className="text-base font-bold text-green-600 shrink-0">✓ 完整</span>
                  ) : (
                    <span className="text-base font-bold text-red-500 shrink-0">{s.missingItems} 項未填</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────
export default function FillCheckPage({ user, onBack }: Props) {
  const todayStr      = new Date().toISOString().split('T')[0]
  const isManagerView = user.role === 'manager' || user.role === 'sub-manager'

  const [tab, setTab]                 = useState<'detail' | 'stats'>('stats')
  const [date, setDate]               = useState(todayStr)
  const [storeFilter, setStoreFilter] = useState(isManagerView ? user.storeId : '')
  const [records, setRecords]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [storeOptions, setStoreOptions] = useState<string[]>([])
  const [storeNames, setStoreNames]     = useState<Record<string, string>>({})

  const storeLabel = (id: string) => storeNames[id] ? `${id} ${storeNames[id]}` : `${id} 店`

  useEffect(() => {
    const fetchMeta = async () => {
      const [r1, rNames] = await Promise.all([
        supabase.from('daily_work_logs').select('store_id'),
        supabase.from('stores').select('store_id, store_name'),
      ])
      setStoreOptions([...new Set((r1.data || []).map((r: any) => r.store_id))].sort())
      if (rNames.data) {
        const map: Record<string, string> = {}
        rNames.data.forEach((r: any) => { map[r.store_id] = r.store_name })
        setStoreNames(map)
      }
    }
    fetchMeta()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setExpanded(null)
      let query = supabase
        .from('daily_work_logs')
        .select('*')
        .eq('log_date', date)
        .order('store_id')
        .order('submitted_at', { ascending: false })
      if (storeFilter.trim()) query = query.eq('store_id', storeFilter.trim())
      const { data } = await query
      setRecords(data || [])
      setLoading(false)
    }
    load()
  }, [date, storeFilter])

  const okCount      = records.filter(r => analyzeMissing(r).length === 0).length
  const missingCount = records.length - okCount

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">每日填報查核</h1>
            <p className="text-base text-gray-400">{isManagerView ? user.storeName : '各門市未填項目統計'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {([['stats', '統計'], ['detail', '明細']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: tab === key ? '#005f3b' : '#f3f4f6', color: tab === key ? 'white' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none"
          />
          {!isManagerView && (
            <div className="relative">
              <select
                value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none appearance-none pr-7"
              >
                <option value="">全部門市</option>
                {storeOptions.map(s => <option key={s} value={s}>{storeLabel(s)}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入中...</span>
          </div>
        ) : tab === 'stats' ? (
          <StatsView records={records} storeLabel={storeLabel} />
        ) : (
          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-base">查無當日提交紀錄</p>
              </div>
            ) : (
              <>
                {/* 明細摘要 */}
                <div className="flex gap-2 mb-1">
                  <div className="flex-1 rounded-xl px-3 py-2 bg-green-50 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-base font-bold text-green-700">{okCount} 筆完整</span>
                  </div>
                  <div className="flex-1 rounded-xl px-3 py-2 bg-amber-50 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-base font-bold text-amber-700">{missingCount} 筆有缺項</span>
                  </div>
                </div>

                {records.map((r, i) => {
                  const missing    = analyzeMissing(r)
                  const totalItems = missing.reduce((sum, g) => sum + g.items.length, 0)
                  const isOk       = missing.length === 0
                  const severity   = isOk ? 'ok' : missing.length <= 2 ? 'warn' : 'err'
                  const C = {
                    ok:   { text: '#16a34a', bg: '#f0fdf4' },
                    warn: { text: '#d97706', bg: '#fffbeb' },
                    err:  { text: '#dc2626', bg: '#fef2f2' },
                  }[severity]
                  const ts = r.submitted_at
                    ? new Date(r.submitted_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                    : '—'

                  return (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.bg }}>
                          {isOk
                            ? <CheckCircle2 className="w-4 h-4" style={{ color: C.text }} />
                            : <AlertCircle  className="w-4 h-4" style={{ color: C.text }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-gray-800 truncate">{storeLabel(r.store_id)}</span>
                            <span className="text-base text-gray-400 shrink-0">{r.shift?.split(' ')[0]}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-semibold" style={{ color: C.text }}>
                              {isOk ? '✓ 完整填寫' : `${totalItems} 項未填`}
                            </span>
                            <span className="text-base text-gray-400">・{r.staff_name} ・{ts}</span>
                          </div>
                        </div>
                        {expanded === r.id
                          ? <ChevronUp   className="w-4 h-4 text-gray-300 shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {expanded === r.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-gray-50">
                            <div className="px-4 py-3 space-y-3">
                              {isOk ? (
                                <p className="text-base text-green-600 font-semibold">✓ 所有必填項目均已完成</p>
                              ) : (
                                missing.map(group => (
                                  <div key={group.category}>
                                    <p className="text-sm font-bold mb-1" style={{ color: C.text }}>{group.category}</p>
                                    <div className="space-y-0.5 pl-2">
                                      {group.items.map(item => (
                                        <div key={item} className="flex items-start gap-1.5">
                                          <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0 mt-2" />
                                          <span className="text-base text-gray-600">{item}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
