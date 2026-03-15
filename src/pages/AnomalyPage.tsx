import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, AlertTriangle, Clock, CheckCircle2, X, RefreshCw,
  Wrench, ShieldAlert, Building2, Camera,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Severity = 'low' | 'medium' | 'high' | 'critical'
type Status   = 'open' | 'in_progress' | 'resolved'
type TabType  = 'general' | 'repair' | 'quality' | 'external'

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

const generalCategories = ['設備故障', '衛生問題', '商品品質', '人員事故', '顧客投訴', '設施損壞', '其他']

const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'general',  label: '異常回報', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: '#ef4444' },
  { id: 'repair',   label: '報修記錄', icon: <Wrench        className="w-3.5 h-3.5" />, color: '#f97316' },
  { id: 'quality',  label: '品質異常', icon: <ShieldAlert   className="w-3.5 h-3.5" />, color: '#8b5cf6' },
  { id: 'external', label: '外部稽查', icon: <Building2     className="w-3.5 h-3.5" />, color: '#3b82f6' },
]

export default function AnomalyPage({ user, onBack }: Props) {
  const [activeTab, setActiveTab]   = useState<TabType>('general')
  const [anomalies, setAnomalies]   = useState<Anomaly[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)

  // ── 通用異常表單 ──
  const [generalForm, setGeneralForm] = useState({
    category: '設備故障', description: '', severity: 'medium' as Severity,
  })
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // ── 報修記錄表單 ──
  const [repairForm, setRepairForm] = useState({
    equipmentName: '', abnormalStatus: '', reporterPhone: '',
  })
  const [repairPhotoFile, setRepairPhotoFile]       = useState<File | null>(null)
  const [repairPhotoPreview, setRepairPhotoPreview] = useState<string | null>(null)

  // ── 品質異常表單 ──
  const [qualityForm, setQualityForm] = useState({
    productCode: '', productName: '', quantity: '1',
    expiryDate: '', anomalyReason: '', hasPhoto: false,
    displayTemp: '', productSurfaceTemp: '',
    productRetained: 'store' as 'consumer' | 'store' | 'no' | 'other',
    storeHandling: 'exchange' as 'refund' | 'exchange' | 'none',
    consumerContact: 'disagreed' as 'agreed' | 'disagreed',
    consumerName: '', consumerPhone: '', specialNote: '',
  })

  // ── 外部稽查表單 ──
  const [externalForm, setExternalForm] = useState({
    agency: '', inspectedDate: new Date().toISOString().split('T')[0],
    inspectedTime: '', hasForm: true, content: '',
  })

  const fetchAnomalies = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('anomaly_reports')
      .select('*')
      .eq('store_id', user.storeId)
      .order('reported_at', { ascending: false })
    if (!error && data) setAnomalies(data)
    setLoading(false)
  }

  useEffect(() => { fetchAnomalies() }, [])

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('anomaly_reports').update({ status }).eq('id', id)
    setAnomalies(p => p.map(a => a.id === id ? { ...a, status } : a))
  }

  const closeForm = () => setShowForm(false)

  // ── Photo upload helper ──
  const uploadPhoto = async (file: File, storeId: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${storeId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('anomaly-photos').upload(path, file)
    if (upErr) throw upErr
    const { data: urlData } = supabase.storage.from('anomaly-photos').getPublicUrl(path)
    return urlData.publicUrl
  }

  // ── 送出通用異常 ──
  const submitGeneral = async () => {
    if (!generalForm.description.trim()) return
    setSaving(true)
    let photoUrl = ''
    if (photoFile) {
      try {
        photoUrl = await uploadPhoto(photoFile, user.storeId)
      } catch { /* silently ignore */ }
    }
    const description = generalForm.description + (photoUrl ? `\n[現場照片：${photoUrl}]` : '')
    const { data, error } = await supabase.from('anomaly_reports').insert({
      store_id:      user.storeId,
      reporter_name: user.name,
      category:      generalForm.category,
      description,
      severity:      generalForm.severity,
      status:        'open',
    }).select().single()
    if (!error && data) {
      setAnomalies(p => [data, ...p])
      closeForm()
      setGeneralForm({ category: '設備故障', description: '', severity: 'medium' })
      setPhotoFile(null)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
    setSaving(false)
  }

  // ── 送出報修記錄 ──
  const submitRepair = async () => {
    if (!repairForm.equipmentName.trim() || !repairForm.abnormalStatus.trim()) return
    setSaving(true)
    let photoUrl = ''
    if (repairPhotoFile) {
      try {
        photoUrl = await uploadPhoto(repairPhotoFile, user.storeId)
      } catch { /* silently ignore */ }
    }
    const desc = `【設備報修】\n設備名稱：${repairForm.equipmentName}\n異常狀況：${repairForm.abnormalStatus}\n報修電話：${repairForm.reporterPhone || '—'}` + (photoUrl ? `\n[現場照片：${photoUrl}]` : '')
    const { data, error } = await supabase.from('anomaly_reports').insert({
      store_id:      user.storeId,
      reporter_name: user.name,
      category:      '設備報修',
      description:   desc,
      severity:      'high',
      status:        'open',
    }).select().single()
    if (!error && data) {
      setAnomalies(p => [data, ...p])
      closeForm()
      setRepairForm({ equipmentName: '', abnormalStatus: '', reporterPhone: '' })
      setRepairPhotoFile(null)
      if (repairPhotoPreview) URL.revokeObjectURL(repairPhotoPreview)
      setRepairPhotoPreview(null)
    }
    setSaving(false)
  }

  // ── 送出品質異常 ──
  const submitQuality = async () => {
    if (!qualityForm.anomalyReason.trim()) return
    setSaving(true)
    const q = qualityForm
    const desc = [
      `【品質異常回報】`,
      `商品代號：${q.productCode || '—'}　商品名稱：${q.productName || '未提供'}　數量：${q.quantity}`,
      `效期：${q.expiryDate || '—'}　異常原因：${q.anomalyReason}`,
      `機台顯示溫度：${q.displayTemp ? q.displayTemp + '°C' : '—'}　商品表面溫度：${q.productSurfaceTemp ? q.productSurfaceTemp + '°C' : '—'}`,
      `商品保留：${q.productRetained}　店鋪處理：${q.storeHandling}`,
      `廠商聯繫：${q.consumerContact}${q.consumerContact === 'agreed' ? `（${q.consumerName} ${q.consumerPhone}）` : ''}`,
      q.specialNote ? `特殊說明：${q.specialNote}` : '',
    ].filter(Boolean).join('\n')
    const { data, error } = await supabase.from('anomaly_reports').insert({
      store_id:      user.storeId,
      reporter_name: user.name,
      category:      '品質異常回報',
      description:   desc,
      severity:      'medium',
      status:        'open',
    }).select().single()
    if (!error && data) {
      setAnomalies(p => [data, ...p])
      closeForm()
    }
    setSaving(false)
  }

  // ── 送出外部稽查 ──
  const submitExternal = async () => {
    if (!externalForm.agency.trim()) return
    setSaving(true)
    const e = externalForm
    const desc = [
      `【外部機關品保稽查】`,
      `稽查單位：${e.agency}`,
      `稽查時間：${e.inspectedDate} ${e.inspectedTime}`,
      `有無稽查單：${e.hasForm ? '有（已拍照回報）' : '無'}`,
      !e.hasForm && e.content ? `稽查內容：${e.content}` : '',
    ].filter(Boolean).join('\n')
    const { data, error } = await supabase.from('anomaly_reports').insert({
      store_id:      user.storeId,
      reporter_name: user.name,
      category:      '外部機關稽查',
      description:   desc,
      severity:      'high',
      status:        'open',
    }).select().single()
    if (!error && data) {
      setAnomalies(p => [data, ...p])
      closeForm()
      setExternalForm({ agency: '', inspectedDate: new Date().toISOString().split('T')[0], inspectedTime: '', hasForm: true, content: '' })
    }
    setSaving(false)
  }

  const filteredAnomalies = anomalies.filter(a => {
    if (activeTab === 'general')  return !['設備報修', '品質異常回報', '外部機關稽查'].includes(a.category)
    if (activeTab === 'repair')   return a.category === '設備報修'
    if (activeTab === 'quality')  return a.category === '品質異常回報'
    if (activeTab === 'external') return a.category === '外部機關稽查'
    return true
  })

  const openCount = anomalies.filter(a => a.status === 'open').length
  const activeTabCfg = tabs.find(t => t.id === activeTab)!

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader
        title="異常回報"
        subtitle={loading ? '載入中...' : `${openCount} 件待處理`}
        onBack={onBack}
        rightElement={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold mr-1"
            style={{ background: activeTabCfg.color }}
          >
            <Plus className="w-3.5 h-3.5" /> 新增
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: activeTab === tab.id ? tab.color : 'white',
                color:      activeTab === tab.id ? 'white' : '#6b7280',
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {(['open', 'in_progress', 'resolved'] as Status[]).map(s => {
            const c = staConfig[s]
            return (
              <div key={s} className="rounded-2xl p-3 text-center" style={{ background: c.bg }}>
                <p className="text-2xl font-black" style={{ color: c.color }}>
                  {filteredAnomalies.filter(a => a.status === s).length}
                </p>
                <p className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</p>
              </div>
            )
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入中...</span>
          </div>
        )}

        {/* List */}
        {!loading && filteredAnomalies.map((a, i) => {
          const sev = sevConfig[a.severity] ?? sevConfig.medium
          const sta = staConfig[a.status]
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
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
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{a.description}</p>
                  <div className="flex items-center gap-3 mt-2">
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
        })}

        {!loading && filteredAnomalies.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">目前無{activeTabCfg.label}紀錄</p>
          </div>
        )}
      </div>

      {/* ── Form sheet ── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={closeForm}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white rounded-t-3xl z-50 p-6 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <span style={{ color: activeTabCfg.color }}>{activeTabCfg.icon}</span>
                  新增{activeTabCfg.label}
                </h2>
                <button onClick={closeForm} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* ── 通用異常 ── */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">異常類別</label>
                    <select
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      value={generalForm.category}
                      onChange={e => setGeneralForm(p => ({ ...p, category: e.target.value }))}
                    >
                      {generalCategories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">嚴重程度</label>
                    <div className="flex gap-2">
                      {(Object.entries(sevConfig) as [Severity, typeof sevConfig[Severity]][]).map(([s, cfg]) => (
                        <button key={s} onClick={() => setGeneralForm(p => ({ ...p, severity: s }))}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                          style={{ background: generalForm.severity === s ? cfg.color : cfg.bg, color: generalForm.severity === s ? 'white' : cfg.color }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">異常描述</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none resize-none"
                      rows={3} placeholder="請描述異常狀況..."
                      value={generalForm.description}
                      onChange={e => setGeneralForm(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  {/* Photo upload */}
                  <div>
                    <label className="text-sm font-semibold text-gray-500 mb-1.5 block">現場照片（選填）</label>
                    <label
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
                      style={{ borderColor: photoPreview ? '#10b981' : '#e5e7eb', background: photoPreview ? '#f0fdf4' : '#fafafa' }}
                    >
                      <Camera className="w-5 h-5" style={{ color: photoPreview ? '#10b981' : '#9ca3af' }} />
                      <span className="text-sm font-medium" style={{ color: photoPreview ? '#10b981' : '#9ca3af' }}>
                        {photoPreview ? '已選擇照片（點擊更換）' : '拍照或從相簿選取'}
                      </span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setPhotoFile(file)
                          if (photoPreview) URL.revokeObjectURL(photoPreview)
                          setPhotoPreview(URL.createObjectURL(file))
                        }} />
                    </label>
                    {photoPreview && (
                      <div className="relative mt-2">
                        <img src={photoPreview} className="w-full rounded-2xl object-cover max-h-48" alt="preview" />
                        <button
                          onClick={() => { setPhotoFile(null); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null) }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={submitGeneral} disabled={saving}
                    className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '儲存中...' : `送出回報（${user.name}）`}
                  </button>
                </div>
              )}

              {/* ── 報修記錄 ── */}
              {activeTab === 'repair' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 bg-orange-50 rounded-xl px-3 py-2">
                    📞 一般報修：0800-71999（機修 71999）　POS 機修：0800-222200
                  </p>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">設備名稱 *</label>
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      placeholder="例：咖啡機、POS 機、冷藏冰箱..."
                      value={repairForm.equipmentName}
                      onChange={e => setRepairForm(p => ({ ...p, equipmentName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">異常狀況 *</label>
                    <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none resize-none"
                      rows={3} placeholder="請描述設備異常狀況..."
                      value={repairForm.abnormalStatus}
                      onChange={e => setRepairForm(p => ({ ...p, abnormalStatus: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">報修電話</label>
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      placeholder="聯絡電話（選填）"
                      value={repairForm.reporterPhone}
                      onChange={e => setRepairForm(p => ({ ...p, reporterPhone: e.target.value }))} />
                  </div>
                  {/* Repair photo upload */}
                  <div>
                    <label className="text-sm font-semibold text-gray-500 mb-1.5 block">現場照片（選填）</label>
                    <label
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
                      style={{ borderColor: repairPhotoPreview ? '#10b981' : '#e5e7eb', background: repairPhotoPreview ? '#f0fdf4' : '#fafafa' }}
                    >
                      <Camera className="w-5 h-5" style={{ color: repairPhotoPreview ? '#10b981' : '#9ca3af' }} />
                      <span className="text-sm font-medium" style={{ color: repairPhotoPreview ? '#10b981' : '#9ca3af' }}>
                        {repairPhotoPreview ? '已選擇照片（點擊更換）' : '拍照或從相簿選取'}
                      </span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setRepairPhotoFile(file)
                          if (repairPhotoPreview) URL.revokeObjectURL(repairPhotoPreview)
                          setRepairPhotoPreview(URL.createObjectURL(file))
                        }} />
                    </label>
                    {repairPhotoPreview && (
                      <div className="relative mt-2">
                        <img src={repairPhotoPreview} className="w-full rounded-2xl object-cover max-h-48" alt="preview" />
                        <button
                          onClick={() => { setRepairPhotoFile(null); if (repairPhotoPreview) URL.revokeObjectURL(repairPhotoPreview); setRepairPhotoPreview(null) }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={submitRepair} disabled={saving}
                    className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '儲存中...' : `送出報修（${user.name}）`}
                  </button>
                </div>
              )}

              {/* ── 品質異常 ── */}
              {activeTab === 'quality' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 bg-purple-50 rounded-xl px-3 py-2">
                    消費者反應商品品質異常，記錄完整後立即拍照回報 → 營業廳 → 品保部
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">商品代號</label>
                      <input className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        placeholder="條碼或代號"
                        value={qualityForm.productCode}
                        onChange={e => setQualityForm(p => ({ ...p, productCode: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">數量</label>
                      <input type="number" min="1" className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        value={qualityForm.quantity}
                        onChange={e => setQualityForm(p => ({ ...p, quantity: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">商品名稱</label>
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      placeholder="商品名稱（不知道可留空）"
                      value={qualityForm.productName}
                      onChange={e => setQualityForm(p => ({ ...p, productName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">商品效期</label>
                    <input type="date" className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      value={qualityForm.expiryDate}
                      onChange={e => setQualityForm(p => ({ ...p, expiryDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">異常原因 *</label>
                    <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none resize-none"
                      rows={2} placeholder="請描述異常原因..."
                      value={qualityForm.anomalyReason}
                      onChange={e => setQualityForm(p => ({ ...p, anomalyReason: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">機台顯示溫度 (°C)</label>
                      <input type="number" className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        placeholder="例：8"
                        value={qualityForm.displayTemp}
                        onChange={e => setQualityForm(p => ({ ...p, displayTemp: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">商品表面溫度 (°C)</label>
                      <input type="number" className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        placeholder="例：9"
                        value={qualityForm.productSurfaceTemp}
                        onChange={e => setQualityForm(p => ({ ...p, productSurfaceTemp: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">店鋪處理方式</label>
                    <div className="flex gap-2">
                      {[
                        { v: 'refund'   as const, label: '退費' },
                        { v: 'exchange' as const, label: '換貨' },
                        { v: 'none'     as const, label: '未處理' },
                      ].map(({ v, label }) => (
                        <button key={v} onClick={() => setQualityForm(p => ({ ...p, storeHandling: v }))}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                          style={{ background: qualityForm.storeHandling === v ? '#8b5cf6' : '#f3f4f6', color: qualityForm.storeHandling === v ? 'white' : '#6b7280' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">特殊說明</label>
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      placeholder="（選填）"
                      value={qualityForm.specialNote}
                      onChange={e => setQualityForm(p => ({ ...p, specialNote: e.target.value }))} />
                  </div>
                  <button onClick={submitQuality} disabled={saving}
                    className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '儲存中...' : `送出品質異常（${user.name}）`}
                  </button>
                </div>
              )}

              {/* ── 外部稽查 ── */}
              {activeTab === 'external' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 bg-blue-50 rounded-xl px-3 py-2">
                    外部機關（衛生局、經濟部等）到店稽查時填寫，記錄完整後立即拍照回報 → 營業廳
                  </p>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1.5 block">稽查單位 *</label>
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                      placeholder="例：台北市衛生局"
                      value={externalForm.agency}
                      onChange={e => setExternalForm(p => ({ ...p, agency: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">稽查日期</label>
                      <input type="date" className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        value={externalForm.inspectedDate}
                        onChange={e => setExternalForm(p => ({ ...p, inspectedDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">稽查時間</label>
                      <input type="time" className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm text-gray-700 bg-gray-50 outline-none"
                        value={externalForm.inspectedTime}
                        onChange={e => setExternalForm(p => ({ ...p, inspectedTime: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">有無稽查單</label>
                    <div className="flex gap-3">
                      {[
                        { v: true,  label: '有稽查單', desc: '拍照回報即可' },
                        { v: false, label: '無稽查單', desc: '需填寫稽查內容' },
                      ].map(({ v, label, desc }) => (
                        <button key={String(v)} onClick={() => setExternalForm(p => ({ ...p, hasForm: v }))}
                          className="flex-1 py-3 rounded-2xl text-xs font-bold transition-all border-2 text-center"
                          style={{
                            borderColor: externalForm.hasForm === v ? '#3b82f6' : '#f3f4f6',
                            background:  externalForm.hasForm === v ? '#eff6ff'  : '#fafafa',
                            color:       externalForm.hasForm === v ? '#1d4ed8'  : '#6b7280',
                          }}>
                          {label}
                          <span className="block text-[10px] font-normal mt-0.5 opacity-70">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {!externalForm.hasForm && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">稽查狀況與內容 *</label>
                      <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none resize-none"
                        rows={4} placeholder="請記錄稽查狀況及稽查項目..."
                        value={externalForm.content}
                        onChange={e => setExternalForm(p => ({ ...p, content: e.target.value }))} />
                    </div>
                  )}
                  <button onClick={submitExternal} disabled={saving}
                    className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '儲存中...' : `送出稽查紀錄（${user.name}）`}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
