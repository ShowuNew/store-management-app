import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, RefreshCw, Send, Camera, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SCORE_SECTIONS, MAX_TOTAL } from '../types/mystery'
import type { MysterySession, MysteryFormData } from '../types/mystery'

interface Props { token: string }

export default function MysteryFormPage({ token }: Props) {
  const [session, setSession]   = useState<MysterySession | null>(null)
  const [loadErr, setLoadErr]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [scores, setScores]     = useState<Record<string, number>>({})
  const [notes, setNotes]       = useState<Record<string, string>>({})
  const [visitNotes, setVisitNotes] = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [photos, setPhotos]     = useState<Record<number, string[]>>({})
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('mystery_sessions')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !data) { setLoadErr('連結無效或已失效'); setLoading(false); return }

      const now = new Date()
      if (new Date(data.expires_at) < now) {
        await supabase.from('mystery_sessions').update({ status: 'expired' }).eq('token', token)
        setLoadErr('此連結已過期'); setLoading(false); return
      }
      if (data.status === 'completed') {
        setLoadErr('此表單已填寫完成，無法重複提交'); setLoading(false); return
      }
      if (data.status === 'expired') {
        setLoadErr('此連結已過期'); setLoading(false); return
      }

      setSession(data)
      setLoading(false)
    }
    load()
  }, [token])

  const openCamera = (sectionIdx: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !session) return
      setUploadingIdx(sectionIdx)
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${session.id}/${sectionIdx}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('mystery-photos').upload(path, file)
      if (error) { alert('上傳失敗，請稍後再試'); setUploadingIdx(null); return }
      const { data: { publicUrl } } = supabase.storage.from('mystery-photos').getPublicUrl(path)
      setPhotos(p => ({ ...p, [sectionIdx]: [...(p[sectionIdx] ?? []), publicUrl] }))
      setUploadingIdx(null)
    }
    input.click()
  }

  const removePhoto = (sectionIdx: number, url: string) => {
    setPhotos(p => ({ ...p, [sectionIdx]: (p[sectionIdx] ?? []).filter(u => u !== url) }))
  }

  const getScore = (key: string) => scores[key] ?? 0
  const total = SCORE_SECTIONS.reduce(
    (sum, sec) => sum + sec.items.reduce((s, it) => s + getScore(it.key), 0), 0
  )

  const handleSubmit = async () => {
    if (!session) return
    setSaving(true)

    const formData: MysteryFormData = {}
    SCORE_SECTIONS.forEach(sec =>
      sec.items.forEach(it => {
        formData[it.key] = { score: getScore(it.key), note: notes[it.key] ?? '' }
      })
    )

    const photosPayload: Record<string, string[]> = {}
    Object.entries(photos).forEach(([idx, urls]) => {
      const sec = SCORE_SECTIONS[parseInt(idx)]
      if (sec && urls.length > 0) photosPayload[sec.title] = urls
    })

    const { error } = await supabase
      .from('mystery_sessions')
      .update({
        status:       'completed',
        submitted_at: new Date().toISOString(),
        form_data:    formData,
        total_score:  total,
        visit_notes:  visitNotes,
        photos:       photosPayload,
      })
      .eq('token', token)

    if (error) { setSaving(false); alert('送出失敗，請稍後再試'); return }

    setTotalScore(total)
    setDone(true)
    setSaving(false)
  }

  // ── Loading ──
  if (loading) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center gap-3 text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin" />
      <span className="text-base">載入中...</span>
    </div>
  )

  // ── Error ──
  if (loadErr) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-base font-bold text-gray-800">{loadErr}</p>
        <p className="text-base text-gray-400 mt-2">如有疑問請聯絡督導</p>
      </div>
    </div>
  )

  // ── Done ──
  if (done) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 text-center shadow-sm max-w-sm w-full"
      >
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-gray-800 mb-2">評核完成！</h2>
        <p className="text-base text-gray-500 mb-6">{session?.store_name || session?.store_id} 門市</p>
        <div className="rounded-2xl py-6 mb-4" style={{ background: 'linear-gradient(135deg,#007d30,#00a040)' }}>
          <p className="text-white text-base mb-1">總分</p>
          <p className="text-white font-black" style={{ fontSize: 64 }}>{totalScore}</p>
          <p className="text-green-200 text-base">/ {MAX_TOTAL} 分</p>
        </div>
        <p className="text-base text-gray-400">感謝您的評核，資料已上傳</p>
      </motion.div>
    </div>
  )

  // ── Form ──
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#00a040,#007d30)' }} />
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-800">115年店舖服務評核訪查表</h1>
          <p className="text-base text-gray-400 mt-0.5">
            {session?.store_name || session?.store_id} 門市・評核人員填寫
          </p>
        </div>
      </div>

      <div className="px-4 py-4 pb-32 space-y-4">
        {/* Score sections */}
        {SCORE_SECTIONS.map((sec, si) => (
          <motion.div
            key={sec.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.05 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between" style={{ background: '#f0fdf4' }}>
              <div>
                <p className="text-base font-bold text-green-700">{sec.title}</p>
                <p className="text-sm text-green-600">
                  小計：{sec.items.reduce((s, it) => s + getScore(it.key), 0)} /
                  {sec.items.reduce((s, it) => s + it.max, 0)} 分
                </p>
              </div>
              <button
                onClick={() => openCamera(si)}
                disabled={uploadingIdx === si}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: '#dcfce7', color: '#007d30' }}
              >
                {uploadingIdx === si
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Camera className="w-4 h-4" />
                }
                {(photos[si] ?? []).length > 0 ? `${(photos[si] ?? []).length}張` : '拍照'}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {sec.items.map(item => {
                const val = getScore(item.key)
                const isOk = val >= item.max
                const isPartial = val > 0 && val < item.max
                return (
                  <div key={item.key} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-gray-800">{item.label}</p>
                        <p className="text-sm text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={item.max}
                          value={val === 0 ? '' : val}
                          placeholder="0"
                          onChange={e => {
                            let n = parseInt(e.target.value)
                            if (isNaN(n)) n = 0
                            if (n < 0) n = 0
                            if (n > item.max) n = item.max
                            setScores(p => ({ ...p, [item.key]: n }))
                          }}
                          className="w-14 text-center text-xl font-black border-2 rounded-xl py-2 outline-none transition-colors"
                          style={{
                            borderColor: isOk ? '#10b981' : isPartial ? '#f59e0b' : '#e5e7eb',
                            color: isOk ? '#059669' : isPartial ? '#d97706' : '#374151',
                          }}
                        />
                        <span className="text-base text-gray-400">/{item.max}</span>
                      </div>
                    </div>
                    {/* Quick buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setScores(p => ({ ...p, [item.key]: item.max }))}
                        className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: isOk ? '#10b981' : '#f0fdf4',
                          color: isOk ? 'white' : '#059669',
                        }}
                      >
                        全分 {item.max}
                      </button>
                      <button
                        onClick={() => setScores(p => ({ ...p, [item.key]: 0 }))}
                        className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: val === 0 ? '#ef4444' : '#fef2f2',
                          color: val === 0 ? 'white' : '#dc2626',
                        }}
                      >
                        0 分
                      </button>
                    </div>
                    {/* Note */}
                    <textarea
                      rows={1}
                      placeholder="備注（選填）"
                      value={notes[item.key] ?? ''}
                      onChange={e => setNotes(p => ({ ...p, [item.key]: e.target.value }))}
                      className="mt-2 w-full text-base text-gray-700 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none resize-none leading-relaxed"
                      style={{ minHeight: 44 }}
                    />
                  </div>
                )
              })}
            </div>
            {(photos[si] ?? []).length > 0 && (
              <div className="px-4 pb-4 pt-2">
                <p className="text-sm text-gray-400 mb-2">附加照片</p>
                <div className="flex flex-wrap gap-2">
                  {(photos[si] ?? []).map(url => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
                      <button
                        onClick={() => removePhoto(si, url)}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {/* 建議事項 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-base font-bold text-gray-700 mb-2">建議事項（不計分）</p>
          <textarea
            rows={4}
            placeholder="填寫對門市的整體建議或特別觀察..."
            value={visitNotes}
            onChange={e => setVisitNotes(e.target.value)}
            className="w-full text-base text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 outline-none resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-base text-gray-500">目前總分</span>
          <span className="text-xl font-black" style={{ color: '#007d30' }}>
            {total} <span className="text-base font-normal text-gray-400">/ {MAX_TOTAL}</span>
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#00a040,#007d30)', opacity: saving ? 0.7 : 1 }}
        >
          <Send className="w-5 h-5" />
          {saving ? '送出中...' : '送出評核結果'}
        </button>
      </div>
    </div>
  )
}
