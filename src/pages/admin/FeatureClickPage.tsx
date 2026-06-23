import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, RefreshCw, MousePointerClick } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

const FEATURE_LABELS: Record<string, string> = {
  'daily-work':          '每日工作確認',
  'hygiene':             '衛生自主管理',
  'inspection':          '店鋪點檢',
  'coffee-check':        '咖啡機自檢',
  'c15-check':           'C15確認',
  'equipment':           '設備清潔保養',
  'anomaly':             '異常回報',
  'stats':               '月報統計',
  'sub-manager-manage':  '小店長連結',
  'admin-records':       '紀錄查閱',
}

export default function FeatureClickPage({ user, onBack }: Props) {
  const todayStr      = new Date().toISOString().split('T')[0]
  const isManagerView = user.role === 'manager' || user.role === 'sub-manager'

  const [startDate,   setStartDate]   = useState(todayStr)
  const [endDate,     setEndDate]     = useState(todayStr)
  const [storeFilter, setStoreFilter] = useState(isManagerView ? user.storeId : '')
  const [rows,        setRows]        = useState<{ feature: string; store_id: string; user_name: string }[]>([])
  const [loading,     setLoading]     = useState(true)
  const [storeOptions, setStoreOptions] = useState<string[]>([])
  const [storeNames,   setStoreNames]   = useState<Record<string, string>>({})

  const storeLabel = (id: string) => storeNames[id] ? `${id} ${storeNames[id]}` : `${id} 店`

  useEffect(() => {
    supabase.from('stores').select('store_id, store_name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        const ids: string[] = []
        data.forEach((r: any) => { map[r.store_id] = r.store_name; ids.push(r.store_id) })
        setStoreNames(map)
        setStoreOptions(ids.sort())
      }
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase
        .from('feature_usage_logs')
        .select('feature, store_id, user_name')
        .gte('clicked_at', startDate)
        .lte('clicked_at', endDate + 'T23:59:59')
      if (storeFilter.trim()) query = query.eq('store_id', storeFilter.trim())
      const { data } = await query
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [startDate, endDate, storeFilter])

  const featureRanking = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => { map[r.feature] = (map[r.feature] ?? 0) + 1 })
    return Object.entries(map)
      .map(([feature, count]) => ({ feature, count, label: FEATURE_LABELS[feature] ?? feature }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const storeRanking = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => { map[r.store_id] = (map[r.store_id] ?? 0) + 1 })
    return Object.entries(map)
      .map(([store_id, count]) => ({ store_id, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const maxFeatureCount = featureRanking[0]?.count ?? 1

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">功能點擊排行</h1>
            <p className="text-base text-gray-400">各功能進入次數統計</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="flex-1 min-w-[130px] border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="flex-1 min-w-[130px] border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none" />
          {!isManagerView && (
            <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
              className="w-36 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none">
              <option value="">全部門市</option>
              {storeOptions.map(s => <option key={s} value={s}>{storeLabel(s)}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入中...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <MousePointerClick className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-base">查無點擊紀錄</p>
          </div>
        ) : (
          <>
            {/* 總計 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <MousePointerClick className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-black text-blue-600">{rows.length}</p>
                <p className="text-base text-gray-400">總點擊次數</p>
              </div>
            </div>

            {/* 功能排行 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-400 mb-3">功能點擊排行（由高到低）</p>
              <div className="space-y-3">
                {featureRanking.map(({ feature, count, label }, i) => {
                  const pct = count / maxFeatureCount
                  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0891b2', '#16a34a', '#7c3aed', '#d97706', '#dc2626']
                  const color  = colors[i % colors.length]
                  return (
                    <motion.div key={feature} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center text-white shrink-0"
                            style={{ background: color, fontSize: '10px' }}>{i + 1}</span>
                          <span className="text-base font-medium text-gray-700">{label}</span>
                        </div>
                        <span className="text-base font-black" style={{ color }}>{count} 次</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* 各門市點擊量（多門市時才顯示） */}
            {storeRanking.length > 1 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-gray-400 mb-3">各門市點擊量</p>
                <div className="space-y-2">
                  {storeRanking.map(({ store_id, count }) => (
                    <div key={store_id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
                      <p className="text-base font-bold text-gray-800">{storeLabel(store_id)}</p>
                      <p className="text-base font-black text-blue-600">{count} 次</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
