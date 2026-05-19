import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, MinusCircle, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Result = 'pass' | 'fail' | null

const categories = [
  {
    name: '服務現現',
    subtitle: '服裝儀容 / 手部消毒',
    items: [
      '服裝儀容符合規定（制服整潔、名牌配戴、髮型整齊）',
      '進入食品作業區前完成手部清潔消毒',
    ],
  },
  {
    name: '櫃台區',
    subtitle: '90cm通道 / 台面整潔',
    items: [
      '結帳櫃台前緣保留 90cm 通道空間，無商品堆置',
      '後結帳台面整潔，無私人物品或雜物',
      '洗手台清潔，皂液器、擦手紙補充充足',
      '結帳區上方層架或架頂無堆放商品或雜物',
    ],
  },
  {
    name: 'FF區',
    subtitle: '機台清潔 / 陳列合規',
    items: [
      'FF 機台及周邊備品架保持整齊清潔',
      '溫層設備罩蓋完整關閉，無外露或破損',
      '商品陳列符合公司規範，POP 標示正確且完整',
    ],
  },
  {
    name: '全店貨架',
    subtitle: '面向整齊 / 臥式架頂淨空',
    items: [
      '貨架商品面向一致（面向前），無倒置或歪斜',
      '貨架本體及商品表面定期清潔，無積灰或污漬',
      '臥式冰櫃頂端無堆放任何物品（箱子、袋子等）',
    ],
  },
  {
    name: 'EC商品',
    subtitle: '不阻通道 / 正確溫層',
    items: [
      'EC 取件商品存放位置不阻礙客用走道或結帳動線',
      'EC 商品依規定溫層（常溫／冷藏）分類存放，無落地',
    ],
  },
  {
    name: '客用空間',
    subtitle: '座位 / 廁所 / 自助機台',
    items: [
      '用餐座位區桌椅保持清潔整齊，無殘留食物或垃圾',
      '客用廁所清潔，無異味，備有洗潔劑及擦手紙',
      '自助服務機台（咖啡機、ATM 等）台面及周邊整潔',
    ],
  },
]

const shifts = ['07:00', '15:00', '23:00']
const shiftLabels = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']

const totalItems = categories.reduce((s, c) => s + c.items.length, 0)

export default function C15CheckPage({ user, onBack }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [activeCategory, setActiveCategory] = useState(0)
  const [activeShift, setActiveShift]       = useState(0)
  const [results, setResults]               = useState<Record<string, Result>>({})
  const [failNotes, setFailNotes]           = useState<Record<string, string>>({})
  const [saved, setSaved]                   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [loading, setLoading]               = useState(true)
  const [existingId, setExistingId]         = useState<string | null>(null)
  const [draftRestored, setDraftRestored]   = useState<string | null>(null)
  const [draftSavedAt, setDraftSavedAt]     = useState<string | null>(null)
  const [loadError, setLoadError]           = useState<string | null>(null)
  const [saveError, setSaveError]           = useState<string | null>(null)
  const [savedAt, setSavedAt]               = useState('')
  const [confirmLeave, setConfirmLeave]     = useState(false)

  const draftKey = `c15_${user.storeId}_${todayStr}_${shifts[activeShift]}`

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setDraftRestored(null)
      setLoadError(null)
      setSaved(false)

      const { data, error } = await supabase
        .from('c15_records')
        .select('*')
        .eq('store_id', user.storeId)
        .eq('record_date', todayStr)
        .eq('shift', shifts[activeShift])
        .maybeSingle()

      if (cancelled) { setLoading(false); return }

      if (error) {
        setLoadError('資料載入失敗，請檢查網路連線後重試')
        setLoading(false)
        return
      }

      if (data) {
        setExistingId(data.id)
        setResults(data.results || {})
        setFailNotes(data.fail_notes || {})
        setSaved(true)
      } else {
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            setResults(parsed.results || {})
            setFailNotes(parsed.failNotes || {})
            setDraftRestored(parsed.savedAt || '')
          } else {
            setResults({})
            setFailNotes({})
          }
        } catch {
          setResults({})
          setFailNotes({})
        }
        setExistingId(null)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [activeShift]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || saved) return
    const now = new Date().toLocaleTimeString('zh-TW')
    try {
      localStorage.setItem(draftKey, JSON.stringify({ results, failNotes, savedAt: now }))
      setDraftSavedAt(now)
    } catch { /* ignore */ }
  }, [results, failNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  const setResult = (key: string, val: Result) => {
    const newVal = results[key] === val ? null : val
    setResults(p => ({ ...p, [key]: newVal }))
    if (newVal !== 'fail') {
      setFailNotes(p => { const n = { ...p }; delete n[key]; return n })
    }
    setSaved(false)
  }

  const setFailNote = (key: string, note: string) => {
    setFailNotes(p => ({ ...p, [key]: note }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)

    const payload = {
      store_id:    user.storeId,
      staff_name:  user.name,
      record_date: todayStr,
      shift:       shifts[activeShift],
      results,
      fail_notes:  failNotes,
      saved_at:    new Date().toISOString(),
    }

    let saveErr: unknown = null

    if (existingId) {
      const { error } = await supabase.from('c15_records').update(payload).eq('id', existingId)
      saveErr = error
    } else {
      const { error: insertError } = await supabase.from('c15_records').insert(payload)
      saveErr = insertError
      if (!insertError) {
        const { data: inserted } = await supabase
          .from('c15_records')
          .select('id')
          .eq('store_id', user.storeId)
          .eq('record_date', todayStr)
          .eq('shift', shifts[activeShift])
          .maybeSingle()
        if (inserted) setExistingId(inserted.id)
      }
    }

    if (saveErr) {
      const e = saveErr as { message?: string; code?: string }
      setSaveError(`儲存失敗：${e.message ?? e.code ?? '請稍後再試'}`)
      setSaving(false)
      return
    }

    const now = new Date().toLocaleTimeString('zh-TW')
    setSavedAt(now)
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

  const allPassCount = categories.reduce((total, c, ci) =>
    total + c.items.filter((_, i) => results[`${ci}-${i}`] === 'pass').length, 0)
  const allFailCount = categories.reduce((total, c, ci) =>
    total + c.items.filter((_, i) => results[`${ci}-${i}`] === 'fail').length, 0)
  const totalUnfilled = totalItems - allPassCount - allFailCount

  const cat      = categories[activeCategory]
  const passCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'pass').length
  const failCount = cat.items.filter((_, i) => results[`${activeCategory}-${i}`] === 'fail').length
  const pendCount = cat.items.length - passCount - failCount

  const globalItemOffset = categories.slice(0, activeCategory).reduce((s, c) => s + c.items.length, 0)

  const handleBack = () => {
    if (!saved && totalUnfilled < totalItems) {
      setConfirmLeave(true)
    } else {
      onBack()
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="C15 店鋪品質確認"
        subtitle={`${new Date().getMonth() + 1}月 ${new Date().getDate()}日・共 ${totalItems} 項`}
        onBack={handleBack}
      />

      <div className="px-4 py-4 space-y-4 pb-10">

        {/* Overall progress */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-base font-semibold text-gray-600">全部查核進度</p>
            <p className="text-base font-bold text-gray-700">{allPassCount + allFailCount}/{totalItems} 已填</p>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${totalItems > 0 ? Math.round((allPassCount + allFailCount) / totalItems * 100) : 0}%`,
                background: 'linear-gradient(90deg, #00a040, #007d30)',
              }}
            />
          </div>
          <div className="flex gap-3 mt-2">
            <span className="text-base text-green-600 font-semibold">✓ 符合 {allPassCount}</span>
            <span className="text-base text-red-500 font-semibold">✗ 缺失 {allFailCount}</span>
            <span className="text-base text-gray-400 font-semibold">― 未填 {totalUnfilled}</span>
          </div>
        </div>

        {/* Draft restored banner */}
        {draftRestored !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold text-blue-700">已還原草稿</p>
              <p className="text-sm text-blue-500 mt-0.5">上次自動儲存於 {draftRestored}</p>
            </div>
            <button
              onClick={handleRestartDraft}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-sm font-bold"
            >
              重新開始
            </button>
          </div>
        )}

        {/* Shift selector */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-500 mb-2">班次時段</p>
          <div className="flex gap-2">
            {shifts.map((s, i) => (
              <button
                key={s}
                onClick={() => {
                  if (i === activeShift) return
                  setActiveShift(i)
                  setResults({})
                  setFailNotes({})
                  setExistingId(null)
                  setSaveError(null)
                  setLoadError(null)
                  setSaved(false)
                  setActiveCategory(0)
                }}
                className="flex-1 py-2.5 rounded-xl text-base font-bold transition-all"
                style={{
                  background: activeShift === i ? '#005f3b' : '#f3f4f6',
                  color:      activeShift === i ? 'white'   : '#9ca3af',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-2 text-center">{shiftLabels[activeShift]}</p>
        </div>

        {/* Section tabs (horizontal scroll) */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((c, i) => {
              const cFilled = c.items.filter((_, j) => results[`${i}-${j}`] != null).length
              const cFail   = c.items.filter((_, j) => results[`${i}-${j}`] === 'fail').length
              const isActive = activeCategory === i
              return (
                <button
                  key={i}
                  onClick={() => setActiveCategory(i)}
                  className="shrink-0 px-3 py-2 rounded-xl text-left transition-all"
                  style={{
                    background: isActive ? '#005f3b' : 'white',
                    color:      isActive ? 'white'   : '#6b7280',
                    minWidth: '7rem',
                  }}
                >
                  <p className="text-sm font-bold leading-tight">{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                    {cFilled}/{c.items.length} 已填
                    {cFail > 0 && (
                      <span className="ml-1 px-1 rounded-full bg-red-500 text-white text-xs font-black">缺{cFail}</span>
                    )}
                  </p>
                </button>
              )
            })}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
        </div>

        {/* Error banners */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-base text-red-600">{loadError}</p>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-base text-red-600">{saveError}</p>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入紀錄...</span>
          </div>
        ) : (
          <>
            {/* Section subtitle */}
            <p className="text-sm text-gray-400 px-1">{cat.subtitle}</p>

            {/* Per-category stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '符合', count: passCount, color: '#10b981', bg: '#ecfdf5' },
                { label: '缺失', count: failCount, color: '#ef4444', bg: '#fef2f2' },
                { label: '未填', count: pendCount, color: '#9ca3af', bg: '#f9fafb' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-sm font-semibold" style={{ color: s.color }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-2">
              {cat.items.map((item, i) => {
                const key    = `${activeCategory}-${i}`
                const result = results[key]
                const note   = failNotes[key] ?? ''
                const itemNo = globalItemOffset + i + 1

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl p-4"
                  >
                    <div className="flex gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-sm font-bold text-gray-500 flex items-center justify-center shrink-0 mt-0.5">
                        {itemNo}
                      </span>
                      <p className="text-base text-gray-700 leading-relaxed flex-1">{item}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setResult(key, 'pass')}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl font-bold text-base transition-all"
                        style={{
                          minHeight: '56px',
                          background: result === 'pass' ? '#10b981' : '#f0fdf4',
                          color: result === 'pass' ? 'white' : '#10b981',
                        }}
                      >
                        <CheckCircle2 className="w-5 h-5 shrink-0" /> 符合 ✓
                      </button>
                      <button
                        onClick={() => setResult(key, 'fail')}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl font-bold text-base transition-all"
                        style={{
                          minHeight: '56px',
                          background: result === 'fail' ? '#ef4444' : '#fef2f2',
                          color: result === 'fail' ? 'white' : '#ef4444',
                        }}
                      >
                        <XCircle className="w-5 h-5 shrink-0" /> 缺失 ✗
                      </button>
                      <button
                        onClick={() => setResult(key, null)}
                        className="px-3 rounded-2xl bg-gray-50"
                        style={{ minHeight: '56px' }}
                        aria-label="清除"
                      >
                        <MinusCircle className="w-5 h-5 text-gray-300" />
                      </button>
                    </div>

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
                            className="w-full mt-3 border border-red-200 rounded-xl px-3 py-2.5 text-base text-gray-700 bg-red-50 outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 resize-none leading-relaxed"
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

            {/* Save / saved state */}
            {!saved ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #00a040, #007d30)', opacity: saving ? 0.7 : 1 }}
              >
                <Save className="w-4 h-4" />
                {saving ? '儲存中...' : `儲存 ${shifts[activeShift]} C15確認（${user.name}）`}
              </motion.button>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-green-50 border border-green-100 text-center">
                <p className="text-green-700 font-bold text-base">✓ {shifts[activeShift]} C15確認已儲存</p>
                <p className="text-green-400 text-sm mt-0.5">{savedAt}・{user.name}</p>
                <button onClick={() => setSaved(false)} className="mt-2 text-sm text-green-500 underline">繼續編輯</button>
              </div>
            )}

            {/* Draft indicator */}
            {!saved && draftSavedAt && (
              <p className="text-center text-sm text-gray-400">草稿自動儲存於 {draftSavedAt}</p>
            )}
          </>
        )}
      </div>

      {/* Confirm-leave modal */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="w-full bg-white rounded-3xl p-6 space-y-4"
              style={{ maxWidth: 420 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">確認離開？</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    已填寫的內容已自動存入草稿，下次進入此班次時可還原。
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-base"
                  style={{ background: 'linear-gradient(135deg, #00a040, #007d30)', color: 'white' }}
                >
                  繼續填寫
                </button>
                <button
                  onClick={() => { setConfirmLeave(false); onBack() }}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-base bg-gray-100 text-gray-600"
                >
                  直接離開
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
