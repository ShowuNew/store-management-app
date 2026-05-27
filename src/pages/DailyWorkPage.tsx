import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Circle, Thermometer, Save, AlertCircle,
  RefreshCw, Clock, Plus, Trash2, Package, Wrench, Leaf, MessageSquare, ChevronRight, PenLine, RotateCcw,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

// ── 電子手簽名元件 ──
interface SignaturePadProps {
  value: string        // base64 or ''
  onChange: (b64: string) => void
  label: string
  canvasHeight?: number
}
function SignaturePad({ value, onChange, label, canvasHeight = 220 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Restore saved signature when value changes externally
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
  }, [value])

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!drawing.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }, [])

  const endDraw = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    lastPos.current = null
    const canvas = canvasRef.current!
    // Only save if canvas has content
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const hasContent = data.some((v, i) => i % 4 === 3 && v > 0)
    onChange(hasContent ? canvas.toDataURL('image/png') : '')
  }, [onChange])

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-gray-500 flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5" />{label}
        </span>
        {value && (
          <button onClick={clear} className="flex items-center gap-1 text-base text-gray-400 hover:text-red-400">
            <RotateCcw className="w-3 h-3" />重簽
          </button>
        )}
      </div>
      <div className="relative border-2 rounded-xl overflow-hidden"
        style={{ borderColor: value ? '#86efac' : '#e5e7eb', background: value ? '#f0fdf4' : '#fafafa' }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={canvasHeight * 3}
          className="w-full touch-none"
          style={{ display: 'block', cursor: 'crosshair', height: canvasHeight }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-base text-gray-300">請在此簽名</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface Props { user: User; onBack: () => void }

type ViewType = 'overview' | 'temperature' | 'waste' | 'cleaning' | 'friendly' | 'handover'
const SUB_VIEWS: Exclude<ViewType, 'overview'>[] = ['temperature', 'waste', 'cleaning', 'friendly', 'handover']

const shifts = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']

// ── 溫度設備規格 ──
interface TempSpec { specKey: string; location: string; required: string; zone: string; check: (v: number) => boolean; standard?: string; hint?: string }
interface EffectiveSpec extends TempSpec { unitIndex: number; slotKey: string; unitLabel: string }

const BASE_SPECS: TempSpec[] = [
  // ── 店舖賣場 ──
  { specKey: 'shelf-18c',       location: '18°C開放櫃',              required: '16-20°C',   zone: '賣場', check: v => v >= 16 && v <= 20,  standard: '18'  },
  { specKey: 'fridge-4c',       location: '4°C開放櫃（壁型、中島）', required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'OC',              location: 'OC',                      required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'WI',              location: 'WI',                      required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'RI',              location: 'RI立式冷藏櫃',            required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'freezer-chest',   location: '臥式冰櫃（含子母櫃）',   required: '-18°C以下', zone: '賣場', check: v => v <= -18,            standard: '-18' },
  { specKey: 'freezer-v',       location: '立式冷凍櫃（含走入式）',  required: '-18°C以下', zone: '賣場', check: v => v <= -18,            standard: '-18' },
  { specKey: 'light-food',      location: '輕食櫃',                  required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'sapporo-fridge',  location: '金色三麥冷藏冰箱',        required: '0~7°C',     zone: '賣場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'haagen-dazs',     location: '哈根達斯冰箱',            required: '-20°C以下', zone: '賣場', check: v => v <= -20,            standard: '-20' },
  // ── 咖啡櫃檯區 ──
  { specKey: 'milk-fridge',     location: '牛奶冰箱',                required: '0~7°C',     zone: '咖啡', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'coffee-fridge',   location: '抽屜式冷藏冰箱',          required: '0~7°C',     zone: '咖啡', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'freezer-c',       location: '冷凍冰箱',                required: '-18°C以下', zone: '咖啡', check: v => v <= -18,            standard: '-18' },
  // ── 店舖後場／倉庫區 ──
  { specKey: 'backroom-fridge',  location: '冷藏冰箱',               required: '0~7°C',     zone: '後場', check: v => v >= 0  && v <= 7,   standard: '4'   },
  { specKey: 'backroom-freezer', location: '冷凍冰箱／立式冰箱',     required: '-18°C以下', zone: '後場', check: v => v <= -18,            standard: '-18' },
  // ── FF區機台 ──
  { specKey: 'hotdog',          location: '熱狗機刻度',               required: '3~3.5',     zone: 'FF區', check: v => v >= 3  && v <= 3.5, standard: '3.5' },
  { specKey: 'tea-egg',         location: '茶葉蛋鍋',                 required: '65°C以上',  zone: 'FF區', check: v => v >= 65,             standard: '65'  },
  { specKey: 'steamer',         location: '蒸箱',                     required: '65°C以上',  zone: 'FF區', check: v => v >= 65,             standard: '65'  },
  { specKey: 'ff-warmer',       location: '保溫櫃（單溫／雙溫）',     required: '65°C以上',  zone: 'FF區', check: v => v >= 65,             standard: '65'  },
  { specKey: 'oden',            location: '關東煮機',                  required: '82~85°C',   zone: 'FF區', check: v => v >= 82 && v <= 85,  standard: '83'  },
]

function buildEffectiveSpecs(counts: Record<string, number>, customs: TempSpec[]): EffectiveSpec[] {
  const result: EffectiveSpec[] = []
  for (const spec of BASE_SPECS) {
    const count = counts[spec.specKey] ?? 1
    for (let u = 0; u < count; u++) {
      result.push({ ...spec, unitIndex: u, slotKey: `${spec.specKey}-${u}`, unitLabel: count > 1 ? `（${u + 1}號機）` : '' })
    }
  }
  for (const spec of customs) {
    result.push({ ...spec, unitIndex: 0, slotKey: `${spec.specKey}-0`, unitLabel: '' })
  }
  return result
}

// ── 機器清潔清單 ──
const cleaningMachines = [
  '咖啡機（含自助區機台）',
  '霜淇淋機（殺菌鍵／洗濾網）',
  '封口機',
  '蒸包機',
  '熱狗機',
  '茶葉蛋鍋',
  '番薯機',
  '保溫櫃單溫／雙溫',
  '旋風烤箱／蒸烤爐',
  '咖啡複合店-手沖／義式／磨豆機',
  '咖啡複合店-輕食櫃',
  '咖啡複合店-微波烤箱',
]

// ── 友善食光任務 ──
const friendlyTasks = [
  { key: 't0930', time: '09:30', label: '友善食光貼標',  detail: '友善食光商品' },
  { key: 't1600', time: '16:00', label: '過期品下架',    detail: '生鮮蔬果18°C欄、4°C欄、麵包' },
  { key: 't1630', time: '16:30', label: '友善食光貼標',  detail: '生鮮蔬果、4°C欄、OC、溫藏器、輕食點心' },
  { key: 't2300', time: '23:00', label: '過期品下架',    detail: '咖啡用牛奶、WI（FF廚房熱狗、關東煮）、霜淇淋複存盒' },
  { key: 't2400', time: '24:00', label: '過期品下架',    detail: '預購/隨買/蘭購/各溫層專區（冷藏、冷凍、常溫）' },
]

const zones = ['全部', '賣場', '咖啡', '後場', 'FF區', '其他']
const nowTimeStr = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

interface TempReading { time: string; value: string }
type TempData = Record<string, TempReading[]>  // key = slotKey e.g. 'OC-0', 'OC-1'

interface WasteState {
  generalWasteBags: string; foodWasteBags: string; recyclingBags: string
  wasteDeliveryTime: string; cupCollectionTime: string
  uniformBags: string; uniformScan: string
  groundCleaning: boolean; tapeSafety: boolean
}
const defaultWaste: WasteState = {
  generalWasteBags: '', foodWasteBags: '', recyclingBags: '',
  wasteDeliveryTime: '', cupCollectionTime: '',
  uniformBags: '', uniformScan: '',
  groundCleaning: false, tapeSafety: false,
}


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

// ── 交接班結構化欄位 parse/serialize ──
const HANDOVER_SECTIONS = ['異常事項', '備品需求', '客訴記錄', '其他事項'] as const
type HandoverKey = typeof HANDOVER_SECTIONS[number]

function parseHandover(note: string): Record<HandoverKey, string> {
  const result: Record<HandoverKey, string> = { '異常事項': '', '備品需求': '', '客訴記錄': '', '其他事項': '' }
  if (!note.trim()) return result
  // Check if note uses structured markers
  if (note.includes('【')) {
    for (const key of HANDOVER_SECTIONS) {
      const marker = `【${key}】`
      const idx = note.indexOf(marker)
      if (idx === -1) continue
      const start = idx + marker.length
      // Find the next marker
      let end = note.length
      for (const other of HANDOVER_SECTIONS) {
        if (other === key) continue
        const oIdx = note.indexOf(`【${other}】`, start)
        if (oIdx !== -1 && oIdx < end) end = oIdx
      }
      result[key] = note.slice(start, end).trim()
    }
  } else {
    // Legacy free-text: put everything in 其他事項
    result['其他事項'] = note.trim()
  }
  return result
}

function serializeHandover(fields: Record<HandoverKey, string>): string {
  return HANDOVER_SECTIONS
    .filter(k => fields[k].trim())
    .map(k => `【${k}】${fields[k].trim()}`)
    .join('\n')
}

export default function DailyWorkPage({ user, onBack }: Props) {
  const [view, setView]             = useState<ViewType>('overview')
  const [selectedShift, setSelectedShift] = useState(0)
  const [manualDate, setManualDate] = useState('')
  const isManager = ['manager', 'supervisor', 'admin'].includes(user.role)
  const todayStr = useMemo(() => {
    const now = new Date()
    const taiwanHour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false }).format(now)
    )
    // 大夜班 (shift 2) + 台灣時間 00:00-07:59 → 歸屬前一天
    if (selectedShift === 2 && taiwanHour < 8) {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return d.toLocaleDateString('sv', { timeZone: 'Asia/Taipei' })
    }
    return now.toLocaleDateString('sv', { timeZone: 'Asia/Taipei' })
  }, [selectedShift])
  // 店長可手動指定日期補填；否則使用自動計算值
  const logDate = (isManager && manualDate) ? manualDate : todayStr
  const [tempData, setTempData]     = useState<TempData>({})
  const [waste, setWaste]           = useState<WasteState>(defaultWaste)
  const [cleaning, setCleaning]     = useState<Record<string, string>>({})
  const [friendly, setFriendly]     = useState<Record<string, boolean>>({})
  const [shiftSignature, setShiftSignature]     = useState('')
  const [managerSignature, setManagerSignature] = useState('')
  const [allShiftSigs, setAllShiftSigs] = useState({ morning: '', evening: '', lateNight: '' })
  const [sigModalOpen, setSigModalOpen] = useState(false)
  const [handoverNote, setHandoverNote] = useState('')
  const [handoverAnomaly, setHandoverAnomaly]       = useState('')
  const [handoverSupply, setHandoverSupply]         = useState('')
  const [handoverComplaint, setHandoverComplaint]   = useState('')
  const [handoverOther, setHandoverOther]           = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [tempZone, setTempZone]     = useState('全部')
  const [expandedIdx, setExpandedIdx] = useState<Set<string>>(new Set())
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [prevTempData, setPrevTempData] = useState<Record<string, string>>({})
  const [gpsAccuracy,  setGpsAccuracy]  = useState<number | null>(null)
  const [tempSkipped,  setTempSkipped]  = useState<Record<string, 'fault' | 'no-machine'>>({})
  const [tempNotes,    setTempNotes]    = useState<Record<string, string>>({})
  const [equipmentCounts, setEquipmentCounts] = useState<Record<string, number>>({})
  const [customSpecs, setCustomSpecs] = useState<TempSpec[]>([])
  const [now, setNow] = useState(new Date())
  const [addCustomOpen, setAddCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customRequired, setCustomRequired] = useState('')

  // Swipe card mode states
  const [swipeMode, setSwipeMode] = useState(true)
  const [cardIdx, setCardIdx] = useState(0)
  const [cardValue, setCardValue] = useState('')

  const effectiveSpecs = useMemo(() => buildEffectiveSpecs(equipmentCounts, customSpecs), [equipmentCounts, customSpecs])

  // Update clock every minute for 30-min recheck timer
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: allData } = await supabase
        .from('daily_work_logs').select('*')
        .eq('store_id', user.storeId).eq('log_date', logDate)
      const allLogs: any[] = allData || []

      const shiftLog = allLogs.find((l: any) => l.shift === shifts[selectedShift])
      if (shiftLog) {
        setExistingId(shiftLog.id)
        const hn = shiftLog.handover_note ?? ''
        setHandoverNote(hn)
        const parsed = parseHandover(hn)
        setHandoverAnomaly(parsed['異常事項'])
        setHandoverSupply(parsed['備品需求'])
        setHandoverComplaint(parsed['客訴記錄'])
        setHandoverOther(parsed['其他事項'])
        setSubmitted(!!shiftLog.submitted_at)
        setShiftSignature(shiftLog.tasks_done?._signature ?? '')
        if (Array.isArray(shiftLog.temperatures)) {
          const restored: TempData = {}
          const restoredSkipped: Record<string, 'fault' | 'no-machine'> = {}
          const restoredNotes: Record<string, string> = {}
          const newCounts: Record<string, number> = {}
          const newCustoms: TempSpec[] = []
          shiftLog.temperatures.forEach((item: any, positionalIdx: number) => {
            let slotKey: string
            if (item.specKey) {
              const unitIdx = item.unitIndex ?? 0
              slotKey = `${item.specKey}-${unitIdx}`
              const needed = unitIdx + 1
              if ((newCounts[item.specKey] ?? 0) < needed) newCounts[item.specKey] = needed
              if ((item.specKey as string).startsWith('custom-') && !newCustoms.find(s => s.specKey === item.specKey)) {
                newCustoms.push({ specKey: item.specKey, location: item.location ?? '', required: item.required ?? '', zone: item.zone ?? '其他', check: () => true })
              }
            } else {
              const base = BASE_SPECS[positionalIdx]
              if (!base) return
              slotKey = `${base.specKey}-0`
            }
            if (Array.isArray(item.readings)) {
              restored[slotKey] = item.readings.map((r: any) => ({ time: r.time ?? '', value: r.value !== null && r.value !== undefined ? String(r.value) : '' }))
            }
            if (item.skipped === 'fault' || item.skipped === 'no-machine') restoredSkipped[slotKey] = item.skipped
            if (item.actionNote) restoredNotes[slotKey] = item.actionNote
          })
          setTempData(restored)
          setTempSkipped(restoredSkipped)
          setTempNotes(restoredNotes)
          if (Object.keys(newCounts).length > 0) setEquipmentCounts(newCounts)
          if (newCustoms.length > 0) setCustomSpecs(newCustoms)
        } else { setTempData({}); setTempSkipped({}); setTempNotes({}) }
      } else {
        setExistingId(null); setHandoverNote(''); setTempData({}); setSubmitted(false)
        setHandoverAnomaly(''); setHandoverSupply(''); setHandoverComplaint(''); setHandoverOther('')
        setShiftSignature(''); setTempSkipped({}); setTempNotes({})
        // 帶入上一次溫度記錄作為預設值
        const { data: lastLog } = await supabase
          .from('daily_work_logs')
          .select('temperatures')
          .eq('store_id', user.storeId)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single()
        if (lastLog?.temperatures) {
          const prev: Record<string, string> = {}
          const newCounts: Record<string, number> = {}
          const newCustoms: TempSpec[] = []
          ;(lastLog.temperatures as any[]).forEach((item: any, positionalIdx: number) => {
            let slotKey: string
            if (item.specKey) {
              const unitIdx = item.unitIndex ?? 0
              slotKey = `${item.specKey}-${unitIdx}`
              const needed = unitIdx + 1
              if ((newCounts[item.specKey] ?? 0) < needed) newCounts[item.specKey] = needed
              if ((item.specKey as string).startsWith('custom-') && !newCustoms.find(s => s.specKey === item.specKey)) {
                newCustoms.push({ specKey: item.specKey, location: item.location ?? '', required: item.required ?? '', zone: item.zone ?? '其他', check: () => true })
              }
            } else {
              const base = BASE_SPECS[positionalIdx]
              if (!base) return
              slotKey = `${base.specKey}-0`
            }
            if (Array.isArray(item.readings)) {
              const lf = [...item.readings].reverse().find((r: any) => r.value !== null)
              if (lf?.value != null) prev[slotKey] = String(lf.value)
            }
          })
          setPrevTempData(prev)
          if (Object.keys(newCounts).length > 0) setEquipmentCounts(newCounts)
          if (newCustoms.length > 0) setCustomSpecs(newCustoms)
        } else {
          setPrevTempData({})
        }
      }

      const sorted = [...allLogs].sort((a: any, b: any) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
      )
      setWaste(sorted.find((l: any) => l.tasks_done?._waste)?.tasks_done._waste ?? defaultWaste)
      setCleaning(sorted.find((l: any) => l.tasks_done?._cleaning)?.tasks_done._cleaning ?? {})
      setFriendly(sorted.find((l: any) => l.tasks_done?._friendly)?.tasks_done._friendly ?? {})
      setManagerSignature(sorted.find((l: any) => l.tasks_done?._manager_signature)?.tasks_done._manager_signature ?? '')
      setAllShiftSigs({
        morning:   allLogs.find((l: any) => l.shift === shifts[0])?.tasks_done?._signature ?? '',
        evening:   allLogs.find((l: any) => l.shift === shifts[1])?.tasks_done?._signature ?? '',
        lateNight: allLogs.find((l: any) => l.shift === shifts[2])?.tasks_done?._signature ?? '',
      })
      setLoading(false)
    }
    load()
  }, [selectedShift, logDate, user.storeId])

  // When cardIdx changes or entering swipe mode, pre-fill cardValue with last reading
  useEffect(() => {
    if (!swipeMode) return
    const spec = effectiveSpecs[cardIdx]
    if (!spec) return
    const readings = getReadings(spec.slotKey)
    const lastFilled = [...readings].reverse().find(r => r.value.trim())
    setCardValue(lastFilled?.value ?? prevTempData[spec.slotKey] ?? spec.standard ?? '')
  }, [cardIdx, swipeMode, effectiveSpecs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view !== 'temperature' || expandedIdx.size === 0) { setActiveSlotKey(null); return }
    const focusLine = window.innerHeight * 0.35
    const check = () => {
      let bestKey: string | null = null
      let bestDist = Infinity
      itemRefs.current.forEach((el, key) => {
        const dist = Math.abs(el.getBoundingClientRect().top - focusLine)
        if (dist < bestDist) { bestDist = dist; bestKey = key }
      })
      setActiveSlotKey(bestKey)
    }
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [view, expandedIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const getReadings = (slotKey: string) => tempData[slotKey] ?? []
  const addReading = (slotKey: string, spec: TempSpec) => {
    const existing   = tempData[slotKey] ?? []
    const lastFilled = [...existing].reverse().find(r => r.value.trim())
    const defaultVal = lastFilled?.value ?? prevTempData[slotKey] ?? spec.standard ?? ''
    setTempData(p => ({ ...p, [slotKey]: [...(p[slotKey] ?? []), { time: nowTimeStr(), value: defaultVal }] }))
    setExpandedIdx(prev => { const s = new Set(prev); s.add(slotKey); return s }); setSubmitted(false)
  }
  const updateReading = (slotKey: string, rIdx: number, field: keyof TempReading, val: string) => {
    setTempData(p => { const list = [...(p[slotKey] ?? [])]; list[rIdx] = { ...list[rIdx], [field]: val }; return { ...p, [slotKey]: list } })
    setSubmitted(false)
  }
  const removeReading = (slotKey: string, rIdx: number) => {
    setTempData(p => { const list = [...(p[slotKey] ?? [])]; list.splice(rIdx, 1); return { ...p, [slotKey]: list } })
    setSubmitted(false)
  }

  const adjustCount = (specKey: string, delta: number) => {
    setEquipmentCounts(p => {
      const cur = p[specKey] ?? 1
      const next = Math.max(1, cur + delta)
      if (next === cur) return p
      // If reducing, clean up the removed slot's data
      if (delta < 0) {
        const removedSlot = `${specKey}-${cur - 1}`
        setTempData(prev => { const n = { ...prev }; delete n[removedSlot]; return n })
        setTempSkipped(prev => { const n = { ...prev }; delete n[removedSlot]; return n })
        setTempNotes(prev => { const n = { ...prev }; delete n[removedSlot]; return n })
      }
      return { ...p, [specKey]: next }
    })
    setSubmitted(false)
  }

  const addCustomSpec = () => {
    if (!customName.trim()) return
    const specKey = `custom-${Date.now()}`
    setCustomSpecs(p => [...p, { specKey, location: customName.trim(), required: customRequired.trim() || '填寫實際值', zone: '其他', check: () => true }])
    setCustomName(''); setCustomRequired(''); setAddCustomOpen(false); setSubmitted(false)
  }

  const removeCustomSpec = (specKey: string) => {
    setCustomSpecs(p => p.filter(s => s.specKey !== specKey))
    const slotKey = `${specKey}-0`
    setTempData(p => { const n = { ...p }; delete n[slotKey]; return n })
    setTempSkipped(p => { const n = { ...p }; delete n[slotKey]; return n })
    setTempNotes(p => { const n = { ...p }; delete n[slotKey]; return n })
    setSubmitted(false)
  }

  // Derive anomaly detection time from the first bad reading's time field
  const getAnomalyTime = (spec: TempSpec, readings: TempReading[]): string | null => {
    const firstBad = readings.find(r => {
      if (!r.value.trim()) return false
      const n = parseFloat(r.value)
      return !isNaN(n) && !spec.check(n)
    })
    return firstBad?.time ?? null
  }

  const getElapsedMinutes = (timeHHMM: string): number => {
    const [h, m] = timeHHMM.split(':').map(Number)
    const then = new Date(logDate)
    then.setHours(h, m, 0, 0)
    return Math.floor((now.getTime() - then.getTime()) / 60000)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setSaveError(null)
    setGpsAccuracy(null)

    // 嘗試取得 GPS（不阻斷儲存）
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true })
        )
        setGpsAccuracy(Math.round(pos.coords.accuracy))
      } catch { /* GPS 失敗，繼續儲存 */ }
    }

    const temperaturesPayload = effectiveSpecs.map(spec => ({
      specKey: spec.specKey,
      unitIndex: spec.unitIndex,
      location: `${spec.location}${spec.unitLabel}`,
      required: spec.required,
      zone: spec.zone,
      skipped: tempSkipped[spec.slotKey] ?? null,
      actionNote: tempNotes[spec.slotKey]?.trim() ?? null,
      readings: (tempData[spec.slotKey] ?? []).map(r => {
        const num = r.value.trim() !== '' ? parseFloat(r.value) : null
        return { time: r.time, value: num, isNormal: num !== null ? spec.check(num) : null }
      }),
    }))
    const payload = {
      store_id: user.storeId, staff_name: user.name, log_date: logDate,
      shift: shifts[selectedShift], temperatures: temperaturesPayload,
      tasks_done: { _waste: waste, _cleaning: cleaning, _friendly: friendly, _signature: shiftSignature, _manager_signature: managerSignature },
      handover_note: handoverNote,
      submitted_at: new Date().toISOString(),
    }
    let dbError: any = null
    if (existingId) {
      const { error } = await supabase.from('daily_work_logs').update(payload).eq('id', existingId)
      dbError = error
    } else {
      const { data, error } = await supabase.from('daily_work_logs').insert(payload).select().single()
      dbError = error
      if (data) setExistingId(data.id)
    }
    if (dbError) {
      console.error('Save error:', dbError)
      setSaveError(`儲存失敗：${dbError.message ?? '請確認網路連線或聯絡管理員'}`)
      setSaving(false)
      return
    }
    setSubmitted(true); setSaving(false)
  }

  // ── 各區塊完成狀態（用於 overview 卡片）──
  const tempFilledCount  = effectiveSpecs.filter(spec => getReadings(spec.slotKey).some(r => r.value.trim())).length
  const tempRepairCount  = effectiveSpecs.filter(spec => anomalyStatus(spec, getReadings(spec.slotKey)) === 'repair').length
  const tempRecheckCount = effectiveSpecs.filter(spec => anomalyStatus(spec, getReadings(spec.slotKey)) === 'recheck').length
  const cleaningFilled   = cleaningMachines.filter(m => cleaning[m]?.trim()).length
  const shiftFriendlyKeys = selectedShift === 0 ? ['t0930'] : selectedShift === 1 ? ['t1600', 't1630'] : ['t2300', 't2400']
  const shiftFriendlyTasks = friendlyTasks.filter(t => shiftFriendlyKeys.includes(t.key))
  const friendlyDone     = shiftFriendlyTasks.filter(t => friendly[t.key]).length
  const wasteAnyFilled   = !!(waste.generalWasteBags || waste.foodWasteBags || waste.recyclingBags || waste.wasteDeliveryTime || waste.cupCollectionTime || waste.uniformBags || waste.uniformScan?.trim() || waste.groundCleaning || waste.tapeSafety)
  const wasteDone        = waste.groundCleaning && waste.tapeSafety

  const filteredSpecs = tempZone === '全部'
    ? effectiveSpecs
    : effectiveSpecs.filter(spec => spec.zone === tempZone)

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
  const subViewIdx = view !== 'overview' ? SUB_VIEWS.indexOf(view as Exclude<ViewType, 'overview'>) : -1
  const nextView = subViewIdx >= 0 && subViewIdx < SUB_VIEWS.length - 1 ? SUB_VIEWS[subViewIdx + 1] : null

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
    const friendlyStatus: CardStatus = friendlyDone === shiftFriendlyTasks.length ? 'green' : friendlyDone > 0 ? 'yellow' : 'gray'
    const handoverStatus: CardStatus = handoverNote.trim() ? 'green' : 'gray'

    const cards: { view: ViewType; icon: React.ReactNode; title: string; sub: string; status: CardStatus }[] = [
      {
        view: 'temperature',
        icon: <Thermometer className="w-5 h-5" style={{ color: statusColor[tempStatus] }} />,
        title: '溫度記錄',
        sub: tempRepairCount > 0 ? `⚠ ${tempRepairCount} 項需報修`
           : tempRecheckCount > 0 ? `⏱ ${tempRecheckCount} 項需複檢`
           : tempFilledCount > 0 ? `${tempFilledCount}/${effectiveSpecs.length} 台已填`
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
        sub: friendlyDone > 0 ? `${friendlyDone}/${shiftFriendlyTasks.length} 完成` : '尚未確認',
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
        {/* 日期選擇（店長補填用） */}
        {isManager && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-semibold text-gray-400">日期</p>
              {manualDate && (
                <button
                  onClick={() => setManualDate('')}
                  className="text-sm font-bold text-green-600"
                >
                  回到今天
                </button>
              )}
            </div>
            <input
              type="date"
              value={manualDate || todayStr}
              max={new Date().toLocaleDateString('sv', { timeZone: 'Asia/Taipei' })}
              onChange={e => setManualDate(e.target.value === todayStr ? '' : e.target.value)}
              className="w-full text-base font-medium border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-green-500 bg-gray-50"
            />
            {manualDate && (
              <p className="text-sm text-amber-600 mt-2">⚠ 補填模式：儲存將寫入 {manualDate}</p>
            )}
          </div>
        )}

        {/* 班次選擇 */}
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <p className="text-base font-semibold text-gray-400 mb-3">選擇班次</p>
          <div className="flex gap-2">
            {shifts.map((s, i) => (
              <button key={i} onClick={() => { setSelectedShift(i); setSubmitted(false) }}
                className="flex-1 py-2.5 rounded-xl text-base font-bold border-2 transition-all"
                style={{
                  borderColor: selectedShift === i ? '#005f3b' : '#f3f4f6',
                  background:  selectedShift === i ? '#ecfdf5' : '#fafafa',
                  color:       selectedShift === i ? '#005f3b' : '#9ca3af',
                }}>
                {s.split(' ')[0]}<br />
                <span className="font-normal text-base">{s.split(' ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 區塊卡片 */}
        <div className="space-y-2">
          {cards.map(card => (
            <motion.button key={card.view} whileTap={{ scale: 0.97 }}
              onClick={() => setView(card.view)}
              className="w-full flex items-center gap-3 pr-4 py-3.5 text-left rounded-2xl bg-white overflow-hidden transition-colors"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
              {/* 左側色條 */}
              <div className="w-1.5 self-stretch shrink-0 rounded-l-2xl" style={{ background: statusColor[card.status] }} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: statusBg[card.status] }}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-gray-800">{card.title}</p>
                <p className="text-sm mt-0.5 font-semibold" style={{ color: statusColor[card.status] }}>{card.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </motion.button>
          ))}
        </div>

        {/* #32 擔當/店長覆核欄位 */}
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <p className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-gray-400" /> 擔當 / 店長確認
          </p>
          <div className="space-y-2">
            {[
              { label: '早班簽名', sig: allShiftSigs.morning },
              { label: '晚班簽名', sig: allShiftSigs.evening },
              { label: '大夜班簽名', sig: allShiftSigs.lateNight },
            ].map(({ label, sig }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: sig ? '#f0fdf4' : '#f9fafb' }}>
                <span className="text-base font-semibold" style={{ color: sig ? '#16a34a' : '#9ca3af' }}>{label}</span>
                <span className="text-base font-bold" style={{ color: sig ? '#16a34a' : '#d1d5db' }}>
                  {sig ? '✓ 已簽名' : '未簽名'}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: managerSignature ? '#ecfdf5' : '#fff7ed' }}>
              <span className="text-base font-bold" style={{ color: managerSignature ? '#059669' : '#c2410c' }}>
                擔當/店長確認
              </span>
              <span className="text-base font-bold" style={{ color: managerSignature ? '#059669' : '#f97316' }}>
                {managerSignature ? '✓ 已覆核簽名' : '⚠ 尚未覆核'}
              </span>
            </div>
          </div>
        </div>

        {/* 簽名按鈕 */}
        {(() => {
          const isManager = user.role === 'manager' || user.role === 'sub-manager' || user.role === 'supervisor' || user.role === 'admin'
          const hasSig = isManager ? !!managerSignature : !!shiftSignature
          return (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSigModalOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all"
              style={{
                borderColor: hasSig ? '#86efac' : '#d1d5db',
                background:  hasSig ? '#f0fdf4' : '#ffffff',
              }}>
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4" style={{ color: hasSig ? '#16a34a' : '#9ca3af' }} />
                <span className="text-base font-bold" style={{ color: hasSig ? '#16a34a' : '#374151' }}>
                  {hasSig ? '已完成簽名' : '點此進行簽名'}
                </span>
              </div>
              {hasSig
                ? <span className="text-base text-green-500 font-semibold">重新簽名</span>
                : <ChevronRight className="w-4 h-4 text-gray-300" />}
            </motion.button>
          )
        })()}

        {/* Submit */}
        {saveError && (
          <div className="w-full px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <p className="text-red-600 text-base font-semibold">{saveError}</p>
          </div>
        )}
        {!submitted ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #00a040, #007d30)', opacity: saving ? 0.7 : 1 }}>
            <Save className="w-4 h-4" />
            {saving ? '儲存中...' : `確認送出（${user.name} 簽署）`}
          </motion.button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-green-50 border border-green-100 text-center">
            <p className="text-green-600 font-bold text-base">✓ 已完成班次確認並簽署</p>
            <p className="text-green-400 text-base mt-0.5">{new Date().toLocaleTimeString('zh-TW')} 已儲存至資料庫</p>
            {gpsAccuracy !== null && (
              <p className="text-blue-400 text-sm mt-0.5">📍 GPS 定位成功（精度 ±{gpsAccuracy} 公尺）</p>
            )}
            <button onClick={() => setSubmitted(false)} className="mt-2 text-base text-green-500 underline">繼續編輯</button>
          </div>
        )}

        {/* 簽名 Modal */}
        <AnimatePresence>
          {sigModalOpen && (() => {
            const isManager = user.role === 'manager' || user.role === 'sub-manager' || user.role === 'supervisor' || user.role === 'admin'
            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.6)' }}
                onClick={e => { if (e.target === e.currentTarget) setSigModalOpen(false) }}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="w-full bg-white rounded-3xl p-5 space-y-4"
                  style={{ maxWidth: 480, maxHeight: '92dvh', overflowY: 'auto' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-gray-800">
                      {isManager ? '班次簽名確認' : `${shifts[selectedShift].split(' ')[0]} 人員簽名`}
                    </p>
                    <button onClick={() => setSigModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-lg font-bold">×</button>
                  </div>

                  {isManager ? (
                    <>
                      {[
                        { label: '早班  07:00–15:00',  sig: allShiftSigs.morning },
                        { label: '晚班  15:00–23:00',  sig: allShiftSigs.evening },
                        { label: '大夜班 23:00–07:00', sig: allShiftSigs.lateNight },
                      ].map(({ label, sig }) => (
                        <div key={label}>
                          <p className="text-base font-semibold text-gray-400 mb-1 flex items-center gap-1.5">
                            <PenLine className="w-3 h-3" />{label}
                          </p>
                          <div className="border-2 rounded-2xl overflow-hidden flex items-center justify-center"
                            style={{ borderColor: sig ? '#86efac' : '#e5e7eb', background: sig ? '#f0fdf4' : '#f9fafb', height: 80 }}>
                            {sig
                              ? <img src={sig} alt="簽名" className="w-full h-full object-contain" />
                              : <p className="text-base text-gray-300">尚未簽名</p>}
                          </div>
                        </div>
                      ))}
                      <SignaturePad
                        label="店長簽名"
                        value={managerSignature}
                        onChange={sig => { setManagerSignature(sig); setSubmitted(false) }}
                        canvasHeight={180}
                      />
                    </>
                  ) : (
                    <SignaturePad
                      label={`${shifts[selectedShift].split(' ')[0]} 人員簽名`}
                      value={shiftSignature}
                      onChange={sig => { setShiftSignature(sig); setSubmitted(false) }}
                      canvasHeight={280}
                    />
                  )}

                  <button
                    onClick={() => setSigModalOpen(false)}
                    className="w-full py-4 rounded-2xl text-white font-bold text-base"
                    style={{ background: 'linear-gradient(135deg, #00a040, #007d30)' }}
                  >
                    完成
                  </button>
                </motion.div>
              </motion.div>
            )
          })()}
        </AnimatePresence>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 溫度記錄 - List mode
  // ────────────────────────────────────────────────
  const renderTempList = () => (
    <>
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5">
        {zones.filter(z => z === '全部' || effectiveSpecs.some(s => s.zone === z)).map(z => (
          <button key={z} onClick={() => setTempZone(z)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-base font-bold transition-all"
            style={{ background: tempZone === z ? '#1e40af' : '#f3f4f6', color: tempZone === z ? 'white' : '#6b7280' }}>
            {z}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filteredSpecs.map(spec => {
          const { slotKey } = spec
          const readings   = getReadings(slotKey)
          const isExpanded = expandedIdx.has(slotKey)
          const status     = anomalyStatus(spec, readings)
          const lastFilled = [...readings].reverse().find(r => r.value.trim())
          const lastNormal = lastFilled ? evalReading(spec, lastFilled) : null
          const bgHeader   = status === 'repair' ? '#fef2f2' : status === 'recheck' ? '#fffbeb' : status === 'resolved' ? '#f0fdf4' : readings.length > 0 ? '#f0fdf4' : '#f9fafb'
          const isLastUnit = !effectiveSpecs.find(s => s.specKey === spec.specKey && s.unitIndex === spec.unitIndex + 1)
          const isCustom   = spec.specKey.startsWith('custom-')
          const anomalyTime = getAnomalyTime(spec, readings)
          const elapsed = anomalyTime !== null ? getElapsedMinutes(anomalyTime) : null
          const readyToRecheck = elapsed !== null && elapsed >= 30

          const isActive = activeSlotKey === slotKey && expandedIdx.size > 1

          return (
            <div
              key={slotKey}
              ref={el => { if (el) itemRefs.current.set(slotKey, el); else itemRefs.current.delete(slotKey) }}
              className="rounded-xl overflow-hidden transition-all duration-300"
              style={{
                border: isActive ? '1.5px solid #6ee7b7' : '1px solid #f3f4f6',
                boxShadow: isActive ? 'inset 4px 0 0 #00a040, 0 4px 16px rgba(0,160,64,0.12)' : 'none',
              }}
            >
              <button className="w-full flex items-center justify-between px-3 py-2.5"
                style={{ background: bgHeader }}
                onClick={() => setExpandedIdx(prev => { const s = new Set(prev); isExpanded ? s.delete(slotKey) : s.add(slotKey); return s })}>
                <div className="text-left">
                  <p className="text-base font-semibold text-gray-700">
                    {spec.location}{spec.unitLabel}
                  </p>
                  <p className="text-base text-gray-400">標準：{spec.required}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tempSkipped[slotKey] === 'no-machine' && <span className="text-base font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">無此機台</span>}
                  {tempSkipped[slotKey] === 'fault'      && <span className="text-base font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">故障</span>}
                  {status === 'recheck'  && <span className="text-base font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">需複檢</span>}
                  {status === 'repair'   && <span className="text-base font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">需報修</span>}
                  {status === 'resolved' && <span className="text-base font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已正常</span>}
                  {lastFilled
                    ? <span className="text-base font-bold" style={{ color: lastNormal === false ? '#ef4444' : '#10b981' }}>
                        {parseFloat(lastFilled.value) > 0 ? '+' : ''}{parseFloat(lastFilled.value)}°C
                      </span>
                    : <span className="text-base text-gray-300">未填</span>
                  }
                  {readings.length > 0 && <span className="text-base bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-md">{readings.length}筆</span>}
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100">
                      {readings.length === 0 && <p className="text-base text-gray-300 text-center py-1">尚無量測紀錄</p>}
                      {readings.map((r, rIdx) => {
                        const normal = evalReading(spec, r)
                        return (
                          <div key={rIdx} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50">
                              <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                              <input type="time" className="text-base font-medium text-gray-700 outline-none bg-transparent w-16"
                                value={r.time} onChange={e => updateReading(slotKey, rIdx, 'time', e.target.value)} />
                            </div>
                            <div className="flex items-center border rounded-lg flex-1 min-w-0 bg-white"
                              style={{ borderColor: normal === false ? '#fca5a5' : normal === true ? '#6ee7b7' : '#e5e7eb' }}>
                              <input type="text" inputMode="decimal"
                                className="flex-1 text-left text-base font-bold outline-none rounded-l-lg bg-white py-1.5 px-2"
                                style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                                placeholder="溫度" value={r.value}
                                onChange={e => updateReading(slotKey, rIdx, 'value', e.target.value)} />
                              <span className="text-base text-gray-400 pr-2">°C</span>
                            </div>
                            <button onClick={() => removeReading(slotKey, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 shrink-0">
                              <Trash2 className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        )
                      })}
                      <button onClick={() => addReading(slotKey, spec)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-blue-300 text-base font-semibold text-blue-500">
                        <Plus className="w-3.5 h-3.5" /> 新增量測
                      </button>

                      {/* 30-min recheck timer */}
                      {status === 'recheck' && (
                        <p className="text-base rounded-lg px-3 py-2" style={{ background: readyToRecheck ? '#f0fdf4' : '#fffbeb', color: readyToRecheck ? '#16a34a' : '#b45309' }}>
                          {readyToRecheck
                            ? `✓ 已過 ${elapsed} 分鐘，可進行複檢量測`
                            : elapsed !== null ? `⏱ 溫度檢查超過正常溫度範圍，應於30分鐘後重新確認機台是否正常，若仍超出範圍請立刻報修` : '⏱ 請於 30 分鐘後再次量測確認'}
                        </p>
                      )}
                      {status === 'repair' && <p className="text-base text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ 複檢後仍異常，請至「異常回報」提交報修申請</p>}

                      {(status === 'recheck' || status === 'repair') && (
                        <div>
                          <label className="text-sm font-semibold text-gray-500 block mb-1">📝 處理措施 / 說明</label>
                          <textarea rows={2} placeholder="記錄複檢結果、處理措施或備注…"
                            className="w-full text-base text-gray-700 border border-yellow-200 rounded-xl px-3 py-2 bg-yellow-50 outline-none focus:ring-2 focus:ring-yellow-400 resize-none leading-relaxed"
                            value={tempNotes[slotKey] ?? ''}
                            onChange={e => { setTempNotes(p => ({ ...p, [slotKey]: e.target.value })); setSubmitted(false) }}
                          />
                        </div>
                      )}

                      {/* Skip buttons */}
                      <div>
                        <p className="text-sm font-semibold text-gray-400 mb-1">標記機台狀態：</p>
                        <div className="flex gap-2">
                          {(['no-machine', 'fault'] as const).map(type => {
                            const isActive = tempSkipped[slotKey] === type
                            return (
                              <button key={type}
                                onClick={() => { setTempSkipped(p => { const n = { ...p }; if (isActive) delete n[slotKey]; else n[slotKey] = type; return n }); setSubmitted(false) }}
                                className="flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all"
                                style={{ borderColor: isActive ? (type === 'no-machine' ? '#6b7280' : '#f97316') : '#e5e7eb', background: isActive ? (type === 'no-machine' ? '#f3f4f6' : '#fff7ed') : 'white', color: isActive ? (type === 'no-machine' ? '#374151' : '#c2410c') : '#9ca3af' }}>
                                {type === 'no-machine' ? '🚫 無此機台' : '🔧 機台故障'}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Multi-unit controls (non-custom specs) — 店長限定 */}
                      {!isCustom && isManager && (
                        <div className="flex gap-2 pt-1 border-t border-gray-100">
                          {spec.unitIndex > 0 && (
                            <button onClick={() => adjustCount(spec.specKey, -1)}
                              className="flex-1 py-1.5 rounded-lg text-sm font-bold border border-red-200 text-red-500 bg-red-50">
                              ─ 減少此機型台數
                            </button>
                          )}
                          {isLastUnit && (
                            <button onClick={() => adjustCount(spec.specKey, 1)}
                              className="flex-1 py-1.5 rounded-lg text-sm font-bold border border-blue-200 text-blue-500 bg-blue-50">
                              ＋ 新增同型機台
                            </button>
                          )}
                        </div>
                      )}

                      {/* Delete custom spec — 店長限定 */}
                      {isCustom && isManager && (
                        <button onClick={() => removeCustomSpec(spec.specKey)}
                          className="w-full py-1.5 rounded-lg text-sm font-bold border border-red-200 text-red-500 bg-red-50 flex items-center justify-center gap-1">
                          <Trash2 className="w-3 h-3" /> 刪除此自訂機台
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Add custom machine — 店長限定 */}
        {isManager && addCustomOpen ? (
          <div className="border border-dashed border-green-300 rounded-xl p-3 space-y-2 bg-green-50">
            <p className="text-sm font-bold text-green-700">新增其他機台</p>
            <input type="text" placeholder="機台名稱（例：哈根達斯冰箱）" value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="w-full text-base border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-white" />
            <input type="text" placeholder="溫度標準（例：-20°C以下）" value={customRequired}
              onChange={e => setCustomRequired(e.target.value)}
              className="w-full text-base border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-white" />
            <div className="flex gap-2">
              <button onClick={() => { setAddCustomOpen(false); setCustomName(''); setCustomRequired('') }}
                className="flex-1 py-2 rounded-lg text-sm font-bold border border-gray-200 text-gray-500 bg-white">取消</button>
              <button onClick={addCustomSpec} disabled={!customName.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #00a040, #007d30)' }}>確認新增</button>
            </div>
          </div>
        ) : isManager ? (
          <button onClick={() => setAddCustomOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-green-300 text-base font-semibold text-green-600 bg-green-50">
            <Plus className="w-3.5 h-3.5" /> 新增其他機台
          </button>
        ) : null}
      </div>
    </>
  )

  // ────────────────────────────────────────────────
  // 溫度記錄 - Card (swipe) mode
  // ────────────────────────────────────────────────
  const renderTempCard = () => {
    const spec = effectiveSpecs[cardIdx]
    if (!spec) return null
    const { slotKey } = spec
    const readings = getReadings(slotKey)
    const cardNormal = cardValue.trim() ? (() => {
      const n = parseFloat(cardValue)
      return isNaN(n) ? null : spec.check(n)
    })() : null
    const status = anomalyStatus(spec, readings)
    const anomalyTime = getAnomalyTime(spec, readings)
    const elapsed = anomalyTime !== null ? getElapsedMinutes(anomalyTime) : null
    const readyToRecheck = elapsed !== null && elapsed >= 30
    const isCustom = spec.specKey.startsWith('custom-')

    const saveCurrentCard = () => {
      if (!cardValue.trim()) return
      const time = nowTimeStr()
      setTempData(p => {
        const existing = [...(p[slotKey] ?? [])]
        const last = [...existing].reverse().find(r => r.value.trim())
        if (last && last.value === cardValue) return p
        return { ...p, [slotKey]: [...existing, { time, value: cardValue }] }
      })
      setSubmitted(false)
    }

    const goCard = (nextIdx: number) => {
      saveCurrentCard()
      setCardIdx(Math.max(0, Math.min(effectiveSpecs.length - 1, nextIdx)))
    }

    const isLast = cardIdx === effectiveSpecs.length - 1

    const zoneColors: Record<string, { bg: string; color: string }> = {
      '賣場': { bg: '#eff6ff', color: '#1d4ed8' },
      '咖啡': { bg: '#fdf4ff', color: '#7c3aed' },
      'FF區': { bg: '#fff7ed', color: '#c2410c' },
    }
    const zoneStyle = zoneColors[spec.zone] ?? { bg: '#f3f4f6', color: '#6b7280' }

    return (
      <div>
        {cardIdx === 0 && readings.length === 0 && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4 text-blue-700">
            <span className="text-base shrink-0 mt-0.5">💡</span>
            <p className="text-sm leading-snug">
              點擊中間大數字區域輸入溫度 → 按「<strong>下一台</strong>」儲存並跳至下一台；
              若無此機台或機台故障，請點下方按鈕標記後跳過。
            </p>
          </div>
        )}

        {/* Progress header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold text-gray-500">{cardIdx + 1} / {effectiveSpecs.length}</span>
          <span className="px-2 py-1 rounded-lg text-base font-bold" style={{ background: zoneStyle.bg, color: zoneStyle.color }}>
            {spec.zone}
          </span>
        </div>

        {/* Device name + unit label + hint */}
        <p className="text-lg font-bold text-gray-800 mb-1">{spec.location}{spec.unitLabel}</p>
        {spec.hint && (
          <p className="text-sm text-blue-600 bg-blue-50 rounded-xl px-3 py-2 mb-2 leading-snug">ℹ️ {spec.hint}</p>
        )}
        <p className="text-base text-gray-400 mb-4">標準：{spec.required}</p>

        {/* Multi-unit count adjuster — 店長限定 */}
        {!isCustom && isManager && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-400">此機型台數：</span>
            <button onClick={() => adjustCount(spec.specKey, -1)} disabled={(equipmentCounts[spec.specKey] ?? 1) <= 1}
              className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 font-bold text-base disabled:opacity-30 flex items-center justify-center">
              ─
            </button>
            <span className="text-base font-bold text-gray-700 w-6 text-center">{equipmentCounts[spec.specKey] ?? 1}</span>
            <button onClick={() => adjustCount(spec.specKey, 1)}
              className="w-7 h-7 rounded-lg border border-blue-200 text-blue-600 font-bold text-base flex items-center justify-center">
              ＋
            </button>
          </div>
        )}

        {/* Large input */}
        {!tempSkipped[slotKey] && (
          <>
            <div className="flex items-end justify-center gap-2 mb-2">
              <input type="number" inputMode="decimal" placeholder="—" value={cardValue}
                onChange={e => setCardValue(e.target.value)}
                enterKeyHint={isLast ? 'done' : 'next'}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (isLast) saveCurrentCard(); else goCard(cardIdx + 1) } }}
                className="outline-none bg-transparent text-center font-black"
                style={{ fontSize: '56px', width: '180px', borderBottom: `3px solid ${cardNormal === false ? '#ef4444' : cardNormal === true ? '#10b981' : '#d1d5db'}`, color: cardNormal === false ? '#ef4444' : cardNormal === true ? '#10b981' : '#374151' }}
              />
              <span className="text-2xl font-bold text-gray-400 pb-2">°C</span>
            </div>
            {readings.length === 0 && cardValue !== '' && (
              <p className="text-sm text-center -mt-1 mb-1 font-medium"
                style={{ color: prevTempData[slotKey] === cardValue ? '#d97706' : '#9ca3af' }}>
                {prevTempData[slotKey] === cardValue ? '↑ 帶入上次值，請確認後送出' : `↑ 標準參考值 ${spec.required}，請確認後送出`}
              </p>
            )}
          </>
        )}

        {/* Skip status banner */}
        {tempSkipped[slotKey] && (
          <div className={`rounded-2xl px-4 py-4 mb-3 flex items-center gap-3 ${tempSkipped[slotKey] === 'no-machine' ? 'bg-gray-50 border border-gray-200' : 'bg-orange-50 border border-orange-200'}`}>
            <span className="text-2xl">{tempSkipped[slotKey] === 'no-machine' ? '🚫' : '🔧'}</span>
            <div>
              <p className="text-base font-bold" style={{ color: tempSkipped[slotKey] === 'no-machine' ? '#374151' : '#c2410c' }}>
                {tempSkipped[slotKey] === 'no-machine' ? '無此機台' : '機台故障'}
              </p>
              <p className="text-sm text-gray-400">已標記為跳過，不需填寫溫度</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-2 mt-3 mb-3">
          <button onClick={() => goCard(cardIdx - 1)} disabled={cardIdx === 0}
            className="flex-1 py-3 rounded-2xl text-base font-bold transition-all disabled:opacity-40"
            style={{ background: '#f3f4f6', color: '#374151' }}>
            ← 上一台
          </button>
          <button onClick={() => { if (isLast) saveCurrentCard(); else goCard(cardIdx + 1) }}
            className="flex-1 py-3 rounded-2xl text-base font-bold text-white transition-all"
            style={{ background: isLast ? 'linear-gradient(135deg, #00a040, #007d30)' : 'linear-gradient(135deg, #1e40af, #3b82f6)' }}>
            {isLast ? '完成 ✓' : '確認，下一台 →'}
          </button>
        </div>

        {/* Status line */}
        {!tempSkipped[slotKey] && (
          <div className="text-center mb-3 h-6">
            {cardNormal === true && <span className="text-base font-semibold text-green-600">✅ 在標準範圍內</span>}
            {cardNormal === false && <span className="text-base font-semibold text-red-500">⚠️ 超出標準範圍</span>}
          </div>
        )}

        {/* Anomaly banners with 30-min timer */}
        {status === 'recheck' && (
          <div className="rounded-xl px-3 py-2 mb-2 text-base font-semibold"
            style={{ background: readyToRecheck ? '#f0fdf4' : '#fffbeb', color: readyToRecheck ? '#16a34a' : '#b45309', border: `1px solid ${readyToRecheck ? '#bbf7d0' : '#fde68a'}` }}>
            {readyToRecheck
              ? `✓ 已過 ${elapsed} 分鐘，可進行複檢量測`
              : elapsed !== null ? `⏱ 溫度檢查超過正常溫度範圍，應於30分鐘後重新確認機台是否正常，若仍超出範圍請立刻報修` : '⏱ 請於 30 分鐘後再次量測確認'}
          </div>
        )}
        {status === 'repair' && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2 text-base font-semibold text-red-700">
            ⚠ 複檢後仍異常，請至「異常回報」提交報修申請
          </div>
        )}
        {(status === 'recheck' || status === 'repair') && (
          <div className="mb-3">
            <label className="text-sm font-semibold text-gray-500 block mb-1">📝 處理措施 / 說明</label>
            <textarea rows={2} placeholder="記錄複檢結果、處理措施或備注…"
              className="w-full text-base text-gray-700 border border-yellow-200 rounded-xl px-3 py-2 bg-yellow-50 outline-none focus:ring-2 focus:ring-yellow-400 resize-none leading-relaxed"
              value={tempNotes[slotKey] ?? ''}
              onChange={e => { setTempNotes(p => ({ ...p, [slotKey]: e.target.value })); setSubmitted(false) }}
            />
          </div>
        )}

        {/* Skip buttons */}
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-400 mb-1.5">標記機台狀態：</p>
          <div className="flex gap-2">
            {(['no-machine', 'fault'] as const).map(type => {
              const isActive = tempSkipped[slotKey] === type
              return (
                <button key={type}
                  onClick={() => { setTempSkipped(p => { const n = { ...p }; if (isActive) delete n[slotKey]; else n[slotKey] = type; return n }); setSubmitted(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                  style={{ borderColor: isActive ? (type === 'no-machine' ? '#6b7280' : '#f97316') : '#e5e7eb', background: isActive ? (type === 'no-machine' ? '#f3f4f6' : '#fff7ed') : 'white', color: isActive ? (type === 'no-machine' ? '#374151' : '#c2410c') : '#9ca3af' }}>
                  {type === 'no-machine' ? '🚫 無此機台' : '🔧 機台故障'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dots progress */}
        <div className="flex justify-center gap-1.5 my-3 flex-wrap">
          {effectiveSpecs.map((sp, i) => {
            const r = getReadings(sp.slotKey)
            const lf = [...r].reverse().find(rd => rd.value.trim())
            const isNorm = lf ? evalReading(sp, lf) : null
            const isCurrent = i === cardIdx
            const isSkipped = !!tempSkipped[sp.slotKey]
            return (
              <div key={sp.slotKey} className="rounded-full transition-all"
                style={{ width: isCurrent ? 10 : 6, height: isCurrent ? 10 : 6, background: isCurrent ? '#1e40af' : isSkipped ? '#9ca3af' : isNorm === false ? '#ef4444' : isNorm === true ? '#10b981' : '#d1d5db' }}
              />
            )
          })}
        </div>

        <div className="text-center mt-3">
          <button onClick={() => setSwipeMode(false)} className="text-base text-gray-400 underline">切換為列表模式</button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 溫度記錄 (top-level with toggle)
  // ────────────────────────────────────────────────
  const renderTemperature = () => {
    const totalReadings = effectiveSpecs.reduce((s, spec) => s + (tempData[spec.slotKey]?.filter(r => r.value.trim()).length ?? 0), 0)
    const hasAbnormal = effectiveSpecs.some(spec => {
      const s = anomalyStatus(spec, getReadings(spec.slotKey))
      return s === 'recheck' || s === 'repair'
    })
    const allExpanded = filteredSpecs.length > 0 && filteredSpecs.every(s => expandedIdx.has(s.slotKey))

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4">
          {/* Header with toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-base text-gray-500">{totalReadings} 筆已填</span>
            <div className="flex items-center gap-2">
              {hasAbnormal && (
                <span className="text-base text-red-500 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> 有異常
                </span>
              )}
              {!swipeMode && (
                <button
                  onClick={() => setExpandedIdx(allExpanded ? new Set() : new Set(filteredSpecs.map(s => s.slotKey)))}
                  className="px-3 py-1.5 rounded-xl text-base font-bold transition-all"
                  style={{ background: allExpanded ? '#00a040' : '#f3f4f6', color: allExpanded ? 'white' : '#6b7280' }}
                >
                  {allExpanded ? '⊟ 收合全部' : '⊞ 展開全部'}
                </button>
              )}
              <button
                onClick={() => setSwipeMode(m => !m)}
                className="px-3 py-1.5 rounded-xl text-base font-bold transition-all"
                style={{
                  background: swipeMode ? '#005f3b' : '#f3f4f6',
                  color: swipeMode ? 'white' : '#6b7280',
                }}
              >
                {swipeMode ? '⊞ 列表' : '⊟ 卡片'}
              </button>
            </div>
          </div>

          {swipeMode ? renderTempCard() : renderTempList()}
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 廢棄物 / 制服
  // ────────────────────────────────────────────────
  const renderWaste = () => {
    const numberFields: { label: string; key: keyof WasteState; unit: string }[] = [
      { label: '一般垃圾', key: 'generalWasteBags', unit: '袋' },
      { label: '廚餘',     key: 'foodWasteBags',    unit: '袋' },
      { label: '資源回收', key: 'recyclingBags',    unit: '袋' },
      { label: '制服',     key: 'uniformBags',      unit: '袋' },
    ]
    const timeFields: { label: string; key: keyof WasteState }[] = [
      { label: '廢棄物交付時間',        key: 'wasteDeliveryTime' },
      { label: '收退循環杯（交付日翊）', key: 'cupCollectionTime' },
      { label: '制服（離店過刷）',       key: 'uniformScan'       },
    ]
    const checkFields: { label: string; key: keyof WasteState; color: string }[] = [
      { label: '地墊清潔', key: 'groundCleaning', color: '#059669' },
      { label: '貼膠安全', key: 'tapeSafety',     color: '#059669' },
    ]
    return (
      <div className="bg-white rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-orange-500" />
          <p className="text-base font-bold text-gray-700">廢棄物 / 制服確認</p>
          <span className="ml-auto text-base text-gray-300">不分班次</span>
        </div>

        {/* 袋數 */}
        <div className="grid grid-cols-2 gap-3">
          {numberFields.map(({ label, key, unit }) => (
            <div key={key}>
              <label className="text-base font-semibold text-gray-400 mb-1 block">{label}</label>
              <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1"
                style={{ borderColor: (waste[key] as string)?.trim() ? '#6ee7b7' : '#e5e7eb' }}>
                <input type="number" inputMode="numeric"
                  className="flex-1 text-base font-medium text-gray-700 outline-none bg-transparent"
                  placeholder="0"
                  min={0}
                  value={waste[key] as string}
                  onChange={e => { setWaste(p => ({ ...p, [key]: e.target.value })); setSubmitted(false) }} />
                <span className="text-base text-gray-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 時間 */}
        <div className="grid grid-cols-2 gap-3">
          {timeFields.map(({ label, key }) => (
            <div key={key}>
              <label className="text-base font-semibold text-gray-400 mb-1 block">{label}</label>
              <div className="flex items-center gap-1">
                <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50"
                  style={{ borderColor: (waste[key] as string)?.trim() ? '#6ee7b7' : '#e5e7eb' }}>
                  <input type="time"
                    className="flex-1 text-base font-medium text-gray-700 outline-none bg-transparent"
                    value={waste[key] as string}
                    onChange={e => { setWaste(p => ({ ...p, [key]: e.target.value })); setSubmitted(false) }} />
                </div>
                {(waste[key] as string)?.trim() && (
                  <button
                    onClick={() => { setWaste(p => ({ ...p, [key]: '' })); setSubmitted(false) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 確認項目 */}
        <div className="space-y-2">
          {checkFields.map(({ label, key, color }) => (
            <button key={key} onClick={() => { setWaste(p => ({ ...p, [key]: !p[key] })); setSubmitted(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: waste[key] ? color + '15' : '#f9fafb' }}>
              {waste[key]
                ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color }} />
                : <Circle className="w-5 h-5 shrink-0 text-gray-200" />}
              <span className="text-base" style={{ color: waste[key] ? color : '#374151' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  // 機器清潔
  // ────────────────────────────────────────────────
  const renderCleaning = () => (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-base text-gray-300 text-right mb-3">不分班次</p>
      <div className="space-y-2">
        {cleaningMachines.map(machine => (
          <div key={machine} className="flex items-center gap-3">
            <p className="flex-1 text-base text-gray-700 font-medium">{machine}</p>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 gap-1 shrink-0"
              style={{ borderColor: cleaning[machine]?.trim() ? '#6ee7b7' : '#e5e7eb' }}>
              <Clock className="w-3 h-3 text-gray-300" />
              <input type="time" className="text-base font-medium text-gray-700 outline-none bg-transparent w-28"
                value={cleaning[machine] ?? ''}
                onChange={e => { setCleaning(p => ({ ...p, [machine]: e.target.value })); setSubmitted(false) }} />
            </div>
            {cleaning[machine]?.trim() && (
              <button
                onClick={() => { setCleaning(p => ({ ...p, [machine]: '' })); setSubmitted(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────
  // 友善食光
  // ────────────────────────────────────────────────
  const renderFriendly = () => {
    const allPeriods: { label: string; color: string; keys: string[] }[] = [
      { label: '早班作業', color: '#f59e0b', keys: ['t0930'] },
      { label: '下午作業', color: '#3b82f6', keys: ['t1600', 't1630'] },
      { label: '夜班作業', color: '#8b5cf6', keys: ['t2300', 't2400'] },
    ]
    const periods = [allPeriods[selectedShift]]
    return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-base font-bold text-gray-500">{friendlyDone}/{shiftFriendlyTasks.length} 完成</span>
        <span className="text-base text-gray-400">{shifts[selectedShift].split(' ')[0]} 班別作業</span>
      </div>
      {periods.map(period => {
        const tasks = shiftFriendlyTasks
        const periodDone = tasks.filter(t => !!friendly[t.key]).length
        return (
          <div key={period.label} className="bg-white rounded-2xl overflow-hidden">
            {/* 時段標頭 */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: period.color + '15', borderBottom: `2px solid ${period.color}30` }}>
              <span className="text-sm font-bold" style={{ color: period.color }}>{period.label}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: period.color + '20', color: period.color }}>
                {periodDone}/{tasks.length} 完成
              </span>
            </div>
            {/* 該時段的任務 */}
            <div className="p-3 space-y-2">
              {tasks.map(t => {
                const done = !!friendly[t.key]
                return (
                  <button key={t.key} onClick={() => { setFriendly(p => ({ ...p, [t.key]: !p[t.key] })); setSubmitted(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{ background: done ? '#ecfdf5' : '#f9fafb' }}>
                    {done ? <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" /> : <Circle className="w-5 h-5 shrink-0 text-gray-200" />}
                    <div>
                      <p className="text-base font-bold" style={{ color: done ? '#059669' : '#374151' }}>
                        <span className="font-mono text-sm mr-1.5 px-1.5 py-0.5 rounded" style={{ background: period.color + '15', color: period.color }}>{t.time}</span>
                        {t.label}
                      </p>
                      <p className="text-sm text-gray-400 mt-0.5">{t.detail}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
    )
  }

  // ────────────────────────────────────────────────
  // 交接班紀錄
  // ────────────────────────────────────────────────
  const updateHandoverField = (key: HandoverKey, val: string) => {
    const fields: Record<HandoverKey, string> = {
      '異常事項': handoverAnomaly,
      '備品需求': handoverSupply,
      '客訴記錄': handoverComplaint,
      '其他事項': handoverOther,
      [key]: val,
    }
    if (key === '異常事項') setHandoverAnomaly(val)
    else if (key === '備品需求') setHandoverSupply(val)
    else if (key === '客訴記錄') setHandoverComplaint(val)
    else setHandoverOther(val)
    setHandoverNote(serializeHandover(fields))
    setSubmitted(false)
  }

  const handoverFields: { key: HandoverKey; placeholder: string; hint?: string }[] = [
    { key: '異常事項', placeholder: '填寫本班發現的設備或商品異常…' },
    { key: '備品需求', placeholder: '填寫需補充的備品或耗材…' },
    { key: '客訴記錄', placeholder: '記錄顧客姓名、電話、反應時間及內容…', hint: '如有品質客訴，請同步記錄機台溫度' },
    { key: '其他事項', placeholder: '其他需交接的事項…' },
  ]

  const renderHandover = () => (
    <div className="space-y-3">
      {handoverFields.map(({ key, placeholder, hint }) => {
        const value =
          key === '異常事項' ? handoverAnomaly :
          key === '備品需求' ? handoverSupply :
          key === '客訴記錄' ? handoverComplaint : handoverOther
        const hasContent = value.trim().length > 0
        return (
          <div key={key} className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-base font-bold px-2 py-0.5 rounded-full"
                style={{ background: hasContent ? '#dcfce7' : '#f3f4f6', color: hasContent ? '#16a34a' : '#6b7280' }}
              >
                {key}
              </span>
              {hint && <span className="text-base text-gray-400">{hint}</span>}
            </div>
            <textarea
              rows={3}
              placeholder={placeholder}
              className="w-full text-base text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 resize-none leading-relaxed"
              style={{ borderColor: hasContent ? '#86efac' : undefined }}
              value={value}
              onChange={e => updateHandoverField(key, e.target.value)}
            />
          </div>
        )
      })}
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
    <div className="min-h-dvh bg-gray-100">
      <PageHeader
        title={viewTitles[view]}
        subtitle={view === 'overview' ? user.storeName : shifts[selectedShift]}
        onBack={handleBack}
      />
      <div className="px-4 py-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-base">載入紀錄...</span>
          </div>
        ) : view === 'overview' ? renderOverview() : (
          <>
            {renderSection()}
            {nextView && (
              <div className="mt-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setView(nextView)}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00a040, #007d30)' }}
                >
                  <span>下一項：{viewTitles[nextView]}</span>
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
