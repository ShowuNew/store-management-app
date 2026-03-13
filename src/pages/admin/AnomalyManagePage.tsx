import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, CheckCircle2, RefreshCw, Store } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

type Severity = 'low' | 'medium' | 'high' | 'critical'
type Status   = 'open' | 'in_progress' | 'resolved'

interface Anomaly {
  id: string
  store_id: string
  reporter_name: string
  reported_at: string
  category: string
  description: string
  severity: Severity
  status: Status
}

const sevConfig: Record<Severity, { label: string; color: string; bg: string }> = {
  low:      { label: '低',   color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: '中',   color: '#f59e0b', bg: '#fffbeb' },
  high:     { label: '高',   color: '#f97316', bg: '#fff7ed' },
  critical: { label: '緊急', color: '#ef4444', bg: '#fef2f2' },
}
const staConfig: Record<Status, { label: string; color: string; bg: string }> = {
  open:        { label: '待處理', color: '#ef4444', bg: '#fef2f2' },
  in_progress: { label: '處理中', color: '#f59e0b', bg: '#fffbeb' },
  resolved:    { label: '已結案', color: '#10b981', bg: '#ecfdf5' },
}

export default function AnomalyManagePage({ onBack }: Props) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('anomaly_reports')
      .select('*')
      .order('reported_at', { ascending: false })
    if (data) setAnomalies(data)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('anomaly_reports').update({ status }).eq('id', id)
    setAnomalies(p => p.map(a => a.id === id ? { ...a, status } : a))
  }

  const filtered = statusFilter === 'all' ? anomalies : anomalies.filter(a => a.status === statusFilter)

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            ←
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">異常管理</h1>
            <p className="text-xs text-gray-400">跨門市異常集中管理</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['open', 'in_progress', 'resolved'] as Status[]).map(s => {
            const c = staConfig[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className="rounded-xl p-2.5 text-center transition-all"
                style={{
                  background: statusFilter === s ? c.color : c.bg,
                  outline: statusFilter === s ? `2px solid ${c.color}` : 'none',
                }}
              >
                <p className="text-xl font-black" style={{ color: statusFilter === s ? 'white' : c.color }}>
                  {anomalies.filter(a => a.status === s).length}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: statusFilter === s ? 'white' : c.color }}>{c.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">查無異常紀錄</p>
          </div>
        ) : (
          filtered.map((a, i) => {
            const sev = sevConfig[a.severity]
            const sta = staConfig[a.status]
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
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
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Store className="w-3 h-3" /> {a.store_id}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.reported_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-gray-400">回報：{a.reporter_name}</span>
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
          })
        )}
      </div>
    </div>
  )
}
