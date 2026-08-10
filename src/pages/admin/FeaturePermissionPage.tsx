// DB table required (Supabase):
//
// CREATE TABLE group_permissions (
//   id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   group_name    text NOT NULL,
//   feature_code  text NOT NULL,
//   is_enabled    boolean NOT NULL DEFAULT true,
//   updated_at    timestamptz DEFAULT now(),
//   updated_by    text,
//   UNIQUE (group_name, feature_code)
// );
//
// See seed SQL at bottom of this file comment block.

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import type { User } from '../../types'

interface Props {
  user: User
  onBack: () => void
}

const GROUPS = [
  { key: 'sat_group',        label: 'SAT 平板',    icon: '📋', desc: '店員 — 門市現場工作填報' },
  { key: 'manager_group',    label: '全管家 App',  icon: '🏪', desc: '店長 / 小店長 — 管理與查閱' },
  { key: 'supervisor_group', label: '全家人 App',  icon: '🗺️', desc: '擔當 — 跨店巡查管理' },
  { key: 'admin_group',      label: 'WEB 後台',    icon: '🖥️', desc: '管理員 — 系統管理全功能' },
]

const FEATURES = [
  { code: 'daily_work',         name: '每日工作確認',         cat: '員工填報' },
  { code: 'work_items',         name: '工作項目填寫',         cat: '員工填報' },
  { code: 'hygiene',            name: '衛生管理紀錄',         cat: '員工填報' },
  { code: 'equipment',          name: '設備管理紀錄',         cat: '員工填報' },
  { code: 'coffee_check',       name: '咖啡機清潔確認',       cat: '員工填報' },
  { code: 'c15_check',          name: 'C15 確認',             cat: '員工填報' },
  { code: 'inspection',         name: '門市盤點',             cat: '員工填報' },
  { code: 'anomaly_report',     name: '異常回報（含拍照）',   cat: '員工填報' },
  { code: 'anomaly_manage',     name: '異常管理（處理/結案）', cat: '管理功能' },
  { code: 'store_status',       name: '門市狀態總覽',         cat: '管理功能' },
  { code: 'records_single',     name: '歷史紀錄（單店）',     cat: '管理功能' },
  { code: 'records_cross',      name: '歷史紀錄（跨店）',     cat: '管理功能' },
  { code: 'stats_single',       name: '統計報表（單店月報）', cat: '管理功能' },
  { code: 'stats_cross',        name: '統計報表（跨店）',     cat: '管理功能' },
  { code: 'sub_manager_manage', name: '副店長管理',           cat: '管理功能' },
  { code: 'mystery_manage',     name: '神秘客管理',           cat: '系統管理' },
  { code: 'supervisor_import',  name: '督導輪區匯入',         cat: '系統管理' },
  { code: 'feature_click_rank', name: '功能點擊排行',         cat: '系統管理' },
  { code: 'permission_setting', name: '權限設定',             cat: '系統管理' },
]

const CATS = ['員工填報', '管理功能', '系統管理']

export default function FeaturePermissionPage({ onBack }: Props) {
  const [selectedGroup, setSelectedGroup] = useState('sat_group')
  const [perms, setPerms]   = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const load = useCallback(async (group: string) => {
    setLoading(true)
    setSaved(false)
    const { data } = await supabase
      .from('group_permissions')
      .select('feature_code, is_enabled')
      .eq('group_name', group)
    setLoading(false)
    if (!data) return
    setPerms(Object.fromEntries(data.map(r => [r.feature_code, r.is_enabled])))
  }, [])

  useEffect(() => { load(selectedGroup) }, [selectedGroup, load])

  const toggle = (code: string) => {
    setPerms(prev => ({ ...prev, [code]: !prev[code] }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const rows = FEATURES.map(f => ({
      group_name:   selectedGroup,
      feature_code: f.code,
      is_enabled:   perms[f.code] ?? false,
      updated_at:   new Date().toISOString(),
    }))
    await supabase
      .from('group_permissions')
      .upsert(rows, { onConflict: 'group_name,feature_code' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const currentGroup = GROUPS.find(g => g.key === selectedGroup)!
  const enabledCount = FEATURES.filter(f => perms[f.code]).length

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="功能權限設定" subtitle="各群組功能開關管理" onBack={onBack} />

      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-28">

        {/* Group selector */}
        <div className="grid grid-cols-2 gap-2">
          {GROUPS.map(g => (
            <button
              key={g.key}
              onClick={() => setSelectedGroup(g.key)}
              className={`rounded-2xl p-3 text-left transition-all border-2 ${
                selectedGroup === g.key
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-lg">{g.icon}</span>
                <span className={`text-sm font-bold ${selectedGroup === g.key ? 'text-green-700' : 'text-gray-700'}`}>
                  {g.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-7">{g.desc}</p>
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
            <span className="text-sm text-gray-500">
              已開放 <span className="font-bold text-green-600">{enabledCount}</span> / {FEATURES.length} 項功能
            </span>
            <span className="text-xs text-gray-400">{currentGroup.label}</span>
          </div>
        )}

        {/* Feature toggles */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">載入中...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {CATS.map(cat => {
              const items = FEATURES.filter(f => f.cat === cat)
              return (
                <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map(f => {
                      const enabled = perms[f.code] ?? false
                      return (
                        <div key={f.code} className="flex items-center justify-between px-4 py-3.5">
                          <span className={`text-sm font-medium ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                            {f.name}
                          </span>
                          <button
                            onClick={() => toggle(f.code)}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                              enabled ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-10">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: saved ? '#16a34a' : 'linear-gradient(135deg, var(--brand), var(--brand-dark))' }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />儲存中...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" />已儲存</>
            ) : (
              `儲存「${currentGroup.label}」設定`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
