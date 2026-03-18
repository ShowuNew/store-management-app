import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ChevronDown, ChevronUp, Store, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

type Tab = 'daily-work' | 'hygiene' | 'equipment'

const todayStr = new Date().toISOString().split('T')[0]

export default function RecordsPage({ onBack }: Props) {
  const [tab, setTab]           = useState<Tab>('daily-work')
  const [date, setDate]         = useState(todayStr)
  const [storeFilter, setStoreFilter] = useState('')
  const [records, setRecords]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setExpanded(null)

      let query: any
      if (tab === 'daily-work') {
        query = supabase.from('daily_work_logs').select('*').eq('log_date', date).order('submitted_at', { ascending: false })
      } else if (tab === 'hygiene') {
        query = supabase.from('hygiene_records').select('*').eq('record_date', date).order('saved_at', { ascending: false })
      } else {
        query = supabase.from('equipment_logs').select('*').eq('log_date', date).order('saved_at', { ascending: false })
      }

      if (storeFilter.trim()) query = query.eq('store_id', storeFilter.trim())

      const { data } = await query
      setRecords(data || [])
      setLoading(false)
    }
    load()
  }, [tab, date, storeFilter])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily-work', label: '每日工作' },
    { key: 'hygiene',    label: '衛生記錄' },
    { key: 'equipment',  label: '設備保養' },
  ]

  const getDoneCount = (record: any): string => {
    if (tab === 'daily-work') {
      const done = Object.values(record.tasks_done || {}).filter(Boolean).length
      return `${done} 項完成`
    }
    if (tab === 'hygiene') {
      const pass = Object.values(record.results || {}).filter(v => v === 'pass').length
      const fail = Object.values(record.results || {}).filter(v => v === 'fail').length
      return `${pass} 符合 / ${fail} 缺失`
    }
    const done = Object.values(record.done_items || {}).filter(Boolean).length
    return `${done} 項完成`
  }

  const getTimestamp = (record: any): string => {
    const ts = record.submitted_at || record.saved_at
    if (!ts) return '—'
    return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  const getSubtitle = (record: any): string => {
    if (tab === 'daily-work') return record.shift
    if (tab === 'hygiene')    return `${record.shift} 班`
    return record.zone
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} aria-label="返回" className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">紀錄查閱</h1>
            <p className="text-base text-gray-400">跨門市提交紀錄</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl text-base font-bold transition-all"
              style={{ background: tab === t.key ? '#005f3b' : '#f3f4f6', color: tab === t.key ? 'white' : '#6b7280' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none"
          />
          <input
            type="text"
            placeholder="門市代號"
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
            className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-2 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入中...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <ClipboardListIcon />
            <p className="text-base mt-3">查無資料</p>
          </div>
        ) : (
          records.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-800 truncate">{r.store_id}</span>
                    <span className="text-base text-gray-400 shrink-0">{getSubtitle(r)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base text-green-600 font-semibold">{getDoneCount(r)}</span>
                    <span className="text-base text-gray-400">・{r.staff_name} ・{getTimestamp(r)}</span>
                  </div>
                </div>
                {expanded === r.id
                  ? <ChevronUp   className="w-4 h-4 text-gray-300 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />
                }
              </button>

              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-50"
                  >
                    <DetailView record={r} tab={tab} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

function ClipboardListIcon() {
  return (
    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

const tasksByTime = [
  { time: '07:00', tasks: ['確認鮮食上架日期標籤', '確認熱食區設備電源', '清潔咖啡機出水口', '確認冷藏/冷凍溫度記錄'] },
  { time: '10:00', tasks: ['補充貨架缺貨商品', '整理收銀台環境', '確認外送訂單處理完畢'] },
  { time: '12:00', tasks: ['確認午餐鮮食補充狀況', '清潔微波爐內部'] },
  { time: '14:30', tasks: ['準備班次交接事項', '確認交接清單完整', '核對收銀機帳目'] },
]

const hygieneCategories = [
  { name: '場所衛生', items: ['營業場所清潔', '出入口防蟲', '廁所清潔', '洗手台備品', '倉庫後場'] },
  { name: '衛生品質', items: ['食品分類存放', '冷凍冷藏溫度', '設備器具清潔', '消毒規定', '包材收納'] },
  { name: '從業人員', items: ['定期健康檢查', '整齊工作服', '手部清潔', '禁菸嚼檳規定'] },
  { name: '菸害防制', items: ['未成年禁菸', '禁售糖果玩具', '禁促銷廣告', '禁菸盒交付', '法定標示'] },
]

function DetailView({ record, tab }: { record: any; tab: Tab }) {
  if (tab === 'daily-work') {
    return (
      <div className="px-4 py-3 space-y-3">
        {tasksByTime.map(({ time, tasks }) => (
          <div key={time}>
            <p className="text-base font-bold text-gray-400 mb-1.5">{time}</p>
            <div className="space-y-1">
              {tasks.map((task, i) => {
                const key  = `${time}-${i}`
                const done = record.tasks_done?.[key]
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${done ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                      {done && <span className="text-white text-[8px]">✓</span>}
                    </span>
                    <span className="text-base text-gray-600">{task}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'hygiene') {
    return (
      <div className="px-4 py-3 space-y-3">
        {hygieneCategories.map((cat, ci) => (
          <div key={ci}>
            <p className="text-base font-bold text-gray-400 mb-1.5">{cat.name}</p>
            <div className="space-y-1">
              {cat.items.map((item, ii) => {
                const key = `${ci}-${ii}`
                const result = record.results?.[key]
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-base text-gray-600 flex-1 truncate">{item}</span>
                    <span className={`text-base font-bold px-2 py-0.5 rounded-md ml-2 shrink-0 ${
                      result === 'pass' ? 'bg-green-50 text-green-600' :
                      result === 'fail' ? 'bg-red-50 text-red-500' : 'text-gray-300'
                    }`}>
                      {result === 'pass' ? '符合' : result === 'fail' ? '缺失' : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // equipment
  const doneItems = record.done_items || {}
  const allKeys = Object.keys(doneItems)
  return (
    <div className="px-4 py-3">
      <p className="text-base font-bold text-gray-400 mb-2">區域：{record.zone}</p>
      {allKeys.length === 0 ? (
        <p className="text-base text-gray-400">無項目記錄</p>
      ) : (
        <div className="space-y-1">
          {allKeys.map(key => (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${doneItems[key] ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                {doneItems[key] && <span className="text-white text-[8px]">✓</span>}
              </span>
              <span className="text-base text-gray-600">{key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
