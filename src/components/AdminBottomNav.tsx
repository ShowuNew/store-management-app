import type { ReactNode } from 'react'
import { LayoutDashboard, ClipboardList, AlertTriangle, BarChart2 } from 'lucide-react'
import type { Page } from '../types'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const tabs: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'admin-dashboard', label: '總覽',     icon: <LayoutDashboard className="w-5 h-5" /> },
  { page: 'admin-records',   label: '紀錄查閱', icon: <ClipboardList   className="w-5 h-5" /> },
  { page: 'admin-anomaly',   label: '異常管理', icon: <AlertTriangle   className="w-5 h-5" /> },
  { page: 'admin-stats',     label: '數據統計', icon: <BarChart2       className="w-5 h-5" /> },
]

export default function AdminBottomNav({ currentPage, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-30">
      <div className="flex">
        {tabs.map(({ page, label, icon }) => {
          const active = currentPage === page
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative transition-colors"
              style={{ color: active ? '#005f3b' : '#9ca3af' }}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-green-600" />
              )}
              {icon}
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
