import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

const categories = [
  {
    name: '服務現現',
    items: [
      '服裝儀容符合規定（制服整潔、名牌配戴、髮型整齊）',
      '進入食品作業區前完成手部清潔消毒',
    ],
  },
  {
    name: '櫃台區',
    items: [
      '結帳櫃台前緣保留 90cm 通道空間，無商品堆置',
      '後結帳台面整潔，無私人物品或雜物',
      '洗手台清潔，皂液器、擦手紙補充充足',
      '結帳區上方層架或架頂無堆放商品或雜物',
    ],
  },
  {
    name: 'FF區',
    items: [
      'FF 機台及周邊備品架保持整齊清潔',
      '溫層設備罩蓋完整關閉，無外露或破損',
      '商品陳列符合公司規範，POP 標示正確且完整',
    ],
  },
  {
    name: '全店貨架',
    items: [
      '貨架商品面向一致（面向前），無倒置或歪斜',
      '貨架本體及商品表面定期清潔，無積灰或污漬',
      '臥式冰櫃頂端無堆放任何物品（箱子、袋子等）',
    ],
  },
  {
    name: 'EC商品',
    items: [
      'EC 取件商品存放位置不阻礙客用走道或結帳動線',
      'EC 商品依規定溫層（常溫／冷藏）分類存放，無落地',
    ],
  },
  {
    name: '客用空間',
    items: [
      '用餐座位區桌椅保持清潔整齊，無殘留食物或垃圾',
      '客用廁所清潔，無異味，備有洗潔劑及擦手紙',
      '自助服務機台（咖啡機、ATM 等）台面及周邊整潔',
    ],
  },
]

const shifts      = ['07:00', '15:00', '23:00']
const shiftLabels = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']
const totalItems  = categories.reduce((s, c) => s + c.items.length, 0)

export default function C15CheckPage({ user, onBack }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [activeShift, setActiveShift] = useState(0)
  const [checked, setChecked]         = useState<Record<string, boolean>>({})
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [existingId, setExistingId]   = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState<string | null>(null)
  const [draftSavedAt, setDraftSavedAt]   = useState<string | null>(null)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [savedAt, setSavedAt]         = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)

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
        setChecked(data.results || {})
        setSaved(true)
      } else {
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            setChecked(parsed.checked || {})
            setDraftRestored(parsed.savedAt || '')
          } else {
            setChecked({})
          }
        } catch {
          setChecked({})
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
      localStorage.setItem(draftKey, JSON.stringify({ checked, savedAt: now }))
      setDraftSavedAt(now)
    } catch { /* ignore */ }
  }, [checked]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => {
    setChecked(p => ({ ...p, [key]: !p[key] }))
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
      results:     checked,
      fail_notes:  {},
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
    setChecked({})
    setDraftRestored(null)
    setDraftSavedAt(null)
    setSaved(false)
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const anyTouched   = checkedCount > 0

  const handleBack = () => {
    if (!saved && anyTouched) {
      setConfirmLeave(true)
    } else {
      onBack()
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="C15 店鋪品質確認"
        subtitle={`${new Date().getMonth() + 1}月 ${new Date().getDate()}日`}
        onBack={handleBack}
      />

      <div className="px-4 py-4 space-y-4 pb-10">

        {/* Progress */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-500">確認進度</p>
            <p className="text-base font-bold text-gray-700">{checkedCount}/{totalItems} 項</p>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(checkedCount / totalItems * 100)}%`,
                background: 'linear-gradient(90deg, #00a040, #007d30)',
              }}
            />
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
                  setChecked({})
                  setExistingId(null)
                  setSaveError(null)
                  setLoadError(null)
                  setSaved(false)
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

        {/* Error banners */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-base text-red-600">{loadError}</p>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-base text-red-600">{saveError}</p>
          </div>
        )}

        {/* Checklist */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入紀錄...</span>
          </div>
        ) : (
          <>
            {categories.map((cat, ci) => {
              const catChecked = cat.items.filter((_, i) => checked[`${ci}-${i}`]).length
              return (
                <div key={ci} className="bg-white rounded-2xl overflow-hidden">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <p className="text-base font-bold text-gray-800">{cat.name}</p>
                    <span className="text-sm font-semibold" style={{ color: catChecked === cat.items.length ? '#00a040' : '#9ca3af' }}>
                      {catChecked}/{cat.items.length}
                    </span>
                  </div>

                  {/* Items */}
                  {cat.items.map((item, ii) => {
                    const key     = `${ci}-${ii}`
                    const isChecked = !!checked[key]
                    return (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggle(key)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
                        style={{ background: isChecked ? '#f0fdf4' : 'white', borderTop: ii > 0 ? '1px solid #f9fafb' : 'none' }}
                      >
                        {isChecked
                          ? <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: '#00a040' }} />
                          : <Circle       className="w-6 h-6 shrink-0 mt-0.5 text-gray-200" />
                        }
                        <p className="text-sm leading-relaxed flex-1" style={{ color: isChecked ? '#166534' : '#374151' }}>
                          {item}
                        </p>
                      </motion.button>
                    )
                  })}
                </div>
              )
            })}

            {/* Save / saved */}
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
                  <p className="text-sm text-gray-500 mt-0.5">已勾選的內容已自動存入草稿，下次進入此班次時可還原。</p>
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
