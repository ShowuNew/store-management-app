import type { CSSProperties } from 'react'
import { ArrowUp, Store, ChevronDown } from 'lucide-react'
import type { LayoutProps } from './types'

const BLUE       = '#0ea5e9'
const BLUE_DARK  = '#0284c7'

export default function TabletLayout({
  currentPage, activeTabs, user,
  onNavigate, onOpenStorePicker, showScrollTop, children,
}: LayoutProps) {
  return (
    <div
      className="flex flex-col min-h-dvh bg-gray-50"
      style={{ '--nav-bottom-height': '0px' } as CSSProperties}
    >
      {activeTabs.length > 0 && (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-20 flex flex-col" style={{ height: '57px' }}>
          <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${BLUE}, ${BLUE_DARK})` }} />
          <div className="flex items-stretch flex-1 overflow-hidden">
            <div className="flex-1 flex items-stretch overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {activeTabs.map(({ page, icon: Icon, label }) => {
                const active = currentPage === page
                return (
                  <button
                    key={page}
                    onClick={() => onNavigate(page)}
                    className={`flex items-center gap-1.5 px-4 whitespace-nowrap text-sm font-medium border-b-2 transition-all shrink-0 ${
                      active
                        ? 'border-sky-500 text-sky-700 bg-sky-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
            {user?.managedStores && user.managedStores.length > 1 && (
              <button
                onClick={onOpenStorePicker}
                className="flex items-center gap-1.5 px-3 border-l border-gray-100 text-sky-700 hover:bg-sky-50 transition-all shrink-0"
              >
                <Store className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold max-w-[80px] truncate">{user.storeName}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>
        </header>
      )}

      <main className={`flex-1 min-w-0 ${activeTabs.length > 0 ? 'pt-[57px]' : ''}`}>
        {children}
      </main>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="回到頂端"
          className="fixed right-6 bottom-6 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all"
          style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})` }}
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  )
}
