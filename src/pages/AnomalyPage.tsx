import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, AlertTriangle, Clock, CheckCircle2, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Severity = 'low' | 'medium' | 'high' | 'critical'
type Status   = 'open' | 'in_progress' | 'resolved'

interface Anomaly {
  id: string; reportedAt: string; category: string
  description: string; severity: Severity; status: Status; reporterName: string
}

const sevConfig: Record<Severity, { label: string; color: string; bg: string }> = {
  low:      { label: '低',  color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: '中',  color: '#f59e0b', bg: '#fffbeb' },
  high:     { label: '高',  color: '#f97316', bg: '#fff7ed' },
  critical: { label: '緊急', color: '#ef4444', bg: '#fef2f2' },
}
const staConfig: Record<Status, { label: string; color: string; bg: string }> = {
  open:        { label: '待處理', color: '#ef4444', bg: '#fef2f2' },
  in_progress: { label: '處理中', color: '#f59e0b', bg: '#fffbeb' },
  resolved:    { label: '已結案', color: '#10b981', bg: '#ecfdf5' },
}

const categories = ['設備故障', '衛生問題', '商品品質', '人員事故', '顧客投訴', '設施損壞', '其他']

const initAnomalies: Anomaly[] = [
  { id: '1', reportedAt: '09:23', category: '設備故障',  description: '冷凍庫溫度偏高，顯示 -15°C，低於標準 -18°C', severity: 'high',   status: 'in_progress', reporterName: '阿澤' },
  { id: '2', reportedAt: '昨天',  category: '顧客投訴',  description: '顧客反映鮮食包裝破損',                        severity: 'medium', status: 'open',        reporterName: '如思' },
]

export default function AnomalyPage({ user, onBack }: Props) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>(initAnomalies)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: '設備故障', description: '', severity: 'medium' as Severity })

  const updateStatus = (id: string, status: Status) =>
    setAnomalies(p => p.map(a => a.id === id ? { ...a, status } : a))

  const submitAnomaly = () => {
    if (!form.description.trim()) return
    setAnomalies(p => [{
      id: Date.now().toString(),
      reportedAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      category: form.category,
      description: form.description,
      severity: form.severity,
      status: 'open',
      reporterName: user.name,
    }, ...p])
    setShowForm(false)
    setForm({ category: '設備故障', description: '', severity: 'medium' })
  }

  const openCount = anomalies.filter(a => a.status === 'open').length

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="異常回報"
        subtitle={`${openCount} 件待處理`}
        onBack={onBack}
        rightElement={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold mr-1"
            style={{ background: '#ef4444' }}
          >
            <Plus className="w-3.5 h-3.5" /> 新增
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {(['open', 'in_progress', 'resolved'] as Status[]).map(s => {
            const c = staConfig[s]
            return (
              <div key={s} className="rounded-2xl p-3 text-center" style={{ background: c.bg }}>
                <p className="text-2xl font-black" style={{ color: c.color }}>
                  {anomalies.filter(a => a.status === s).length}
                </p>
                <p className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</p>
              </div>
            )
          })}
        </div>

        {/* List */}
        {anomalies.map((a, i) => {
          const sev = sevConfig[a.severity]
          const sta = staConfig[a.status]
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: sev.bg }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: sev.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-gray-700">{a.category}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: sta.bg, color: sta.color }}>{sta.label}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{a.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {a.reportedAt}
                    </span>
                    <span className="text-[10px] text-gray-400">回報：{a.reporterName}</span>
                  </div>
                </div>
              </div>

              {a.status !== 'resolved' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  {a.status === 'open' && (
                    <button
                      onClick={() => updateStatus(a.id, 'in_progress')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-600"
                    >
                      標記處理中
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(a.id, 'resolved')}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-600 flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> 結案
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}

        {anomalies.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">目前無異常紀錄</p>
          </div>
        )}
      </div>

      {/* Create form - bottom sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white rounded-t-3xl z-50 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-800">新增異常回報</h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">異常類別</label>
                  <select
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">嚴重程度</label>
                  <div className="flex gap-2">
                    {(Object.entries(sevConfig) as [Severity, typeof sevConfig[Severity]][]).map(([s, cfg]) => (
                      <button
                        key={s}
                        onClick={() => setForm(p => ({ ...p, severity: s }))}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: form.severity === s ? cfg.color : cfg.bg,
                          color:      form.severity === s ? 'white'   : cfg.color,
                        }}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">異常描述</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none resize-none"
                    rows={3}
                    placeholder="請描述異常狀況..."
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <button
                  onClick={submitAnomaly}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}
                >
                  送出回報（{user.name}）
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
