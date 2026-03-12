import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Award } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Result = 'pass' | 'fail' | 'na' | null

interface ItemData { no: number; description: string; maxScore: number; result: Result }
interface CategoryData { name: string; items: ItemData[] }

const initCategories: CategoryData[] = [
  {
    name: '一、設備管理',
    items: [
      { no: 1,  description: '咖啡機：機台排出廢水口及濾膜清潔乾淨，並確認廢水桶有無溢出',           maxScore: 3, result: null },
      { no: 2,  description: '溫藏機台台面/POP不可遮擋擋風口',                                    maxScore: 3, result: null },
      { no: 3,  description: '所有冷藏冰箱/冷凍冰箱不可有結霜或有凝結水',                          maxScore: 3, result: null },
      { no: 4,  description: '淨水設備每個月定期更換並填寫維護記錄',                               maxScore: 3, result: null },
      { no: 5,  description: '洗手台之皂液備品充足且使用狀況良好',                                 maxScore: 3, result: null },
    ],
  },
  {
    name: '二、環境清潔',
    items: [
      { no: 6,  description: '廁所清潔乾淨，並貼有「如廁後請洗手」標示，且不可存放食品',           maxScore: 3, result: null },
      { no: 7,  description: '倉庫後場（包含倉庫、WI）保持乾燥，不可有病媒及其蹤跡',              maxScore: 5, result: null },
      { no: 8,  description: '包材收納區域整齊乾淨，未使用包材放開口朝下（防止灰塵不缺失）',       maxScore: 3, result: null },
      { no: 9,  description: '賣場食品類商品不可落地，使用防災式棧板',                             maxScore: 3, result: null },
    ],
  },
  {
    name: '三、商品管理',
    items: [
      { no: 10, description: '倉庫貨架須設置明確標示「下架貨架專區」，標示清楚分類',               maxScore: 3, result: null },
      { no: 11, description: '如有過期商品須設置明確標示「報廢專區」，或明顯標示「過期品」',        maxScore: 3, result: null },
      { no: 12, description: '開封管理：FF食材（含霜淇淋餅皮等）應使用密封夾「密封」保存',         maxScore: 3, result: null },
      { no: 13, description: '開封/解凍之FF保鮮材料須標示「開封/解凍日期」及「有效日期」',         maxScore: 3, result: null },
      { no: 14, description: '已拆封的餅皮若放置於餅皮存放盒，須密封保存且在有效期內',             maxScore: 3, result: null },
    ],
  },
]

export default function InspectionPage({ user, onBack }: Props) {
  const [cats, setCats] = useState<CategoryData[]>(initCategories)
  const [openCat, setOpenCat] = useState<number | null>(0)

  const setResult = (ci: number, ii: number, result: Result) =>
    setCats(p => p.map((c, cIdx) =>
      cIdx === ci
        ? { ...c, items: c.items.map((item, iIdx) => iIdx === ii ? { ...item, result } : item) }
        : c
    ))

  const allItems = cats.flatMap(c => c.items)
  const totalMax    = allItems.reduce((s, i) => s + i.maxScore, 0)
  const totalActual = allItems.reduce((s, i) => i.result === 'pass' || i.result === 'na' ? s + i.maxScore : s, 0)
  const percent = Math.round(totalActual / totalMax * 100)
  const pass = percent >= 80

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="店鋪點檢表" subtitle="115年度店鋪綜合評分稽查" onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Score banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-white"
          style={{ background: pass ? 'linear-gradient(135deg,#004d30,#00a86b)' : 'linear-gradient(135deg,#7f1d1d,#dc2626)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs mb-1">目前得分</p>
              <p className="text-5xl font-black">{totalActual}<span className="text-xl font-normal">/{totalMax}</span></p>
              <p className="text-white/80 text-sm mt-1">{pass ? '✓ 合格（80分以上）' : '✗ 不合格（未達80分）'}</p>
            </div>
            <div className="w-20 h-20 rounded-full border-4 border-white/30 flex flex-col items-center justify-center">
              <Award className="w-5 h-5 mb-0.5 text-white/70" />
              <span className="text-2xl font-black">{percent}%</span>
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${percent}%` }} />
          </div>
        </motion.div>

        {/* Accordions */}
        {cats.map((cat, ci) => {
          const catActual = cat.items.reduce((s, i) => i.result === 'pass' || i.result === 'na' ? s + i.maxScore : s, 0)
          const catMax    = cat.items.reduce((s, i) => s + i.maxScore, 0)
          const isOpen    = openCat === ci

          return (
            <div key={ci} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenCat(isOpen ? null : ci)}
                className="w-full flex items-center px-4 py-4 gap-3"
              >
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-gray-800">{cat.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">已得 {catActual}/{catMax} 分</p>
                </div>
                <span className="text-sm font-black text-amber-500">{catActual}分</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-100">
                      {cat.items.map((item, ii) => (
                        <div key={ii} className="px-4 py-3.5 border-b border-gray-50 last:border-0">
                          <div className="flex gap-2 mb-3">
                            <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 flex items-center justify-center shrink-0 mt-0.5">
                              {item.no}
                            </span>
                            <p className="text-xs text-gray-600 leading-relaxed flex-1">{item.description}</p>
                          </div>
                          <div className="flex gap-2 ml-7">
                            {(['pass', 'fail', 'na'] as const).map(r => (
                              <button
                                key={r}
                                onClick={() => setResult(ci, ii, r)}
                                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                                style={{
                                  background: item.result === r
                                    ? r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#6b7280'
                                    : r === 'pass' ? '#f0fdf4' : r === 'fail' ? '#fef2f2' : '#f9fafb',
                                  color: item.result === r ? 'white'
                                    : r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#9ca3af',
                                }}
                              >
                                {r === 'pass' ? '符合' : r === 'fail' ? '缺失' : 'N/A'}
                              </button>
                            ))}
                            <span className="px-2 py-2 text-[11px] text-amber-500 font-black">{item.maxScore}分</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        <button
          className="w-full py-4 rounded-2xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }}
        >
          提交點檢結果（{user.role === 'supervisor' ? '督導' : user.name}簽署）
        </button>
      </div>
    </div>
  )
}
