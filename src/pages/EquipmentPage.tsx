import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Calendar, Save, RefreshCw, AlertTriangle, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Freq = 'daily' | 'weekly' | 'monthly'
interface EqItem { equipment: string; items: string[]; freq: Freq }

const zones = ['FF區', '櫃台區', '賣場', '後場'] as const
type Zone = typeof zones[number]

const data: Record<Zone, EqItem[]> = {
  'FF區': [
    { equipment: 'FF機台',     items: ['機台下方、後方除灰', '機台出水口清潔', '水漬清除'],   freq: 'daily'   },
    { equipment: '開水機',     items: ['出水口清洗', '水漬擦拭'],                             freq: 'daily'   },
    { equipment: '微波爐',     items: ['濾網清洗'],                                           freq: 'weekly'  },
    { equipment: '咖啡機濾網', items: ['清洗咖啡機牛奶小冰箱濾網'],                           freq: 'daily'   },
    { equipment: '蒸箱',       items: ['蒸箱檸檬酸清洗'],                                     freq: 'monthly' },
  ],
  '櫃台區': [
    { equipment: '咖啡機週保養', items: ['豆漿濾網清洗', '水垢清除劑使用', '冷凍水箱除霜'],  freq: 'weekly'  },
    { equipment: '4°C工作冰箱',  items: ['濾網清潔及門板擦拭'],                               freq: 'weekly'  },
    { equipment: '18°C冷凍冰箱', items: ['除霜、出風口、擋板清潔'],                           freq: 'weekly'  },
    { equipment: '霜淇淋機',     items: ['清潔保養作業', '霜料清空丟棄', '零件拆卸消毒'],     freq: 'monthly' },
  ],
  '賣場': [
    { equipment: '事務機',     items: ['ATM、影印機、FamiPort等清潔'],              freq: 'weekly'  },
    { equipment: '美耐板',     items: ['牆面、桌面清潔'],                            freq: 'weekly'  },
    { equipment: '空調設備',   items: ['濾網、週邊清潔'],                            freq: 'weekly'  },
    { equipment: '各機台POP',  items: ['污損、脫落確認更換'],                        freq: 'weekly'  },
    { equipment: 'WI冷藏冰箱', items: ['走道、地板、層板、上方雜物清潔'],            freq: 'monthly' },
  ],
  '後場': [
    { equipment: '淨水設備', items: ['更換大白熊（濾芯）'],  freq: 'monthly' },
    { equipment: '貨架',     items: ['各貨架層板清潔'],      freq: 'monthly' },
    { equipment: '燈管',     items: ['燈管、天花板清潔'],    freq: 'monthly' },
  ],
}

const getMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

type CalStatus = 'done' | 'pending-today' | 'pending-week' | 'pending-month' | 'overdue'

const calBadge: Record<CalStatus, { text: string; bg: string; color: string }> = {
  'done':          { text: '✓ 已完成',    bg: '#ecfdf5', color: '#059669' },
  'pending-today': { text: '今日待執行',  bg: '#fffbeb', color: '#d97706' },
  'pending-week':  { text: '本週待執行',  bg: '#eff6ff', color: '#2563eb' },
  'pending-month': { text: `本月7日到期`, bg: '#eff6ff', color: '#2563eb' },
  'overdue':       { text: '⚠ 逾期未執行', bg: '#fef2f2', color: '#dc2626' },
}

export default function EquipmentPage({ user, onBack }: Props) {
  const todayStr   = new Date().toISOString().split('T')[0]
  const dayOfMonth = new Date().getDate()
  const [activeZone, setActiveZone]       = useState<Zone>('FF區')
  const [doneMap, setDoneMap]             = useState<Record<string, boolean>>({})
  const [historicalDone, setHistoricalDone] = useState<Set<string>>(new Set())
  const [saved, setSaved]                 = useState(false)
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(true)
  const [existingId, setExistingId]       = useState<string | null>(null)

  const monthStart = getMonthStart()
  const weekStart  = getWeekStart()

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Today's record
      const { data: row } = await supabase
        .from('equipment_logs').select('*')
        .eq('store_id', user.storeId).eq('log_date', todayStr).eq('zone', activeZone)
        .maybeSingle()

      if (row) {
        setExistingId(row.id)
        setDoneMap(row.done_items || {})
        setSaved(true)
      } else {
        setExistingId(null); setDoneMap({}); setSaved(false)
      }

      // Historical records this month (to track monthly/weekly completion)
      const { data: hist } = await supabase
        .from('equipment_logs').select('done_items, log_date')
        .eq('store_id', user.storeId).eq('zone', activeZone)
        .gte('log_date', monthStart)

      const zoneItems = data[activeZone]
      const histKeys  = new Set<string>()
      for (const r of (hist || [])) {
        Object.entries(r.done_items || {}).forEach(([k, v]) => {
          if (!v) return
          const idx = parseInt(k.split('-')[1])
          if (isNaN(idx) || !zoneItems[idx]) return
          const eq = zoneItems[idx]
          if (eq.freq === 'monthly') histKeys.add(k)
          if (eq.freq === 'weekly' && r.log_date >= weekStart) histKeys.add(k)
          if (eq.freq === 'daily'  && r.log_date === todayStr)  histKeys.add(k)
        })
      }
      setHistoricalDone(histKeys)
      setLoading(false)
    }
    load()
  }, [activeZone, user.storeId])

  const toggle = (key: string) => { setDoneMap(p => ({ ...p, [key]: !p[key] })); setSaved(false) }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      store_id: user.storeId, staff_name: user.name,
      log_date: todayStr, zone: activeZone,
      done_items: doneMap, saved_at: new Date().toISOString(),
    }
    if (existingId) {
      await supabase.from('equipment_logs').update(payload).eq('id', existingId)
    } else {
      const { data: r } = await supabase.from('equipment_logs').insert(payload).select().single()
      if (r) setExistingId(r.id)
    }
    // Update historicalDone for today's daily items
    const zoneItems = data[activeZone]
    const newHist = new Set(historicalDone)
    Object.entries(doneMap).forEach(([k, v]) => {
      if (!v) return
      const idx = parseInt(k.split('-')[1])
      if (isNaN(idx) || !zoneItems[idx]) return
      if (zoneItems[idx].freq === 'daily') newHist.add(k)
    })
    setHistoricalDone(newHist)
    setSaved(true); setSaving(false)
  }

  const items = data[activeZone]

  const getCalStatus = (eq: EqItem, key: string): CalStatus => {
    if (eq.freq === 'daily')   return historicalDone.has(key) ? 'done' : 'pending-today'
    if (eq.freq === 'weekly')  return historicalDone.has(key) ? 'done' : 'pending-week'
    // monthly
    if (historicalDone.has(key)) return 'done'
    return dayOfMonth > 7 ? 'overdue' : 'pending-month'
  }

  const overdueCount  = items.filter((eq, i) => getCalStatus(eq, `${activeZone}-${i}`) === 'overdue').length
  const doneThisMonth = items.filter((eq, i) => getCalStatus(eq, `${activeZone}-${i}`) === 'done').length
  const todayDone     = items.filter((_, i) => doneMap[`${activeZone}-${i}`]).length

  const freqLabel: Record<Freq, string> = { daily: '每日', weekly: '每週', monthly: '每月5日' }
  const freqColor: Record<Freq, string> = { daily: '#3b82f6', weekly: '#8b5cf6', monthly: '#f59e0b' }
  const freqBg:    Record<Freq, string> = { daily: '#eff6ff', weekly: '#f5f3ff', monthly: '#fffbeb' }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="設備清潔保養" subtitle={`${new Date().getMonth() + 1}月 保養紀錄`} onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-8">

        {/* Zone tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {zones.map(z => (
            <button key={z} onClick={() => setActiveZone(z)}
              className="shrink-0 px-4 py-2.5 rounded-xl text-base font-bold transition-all"
              style={{ background: activeZone === z ? '#005f3b' : 'white', color: activeZone === z ? 'white' : '#6b7280' }}>
              {z}
            </button>
          ))}
        </div>

        {/* Monthly overview card */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-base font-bold text-gray-700">{activeZone} 保養概覽</span>
            </div>
            <span className="text-base text-gray-400">{new Date().getMonth() + 1}月</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: '本期已完成', value: doneThisMonth, color: '#059669', bg: '#ecfdf5' },
              { label: '今日已勾選', value: todayDone,     color: '#2563eb', bg: '#eff6ff' },
              { label: '逾期未執行', value: overdueCount,  color: overdueCount > 0 ? '#dc2626' : '#9ca3af', bg: overdueCount > 0 ? '#fef2f2' : '#f9fafb' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: s.bg }}>
                <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-base font-semibold" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${items.length ? doneThisMonth / items.length * 100 : 0}%`, background: '#00a040' }} />
          </div>
          <p className="text-base text-gray-400 mt-1.5 text-right">{doneThisMonth}/{items.length} 項完成</p>
        </div>

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-base font-semibold text-red-600">
              {activeZone} 有 {overdueCount} 項每月保養已逾期（月份過7日未完成）
            </p>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入紀錄...</span>
          </div>
        ) : (
          <>
            {/* Equipment cards */}
            <div className="space-y-3">
              {items.map((eq, i) => {
                const key    = `${activeZone}-${i}`
                const done   = !!doneMap[key]
                const status = getCalStatus(eq, key)
                const badge  = calBadge[status]
                const isOverdue = status === 'overdue'

                return (
                  <motion.div key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm"
                    style={{ border: isOverdue ? '1.5px solid #fca5a5' : undefined }}
                  >
                    <div className="flex items-center px-4 py-3.5 gap-3 border-b border-gray-50">
                      <button onClick={() => toggle(key)} className="shrink-0" style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {done
                          ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                          : <Circle className="w-6 h-6 text-gray-200" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold"
                          style={{ color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
                          {eq.equipment}
                        </p>
                        {/* Calendar status badge */}
                        <span className="inline-flex items-center gap-1 text-base font-semibold mt-1 px-2 py-0.5 rounded-lg"
                          style={{ background: badge.bg, color: badge.color }}>
                          <Clock className="w-3 h-3" />
                          {badge.text}
                        </span>
                      </div>
                      <span className="text-base px-2 py-1 rounded-lg font-bold shrink-0"
                        style={{ background: freqBg[eq.freq], color: freqColor[eq.freq] }}>
                        {freqLabel[eq.freq]}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {eq.items.map((item, ii) => (
                        <p key={ii} className="text-base text-gray-500 flex items-start gap-2">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                          {item}
                        </p>
                      ))}
                      {done && (
                        <p className="text-base text-green-500 font-semibold mt-1">
                          ✓ {new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 完成（{user.name}）
                        </p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {!saved ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
                className="w-full rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-opacity"
                style={{ minHeight: '56px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', opacity: saving ? 0.7 : 1 }}>
                <Save className="w-5 h-5" />
                {saving ? '儲存中...' : `儲存 ${activeZone} 今日紀錄（${user.name}）`}
              </motion.button>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-amber-600 font-bold text-base">✓ {activeZone} 保養紀錄已儲存至資料庫</p>
                <p className="text-amber-400 text-base mt-0.5">{new Date().toLocaleTimeString('zh-TW')}・{user.name}</p>
                <button onClick={() => setSaved(false)} className="mt-2 text-base text-amber-500 underline">繼續編輯</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
