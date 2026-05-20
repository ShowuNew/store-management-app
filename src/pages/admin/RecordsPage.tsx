import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ChevronDown, ChevronUp, Store, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface Props { user: User; onBack: () => void }

type Tab = 'daily-work' | 'hygiene' | 'equipment' | 'coffee-check' | 'c15-check'

export default function RecordsPage({ user, onBack }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const isManagerView = user.role === 'manager' || user.role === 'sub-manager'
  const [tab, setTab]           = useState<Tab>('daily-work')
  const [date, setDate]         = useState(todayStr)
  const [storeFilter, setStoreFilter] = useState(isManagerView ? user.storeId : '')
  const [records, setRecords]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [storeOptions, setStoreOptions] = useState<string[]>([])

  // 載入所有曾出現過的門市代號供下拉選擇
  useEffect(() => {
    const fetchStores = async () => {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from('daily_work_logs').select('store_id'),
        supabase.from('hygiene_records').select('store_id'),
        supabase.from('equipment_logs').select('store_id'),
        supabase.from('coffee_check_records').select('store_id'),
        supabase.from('c15_records').select('store_id'),
      ])
      const all = [
        ...(r1.data || []),
        ...(r2.data || []),
        ...(r3.data || []),
        ...(r4.data || []),
        ...(r5.data || []),
      ].map((r: any) => r.store_id).filter(Boolean)
      setStoreOptions([...new Set(all)].sort())
    }
    fetchStores()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setExpanded(null)

      let query: any
      if (tab === 'daily-work') {
        query = supabase.from('daily_work_logs').select('*').eq('log_date', date).order('submitted_at', { ascending: false })
      } else if (tab === 'hygiene') {
        query = supabase.from('hygiene_records').select('*').eq('record_date', date).order('saved_at', { ascending: false })
      } else if (tab === 'equipment') {
        query = supabase.from('equipment_logs').select('*').eq('log_date', date).order('saved_at', { ascending: false })
      } else if (tab === 'c15-check') {
        query = supabase.from('c15_records').select('*').eq('record_date', date).order('saved_at', { ascending: false })
      } else {
        query = supabase.from('coffee_check_records').select('*').eq('check_date', date).order('created_at', { ascending: false })
      }

      if (storeFilter.trim()) query = query.eq('store_id', storeFilter.trim())

      const { data } = await query
      setRecords(data || [])
      setLoading(false)
    }
    load()
  }, [tab, date, storeFilter])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily-work',    label: '每日工作' },
    { key: 'hygiene',       label: '衛生記錄' },
    { key: 'equipment',     label: '設備保養' },
    { key: 'coffee-check',  label: '咖啡自檢' },
    { key: 'c15-check',     label: 'C15確認'  },
  ]

  const getDoneCount = (record: any): string => {
    if (tab === 'daily-work') {
      const done = Object.values(record.tasks_done || {}).filter(Boolean).length
      return `${done} 項完成`
    }
    if (tab === 'hygiene') {
      const pass = Object.values(record.results || {}).filter(v => v === 'pass').length
      const fail = Object.values(record.results || {}).filter(v => v === 'fail').length
      return `${pass} 符合 / ${fail} 缺失`
    }
    if (tab === 'coffee-check') {
      return record.overall_ok ? '✓ 無異常' : '⚠ 有異常'
    }
    if (tab === 'c15-check') {
      const done = Object.values(record.results || {}).filter(Boolean).length
      return `${done}/${c15Categories.length} 分類確認`
    }
    const done = Object.values(record.done_items || {}).filter(Boolean).length
    return `${done} 項完成`
  }

  const getTimestamp = (record: any): string => {
    const ts = record.submitted_at || record.saved_at || record.created_at
    if (!ts) return '—'
    return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  const getSubtitle = (record: any): string => {
    if (tab === 'daily-work') return record.shift
    if (tab === 'hygiene')    return `${record.shift} 班`
    if (tab === 'coffee-check') return record.machine_no ? `機號 ${record.machine_no}` : '咖啡機'
    if (tab === 'c15-check') return `${record.shift} 班`
    return record.zone
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} aria-label="返回" className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-900">紀錄查閱</h1>
            <p className="text-base text-gray-400">{isManagerView ? user.storeName : '跨門市提交紀錄'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 min-w-[4.5rem] py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: tab === t.key ? '#005f3b' : '#f3f4f6', color: tab === t.key ? 'white' : '#6b7280' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none"
          />
          {!isManagerView && (
            <div className="relative">
              <select
                value={storeFilter}
                onChange={e => setStoreFilter(e.target.value)}
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 bg-gray-50 outline-none appearance-none pr-7"
              >
                <option value="">全部門市</option>
                {storeOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-2 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-base">載入中...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <ClipboardListIcon />
            <p className="text-base mt-3">查無資料</p>
          </div>
        ) : (
          records.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-800 truncate">{r.store_id}</span>
                    <span className="text-base text-gray-400 shrink-0">{getSubtitle(r)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base text-green-600 font-semibold">{getDoneCount(r)}</span>
                    <span className="text-base text-gray-400">・{r.staff_name} ・{getTimestamp(r)}</span>
                  </div>
                </div>
                {expanded === r.id
                  ? <ChevronUp   className="w-4 h-4 text-gray-300 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />
                }
              </button>

              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-50"
                  >
                    <DetailView record={r} tab={tab} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

function ClipboardListIcon() {
  return (
    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

const hygieneCategories = [
  {
    name: '場所衛生環境',
    items: [
      '營業場所保持清潔，不得有納垢、剝落、積灰、積水等情形',
      '出入口應通風良好、保持清潔無異味，並設置防蟲設施，無病媒出沒痕跡',
      '廁所應保持清潔、無不良氣味，並備有洗潔劑、乾手器或擦手紙巾',
      '洗手接觸面應保持平滑、無凹陷或裂縫，並保持清潔',
    ],
  },
  {
    name: '衛生品質管理',
    items: [
      '食品接觸面應保持平滑、無凹陷或裂縫，並保持清潔',
      '清洗、清潔和消毒機具應專用器具妥善保管',
      '使用之原料應符合相關食品衛生標準或規定，並可追溯來源',
      '食品應分開貯放，不得直接置於地面，並依先進先出使用，且在有效日期內使用',
      '冷凍 -18°C 以下；冷藏 7°C 以下；溫藏 65°C 以上（溫度計功能正常）',
      '食品設備、器具及抹布等，使用前後應確認其清潔，並定期有效消毒',
    ],
  },
  {
    name: '從業人員衛生管理',
    items: [
      '從業人員每年定期健康檢查（含工讀生）',
      '從業人員應穿戴整潔之工作衣，與食品直接接觸者，手部不得佩戴飾物或留指甲，或配戴清潔之手套',
      '從業人員手部應保持清潔，並應於進入食品作業場所前、如廁後正確洗手或消毒',
      '作業人員工作中不得有吸菸、嚼檳榔或飲食及其他可能污染食品之行為',
      '私人及清潔用具等以明標（區）統一收置',
    ],
  },
  {
    name: '菸害防制',
    items: [
      '所有入口處應設置明顯禁菸標示，且不得供應與菸品相關聯物，無吸菸行為人',
      '不供應菸品予未滿 20 歲者，且不得販售菸品形狀之糖果、點心、玩具或其他任何物品',
      '不促銷菸品或菸品廣告',
      '不可將菸盒代替隔熱紙夾付消費者使用，違反者店鋪將處 10～50 萬不等罰鍰',
      '菸品或菸品容器之展示，應以使消費者獲知菸品品牌及價格之必要者為限',
      '應於明顯處標示「吸菸有害健康」、「免費戒菸專線 0800-636363」等法定警示圖文',
    ],
  },
]

const c15Categories = [
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

function CheckDot({ done }: { done: boolean }) {
  return (
    <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${done ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
      {done && <span className="text-white text-xs leading-none">✓</span>}
    </span>
  )
}

function OkBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-sm font-bold px-2 py-0.5 rounded-md ${ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
      {ok ? '正常' : '異常'}
    </span>
  )
}

function DetailView({ record, tab }: { record: any; tab: Tab }) {
  if (tab === 'coffee-check') {
    const rows: { label: string; value: string | number | null; ok?: boolean }[] = [
      { label: '中熱套式 溫度', value: record.medium_hot_set_temp != null ? `${record.medium_hot_set_temp} °C` : '—', ok: record.medium_hot_set_temp_ok },
      { label: '中熱套式 重量', value: record.medium_hot_set_weight != null ? `${record.medium_hot_set_weight} g` : '—', ok: record.medium_hot_set_weight_ok },
      { label: '中熱拿鐵 溫度', value: record.medium_latte_temp != null ? `${record.medium_latte_temp} °C` : '—', ok: record.medium_latte_temp_ok },
      { label: '中熱拿鐵 重量', value: record.medium_latte_weight != null ? `${record.medium_latte_weight} g` : '—', ok: record.medium_latte_weight_ok },
    ]
    return (
      <div className="px-4 py-3 space-y-3">
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-base text-gray-500">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-700">{row.value}</span>
                {row.ok !== undefined && <OkBadge ok={row.ok} />}
              </div>
            </div>
          ))}
        </div>
        {record.note ? (
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1">備註</p>
            <p className="text-base text-gray-600 whitespace-pre-line">{record.note}</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span className="text-base text-gray-400">整體結論</span>
          <OkBadge ok={record.overall_ok} />
        </div>
      </div>
    )
  }

  if (tab === 'daily-work') {
    const td       = record.tasks_done || {}
    const waste    = td._waste    || {}
    const cleaning = td._cleaning || {}
    const friendly = td._friendly || {}
    const uniform  = td._uniform  || {}
    const signed   = !!td._signature
    const mgrSigned = !!td._manager_signature

    const friendlyKeys: { key: string; label: string }[] = [
      { key: 't0930', label: '友善食光貼標（09:30）' },
      { key: 't1600', label: '過期品下架（16:00）' },
      { key: 't2000', label: '鮮食效期確認（20:00）' },
    ]

    return (
      <div className="px-4 py-3 space-y-4">
        {/* 廢棄物 */}
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">廢棄物處理</p>
          <div className="space-y-1">
            {[
              { label: '廚餘袋數', value: waste.foodWasteBags ?? '—' },
              { label: '資源回收箱數', value: waste.recyclingCount ?? '—' },
              { label: '廚餘完成時間', value: waste.leftoverFoodTime || '—' },
              { label: '集杯完成時間', value: waste.cupCollectionTime || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-base text-gray-500">{label}</span>
                <span className="text-base font-semibold text-gray-700">{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <CheckDot done={!!waste.verified} />
              <span className="text-base text-gray-600">確認廢棄物數量</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckDot done={!!waste.groundCleaning} />
              <span className="text-base text-gray-600">戶外地面清潔</span>
            </div>
          </div>
        </div>

        {/* 設備清潔 */}
        {Object.keys(cleaning).length > 0 && (
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">設備清潔</p>
            <div className="space-y-1">
              {Object.entries(cleaning).map(([machine, time]) => (
                <div key={machine} className="flex items-center justify-between">
                  <span className="text-base text-gray-500">{machine}</span>
                  <span className="text-base font-semibold text-gray-700">{(time as string) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 友善食光 */}
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">友善食光 / 過期品下架</p>
          <div className="space-y-1">
            {friendlyKeys.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <CheckDot done={!!friendly[key]} />
                <span className="text-base text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 儀容衛生 */}
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">儀容與衛生</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><CheckDot done={!!uniform.appearance} /><span className="text-base text-gray-600">服裝儀容合規</span></div>
            <div className="flex items-center gap-2"><CheckDot done={!!uniform.sanitize} /><span className="text-base text-gray-600">手部清潔消毒</span></div>
          </div>
        </div>

        {/* 簽名 */}
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">簽名確認</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><CheckDot done={signed} /><span className="text-base text-gray-600">班次員工簽名</span></div>
            <div className="flex items-center gap-2"><CheckDot done={mgrSigned} /><span className="text-base text-gray-600">店長簽名</span></div>
          </div>
        </div>

        {/* 交接備注 */}
        {record.handover_note && (
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.08em] mb-1">交接備注</p>
            <p className="text-base text-gray-600 whitespace-pre-line">{record.handover_note}</p>
          </div>
        )}
      </div>
    )
  }

  if (tab === 'hygiene') {
    return (
      <div className="px-4 py-3 space-y-3">
        {hygieneCategories.map((cat, ci) => (
          <div key={ci}>
            <p className="text-base font-bold text-gray-400 mb-1.5">{cat.name}</p>
            <div className="space-y-1">
              {cat.items.map((item, ii) => {
                const key = `${ci}-${ii}`
                const result = record.results?.[key]
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-base text-gray-600 flex-1 truncate">{item}</span>
                    <span className={`text-base font-bold px-2 py-0.5 rounded-md ml-2 shrink-0 ${
                      result === 'pass' ? 'bg-green-50 text-green-600' :
                      result === 'fail' ? 'bg-red-50 text-red-500' : 'text-gray-300'
                    }`}>
                      {result === 'pass' ? '符合' : result === 'fail' ? '缺失' : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'c15-check') {
    return (
      <div className="px-4 py-3 space-y-2">
        {c15Categories.map((cat, ci) => {
          const done = !!record.results?.[`${ci}`]
          return (
            <div key={ci} className="flex items-start gap-3 py-1.5">
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${done ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                {done && <span className="text-white text-xs leading-none">✓</span>}
              </span>
              <div className="flex-1">
                <p className={`text-base font-bold ${done ? 'text-green-700' : 'text-gray-500'}`}>{cat.name}</p>
                <div className="mt-0.5 space-y-0.5">
                  {cat.items.map((item, ii) => (
                    <p key={ii} className="text-sm text-gray-400 leading-relaxed">• {item}</p>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // equipment
  const doneItems = record.done_items || {}
  const allKeys = Object.keys(doneItems)
  return (
    <div className="px-4 py-3">
      <p className="text-base font-bold text-gray-400 mb-2">區域：{record.zone}</p>
      {allKeys.length === 0 ? (
        <p className="text-base text-gray-400">無項目記錄</p>
      ) : (
        <div className="space-y-1">
          {allKeys.map(key => (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${doneItems[key] ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                {doneItems[key] && <span className="text-white text-xs leading-none">✓</span>}
              </span>
              <span className="text-base text-gray-600">{key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
