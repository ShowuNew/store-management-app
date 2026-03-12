import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Calendar, Save } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Freq = 'daily' | 'weekly' | 'monthly'

interface EqItem { equipment: string; items: string[]; freq: Freq }

const freqConfig: Record<Freq, { label: string; color: string; bg: string }> = {
  daily:   { label: '每日',   color: '#3b82f6', bg: '#eff6ff' },
  weekly:  { label: '每週',   color: '#8b5cf6', bg: '#f5f3ff' },
  monthly: { label: '每月5日', color: '#f59e0b', bg: '#fffbeb' },
}

const zones = ['FF區', '櫃台區', '賣場', '後場'] as const
type Zone = typeof zones[number]

const data: Record<Zone, EqItem[]> = {
  'FF區': [
    { equipment: 'FF機台',      items: ['機台下方、後方除灰', '機台出水口清潔', '水漬清除'],              freq: 'daily'   },
    { equipment: '開水機',      items: ['出水口清洗', '水漬擦拭'],                                      freq: 'daily'   },
    { equipment: '微波爐',      items: ['濾網清洗'],                                                    freq: 'weekly'  },
    { equipment: '咖啡機濾網',  items: ['清洗咖啡機牛奶小冰箱濾網'],                                    freq: 'daily'   },
    { equipment: '蒸箱',        items: ['蒸箱檸檬酸清洗'],                                              freq: 'monthly' },
  ],
  '櫃台區': [
    { equipment: '咖啡機週保養', items: ['豆漿濾網清洗', '水垢清除劑使用', '冷凍水箱除霜'],             freq: 'weekly'  },
    { equipment: '4°C工作冰箱',  items: ['濾網清潔及門板擦拭'],                                         freq: 'weekly'  },
    { equipment: '18°C冷凍冰箱', items: ['除霜、出風口、擋板清潔'],                                      freq: 'weekly'  },
    { equipment: '霜淇淋機',     items: ['清潔保養作業', '霜料清空丟棄', '零件拆卸消毒'],                freq: 'monthly' },
  ],
  '賣場': [
    { equipment: '事務機',    items: ['ATM、影印機、FamiPort等清潔'],   freq: 'weekly'  },
    { equipment: '美耐板',    items: ['牆面、桌面清潔'],                freq: 'weekly'  },
    { equipment: '空調設備',  items: ['濾網、週邊清潔'],                freq: 'weekly'  },
    { equipment: '各機台POP', items: ['污損、脫落確認更換'],            freq: 'weekly'  },
    { equipment: 'WI冷藏冰箱', items: ['走道、地板、層板、上方雜物清潔'], freq: 'monthly' },
  ],
  '後場': [
    { equipment: '淨水設備', items: ['更換大白熊（濾芯）'],    freq: 'monthly' },
    { equipment: '貨架',     items: ['各貨架層板清潔'],        freq: 'monthly' },
    { equipment: '燈管',     items: ['燈管、天花板清潔'],      freq: 'monthly' },
  ],
}

export default function EquipmentPage({ user, onBack }: Props) {
  const [activeZone, setActiveZone] = useState<Zone>('FF區')
  const [doneMap, setDoneMap]       = useState<Record<string, boolean>>({})
  const [saved, setSaved]           = useState(false)

  const toggle = (key: string) => setDoneMap(p => ({ ...p, [key]: !p[key] }))

  const items    = data[activeZone]
  const doneCount = items.filter((_, i) => doneMap[`${activeZone}-${i}`]).length

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="設備清潔保養" subtitle={`${new Date().getMonth() + 1}月 保養紀錄`} onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Zone tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {zones.map(z => (
            <button
              key={z}
              onClick={() => { setActiveZone(z); setSaved(false) }}
              className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: activeZone === z ? '#005f3b' : 'white',
                color:      activeZone === z ? 'white'   : '#6b7280',
              }}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-300 shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="text-sm font-bold text-gray-700">{activeZone} 完成度</span>
              <span className="text-sm font-black" style={{ color: '#00a86b' }}>{doneCount}/{items.length}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${items.length ? doneCount / items.length * 100 : 0}%`, background: '#00a86b' }}
              />
            </div>
          </div>
        </div>

        {/* Equipment cards */}
        <div className="space-y-3">
          {items.map((eq, i) => {
            const key  = `${activeZone}-${i}`
            const done = doneMap[key]
            const fc   = freqConfig[eq.freq]
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="flex items-center px-4 py-3.5 gap-3 border-b border-gray-50">
                  <button onClick={() => toggle(key)} className="shrink-0">
                    {done
                      ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                      : <Circle className="w-6 h-6 text-gray-200" />
                    }
                  </button>
                  <p
                    className="flex-1 text-sm font-bold"
                    style={{ color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}
                  >
                    {eq.equipment}
                  </p>
                  <span
                    className="text-[10px] px-2 py-1 rounded-lg font-bold shrink-0"
                    style={{ background: fc.bg, color: fc.color }}
                  >
                    {fc.label}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {eq.items.map((item, ii) => (
                    <p key={ii} className="text-xs text-gray-500 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      {item}
                    </p>
                  ))}
                  {done && (
                    <p className="text-xs text-green-500 font-semibold mt-1">
                      ✓ {new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 完成（{user.name}）
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Save */}
        {!saved ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setSaved(true)}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}
          >
            <Save className="w-4 h-4" />
            儲存 {activeZone} 保養紀錄（{user.name}）
          </motion.button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
            <p className="text-amber-600 font-bold text-sm">✓ {activeZone} 保養紀錄已儲存</p>
            <p className="text-amber-400 text-xs mt-0.5">{new Date().toLocaleTimeString('zh-TW')}・{user.name}</p>
          </div>
        )}
      </div>
    </div>
  )
}
