import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, MinusCircle, Save, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Result = 'pass' | 'fail' | null

const categories = [
  {
    name: '場所衛生環境',
    items: [
      '營業場所（地面／牆壁／支柱／天花板）保持清潔，不得有納垢、剝落、積灰、積水等情形',
      '出入口、門窗、處理口及其他孔道應通風良好，保持清潔無異味，並設置防止病媒侵入之設施，以避免有病媒或其出沒之痕跡（老鼠、蟑螂、蚊蟲等）；食品曝露之正上方天花板不得有結露現象',
      '廁所應保持清潔，不得有不良氣味，並應於明顯處標示「如廁後應洗手」之字樣，且備有洗潔劑、乾手器或擦手紙巾等',
      '洗手接觸面應保持平滑、無凹陷或裂縫，並保持清潔',
    ],
  },
  {
    name: '衛生品質管理',
    items: [
      '食品接觸面應保持平滑、無凹陷或裂縫，並保持清潔',
      '清洗、清潔和消毒機具應專用器具妥善保管',
      '使用之原料應符合相關食品衛生標準或規定，並可追溯來源',
      '食品應分開貯放，不得直接置於地面，並依先進先出使用，且在有效日期內使用',
      '冷凍溫度應保持在 -18°C 以下；冷藏溫度應保持在 7°C 以下；溫藏溫度保持 65°C 以上（溫度計功能正常操作）',
      '食品設備、器具及抹布等，使用前後應確認其清潔，並定期有效消毒',
    ],
  },
  {
    name: '從業人員衛生管理',
    items: [
      '從業人員每年定期健康檢查（含工讀生）',
      '從業人員應穿戴整潔之工作衣，與食品直接接觸者，手部不得佩戴飾物或留指甲，或配戴清潔之手套',
      '從業人員手部應保持清潔，並應於進入食品作業場所前、如廁後或手部受污染時應正確洗手或消毒',
      '作業人員工作中不得有吸菸、嚼檳榔或口含糖、飲食及其他可能污染食品之行為',
      '私人及清潔用具等以明標（區）統一收置',
    ],
  },
  {
    name: '菸害防制',
    items: [
      '所有入口處應設置明顯禁菸標示，且不得供應與菸品相關聯物，無吸菸行為人',
      '不供應菸品予未滿 20 歲者，且不得販售菸品形狀之糖果、點心、玩具或其他任何物品',
      '不促銷菸品或菸品廣告',
      '不可將菸盒代替隔熱紙夾付消費者使用，以免觸犯菸防制相關法規，違反者店鋪將處 10～50 萬不等罰鍰',
      '菸品或菸品容器之展示，應以使消費者獲知菸品品牌及價格之必要者為限（菸品展示正面距場外外部二公尺以上者，不在此限）',
      '應於明顯處標示「吸菸有害健康」、「免費戒菸專線 0800-636363」、「本場所不供應菸品予未滿20歲」、「未滿 20 歲者不得吸菸」、「不得強迫、誘使孕婦吸菸」之警示圖文',
    ],
  },
]

const shifts = ['07:00', '15:00', '23:00']
const todayStr = new Date().toISOString().split('T')[0]

export default function HygienePage({ user, onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeShift, setActiveShift]       = useState(0)
  const [results, setResults]               = useState<Record<string, Result>>({})
  const [failNotes, setFailNotes]           = useState<Record<string, string>>({})
  const [saved, setSaved]                   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [loading, setLoading]               = useState(true)
  const [existingId, setExistingId]         = useState<string | null>(null)
  const [draftRestored, setDraftRestored]   = useState<{ at: string } | null>(null)
  const [draftSavedAt, setDraftSavedAt]     = useState<string | null>(null)

  const draftKey = `hygiene_${user.storeId}_${todayStr}_${activeShift}`

  // Load from Supabase (or restore draft)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setDraftRestored(null)
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
        setFailNotes(data.fail_notes || {})
        setSaved(true)
      } else {
        // Try localStorage draft
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            setResults(parsed.results || {})
            setFailNotes(parsed.failNotes || {})
            setDraftRestored({ at: parsed.savedAt || '' })
            setSaved(false)
          } else {
            setResults({})
            setFailNotes({})
            setSaved(false)
          }
        } catch {
          setResults({})
          setFailNotes({})
          setSaved(false)
        }
        setExistingId(null)
      }
      setLoading(false)
    }
    load()
  }, [activeShift]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft to localStorage whenever results or failNotes change
  useEffect(() => {
    if (loading) return
    if (saved) return
    const now = new Date().toLocaleTimeString('zh-TW')
    const draft = { results, failNotes, savedAt: now }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
      setDraftSavedAt(now)
    } catch { /* ignore */ }
  }, [results, failNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  const setResult = (key: string, val: Result) => {
    setResults(p => ({ ...p, [key]: p[key] === val ? null : val }))
    setSaved(false)
  }

  const setFailNote = (key: string, note: string) => {
    setFailNotes(p => ({ ...p, [key]: note }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      store_id:    user.storeId,
      staff_name:  user.name,
      record_date: todayStr,
      shift:       shifts[activeShift],
      results,
      fail_notes:  failNotes,
      saved_at:    new Date().toISOString(),
    }

    if (existingId) {
      await supabase.from('hygiene_records').update(payload).eq('id', existingId)
    } else {
      const { data } = await supabase.from('hygiene_records').insert(payload).select().single()
      if (data) setExistingId(data.id)
    }

    // Clear draft after successful save
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setDraftRestored(null)
    setDraftSavedAt(null)
    setSaved(true)
    setSaving(false)
  }

  const handleRestartDraft = () => {
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setResults({})
    setFailNotes({})
    setDraftRestored(null)
    setDraftSavedAt(null)
    setSaved(false)
  }

  const cat = categories[activeCategory]
  const allPassCount = categories.reduce((total, c, ci) =>
    total + c.items.filter((_, i) => results[`${ci}-${i}`] === 'pass').length, 0)
  const allFailCount = categories.reduce((total, c, ci) =>
    total + c.items.filter((_, i) => results[`${ci}-${i}`] === 'fail').length, 0)
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)
  const passCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'pass').length
  const failCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'fail').length
  const pendCount = cat.items.length - passCount - failCount

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="衛生自主管理"
        subtitle={`${new Date().getMonth() + 1}月 ${new Date().getDate()}日・共21項`}
        onBack={onBack}
      />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Overall progress */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600">全部查核進度</p>
            <p className="text-sm font-bold text-gray-700">{allPassCount + allFailCount}/{totalItems} 已填</p>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.round((allPassCount + allFailCount) / totalItems * 100)}%`,
                background: 'linear-gradient(90deg, #00a86b, #00d47e)',
              }}
            />
          </div>
          <div className="flex gap-3 mt-2">
            <span className="text-[11px] text-green-600 font-semibold">✓ 符合 {allPassCount}</span>
            <span className="text-[11px] text-red-500 font-semibold">✗ 缺失 {allFailCount}</span>
            <span className="text-[11px] text-gray-400 font-semibold">― 未填 {totalItems - allPassCount - allFailCount}</span>
          </div>
        </div>

        {/* Draft restored banner */}
        {draftRestored && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-700">已還原草稿</p>
              <p className="text-xs text-blue-500 mt-0.5">上次自動儲存於 {draftRestored.at}</p>
            </div>
            <button
              onClick={handleRestartDraft}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold"
            >
              重新開始
            </button>
          </div>
        )}

        {/* Shift */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">班次時段</p>
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
          {categories.map((c, i) => {
            const cFail = c.items.filter((_, j) => results[`${i}-${j}`] === 'fail').length
            return (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                style={{
                  background: activeCategory === i ? '#005f3b' : 'white',
                  color:      activeCategory === i ? 'white'   : '#6b7280',
                }}
              >
                {c.name}
                {cFail > 0 && (
                  <span className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black">
                    {cFail}
                  </span>
                )}
              </button>
            )
          })}
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
                const note   = failNotes[key] ?? ''
                const itemNo = categories.slice(0, activeCategory).reduce((s, c) => s + c.items.length, 0) + i + 1
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl p-4"
                  >
                    <div className="flex gap-2 mb-3">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 flex items-center justify-center shrink-0 mt-0.5">
                        {itemNo}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed flex-1">{item}</p>
                    </div>
                    {/* Full-width buttons, no ml-7 indent */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setResult(key, 'pass')}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all"
                        style={{
                          minHeight: '60px',
                          background: result === 'pass' ? '#10b981' : '#f0fdf4',
                          color: result === 'pass' ? 'white' : '#10b981',
                        }}
                      >
                        <CheckCircle2 className="w-5 h-5" /> 符合 ✓
                      </button>
                      <button
                        onClick={() => setResult(key, 'fail')}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all"
                        style={{
                          minHeight: '60px',
                          background: result === 'fail' ? '#ef4444' : '#fef2f2',
                          color: result === 'fail' ? 'white' : '#ef4444',
                        }}
                      >
                        <XCircle className="w-5 h-5" /> 缺失 ✗
                      </button>
                      <button
                        onClick={() => setResult(key, null)}
                        className="px-3 rounded-2xl bg-gray-50"
                        style={{ minHeight: '60px' }}
                      >
                        <MinusCircle className="w-5 h-5 text-gray-300" />
                      </button>
                    </div>

                    {/* Animated fail notes textarea */}
                    <AnimatePresence>
                      {result === 'fail' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <textarea
                            className="w-full mt-3 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-red-50 outline-none resize-none leading-relaxed"
                            rows={2}
                            placeholder="請記錄缺失說明（選填）..."
                            value={note}
                            onChange={e => setFailNote(key, e.target.value)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
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

            {/* Draft auto-save indicator */}
            {!saved && draftSavedAt && (
              <p className="text-center text-xs text-gray-400">
                🗒 自動儲存草稿 {draftSavedAt}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
