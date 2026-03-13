import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Thermometer, Save, AlertCircle, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

const shifts = ['早班 07:00–15:00', '中班 15:00–23:00', '大夜班 23:00–07:00']

const tempItems = [
  { location: '冷藏區 (一般)', required: '0~7°C',    value: 4,   isNormal: true  },
  { location: '冷凍區',        required: '-18°C以下', value: -19, isNormal: true  },
  { location: '冰淇淋機',      required: '-18~-4°C',  value: -10, isNormal: true  },
  { location: '熱食保溫',      required: '65°C以上',  value: 68,  isNormal: true  },
  { location: '鮮食冷藏',      required: '0~7°C',     value: 8,   isNormal: false },
]

const tasksByTime = [
  { time: '07:00', tasks: ['確認鮮食上架日期標籤', '確認熱食區設備電源', '清潔咖啡機出水口', '確認冷藏/冷凍溫度記錄'] },
  { time: '10:00', tasks: ['補充貨架缺貨商品', '整理收銀台環境', '確認外送訂單處理完畢'] },
  { time: '12:00', tasks: ['確認午餐鮮食補充狀況', '清潔微波爐內部'] },
  { time: '14:30', tasks: ['準備班次交接事項', '確認交接清單完整', '核對收銀機帳目'] },
]

const todayStr = new Date().toISOString().split('T')[0]

export default function DailyWorkPage({ user, onBack }: Props) {
  const [selectedShift, setSelectedShift] = useState(0)
  const [doneMap, setDoneMap]   = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [existingId, setExistingId] = useState<string | null>(null)

  // Load today's existing record
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

  const allKeys = tasksByTime.flatMap(t => t.tasks.map((_, i) => `${t.time}-${i}`))
  const doneCount  = allKeys.filter(k => doneMap[k]).length
  const hasAbnormal = tempItems.some(t => !t.isNormal)

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
              <div className="space-y-2">
                {tempItems.map((t, i) => (
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
            </div>

            {/* Task checklist */}
            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">工作清單</p>
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
                      <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg">{time}</span>
                      <span className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div className="space-y-1.5">
                      {tasks.map((task, i) => {
                        const key = `${time}-${i}`
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
                              : <Circle className="w-5 h-5 shrink-0 text-gray-200" />
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
