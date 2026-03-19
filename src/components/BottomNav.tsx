import { Home, ClipboardCheck, ShieldCheck, AlertTriangle, Wrench, ClipboardList } from 'lucide-react'
import type { Page } from '../types'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const tabs = [
  { page: 'dashboard'  as Page, icon: Home,          label: '首頁' },
  { page: 'daily-work' as Page, icon: ClipboardCheck, label: '每日' },
  { page: 'hygiene'    as Page, icon: ShieldCheck,    label: '衛生' },
  { page: 'inspection' as Page, icon: ClipboardList,  label: '點檢' },
  { page: 'anomaly'    as Page, icon: AlertTriangle,  label: '異常' },
  { page: 'equipment'  as Page, icon: Wrench,         label: '設備' },
]

export default function BottomNav({ currentPage, onNavigate }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-100 z-20">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map(({ page, icon: Icon, label }) => {
          const active = currentPage === page
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="flex flex-col items-center gap-0.5 flex-1 py-2.5 transition-all min-h-[52px] justify-center relative"
              style={{ color: active ? '#005f3b' : '#9ca3af' }}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-green-700" />
              )}
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-xs font-medium leading-tight">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
