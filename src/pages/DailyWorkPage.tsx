import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Circle, Thermometer, Save, AlertCircle,
  RefreshCw, Clock, Plus, Trash2, Package, Wrench, Leaf, Shirt, MessageSquare, ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type ViewType = 'overview' | 'temperature' | 'waste' | 'cleaning' | 'friendly' | 'handover'

const shifts = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']

// ── 溫度設備規格 ──
interface TempSpec { location: string; required: string; zone: string; check: (v: number) => boolean }
const tempSpecs: TempSpec[] = [
  { location: '4°C 間隔機（前後中島）', required: '4°C',      zone: '賣場', check: v => v >= 2 && v <= 6 },
  { location: 'OC',                    required: '0~7°C',    zone: '賣場', check: v => v >= 0 && v <= 7 },
  { location: 'WI（走入式冷藏）',      required: '0~7°C',    zone: '賣場', check: v => v >= 0 && v <= 7 },
  { location: '立式冷凍',              required: '-18°C以下', zone: '賣場', check: v => v <= -18 },
  { location: '18°C 欄',               required: '18°C以下',  zone: '賣場', check: v => v <= 18 },
  { location: '咖啡冷藏機台',          required: '0~7°C',    zone: '咖啡', check: v => v >= 0 && v <= 7 },
  { location: '牛奶冰箱',              required: '0~7°C',    zone: '咖啡', check: v => v >= 0 && v <= 7 },
  { location: '冷凍冰箱',              required: '-18°C以下', zone: '咖啡', check: v => v <= -18 },
  { location: '冰淇淋機（子母機）',    required: '依機台',    zone: '咖啡', check: () => true },
  { location: '蒸箱',                  required: '65°C以上',  zone: 'FF區', check: v => v >= 65 },
  { location: '關東煮機',              required: '82~85°C',   zone: 'FF區', check: v => v >= 82 && v <= 85 },
  { location: '鮮食機',                required: '0~7°C',    zone: 'FF區', check: v => v >= 0 && v <= 7 },
  { location: 'FF 冷凍冰箱',            required: '-20°C以下', zone: 'FF區', check: v => v <= -20 },
]

// ── 機器清潔清單 ──
const cleaningMachines = [
  '霜淇淋機濾網清潔沖洗', '封口機', '蒸包機', '熱狗機', '茶葉蛋鍋',
  '保溫機（單溫）', '保溫機（雙溫）', '咖啡機（手沖臥式固定式）', '廚房清潔',
]

// ── 友善食光任務 ──
const friendlyTasks = [
  { key: 't0930', time: '09:30', label: '友善食光貼標',  detail: '友善食光商品' },
  { key: 't1600', time: '16:00', label: '過期品下架',    detail: '生鮮蔬果18°C欄、4°C欄、麵包' },
  { key: 't1630', time: '16:30', label: '友善食光貼標',  detail: '生鮮蔬果、4°C欄、OC、溫藏器、輕食點心' },
  { key: 't2300', time: '23:00', label: '過期品下架',    detail: '咖啡用牛奶、WI（FF廚房熱狗、關東煮）、霜淇淋複存盒' },
  { key: 't2400', time: '24:00', label: '過期品下架',    detail: '預購/隨買/蘭購/各溫層專區（冷藏、冷凍、常溫）' },
]

const zones = ['全部', '賣場', '咖啡', 'FF區']
const todayStr = new Date().toISOString().split('T')[0]
const nowTimeStr = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

interface TempReading { time: string; value: string }
type TempData = Record<number, TempReading[]>

interface WasteState {
  foodWasteBags: string; recyclingCount: string
  leftoverFoodTime: string; cupCollectionTime: string
  verified: boolean; groundCleaning: boolean
}
const defaultWaste: WasteState = { foodWasteBags: '', recyclingCount: '', leftoverFoodTime: '', cupCollectionTime: '', verified: false, groundCleaning: false }

const evalReading = (spec: TempSpec, r: TempReading): boolean | null => {
  if (!r.value.trim()) return null
  const n = parseFloat(r.value)
  return isNaN(n) ? null : spec.check(n)
}

type AnomalyStatus = 'none' | 'recheck' | 'repair' | 'resolved'
const anomalyStatus = (spec: TempSpec, readings: TempReading[]): AnomalyStatus => {
  const filled = readings.filter(r => r.value.trim())
  if (!filled.length) return 'none'
  const lastNormal = evalReading(spec, filled[filled.length - 1])
  if (lastNormal === false) return filled.length >= 2 ? 'repair' : 'recheck'
  if (lastNormal === true && filled.some(r => evalReading(spec, r) === false)) return 'resolved'
  return 'none'
}

export default function DailyWorkPage({ user, onBack }: Props) {
  const [view, setView]             = useState<ViewType>('overview')
  const [selectedShift, setSelectedShift] = useState(0)
  const [tempData, setTempData]     = useState<TempData>({})
  const [waste, setWaste]           = useState<WasteState>(defaultWaste)
  const [cleaning, setCleaning]     = useState<Record<string, string>>({})
  const [friendly, setFriendly]     = useState<Record<string, boolean>>({})
  const [uniform, setUniform]       = useState({ appearance: false, sanitize: false })
  const [handoverNote, setHandoverNote] = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [tempZone, setTempZone]     = useState('全部')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: allData } = await supabase
        .from('daily_work_logs').select('*')
        .eq('store_id', user.storeId).eq('log_date', todayStr)
      const allLogs: any[] = allData || []

      const shiftLog = allLogs.find((l: any) => l.shift === shifts[selectedShift])
      if (shiftLog) {
        setExistingId(shiftLog.id)
        setHandoverNote(shiftLog.handover_note ?? '')
        setSubmitted(!!shiftLog.submitted_at)
        if (Array.isArray(shiftLog.temperatures)) {
          const restored: TempData = {}
          shiftLog.temperatures.forEach((item: { readings?: { time: string; value: number | null }[] }, i: number) => {
            if (Array.isArray(item.readings)) {
              restored[i] = item.readings.map(r => ({
                time: r.time ?? '',
                value: r.value !== null && r.value !== undefined ? String(r.value) : '',
              }))
            }
          })
          setTempData(restored)
        } else { setTempData({}) }
      } else {
        setExistingId(null); setHandoverNote(''); setTempData({}); setSubmitted(false)
      }

      const sorted = [...allLogs].sort((a: any, b: any) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
      )
      setWaste(sorted.find((l: any) => l.tasks_done?._waste)?.tasks_done._waste ?? defaultWaste)
      setCleaning(sorted.find((l: any) => l.tasks_done?._cleaning)?.tasks_done._cleaning ?? {})
      setFriendly(sorted.find((l: any) => l.tasks_done?._friendly)?.tasks_done._friendly ?? {})
      setUniform(sorted.find((l: any) => l.tasks_done?._uniform)?.tasks_done._uniform ?? { appearance: false, sanitize: false })
      setLoading(false)
    }
    load()
  }, [selectedShift, user.storeId])

  const getReadings = (i: number) => tempData[i] ?? []
  const addReading = (i: number) => {
    setTempData(p => ({ ...p, [i]: [...(p[i] ?? []), { time: nowTimeStr(), value: '' }] }))
    setExpandedIdx(i); setSubmitted(false)
  }
  const updateReading = (i: number, rIdx: number, field: keyof TempReading, val: string) => {
    setTempData(p => { const list = [...(p[i] ?? [])]; list[rIdx] = { ...list[rIdx], [field]: val }; return { ...p, [i]: list } })
    setSubmitted(false)
  }
  const removeReading = (i: number, rIdx: number) => {
    setTempData(p => { const list = [...(p[i] ?? [])]; list.splice(rIdx, 1); return { ...p, [i]: list } })
    setSubmitted(false)
  }

  const handleSubmit = async () => {
    setSaving(true)
    const temperaturesPayload = tempSpecs.map((spec, i) => ({
      location: spec.location, required: spec.required, zone: spec.zone,
      readings: (tempData[i] ?? []).map(r => {
        const num = r.value.trim() !== '' ? parseFloat(r.value) : null
        return { time: r.time, value: num, isNormal: num !== null ? spec.check(num) : null }
      }),
    }))
    const payload = {
      store_id: user.storeId, staff_name: user.name, log_date: todayStr,
      shift: shifts[selectedShift], temperatures: temperaturesPayload,
      tasks_done: { _waste: waste, _cleaning: cleaning, _friendly: friendly, _uniform: uniform },
      handover_note: handoverNote,
      submitted_at: new Date().toISOString(),
    }
    if (existingId) {
      await supabase.from('daily_work_logs').update(payload).eq('id', existingId)
    } else {
      const { data } = await supabase.from('daily_work_logs').insert(payload).select().single()
      if (data) setExistingId(data.id)
    }
    setSubmitted(true); setSaving(false)
  }

  // ── 各區塊完成狀態（用於 overview 卡片）──
  const tempFilledCount  = tempSpecs.filter((_, i) => getReadings(i).some(r => r.value.trim())).length
  const tempRepairCount  = tempSpecs.filter((spec, i) => anomalyStatus(spec, getReadings(i)) === 'repair').length
  const tempRecheckCount = tempSpecs.filter((spec, i) => anomalyStatus(spec, getReadings(i)) === 'recheck').length
  const cleaningFilled   = cleaningMachines.filter(m => cleaning[m]?.trim()).length
  const friendlyDone     = friendlyTasks.filter(t => friendly[t.key]).length
  const wasteAnyFilled   = !!(waste.foodWasteBags || waste.recyclingCount || waste.leftoverFoodTime || waste.cupCollectionTime || waste.verified || waste.groundCleaning || uniform.appearance || uniform.sanitize)
  const wasteDone        = waste.verified && waste.groundCleaning && uniform.appearance

  const filteredIndices = tempZone === '全部'
    ? tempSpecs.map((_, i) => i)
    : tempSpecs.map((_, i) => i).filter(i => tempSpecs[i].zone === tempZone)

  // ── 路由標題 ──
  const viewTitles: Record<ViewType, string> = {
    overview:    '每日工作確認',
    temperature: '溫度記錄',
    waste:       '廢棄物 / 制服確認',
    cleaning:    '機器清潔時間登記',
    friendly:    '友善食光 / 過期品下架',
    handover:    '交接班紀錄',
  }
  const handleBack = () => view === 'overview' ? onBack() : setView('overview')

  // ────────────────────────────────────────────────
  // Overview
  // ────────────────────────────────────────────────
  const renderOverview = () => {
    type CardStatus = 'gray' | 'yellow' | 'green' | 'red'
    const statusColor: Record<CardStatus, string> = {
      gray:   '#d1d5db',
      yellow: '#f59e0b',
      green:  '#10b981',
      red:    '#ef4444',
    }
    const statusBg: Record<CardStatus, string> = {
      gray:   '#f9fafb',
      yellow: '#fffbeb',
      green:  '#f0fdf4',
      red:    '#fef2f2',
    }

    const tempStatus: CardStatus = tempRepairCount > 0 ? 'red' : tempRecheckCount > 0 ? 'yellow' : tempFilledCount > 0 ? 'green' : 'gray'
    const wasteStatus: CardStatus = wasteDone ? 'green' : wasteAnyFilled ? 'yellow' : 'gray'
    const cleanStatus: CardStatus = cleaningFilled === cleaningMachines.length ? 'green' : cleaningFilled > 0 ? 'yellow' : 'gray'
    const friendlyStatus: CardStatus = friendlyDone === friendlyTasks.length ? 'green' : friendlyDone > 0 ? 'yellow' : 'gray'
    const handoverStatus: CardStatus = handoverNote.trim() ? 'green' : 'gray'

    const cards: { view: ViewType; icon: React.ReactNode; title: string; sub: string; status: CardStatus }[] = [
      {
        view: 'temperature',
        icon: <Thermometer className="w-5 h-5" style={{ color: statusColor[tempStatus] }} />,
        title: '溫度記錄',
        sub: tempRepairCount > 0 ? `⚠ ${tempRepairCount} 項需報修`
           : tempRecheckCount > 0 ? `⏱ ${tempRecheckCount} 項需複核`
           : tempFilledCount > 0 ? `${tempFilledCount}/${tempSpecs.length} 台已填`
           : '尚未填寫',
        status: tempStatus,
      },
      {
        view: 'waste',
        icon: <Package className="w-5 h-5" style={{ color: statusColor[wasteStatus] }} />,
        title: '廢棄物 / 制服確認',
        sub: wasteDone ? '已完成確認' : wasteAnyFilled ? '填寫中' : '尚未填寫',
        status: wasteStatus,
      },
      {
        view: 'cleaning',
        icon: <Wrench className="w-5 h-5" style={{ color: statusColor[cleanStatus] }} />,
        title: '機器清潔時間登記',
        sub: cleaningFilled > 0 ? `${cleaningFilled}/${cleaningMachines.length} 台已填` : '尚未填寫',
        status: cleanStatus,
      },
      {
        view: 'friendly',
        icon: <Leaf className="w-5 h-5" style={{ color: statusColor[friendlyStatus] }} />,
        title: '友善食光 / 過期品下架',
        sub: friendlyDone > 0 ? `${friendlyDone}/${friendlyTasks.length} 完成` : '尚未確認',
        status: friendlyStatus,
      },
      {
        view: 'handover',
        icon: <MessageSquare className="w-5 h-5" style={{ color: statusColor[handoverStatus] }} />,
        title: '交接班紀錄',
        sub: handoverNote.trim() ? '已填寫' : '選填',
        status: handoverStatus,
      },
    ]

    return (
      <div className="space-y-4">
        {/* 班次選擇 */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">選擇班次</p>
          <div className="flex gap-2">
            {shifts.map((s, i) => (
              <button key={i} onClick={() => { setSelectedShift(i); setSubmitted(false) }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
                style={{
                  borderColor: selectedShift === i ? '#00a86b' : '#f3f4f6',
                  background:  selectedShift === i ? '#ecfdf5' : '#fafafa',
                  color:       selectedShift === i ? '#00a86b' : '#9ca3af',
                }}>
                {s.split(' ')[0]}<br />
                <span className="font-normal text-[10px]">{s.split(' ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 區塊卡片 */}
        <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50">
          {cards.map(card => (
            <motion.button key={card.view} whileTap={{ scale: 0.98 }}
              onClick={() => setView(card.view)}
              className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors"
              style={{ background: statusBg[card.status] }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{card.title}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: statusColor[card.status] }}>{card.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </motion.button>
          ))}
        </div>

        {/* Submit */}
        {!submitted ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #00a86b, #00d47e)', opacity: saving ? 0.7 : 1 }}>
            <Save className="w-4 h-4" />
            {saving ? '儲存中...' : `確認送出（${user.name} 簽署）`}
          </motion.button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-green-50 border border-green-100 text-center">
            <p className="text-green-600 font-bold text-sm">✓ 已完成班次確認並簽署</p>
            <p className="text-green-400 text-xs mt-0.5">{new Date().toLocaleTimeString('zh-TW')} 已儲存至資料庫</p>
            <button onClick={() => setSubmitted(false)} className="mt-2 text-xs text-green-500 underline">繼續編輯</button>
          </div>
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 溫度記錄
  // ────────────────────────────────────────────────
  const renderTemperature = () => {
    const totalReadings = tempSpecs.reduce((s, _, i) => s + (tempData[i]?.filter(r => r.value.trim()).length ?? 0), 0)
    const hasAbnormal = tempSpecs.some((spec, i) => {
      const s = anomalyStatus(spec, getReadings(i))
      return s === 'recheck' || s === 'repair'
    })
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">{totalReadings} 筆已填</span>
            {hasAbnormal && <span className="flex items-center gap-1 text-xs text-red-500 font-semibold"><AlertCircle className="w-3.5 h-3.5" /> 有異常</span>}
          </div>
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5">
            {zones.map(z => (
              <button key={z} onClick={() => setTempZone(z)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: tempZone === z ? '#1e40af' : '#f3f4f6', color: tempZone === z ? 'white' : '#6b7280' }}>
                {z}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredIndices.map(specIdx => {
              const spec       = tempSpecs[specIdx]
              const readings   = getReadings(specIdx)
              const isExpanded = expandedIdx === specIdx
              const status     = anomalyStatus(spec, readings)
              const lastFilled = [...readings].reverse().find(r => r.value.trim())
              const lastNormal = lastFilled ? evalReading(spec, lastFilled) : null
              const bgHeader   = status === 'repair' ? '#fef2f2' : status === 'recheck' ? '#fffbeb' : status === 'resolved' ? '#f0fdf4' : readings.length > 0 ? '#f0fdf4' : '#f9fafb'

              return (
                <div key={specIdx} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button className="w-full flex items-center justify-between px-3 py-2.5"
                    style={{ background: bgHeader }}
                    onClick={() => setExpandedIdx(isExpanded ? null : specIdx)}>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-gray-700">{spec.location}</p>
                      <p className="text-[10px] text-gray-400">標準：{spec.required}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'recheck'  && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">需複核</span>}
                      {status === 'repair'   && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">需報修</span>}
                      {status === 'resolved' && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已正常</span>}
                      {lastFilled
                        ? <span className="text-sm font-bold" style={{ color: lastNormal === false ? '#ef4444' : '#10b981' }}>
                            {parseFloat(lastFilled.value) > 0 ? '+' : ''}{parseFloat(lastFilled.value)}°C
                          </span>
                        : <span className="text-xs text-gray-300">未填</span>
                      }
                      {readings.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-md">{readings.length}筆</span>}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100">
                          {readings.length === 0 && <p className="text-xs text-gray-300 text-center py-1">尚無量測紀錄</p>}
                          {readings.map((r, rIdx) => {
                            const normal = evalReading(spec, r)
                            return (
                              <div key={rIdx} className="flex items-center gap-2">
                                <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50">
                                  <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                                  <input type="time" className="text-xs font-medium text-gray-700 outline-none bg-transparent w-16"
                                    value={r.time} onChange={e => updateReading(specIdx, rIdx, 'time', e.target.value)} />
                                </div>
                                <div className="flex items-center border rounded-lg overflow-hidden flex-1"
                                  style={{ borderColor: normal === false ? '#fca5a5' : normal === true ? '#6ee7b7' : '#e5e7eb' }}>
                                  <input type="number" inputMode="decimal"
                                    className="flex-1 text-center text-sm font-bold outline-none bg-transparent py-1.5 px-2"
                                    style={{ color: normal === false ? '#ef4444' : normal === true ? '#10b981' : '#374151' }}
                                    placeholder="溫度" value={r.value}
                                    onChange={e => updateReading(specIdx, rIdx, 'value', e.target.value)} />
                                  <span className="text-xs text-gray-400 pr-2">°C</span>
                                </div>
                                {r.value.trim() && <span className="text-[10px] font-bold w-7 text-center shrink-0" style={{ color: normal === false ? '#ef4444' : '#10b981' }}>{normal === false ? '異常' : 'OK'}</span>}
                                <button onClick={() => removeReading(specIdx, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 shrink-0">
                                  <Trash2 className="w-3 h-3 text-gray-400" />
                                </button>
                              </div>
                            )
                          })}
                          <button onClick={() => addReading(specIdx)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-blue-300 text-xs font-semibold text-blue-500">
                            <Plus className="w-3.5 h-3.5" /> 新增量測
                          </button>
                          {status === 'recheck' && <p className="text-[11px] text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2">⏱ 請於 30 分鐘後再次量測確認</p>}
                          {status === 'repair'  && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ 複核後仍異常，請至「異常回報」提交報修申請</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 廢棄物 / 制服
  // ────────────────────────────────────────────────
  const renderWaste = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shirt className="w-3.5 h-3.5 text-purple-500" />
          <p className="text-xs font-bold text-gray-700">制服 / 服裝儀容確認</p>
          <span className="ml-auto text-[10px] text-gray-300">不分班次</span>
        </div>
        <div className="space-y-2">
          {[
            { key: 'appearance', label: '當班制服清潔整齊、頭髮整潔、無飾物' },
            { key: 'sanitize',   label: '手部消毒完成（販售咖啡前 / 更換牛奶前）' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => { setUniform(p => ({ ...p, [key]: !p[key as keyof typeof uniform] })); setSubmitted(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: (uniform as any)[key] ? '#f5f3ff' : '#f9fafb' }}>
              {(uniform as any)[key]
                ? <CheckCircle2 className="w-5 h-5 shrink-0 text-purple-500" />
                : <Circle className="w-5 h-5 shrink-0 text-gray-200" />}
              <span className="text-sm" style={{ color: (uniform as any)[key] ? '#7c3aed' : '#374151' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-3.5 h-3.5 text-orange-500" />
          <p className="text-xs font-bold text-gray-700">廢棄物管理</p>
          <span className="ml-auto text-[10px] text-gray-300">不分班次</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: '廚餘袋數',     key: 'foodWasteBags',    unit: '袋', type: 'number' },
            { label: '資源回收',     key: 'recyclingCount',   unit: '件', type: 'number' },
            { label: '剩食交付時間', key: 'leftoverFoodTime', unit: '',   type: 'time'   },
            { label: '鋼環杯交付',   key: 'cupCollectionTime',unit: '',   type: 'time'   },
          ].map(({ label, key, unit, type }) => (
            <div key={key}>
              <label className="text-[10px] font-semibold text-gray-400 mb-1 block">{label}</label>
              <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1">
                <input type={type} inputMode={type === 'number' ? 'numeric' : undefined}
                  className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent"
                  placeholder={type === 'time' ? '--:--' : '0'}
                  value={(waste as any)[key]}
                  onChange={e => { setWaste(p => ({ ...p, [key]: e.target.value })); setSubmitted(false) }} />
                {unit && <span className="text-xs text-gray-400">{unit}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[
            { key: 'verified',      label: '驗整確認' },
            { key: 'groundCleaning',label: '地盤清潔／貼膠安全確認' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => { setWaste(p => ({ ...p, [key]: !p[key as keyof WasteState] })); setSubmitted(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: (waste as any)[key] ? '#ecfdf5' : '#f9fafb' }}>
              {(waste as any)[key]
                ? <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
                : <Circle className="w-5 h-5 shrink-0 text-gray-200" />}
              <span className="text-sm" style={{ color: (waste as any)[key] ? '#059669' : '#374151' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────
  // 機器清潔
  // ────────────────────────────────────────────────
  const renderCleaning = () => (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-[10px] text-gray-300 text-right mb-3">不分班次</p>
      <div className="space-y-2">
        {cleaningMachines.map(machine => (
          <div key={machine} className="flex items-center gap-3">
            <p className="flex-1 text-xs text-gray-700 font-medium">{machine}</p>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 gap-1 shrink-0"
              style={{ borderColor: cleaning[machine]?.trim() ? '#6ee7b7' : '#e5e7eb' }}>
              <Clock className="w-3 h-3 text-gray-300" />
              <input type="time" className="text-xs font-medium text-gray-700 outline-none bg-transparent w-16"
                value={cleaning[machine] ?? ''}
                onChange={e => { setCleaning(p => ({ ...p, [machine]: e.target.value })); setSubmitted(false) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────
  // 友善食光
  // ────────────────────────────────────────────────
  const renderFriendly = () => (
    <div className="bg-white rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-500">{friendlyDone}/{friendlyTasks.length} 完成</span>
        <span className="text-[10px] text-gray-300">不分班次</span>
      </div>
      <div className="space-y-2">
        {friendlyTasks.map(t => {
          const done = !!friendly[t.key]
          return (
            <button key={t.key} onClick={() => { setFriendly(p => ({ ...p, [t.key]: !p[t.key] })); setSubmitted(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: done ? '#ecfdf5' : '#f9fafb' }}>
              {done ? <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" /> : <Circle className="w-5 h-5 shrink-0 text-gray-200" />}
              <div>
                <p className="text-xs font-bold" style={{ color: done ? '#059669' : '#374151' }}>
                  <span className="text-gray-400 mr-1">{t.time}</span>{t.label}
                </p>
                <p className="text-[10px] text-gray-400">{t.detail}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────
  // 交接班紀錄
  // ────────────────────────────────────────────────
  const renderHandover = () => (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-[10px] text-gray-400 mb-3">
        如有消費者反應，請記錄姓名、電話、反應時間；如有品質異常客訴，請量測並記錄機台溫度
      </p>
      <textarea
        rows={8}
        placeholder="請填寫交接事項、消費者反應或其他店鋪紀錄..."
        className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 outline-none resize-none leading-relaxed"
        value={handoverNote}
        onChange={e => { setHandoverNote(e.target.value); setSubmitted(false) }}
      />
    </div>
  )

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  const renderSection = () => {
    switch (view) {
      case 'temperature': return renderTemperature()
      case 'waste':       return renderWaste()
      case 'cleaning':    return renderCleaning()
      case 'friendly':    return renderFriendly()
      case 'handover':    return renderHandover()
      default:            return null
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title={viewTitles[view]}
        subtitle={view === 'overview' ? user.storeName : shifts[selectedShift]}
        onBack={handleBack}
      />
      <div className="px-4 py-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">載入紀錄...</span>
          </div>
        ) : view === 'overview' ? renderOverview() : renderSection()}
      </div>
    </div>
  )
}
