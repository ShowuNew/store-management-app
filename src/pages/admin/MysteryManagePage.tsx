import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link2, Copy, Check, RefreshCw, ClipboardList, Plus, CheckCircle2, Clock, XCircle, Ban } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { supabase } from '../../lib/supabase'
import { SCORE_SECTIONS, MAX_TOTAL } from '../../types/mystery'
import type { MysterySession } from '../../types/mystery'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

const BASE_URL = window.location.origin

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

function toDateLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fmtDT(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MysteryManagePage({ user, onBack }: Props) {
  const [tab, setTab] = useState<'create' | 'history'>('create')

  // ── Create ──
  const [storeId,   setStoreId]   = useState('')
  const [storeName, setStoreName] = useState('')
  const [startsAt, setStartsAt] = useState(() => toDateLocal(new Date()))
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return toDateLocal(d)
  })
  const [creating,  setCreating]  = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [createdRange, setCreatedRange] = useState<{ starts: string; ends: string } | null>(null)

  // ── History ──
  const [sessions,  setSessions]  = useState<MysterySession[]>([])
  const [loading,   setLoading]   = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('mystery_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setSessions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])

  const handleCreate = async () => {
    if (!storeId.trim()) return
    if (new Date(endsAt) <= new Date(startsAt)) {
      alert('結束時間必須晚於開始時間')
      return
    }
    setCreating(true)
    const token = generateToken()

    const { error } = await supabase.from('mystery_sessions').insert({
      token,
      store_id:   storeId.trim(),
      store_name: storeName.trim(),
      created_by: user.name,
      starts_at:  new Date(startsAt).toISOString(),
      expires_at: new Date(endsAt).toISOString(),
    })

    if (error) { alert('建立失敗，請稍後再試'); setCreating(false); return }

    setCreatedRange({ starts: startsAt, ends: endsAt })
    setGeneratedUrl(`${BASE_URL}/?token=${token}`)
    setCreating(false)
  }

  const handleCancel = async (id: string) => {
    if (!confirm('確定要取消此連結？神秘客將無法再使用此連結。')) return
    await supabase.from('mystery_sessions').update({ status: 'cancelled' }).eq('id', id)
    await loadHistory()
  }

  const handleCopy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setGeneratedUrl(null)
    setCreatedRange(null)
    setStoreId('')
    setStoreName('')
    const now = new Date()
    setStartsAt(toDateLocal(now))
    const end = new Date()
    end.setDate(end.getDate() + 3)
    setEndsAt(toDateLocal(end))
    setCopied(false)
  }

  const statusLabel = (s: MysterySession) => {
    const now = new Date()
    if (s.status === 'completed') return { text: '已完成', color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 className="w-4 h-4" /> }
    if (s.status === 'cancelled') return { text: '已取消', color: '#ef4444', bg: '#fef2f2', icon: <Ban className="w-4 h-4" /> }
    if (s.status === 'expired' || new Date(s.expires_at) < now) return { text: '已過期', color: '#9ca3af', bg: '#f3f4f6', icon: <XCircle className="w-4 h-4" /> }
    if (s.starts_at && new Date(s.starts_at) > now) return { text: '未開始', color: '#6366f1', bg: '#eef2ff', icon: <Clock className="w-4 h-4" /> }
    return { text: '進行中', color: '#f59e0b', bg: '#fffbeb', icon: <Clock className="w-4 h-4" /> }
  }

  const isActionable = (s: MysterySession) =>
    s.status === 'pending' && new Date(s.expires_at) > new Date()

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="神秘客稽查" subtitle="Mystery Shopper" onBack={onBack} />

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-2 pt-2">
        {([['create', '建立連結', <Plus className="w-4 h-4" />], ['history', '歷史記錄', <ClipboardList className="w-4 h-4" />]] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'create' | 'history')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-base transition-all"
            style={{
              background: tab === key ? '#f0fdf4' : 'transparent',
              color:      tab === key ? '#007d30' : '#9ca3af',
              borderBottom: tab === key ? '2px solid #007d30' : '2px solid transparent',
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* ── Create tab ── */}
        {tab === 'create' && (
          <div className="space-y-4">
            {!generatedUrl ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <p className="text-base font-bold text-gray-700">指定評核門市</p>

                <div>
                  <label className="text-base font-semibold text-gray-500 block mb-1">店號 *</label>
                  <input
                    type="text"
                    placeholder="例：1234"
                    value={storeId}
                    onChange={e => setStoreId(e.target.value)}
                    className="w-full text-base font-medium border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-green-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-base font-semibold text-gray-500 block mb-1">店名（選填）</label>
                  <input
                    type="text"
                    placeholder="例：全家便利商店 XX 店"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="w-full text-base font-medium border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-green-500 bg-gray-50"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-base font-semibold text-gray-500 block">連結有效期間</label>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">開始日期</p>
                    <input
                      type="date"
                      value={startsAt}
                      onChange={e => setStartsAt(e.target.value)}
                      className="w-full text-base font-medium border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-green-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">結束日期</p>
                    <input
                      type="date"
                      value={endsAt}
                      min={startsAt}
                      onChange={e => setEndsAt(e.target.value)}
                      className="w-full text-base font-medium border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-green-500 bg-gray-50"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!storeId.trim() || creating}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#00a040,#007d30)', opacity: (!storeId.trim() || creating) ? 0.5 : 1 }}
                >
                  <Link2 className="w-5 h-5" />
                  {creating ? '建立中...' : '產生神秘客連結'}
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <p className="text-base font-bold text-gray-800">連結已建立！</p>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>開始：{createdRange ? fmtDT(createdRange.starts) : '—'}</span>
                    <span>→</span>
                    <span>結束：{createdRange ? fmtDT(createdRange.ends) : '—'}</span>
                  </div>
                  <p className="text-base font-medium text-gray-700 break-all leading-relaxed">{generatedUrl}</p>
                </div>

                <button
                  onClick={handleCopy}
                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: copied ? '#ecfdf5' : 'linear-gradient(135deg,#00a040,#007d30)',
                    color: copied ? '#059669' : 'white',
                  }}
                >
                  {copied ? <><Check className="w-5 h-5" />已複製！</> : <><Copy className="w-5 h-5" />複製連結</>}
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-3 rounded-2xl text-base font-bold text-gray-500 bg-gray-100"
                >
                  建立另一個連結
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-500">{sessions.length} 筆記錄</p>
              <button onClick={loadHistory} className="flex items-center gap-1.5 text-base text-gray-400">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-base">載入中...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-base">尚無評核記錄</p>
              </div>
            ) : (
              sessions.map(s => {
                const st = statusLabel(s)
                const isExp = expanded === s.id
                const actionable = isActionable(s)
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-4 flex items-center gap-3">
                      <button
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                        onClick={() => setExpanded(isExp ? null : s.id)}
                      >
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0 text-sm font-bold"
                          style={{ background: st.bg, color: st.color }}>
                          {st.icon}{st.text}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-800">
                            {s.store_name || s.store_id}
                            {s.store_name && <span className="text-base text-gray-400 ml-1">#{s.store_id}</span>}
                          </p>
                          <p className="text-sm text-gray-400">
                            {new Date(s.created_at).toLocaleDateString('zh-TW')} 建立・由 {s.created_by}
                          </p>
                          <p className="text-sm text-gray-400">
                            {s.starts_at ? fmtDT(s.starts_at) : '—'} → {fmtDT(s.expires_at)}
                          </p>
                        </div>
                        {s.status === 'completed' && s.total_score !== undefined && (
                          <div className="text-right shrink-0">
                            <p className="text-xl font-black text-green-600">{s.total_score}</p>
                            <p className="text-sm text-gray-400">/{MAX_TOTAL}</p>
                          </div>
                        )}
                      </button>
                      {actionable && (
                        <div className="shrink-0 flex gap-1">
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(`${BASE_URL}/?token=${s.token}`)
                              alert('連結已複製！')
                            }}
                            className="p-2 rounded-xl bg-gray-50"
                            title="複製連結"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleCancel(s.id)}
                            className="p-2 rounded-xl bg-red-50"
                            title="取消連結"
                          >
                            <Ban className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExp && s.status === 'completed' && s.form_data && (
                      <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                        {SCORE_SECTIONS.map(sec => {
                          const secScore = sec.items.reduce((sum, it) => sum + (s.form_data![it.key]?.score ?? 0), 0)
                          const secMax   = sec.items.reduce((sum, it) => sum + it.max, 0)
                          return (
                            <div key={sec.title}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-base font-bold text-gray-600">{sec.title}</p>
                                <p className="text-base font-bold" style={{ color: secScore >= secMax * 0.8 ? '#10b981' : '#f59e0b' }}>
                                  {secScore}/{secMax}
                                </p>
                              </div>
                              {sec.items.map(it => {
                                const fd = s.form_data![it.key]
                                const score = fd?.score ?? 0
                                return (
                                  <div key={it.key} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                                    <p className="text-sm text-gray-600 flex-1">{it.label}</p>
                                    <p className="text-sm font-bold ml-2 shrink-0"
                                      style={{ color: score >= it.max ? '#10b981' : score > 0 ? '#f59e0b' : '#ef4444' }}>
                                      {score}/{it.max}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                        {s.visit_notes && (
                          <div className="bg-gray-50 rounded-xl px-3 py-3">
                            <p className="text-sm font-bold text-gray-400 mb-1">建議事項</p>
                            <p className="text-base text-gray-700 leading-relaxed">{s.visit_notes}</p>
                          </div>
                        )}
                        {s.photos && Object.keys(s.photos).length > 0 && (
                          <div className="bg-gray-50 rounded-xl px-3 py-3">
                            <p className="text-sm font-bold text-gray-400 mb-2">附加照片</p>
                            {Object.entries(s.photos).map(([secTitle, urls]) => (
                              <div key={secTitle} className="mb-2 last:mb-0">
                                <p className="text-sm text-gray-500 mb-1">{secTitle}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {urls.map(url => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
