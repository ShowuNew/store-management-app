import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Thermometer, Save, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

const shifts = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']

interface TempItem {
  location: string
  required: string
  value: number
  isNormal: boolean
  zone: string
}

const tempItems: TempItem[] = [
  // 賣場區
  { location: '4°C 間隔機（前後中島）', required: '4°C',      value: 4,   isNormal: true,  zone: '賣場' },
  { location: 'OC',                    required: '0~7°C',    value: 3,   isNormal: true,  zone: '賣場' },
  { location: 'WI（走入式冷藏）',      required: '0~7°C',    value: 5,   isNormal: true,  zone: '賣場' },
  { location: '立式冷凍',              required: '-18°C以下', value: -20, isNormal: true,  zone: '賣場' },
  { location: '18°C 欄',               required: '18°C以下',  value: 16,  isNormal: true,  zone: '賣場' },
  // 咖啡/牛奶區
  { location: '咖啡冷藏機台',          required: '0~7°C',    value: 4,   isNormal: true,  zone: '咖啡' },
  { location: '牛奶冰箱',             required: '0~7°C',    value: 5,   isNormal: true,  zone: '咖啡' },
  { location: '冷凍冰箱',             required: '-18°C以下', value: -19, isNormal: true,  zone: '咖啡' },
  { location: '冰淇淋機（子母機）',    required: '依機台',    value: -8,  isNormal: true,  zone: '咖啡' },
  // FF 區熱食
  { location: '蒸箱',                 required: '65°C以上',  value: 72,  isNormal: true,  zone: 'FF區' },
  { location: '關東煮機',              required: '82~85°C',   value: 83,  isNormal: true,  zone: 'FF區' },
  { location: '鮮食機',               required: '0~7°C',    value: 8,   isNormal: false, zone: 'FF區' },
  { location: 'FF 冷凍冰箱',           required: '-20°C以下', value: -21, isNormal: true,  zone: 'FF區' },
]

const tasksByTime = [
  {
    time: '07:00',
    tasks: [
      '確認各機台溫度記錄（冷藏/冷凍/熱食）',
      '確認鮮食上架日期標籤',
      '確認熱食區設備電源',
      '清潔咖啡機出水口',
    ],
  },
  {
    time: '09:30',
    tasks: [
      '友善食光貼標（友善食光商品）',
    ],
  },
  {
    time: '12:00',
    tasks: [
      '補充貨架缺貨商品',
      '清潔微波爐內部',
      '確認霜淇淋機清潔時間登記',
    ],
  },
  {
    time: '16:00',
    tasks: [
      '過期品下架：生鮮蔬果 18°C 欄',
      '過期品下架：4°C 欄',
      '過期品下架：麵包',
    ],
  },
  {
    time: '16:30',
    tasks: [
      '友善食光貼標：生鮮蔬果、4°C欄、OC、溫藏器、輕食點心',
    ],
  },
  {
    time: '23:00',
    tasks: [
      '過期品下架：咖啡用牛奶（WI、咖啡機牛奶/冰箱）',
      '過期品下架：WI（FF廚房熱狗、關東煮）',
      '過期品下架：霜淇淋複存盒',
    ],
  },
  {
    time: '24:00',
    tasks: [
      '過期品下架：預購/隨買/蘭購/各溫層專區（冷藏、冷凍、常溫）',
      '準備班次交接事項，確認交接清單完整',
    ],
  },
]

const zones = ['全部', '賣場', '咖啡', 'FF區']
const todayStr = new Date().toISOString().split('T')[0]

export default function DailyWorkPage({ user, onBack }: Props) {
  const [selectedShift, setSelectedShift] = useState(0)
  const [doneMap, setDoneMap]     = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [tempZone, setTempZone]   = useState('全部')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('daily_work_logs')
        .select('*')
        .eq('store_id', user.storeId)
        .eq('log_date', todayStr)
        .eq('shift', shifts[selectedShift])
        .maybeSingle()

      if (data) {
        setExistingId(data.id)
        setDoneMap(data.tasks_done || {})
        setSubmitted(!!data.submitted_at)
      } else {
        setExistingId(null)
        setDoneMap({})
        setSubmitted(false)
      }
      setLoading(false)
    }
    load()
  }, [selectedShift])

  const toggleTask = (key: string) => {
    setDoneMap(p => ({ ...p, [key]: !p[key] }))
    setSubmitted(false)
  }

  const handleSubmit = async () => {
    setSaving(true)
    const payload = {
      store_id:     user.storeId,
      staff_name:   user.name,
      log_date:     todayStr,
      shift:        shifts[selectedShift],
      tasks_done:   doneMap,
      temperatures: tempItems,
      submitted_at: new Date().toISOString(),
    }

    if (existingId) {
      await supabase.from('daily_work_logs').update(payload).eq('id', existingId)
    } else {
      const { data } = await supabase.from('daily_work_logs').insert(payload).select().single()
      if (data) setExistingId(data.id)
    }

    setSubmitted(true)
    setSaving(false)
  }

  const allKeys   = tasksByTime.flatMap(t => t.tasks.map((_, i) => `${t.time}-${i}`))
  const doneCount = allKeys.filter(k => doneMap[k]).length
  const hasAbnormal = tempItems.some(t => !t.isNormal)
  const filteredTemps = tempZone === '全部' ? tempItems : tempItems.filter(t => t.zone === tempZone)

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="每日工作確認" subtitle={user.storeName} onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Shift selector */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">選擇班次</p>
          <div className="flex flex-col gap-2">
            {shifts.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedShift(i)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: selectedShift === i ? '#00a86b' : '#f3f4f6',
                  background:  selectedShift === i ? '#ecfdf5' : '#fafafa',
                  color:       selectedShift === i ? '#00a86b' : '#6b7280',
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: selectedShift === i ? '#00a86b' : '#d1d5db' }}>
                  {selectedShift === i && <span className="w-2 h-2 rounded-full bg-green-500" />}
                </span>
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入紀錄...</span>
          </div>
        ) : (
          <>
            {/* Temperature */}
            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-bold text-gray-800">溫度記錄</p>
                </div>
                {hasAbnormal && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> 有異常
                  </span>
                )}
              </div>

              {/* Zone filter */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto">
                {zones.map(z => (
                  <button key={z} onClick={() => setTempZone(z)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: tempZone === z ? '#1e40af' : '#f3f4f6', color: tempZone === z ? 'white' : '#6b7280' }}>
                    {z}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredTemps.map((t, i) => (
                  <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${t.isNormal ? 'bg-gray-50' : 'bg-red-50'}`}>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{t.location}</p>
                      <p className="text-[10px] text-gray-400">標準：{t.required}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: t.isNormal ? '#10b981' : '#ef4444' }}>
                        {t.value > 0 ? '+' : ''}{t.value}°C
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: t.isNormal ? '#10b981' : '#ef4444' }}>
                        {t.isNormal ? '正常' : '⚠ 異常'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {hasAbnormal && (
                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs font-bold text-red-600">⚠ 溫度異常處理程序</p>
                  <p className="text-[11px] text-red-500 mt-1">超出正常範圍 → 30分鐘後重新確認 → 仍異常請立即至「異常回報」送出報修申請</p>
                </div>
              )}
            </div>

            {/* Task checklist */}
            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">作業確認清單</p>
                <span
                  className="text-xs px-2.5 py-1 rounded-xl font-bold"
                  style={{ background: doneCount === allKeys.length ? '#ecfdf5' : '#f3f4f6', color: doneCount === allKeys.length ? '#10b981' : '#6b7280' }}
                >
                  {doneCount}/{allKeys.length}
                </span>
              </div>
              <div className="space-y-5">
                {tasksByTime.map(({ time, tasks }) => (
                  <div key={time}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg">{time}</span>
                      <span className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div className="space-y-1.5">
                      {tasks.map((task, i) => {
                        const key  = `${time}-${i}`
                        const done = doneMap[key]
                        return (
                          <motion.button
                            key={key}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleTask(key)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                            style={{ background: done ? '#ecfdf5' : '#f9fafb' }}
                          >
                            {done
                              ? <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
                              : <Circle       className="w-5 h-5 shrink-0 text-gray-200" />
                            }
                            <span className="text-sm" style={{ color: done ? '#059669' : '#374151', textDecoration: done ? 'line-through' : 'none' }}>
                              {task}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            {!submitted ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #00a86b, #00d47e)', opacity: saving ? 0.7 : 1 }}
              >
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
          </>
        )}
      </div>
    </div>
  )
}
