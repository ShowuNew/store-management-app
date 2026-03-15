import { Home, ClipboardCheck, ShieldCheck, AlertTriangle, Wrench, ClipboardList } from 'lucide-react'
import type { Page } from '../types'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const tabs = [
  { page: 'dashboard'  as Page, icon: Home,          label: '首頁'   },
  { page: 'daily-work' as Page, icon: ClipboardCheck, label: '每日確認' },
  { page: 'hygiene'    as Page, icon: ShieldCheck,    label: '衛生管理' },
  { page: 'inspection' as Page, icon: ClipboardList,  label: '店鋪點檢' },
  { page: 'anomaly'    as Page, icon: AlertTriangle,  label: '異常回報' },
  { page: 'equipment'  as Page, icon: Wrench,         label: '設備保養' },
]

export default function BottomNav({ currentPage, onNavigate }: Props) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-20">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map(({ page, icon: Icon, label }) => {
          const active = currentPage === page
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition-all min-h-[52px] justify-center"
              style={{ color: active ? '#00a86b' : '#9ca3af' }}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
              {active && (
                <span className="w-1 h-1 rounded-full" style={{ background: '#00a86b' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
