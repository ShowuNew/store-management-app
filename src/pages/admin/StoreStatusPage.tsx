import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, CheckCircle2, Clock, MinusCircle,
  AlertTriangle, ChevronDown, ChevronUp, Calendar, RefreshCw,
} from 'lucide-react'
import type { User } from '../../types'

interface Props {
  user: User
  onBack: () => void
}

type ShiftStatus = 'done' | 'pending' | 'none'

interface StoreData {
  storeId: string
  storeName: string
  district: string
  dailyWork: { morning: ShiftStatus; afternoon: ShiftStatus; night: ShiftStatus }
  hygiene:   { morning: ShiftStatus; afternoon: ShiftStatus; night: ShiftStatus }
  equipment: { morning: ShiftStatus; afternoon: ShiftStatus; night: ShiftStatus }
  openAnomalies: number
}

// 模擬 10 間店鋪靜態資料（含店號 123456）
const STORE_LIST: StoreData[] = [
  {
    storeId: '123456', storeName: '信義門市', district: '信義區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'pending' },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'none'    },
    equipment: { morning: 'done', afternoon: 'pending', night: 'none'    },
    openAnomalies: 1,
  },
  {
    storeId: '234567', storeName: '大安門市', district: '大安區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'none'    },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'none'    },
    equipment: { morning: 'done', afternoon: 'done',    night: 'none'    },
    openAnomalies: 0,
  },
  {
    storeId: '345678', storeName: '中山門市', district: '中山區',
    dailyWork: { morning: 'done', afternoon: 'pending', night: 'none'    },
    hygiene:   { morning: 'done', afternoon: 'none',    night: 'none'    },
    equipment: { morning: 'done', afternoon: 'none',    night: 'none'    },
    openAnomalies: 2,
  },
  {
    storeId: '456789', storeName: '松山門市', district: '松山區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'pending' },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'pending' },
    equipment: { morning: 'done', afternoon: 'done',    night: 'none'    },
    openAnomalies: 0,
  },
  {
    storeId: '567890', storeName: '內湖門市', district: '內湖區',
    dailyWork: { morning: 'done', afternoon: 'none',    night: 'none'    },
    hygiene:   { morning: 'done', afternoon: 'none',    night: 'none'    },
    equipment: { morning: 'none', afternoon: 'none',    night: 'none'    },
    openAnomalies: 3,
  },
  {
    storeId: '678901', storeName: '南港門市', district: '南港區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'done'    },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'done'    },
    equipment: { morning: 'done', afternoon: 'done',    night: 'done'    },
    openAnomalies: 0,
  },
  {
    storeId: '789012', storeName: '文山門市', district: '文山區',
    dailyWork: { morning: 'done', afternoon: 'pending', night: 'none'    },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'none'    },
    equipment: { morning: 'done', afternoon: 'pending', night: 'none'    },
    openAnomalies: 1,
  },
  {
    storeId: '890123', storeName: '北投門市', district: '北投區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'pending' },
    hygiene:   { morning: 'done', afternoon: 'pending', night: 'none'    },
    equipment: { morning: 'done', afternoon: 'none',    night: 'none'    },
    openAnomalies: 0,
  },
  {
    storeId: '901234', storeName: '士林門市', district: '士林區',
    dailyWork: { morning: 'none', afternoon: 'none',    night: 'none'    },
    hygiene:   { morning: 'none', afternoon: 'none',    night: 'none'    },
    equipment: { morning: 'none', afternoon: 'none',    night: 'none'    },
    openAnomalies: 0,
  },
  {
    storeId: '112233', storeName: '萬華門市', district: '萬華區',
    dailyWork: { morning: 'done', afternoon: 'done',    night: 'none'    },
    hygiene:   { morning: 'done', afternoon: 'done',    night: 'none'    },
    equipment: { morning: 'done', afternoon: 'done',    night: 'none'    },
    openAnomalies: 1,
  },
]

/* ── 輔助函式 ── */
function countDone(shifts: { morning: ShiftStatus; afternoon: ShiftStatus; night: ShiftStatus }) {
  return [shifts.morning, shifts.afternoon, shifts.night].filter(s => s === 'done').length
}

function storeScore(s: StoreData): number {
  return countDone(s.dailyWork) + countDone(s.hygiene) + countDone(s.equipment)
}

function isAllDone(s: StoreData) {
  const full = (sh: StoreData['dailyWork']) =>
    sh.morning === 'done' && sh.afternoon === 'done' && sh.night === 'done'
  return full(s.dailyWork) && full(s.hygiene) && full(s.equipment)
}

function hasIssue(s: StoreData) {
  const hasNone = (sh: StoreData['dailyWork']) =>
    sh.morning === 'none' || sh.afternoon === 'none' || sh.night === 'none'
  return hasNone(s.dailyWork) || hasNone(s.hygiene) || hasNone(s.equipment) || s.openAnomalies > 0
}

/* ── 班別狀態 Badge ── */
const SHIFT_LABEL = { morning: '早', afternoon: '午', night: '晚' } as const

function StatusDot({ status }: { status: ShiftStatus }) {
  if (status === 'done')    return <CheckCircle2 className="w-4 h-4" style={{ color: '#16a34a' }} />
  if (status === 'pending') return <Clock        className="w-4 h-4" style={{ color: '#d97706' }} />
  return                           <MinusCircle  className="w-4 h-4 text-gray-300" />
}

function ShiftRow({ label, shifts }: { label: string; shifts: StoreData['dailyWork'] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 w-14 shrink-0">{label}</span>
      <div className="flex gap-3">
        {(['morning', 'afternoon', 'night'] as const).map(k => (
          <div key={k} className="flex items-center gap-0.5">
            <StatusDot status={shifts[k]} />
            <span className="text-xs text-gray-400">{SHIFT_LABEL[k]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 總完成率文字 ── */
function CompletionBadge({ store }: { store: StoreData }) {
  if (isAllDone(store)) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>
        全部完成
      </span>
    )
  }
  if (hasIssue(store)) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>
        有未完成
      </span>
    )
  }
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fefce8', color: '#b45309' }}>
      進行中
    </span>
  )
}

/* ── 單間店鋪卡片 ── */
function StoreCard({ store, index }: { store: StoreData; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const score = storeScore(store)
  const total = 9

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      {/* 卡片頂部摘要列 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
      >
        {/* 店號圖示 */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#f0fdf4' }}>
          <Building2 className="w-5 h-5" style={{ color: '#16a34a' }} />
        </div>

        {/* 店名 + 店號 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900">{store.storeName}</span>
            <span className="text-xs text-gray-400">#{store.storeId}</span>
            <CompletionBadge store={store} />
          </div>
          {/* 進度條 */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(score / total) * 100}%`,
                  background: score === total ? '#16a34a' : score > 5 ? '#d97706' : '#ef4444',
                }}
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0">{score}/{total}</span>
          </div>
        </div>

        {/* 異常數 + 展開箭頭 */}
        <div className="flex items-center gap-2 shrink-0">
          {store.openAnomalies > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle className="w-3 h-3" />
              {store.openAnomalies}
            </span>
          )}
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {/* 展開詳細 */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-gray-50 px-4 py-3 space-y-2"
        >
          <ShiftRow label="每日確認" shifts={store.dailyWork} />
          <ShiftRow label="衛生管理" shifts={store.hygiene}   />
          <ShiftRow label="設備保養" shifts={store.equipment} />

          {store.openAnomalies > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-red-500 font-semibold">
                尚有 {store.openAnomalies} 件異常待處理
              </span>
            </div>
          )}

          {/* 圖例 */}
          <div className="flex gap-4 pt-1 border-t border-gray-50">
            {[
              { icon: <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />, label: '已完成' },
              { icon: <Clock        className="w-3.5 h-3.5" style={{ color: '#d97706' }} />, label: '進行中' },
              { icon: <MinusCircle  className="w-3.5 h-3.5 text-gray-300" />,               label: '未提交' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1">
                {icon}
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ══ 主頁面 ══ */
type FilterType = 'all' | 'done' | 'issue'

export default function StoreStatusPage({ onBack }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [dateStr, setDateStr] = useState(today)
  const [filter, setFilter]   = useState<FilterType>('all')

  const filtered = useMemo(() => {
    return STORE_LIST.filter(s => {
      if (filter === 'done')  return isAllDone(s)
      if (filter === 'issue') return hasIssue(s)
      return true
    })
  }, [filter])

  const doneCount  = STORE_LIST.filter(isAllDone).length
  const issueCount = STORE_LIST.filter(hasIssue).length
  const midCount   = STORE_LIST.length - doneCount - issueCount

  const filterTabs: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all',   label: '全部',   count: STORE_LIST.length, color: '#374151' },
    { key: 'done',  label: '全部完成', count: doneCount,          color: '#16a34a' },
    { key: 'issue', label: '有未完成', count: issueCount,          color: '#dc2626' },
  ]

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #00a040, #007d30)' }} />
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-900">店鋪作業完成狀況</h1>
            <p className="text-xs text-gray-400">即時查看各店鋪作業提交情形</p>
          </div>
          <button
            onClick={() => setDateStr(today)}
            className="flex items-center gap-1 text-xs text-green-700 font-semibold px-2 py-1 rounded-lg bg-green-50"
          >
            <RefreshCw className="w-3 h-3" />今日
          </button>
        </div>

        {/* 日期選擇 */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateStr}
              max={today}
              onChange={e => setDateStr(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 font-semibold outline-none"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* 摘要數字列 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '全部完成', value: doneCount,          color: '#16a34a', bg: '#f0fdf4' },
            { label: '進行中',   value: midCount,            color: '#d97706', bg: '#fffbeb' },
            { label: '有未完成', value: issueCount,          color: '#dc2626', bg: '#fef2f2' },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-3 text-center"
              style={{ background: c.bg }}
            >
              <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: c.color }}>{c.label}</p>
            </motion.div>
          ))}
        </div>

        {/* 篩選 tabs */}
        <div className="flex gap-2">
          {filterTabs.map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                filter === key
                  ? 'border-transparent shadow-sm'
                  : 'border-gray-100 bg-white text-gray-500'
              }`}
              style={filter === key ? { background: color, color: '#fff' } : {}}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* 店鋪卡片列表 */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">此篩選無資料</div>
          ) : (
            filtered.map((store, i) => (
              <StoreCard key={store.storeId} store={store} index={i} />
            ))
          )}
        </div>

        {/* 資料說明 */}
        <p className="text-center text-xs text-gray-300 pt-2">
          資料為模擬展示 · 實際上線後將串接後端即時資料
        </p>
      </div>
    </div>
  )
}
