import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Award, AlertTriangle, Save } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

type Result = 'pass' | 'fail' | 'na' | null

interface ItemData {
  no: number
  description: string
  maxScore: number
  isCritical?: boolean   // ★ 缺失則總分歸零
  isImportant?: boolean  // ★ 重點項目（僅標示）
  result: Result
}
interface CategoryData { name: string; items: ItemData[] }

const initCategories: CategoryData[] = [
  {
    name: '一、業務保養紀錄',
    items: [
      { no: 1,  description: '每月機器業務保養清潔保養有執行紀錄，每月完表留存「附6-店鋪衛生自主管理表」', maxScore: 3, result: null },
      { no: 2,  description: '店鋪衛生自主管理表登錄完整；機台溫度異常時應於30分鐘內通報，再次確認', maxScore: 3, result: null },
    ],
  },
  {
    name: '二、清潔用品管理',
    items: [
      { no: 3,  description: '使用清潔用品須貼「清潔用品專區」標籤，專區內須乾淨且無穢塵', maxScore: 3, result: null },
      { no: 4,  description: '清潔用品及機器用品須置放洗手台下方，且清潔放料用具須設置專屬容器（防：水壺、內桶、量杯等）', maxScore: 3, result: null },
      { no: 5,  description: '機器及清盤等設備，食品用與非食品用清潔刷分開擺放（食品用清潔刷置一側，非食品用另置一側）', maxScore: 3, result: null },
      { no: 6,  description: '清潔用品及周邊環境須乾淨，無蒼蠅、蚊蟲及蟑螂等病媒', maxScore: 3, result: null },
    ],
  },
  {
    name: '三、重點機台管理',
    items: [
      { no: 7,  description: '【咖啡機】機台及周邊環境（含出料口、乙粉樽罐圈、咖啡機底層等）：須乾淨，無蒼蠅、蚊蟲及蟑螂等病媒', maxScore: 5, result: null },
      { no: 8,  description: '【咖啡機】清洗後的周邊備品（含5000S牛奶清潔盒等）：須乾淨無奶垢，保存位置清潔，無交叉污染之虞', maxScore: 3, result: null },
      { no: 9,  description: '【咖啡機】咖啡豆槽無明顯油垢殘留', maxScore: 3, result: null },
      { no: 10, description: '【咖啡機】牛奶冰箱：孔洞須洗乾淨且無奶垢', maxScore: 3, result: null },
      { no: 11, description: '【咖啡機】咖啡業務用奶：使用制式咖啡業務用奶，目前僅可拆封一瓶（封膜開啟不超過 1/2）', maxScore: 3, result: null },
      { no: 12, description: '【霜淇淋機台】機台及周邊（含出料口、滴水盤、後排氣出風口等）應清潔乾淨；若出料口有料，須以酒精紙巾擦拭，並確認「異常淇淋比例磁鐵」在位', maxScore: 3, result: null },
      { no: 13, description: '【FF機台】FF區所有機台（含備品架）及周邊環境：乾淨且無蒼蠅及蟑螂等病媒', maxScore: 3, result: null },
      { no: 14, description: '【熱狗機台】下方使用制式熱狗機吸油紙，並貼有「加熱」及「保溫」貼紙，加熱刻度符合設定', maxScore: 3, result: null },
      { no: 15, description: '【溫層機台】各溫層機台（含水果陳列籃）保持乾淨無明顯髒汙／發霉等現象，且不可有蒼蠅、蟑螂等病媒', maxScore: 5, isImportant: true, result: null },
      { no: 16, description: '【溫層機台】各溫層機台商品或 POP 不可遮擋迴風口', maxScore: 3, result: null },
      { no: 17, description: '【機台設施】所有冷藏冰箱／冷凍冰櫃（含咖啡機小冰箱等）不可有結霜或嚴重結露', maxScore: 3, result: null },
      { no: 18, description: '【機台設施】臥式冰櫃商品陳列不可超過截線', maxScore: 3, result: null },
    ],
  },
  {
    name: '四、設施／設備管理',
    items: [
      { no: 19, description: '【淨水設備】大白熊（濾心）：每 2 個月定期更新，並填寫紀錄表（使用 RO 過濾機者不在此限）', maxScore: 3, result: null },
      { no: 20, description: '【淨水設備】過濾水出水管口：乾淨無發霉狀況', maxScore: 3, result: null },
      { no: 21, description: '【洗手台】有洗手台之處（客用／自用）皆須張貼制式洗手步驟標示於洗手台附近顯處，且洗手台保持乾淨', maxScore: 3, result: null },
      { no: 22, description: '【倉庫】店鋪後場（包含倉庫、WI）要保持乾淨，不可有病媒及其蹤跡', maxScore: 5, result: null },
      { no: 23, description: '【廁所】廁所（客用／自用）：應乾淨、無明顯異味，並須張貼「如廁後應洗手」標示，且不可存放食品', maxScore: 3, result: null },
      { no: 24, description: '【包材】賣場包材（碗／杯／蓋等）：擺放開口朝下（置於自助區抽屜不記缺失），放置周圍乾淨，且包材不可過期', maxScore: 3, result: null },
      { no: 25, description: '【包材】未使用之庫存包材（碗／杯／蓋等）：要封口以避免異物混入', maxScore: 3, result: null },
    ],
  },
  {
    name: '五、商品管理',
    items: [
      { no: 26, description: '【存放】賣場食品類商品不可落地，需使用制式棧板', maxScore: 3, result: null },
      { no: 27, description: '【存放】倉庫貨架商品須把食品、非食品分開放置（明顯區隔），食品類商品不可落地，需墊高離地（不限定制式棧板，但不可使用紙箱）', maxScore: 3, result: null },
      { no: 28, description: '【存放】商品庫存需依設定溫層存放（解凍商品應置於冷藏區）', maxScore: 3, result: null },
      { no: 29, description: '【下架專區】倉庫須專區設置並明確標示「下架退貨專區」（活力箱或有蓋塑膠箱），分常溫、冷藏、冷凍三溫層放置', maxScore: 3, result: null },
      { no: 30, description: '【下架專區】過期商品須專區標示「報廢專區」或明顯標示「過期品」；已 Key loss 過期鮮食與一般食品，須拆袋破壞包裝，置於廚餘桶（袋）內', maxScore: 3, result: null },
      { no: 31, description: '【開封管理】FF 已開封庫存物料（含霜淇淋餅皮等）應使用密封棒「密封」保存（不得使用橡皮筋、訂書針、迴紋針、膠帶等）；咖啡豆僅可使用拉滑式密封棒封口；已拆封餅皮若放置餅皮存放盒，鎖扣蓋緊且外盒無破損', maxScore: 3, result: null },
      { no: 32, description: '【標示】開封／解凍之 FF 原料須標示「開封／解凍日期」及「有效日期」；已拆封的餅皮若放置餅皮存放盒，需於容器上註明有效日期並「密封」保存', maxScore: 3, result: null },
      { no: 33, description: '【過期品】賣場及倉庫的食品無過期（含咖啡業務用奶、溫藏商品、霜淇淋霜料〔含未貼效期貼紙〕、解凍商品、備品〔醬包等〕）', maxScore: 5, isCritical: true, result: null },
    ],
  },
]

const todayStr = new Date().toISOString().split('T')[0]

export default function InspectionPage({ user, onBack }: Props) {
  const [cats, setCats] = useState<CategoryData[]>(initCategories)
  const [openCat, setOpenCat] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [existingId, setExistingId] = useState<string | null>(null)

  // 載入今日既有紀錄
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('inspection_logs')
        .select('*')
        .eq('store_id', user.storeId)
        .eq('inspect_date', todayStr)
        .single()
      if (data) {
        setExistingId(data.id)
        setCats(data.categories)
      }
    }
    load()
  }, [user.storeId])

  const setResult = (ci: number, ii: number, result: Result) => {
    setCats(p => p.map((c, cIdx) =>
      cIdx === ci
        ? { ...c, items: c.items.map((item, iIdx) => iIdx === ii ? { ...item, result } : item) }
        : c
    ))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    const payload = {
      store_id:       user.storeId,
      staff_name:     user.name,
      inspect_date:   todayStr,
      categories:     cats,
      total_score:    totalScore,
      passed:         pass,
      critical_failed: criticalFailed,
      saved_at:       new Date().toISOString(),
    }
    let err = null
    if (existingId) {
      const res = await supabase.from('inspection_logs').update(payload).eq('id', existingId)
      err = res.error
    } else {
      const res = await supabase.from('inspection_logs').insert(payload).select().single()
      err = res.error
      if (res.data) setExistingId(res.data.id)
    }
    setSaving(false)
    if (err) { setSaveError(err.message); return }
    setSaved(true)
  }

  const allItems      = cats.flatMap(c => c.items)
  const criticalFailed = allItems.some(i => i.isCritical && i.result === 'fail')
  const totalDeducted  = allItems.reduce((s, i) => i.result === 'fail' ? s + i.maxScore : s, 0)
  const totalScore     = criticalFailed ? 0 : Math.max(0, 100 - totalDeducted)
  const pass           = !criticalFailed && totalScore >= 80

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="店鋪點檢表" subtitle="115年度店鋪綜合評分稽查" onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Score banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-white"
          style={{
            background: criticalFailed
              ? 'linear-gradient(135deg,#1f2937,#374151)'
              : pass
              ? 'linear-gradient(135deg,#004d30,#00a86b)'
              : 'linear-gradient(135deg,#7f1d1d,#dc2626)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs mb-1">
                {criticalFailed ? '⚠ 重點項目缺失' : '目前得分'}
              </p>
              <p className="text-5xl font-black">
                {totalScore}<span className="text-xl font-normal">/100</span>
              </p>
              <p className="text-white/80 text-sm mt-1">
                {criticalFailed
                  ? '★ 第33項（過期品）缺失 → 總分歸零'
                  : pass ? '✓ 合格（80分以上）' : '✗ 不合格（未達80分）'}
              </p>
            </div>
            <div className="w-20 h-20 rounded-full border-4 border-white/30 flex flex-col items-center justify-center">
              <Award className="w-5 h-5 mb-0.5 text-white/70" />
              <span className="text-2xl font-black">{totalScore}</span>
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${totalScore}%` }} />
          </div>
          <p className="text-white/50 text-[10px] mt-2">計分方式：倒扣制（滿分100），缺失項目扣對應分數；★第33項缺失則總分歸零</p>
        </motion.div>

        {criticalFailed && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">★ 重點項目缺失警告</p>
              <p className="text-xs text-red-500 mt-0.5">第 33 項「過期品」標記為缺失，依規定本次點檢總分歸零。</p>
            </div>
          </div>
        )}

        {/* Accordions */}
        {cats.map((cat, ci) => {
          const catDeducted = cat.items.reduce((s, i) => i.result === 'fail' ? s + i.maxScore : s, 0)
          const catMax      = cat.items.reduce((s, i) => s + i.maxScore, 0)
          const isOpen      = openCat === ci

          return (
            <div key={ci} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenCat(isOpen ? null : ci)}
                className="w-full flex items-center px-4 py-4 gap-3"
              >
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-gray-800">{cat.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {catDeducted > 0 ? `扣 ${catDeducted} 分` : '無扣分'} ／ 配分共 {catMax} 分
                  </p>
                </div>
                <span className="text-sm font-black shrink-0" style={{ color: catDeducted > 0 ? '#ef4444' : '#10b981' }}>
                  {catDeducted > 0 ? `-${catDeducted}分` : '全符合'}
                </span>
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
                        <div
                          key={ii}
                          className={`px-4 py-3.5 border-b border-gray-50 last:border-0 ${
                            item.isCritical ? 'bg-red-50/60' : item.isImportant ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <div className="flex gap-2 mb-3">
                            <span
                              className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                item.isCritical
                                  ? 'bg-red-100 text-red-600'
                                  : item.isImportant
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {item.isCritical || item.isImportant ? '★' : item.no}
                            </span>
                            <div className="flex-1">
                              {item.isCritical && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1 bg-red-100 text-red-600">
                                  ★重點（缺失→總分歸零）
                                </span>
                              )}
                              {item.isImportant && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1 bg-amber-100 text-amber-600">
                                  ★重點
                                </span>
                              )}
                              <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{item.description}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-8">
                            {(['pass', 'fail', 'na'] as const).map(r => (
                              <button
                                key={r}
                                onClick={() => setResult(ci, ii, r)}
                                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                                style={{
                                  background: item.result === r
                                    ? r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#6b7280'
                                    : r === 'pass' ? '#f0fdf4'  : r === 'fail' ? '#fef2f2'  : '#f9fafb',
                                  color: item.result === r
                                    ? 'white'
                                    : r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#9ca3af',
                                }}
                              >
                                {r === 'pass' ? '符合' : r === 'fail' ? '缺失' : 'N/A'}
                              </button>
                            ))}
                            <span className="px-2 py-2 text-[11px] text-amber-500 font-black shrink-0">
                              {item.maxScore}分
                            </span>
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

        {saveError && (
          <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100">
            ⚠️ 儲存失敗：{saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: saved ? 'linear-gradient(135deg,#00a040,#007d30)' : 'linear-gradient(135deg,#8b5cf6,#a78bfa)' }}
        >
          <Save className="w-4 h-4" />
          {saving ? '儲存中...' : saved ? '已儲存 ✓' : `提交點檢結果（${user.role === 'supervisor' ? '督導' : user.name}簽署）`}
        </button>
      </div>
    </div>
  )
}
