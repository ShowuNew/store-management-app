export interface MysterySession {
  id: string
  token: string
  store_id: string
  store_name: string
  created_by: string
  created_at: string
  expires_at: string
  submitted_at?: string
  status: 'pending' | 'completed' | 'expired'
  form_data?: MysteryFormData
  total_score?: number
  visit_notes?: string
}

export type MysteryFormData = Record<string, { score: number; note: string }>

export interface ScoreDef {
  key: string
  label: string
  desc: string
  max: number
}

export const SCORE_SECTIONS: { title: string; items: ScoreDef[] }[] = [
  {
    title: '形象服務',
    items: [
      { key: 's1_1', label: '1-1 入店招呼', desc: '門市人員立即說「您好」，展現友善與熱情的服務態度', max: 10 },
      { key: 's1_2', label: '1-2 制服',     desc: '依公司規定穿著制服，名牌位置正確，文字清楚', max: 8 },
      { key: 's1_3', label: '1-3 儀態',     desc: '站姿端正，動作得體，展現良好服務儀態', max: 6 },
      { key: 's1_4', label: '1-4 儀容',     desc: '頭髮整潔、面容乾淨、手部整潔、無飾物違規', max: 6 },
      { key: 's2',   label: '2  形象整體滿意度', desc: '【專業規定】服務人員整體形象與氣質展現', max: 20 },
    ],
  },
  {
    title: '基本服務',
    items: [
      { key: 's3_1', label: '3-1 語術確認（開門問候）',    desc: '針對單筆購買超過指定金額，主動提示集點/優惠資訊', max: 3 },
      { key: 's3_2', label: '3-2 語術確認（商品推薦）',    desc: '針對購買商品，主動推薦相關優惠或加購商品', max: 6 },
      { key: 's3_3', label: '3-3 結帳語術（集點確認）',    desc: '主動詢問顧客是否有集點卡/會員卡', max: 6 },
      { key: 's3_4', label: '3-4 結帳語術（通知金額）',    desc: '清楚告知消費金額，並確認顧客了解', max: 6 },
      { key: 's3_5', label: '3-5 付款方式（確認找零）',    desc: '確認付款方式，找零或刷卡金額正確告知', max: 6 },
      { key: 's3_6', label: '3-6 結帳語術（發票/贈品）',   desc: '主動告知發票號碼/贈品/保存期限等資訊', max: 6 },
      { key: 's3_7', label: '3-7 結帳語術（道謝送客）',    desc: '結帳完成後說「謝謝」「歡迎再來」等送客語術', max: 8 },
    ],
  },
  {
    title: '衛生安全',
    items: [
      { key: 's4_1', label: '4-1 安全衛生確認', desc: '店內環境整潔，走道無障礙物，安全無虞', max: 2 },
      { key: 's4_2', label: '4-2 商品陳列整齊', desc: '商品陳列整齊，標價清楚，無過期商品', max: 5 },
    ],
  },
  {
    title: '進階服務',
    items: [
      { key: 's5',   label: '5   訴求滿意度整體',   desc: '服務人員積極詳細提供推薦及結帳流程確認，整體滿意度', max: 60 },
      { key: 's6_1', label: '6-1 活動推薦應援',     desc: '主動介紹當期促銷活動或新品', max: 5 },
      { key: 's6_2', label: '6-2 服務熱忱',         desc: '展現積極、有溫度的服務態度', max: 2 },
      { key: 's6_3', label: '6-3 需求確認/服務',    desc: '主動確認顧客需求，提供完整服務', max: 3 },
      { key: 's6_s', label: '6-s 回購意願',         desc: '顧客整體回購意願評估', max: 1 },
    ],
  },
  {
    title: '差異化',
    items: [
      { key: 'sS',  label: 'S  銷售加分', desc: '超出標準的主動銷售行為或特別優良表現', max: 8 },
      { key: 'sQC', label: 'QC 稽查指數', desc: '整體稽查品質與服務規範符合度', max: 9 },
    ],
  },
]

export const MAX_TOTAL = SCORE_SECTIONS.reduce(
  (sum, sec) => sum + sec.items.reduce((s, it) => s + it.max, 0),
  0,
)
