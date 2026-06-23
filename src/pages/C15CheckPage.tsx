import { useState, useEffect, useRef } from 'react'
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
      '當班人員服儀清潔：(1)符合服儀海報規範，頭髮需整齊(長髮盤起)、手部不得佩戴戒指等飾品，手部若有傷口應進行包紮。(2)不得著破褲、內搭衣下襬不外露。(3)調理FF區商品時，請配戴口罩，避免飛沫污染食品。',
      '使用手指消毒器消毒手部。(販售咖啡前/更換牛奶手部消毒)',
    ],
  },
  {
    name: '櫃台區',
    items: [
      '桌面>90公分購物空間(扣除面銷籃)且乾淨整齊(含TM、六格陳列架等)※90公分距離約為兩個購物籃橫放，若櫃台長度<90公分，不擺放面銷籃。',
      '後櫃台淨空，除店用設備外無放置其他物品且保持乾淨：(1)不放置私人用品(飲料、手機)、雜物等。(2)洗手台僅可放置洗手乳，菜瓜布可放內側。(3)菸架上方淨空，除專用捕蠅紙陳列盒。',
    ],
  },
  {
    name: 'FF區',
    items: [
      'FF區整齊清潔無空架：桌面無積塵、機台清潔、熟食器具、備品區(包材、袋子、壓克力架)無明顯髒污。',
      '防塵罩、壓克力無嚴重泛黃破損，保溫石無嚴重糖蜜沾黏。',
      '販售時間內不可空架，賣相不佳商品需下架。',
    ],
  },
  {
    name: '全店貨架',
    items: [
      '商品排面整齊無欠品：4℃(含中島櫃)、18℃、麵包架、OC、WI、全店貨架及層板保持乾淨，無灰塵、污漬、水氣。',
      '定時清潔貨架縫隙、轉角與底層的積塵，避免蚊蟲屍、包裝碎屑等汙染源。',
      '中島櫃上方不堆放雜物。',
    ],
  },
  {
    name: 'EC商品',
    items: [
      'EC商品存放不影響顧客觀感及購買動線：存放EC商品不得遮擋消費動線。',
      '需放置後場或EC櫃內，若件數很多堆疊在EC櫃上需整齊收納。',
      'EC櫃內可放EC商品、預售、預換，不可放其他物品(如備品/商品庫存/私人物品)。',
    ],
  },
  {
    name: '客用空間',
    items: [
      '休息區清潔：桌面/地面清潔無髒污無垃圾，桌貼無髒污、破損、垃圾桶乾淨無滿溢。',
      '客用廁所清潔：垃圾桶無滿溢、廁所無臭味、地面/洗手台清潔。',
      '自助區機台：結帳機、咖啡機、微波爐等，環境保持清潔。',
    ],
  },
]

const shifts      = ['07:00', '15:00', '23:00']
const shiftLabels = ['早班 07:00–15:00', '晚班 15:00–23:00', '大夜班 23:00–07:00']
const totalItems  = categories.length

export default function C15CheckPage({ user, onBack }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const isManager = user.role === 'manager' || user.role === 'sub-manager'
  const [selectedDate, setSelectedDate] = useState(todayStr)

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
  const [activeC15Key, setActiveC15Key] = useState<string | null>(null)
  const c15Refs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    const focusLine = window.innerHeight * 0.35
    const check = () => {
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80
      let bestKey: string | null = null; let bestScore = Infinity
      c15Refs.current.forEach((el, k) => {
        const rect = el.getBoundingClientRect()
        if (rect.bottom < 0 || rect.top > window.innerHeight) return
        const score = atBottom ? -rect.top : Math.abs(rect.top - focusLine)
        if (score < bestScore) { bestScore = score; bestKey = k }
      })
      setActiveC15Key(bestKey)
    }
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const draftKey = `c15_${user.storeId}_${selectedDate}_${shifts[activeShift]}`

  useEffect(() => {
    let cancelled = false
    setChecked({})
    setSaved(false)
    setExistingId(null)
    setDraftRestored(null)
    setDraftSavedAt(null)
    const load = async () => {
      setLoading(true)
      setDraftRestored(null)
      setLoadError(null)
      setSaved(false)

      const { data, error } = await supabase
        .from('c15_records')
        .select('*')
        .eq('store_id', user.storeId)
        .eq('record_date', selectedDate)
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
  }, [activeShift, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

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
      record_date: selectedDate,
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
          .eq('record_date', selectedDate)
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
        subtitle={(() => { const [, sm, sd] = selectedDate.split('-'); return `${parseInt(sm)}月${parseInt(sd)}日` })()}
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
                background: 'linear-gradient(90deg, var(--brand), var(--brand-dark))',
              }}
            />
          </div>
        </div>

        {/* Date picker (managers only) */}
        {isManager && (
          <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-500">查閱日期</p>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => {
                setSelectedDate(e.target.value)
                setChecked({})
                setSaved(false)
                setExistingId(null)
                setDraftRestored(null)
                setDraftSavedAt(null)
              }}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-base text-gray-700 bg-gray-50 outline-none"
            />
          </div>
        )}

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
              const key       = `${ci}`
              const isChecked = !!checked[key]
              return (
                <div key={ci} className="bg-white rounded-2xl overflow-hidden transition-shadow duration-300"
                  ref={el => { if (el) c15Refs.current.set(`${ci}`, el); else c15Refs.current.delete(`${ci}`) }}
                  style={{ boxShadow: activeC15Key === `${ci}` ? '0 0 0 2px var(--brand), 0 4px 16px var(--brand-shadow)' : 'none' }}
                >
                  {/* Section header — single checkbox per category */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                    style={{ background: isChecked ? '#f0fdf4' : 'white' }}
                  >
                    <p className="text-base font-bold" style={{ color: isChecked ? '#166534' : '#1f2937' }}>{cat.name}</p>
                    {isChecked
                      ? <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: 'var(--brand)' }} />
                      : <Circle       className="w-6 h-6 shrink-0 text-gray-200" />
                    }
                  </motion.button>

                  {/* Items as read-only bullet list */}
                  <div className="border-t border-gray-50">
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-2 px-4 py-2.5" style={{ borderTop: ii > 0 ? '1px solid #f9fafb' : 'none' }}>
                        <span className="text-gray-300 text-sm shrink-0 mt-0.5">•</span>
                        <p className="text-sm leading-relaxed text-gray-500">{item}</p>
                      </div>
                    ))}
                  </div>
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
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))', opacity: saving ? 0.7 : 1 }}
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
                  style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))', color: 'white' }}
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
