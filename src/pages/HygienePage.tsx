import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, MinusCircle, Save, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Result = 'pass' | 'fail' | null

const categories = [
  {
    name: '場所衛生',
    items: [
      '營業場所（地面/牆壁/支柱/天花板）保持清潔，不得有納垢、積塵、積水等情形',
      '出入口、門窗、通氣口無蟲鼠侵入跡象，且防止蒼蠅、蚊蟲進入',
      '廁所保持清潔，無不良氣味，並貼有洗手標示',
      '洗手台之皂液備品充足，且洗手步驟標示完整',
      '倉庫後場保持乾燥，無病媒孳生跡象',
    ],
  },
  {
    name: '衛生品質',
    items: [
      '食品應分類存放，不得直接落地，並在有效日期內使用',
      '冷凍溫度應保持在 -18°C 以下；冷藏溫度應保持 0~7°C',
      '食品設備、器具及抹布等，使用前後確認清潔消毒',
      '清洗和消毒器具應符合食品衛生相關規定',
      '包材收納區域乾淨，未使用包材放置正確',
    ],
  },
  {
    name: '從業人員',
    items: [
      '從業人員每年定期健康檢查（含工讀生）',
      '從業人員應穿戴整齊工作服，手部不得佩戴飾物或留指甲',
      '從業人員手部保持清潔，進入食品作業場所前洗手或消毒',
      '工作中不得有吸菸、嚼檳榔或口嚼糖、飲食及其他污染食品行為',
    ],
  },
  {
    name: '菸害防制',
    items: [
      '不供應菸品予未滿 20 歲者',
      '不販售菸品形狀之糖果、玩具及其他物品',
      '不促銷菸品或進行菸品廣告',
      '不可將菸盒代替熟食交付消費者使用',
      '張貼「吸菸有害健康」及「未滿 20 歲者不得吸菸」等法定標示',
    ],
  },
]

const shifts = ['07:00', '15:00', '23:00']
const todayStr = new Date().toISOString().split('T')[0]

export default function HygienePage({ user, onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeShift, setActiveShift]       = useState(0)
  const [results, setResults]               = useState<Record<string, Result>>({})
  const [saved, setSaved]                   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [loading, setLoading]               = useState(true)
  const [existingId, setExistingId]         = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('hygiene_records')
        .select('*')
        .eq('store_id', user.storeId)
        .eq('record_date', todayStr)
        .eq('shift', shifts[activeShift])
        .maybeSingle()

      if (data) {
        setExistingId(data.id)
        setResults(data.results || {})
        setSaved(true)
      } else {
        setExistingId(null)
        setResults({})
        setSaved(false)
      }
      setLoading(false)
    }
    load()
  }, [activeShift])

  const setResult = (key: string, val: Result) =>
    setResults(p => ({ ...p, [key]: p[key] === val ? null : val }))

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      store_id:    user.storeId,
      staff_name:  user.name,
      record_date: todayStr,
      shift:       shifts[activeShift],
      results,
      saved_at:    new Date().toISOString(),
    }

    if (existingId) {
      await supabase.from('hygiene_records').update(payload).eq('id', existingId)
    } else {
      const { data } = await supabase.from('hygiene_records').insert(payload).select().single()
      if (data) setExistingId(data.id)
    }

    setSaved(true)
    setSaving(false)
  }

  const cat       = categories[activeCategory]
  const passCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'pass').length
  const failCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'fail').length
  const pendCount = cat.items.length - passCount - failCount

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="衛生自主管理"
        subtitle={`${new Date().getMonth() + 1}月 ${new Date().getDate()}日 班次確認`}
        onBack={onBack}
      />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Shift */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">班次時段</p>
          <div className="flex gap-2">
            {shifts.map((s, i) => (
              <button
                key={s}
                onClick={() => { setActiveShift(i); setSaved(false) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: activeShift === i ? '#00a86b' : '#f3f4f6',
                  color:      activeShift === i ? 'white'   : '#9ca3af',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
              style={{
                background: activeCategory === i ? '#005f3b' : 'white',
                color:      activeCategory === i ? 'white'   : '#6b7280',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入紀錄...</span>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '符合', count: passCount, color: '#10b981', bg: '#ecfdf5' },
                { label: '缺失', count: failCount, color: '#ef4444', bg: '#fef2f2' },
                { label: '未填', count: pendCount, color: '#9ca3af', bg: '#f9fafb' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-2">
              {cat.items.map((item, i) => {
                const key    = `${activeCategory}-${i}`
                const result = results[key]
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl p-4"
                  >
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{item}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setResult(key, 'pass')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        style={{ background: result === 'pass' ? '#10b981' : '#f0fdf4', color: result === 'pass' ? 'white' : '#10b981' }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 符合 ✓
                      </button>
                      <button
                        onClick={() => setResult(key, 'fail')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        style={{ background: result === 'fail' ? '#ef4444' : '#fef2f2', color: result === 'fail' ? 'white' : '#ef4444' }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> 缺失 ✗
                      </button>
                      <button
                        onClick={() => setResult(key, null)}
                        className="px-3 py-2.5 rounded-xl bg-gray-50"
                      >
                        <MinusCircle className="w-3.5 h-3.5 text-gray-300" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Save */}
            {!saved ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #00a86b, #00d47e)', opacity: saving ? 0.7 : 1 }}
              >
                <Save className="w-4 h-4" />
                {saving ? '儲存中...' : `儲存 ${shifts[activeShift]} 衛生紀錄（${user.name}）`}
              </motion.button>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-green-50 border border-green-100 text-center">
                <p className="text-green-600 font-bold text-sm">✓ {shifts[activeShift]} 紀錄已儲存至資料庫</p>
                <p className="text-green-400 text-xs mt-0.5">{new Date().toLocaleTimeString('zh-TW')}・{user.name}</p>
                <button onClick={() => setSaved(false)} className="mt-2 text-xs text-green-500 underline">繼續編輯</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
