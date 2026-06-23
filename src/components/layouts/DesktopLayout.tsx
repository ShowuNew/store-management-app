import type { CSSProperties } from 'react'
import { ArrowUp, Store, ChevronDown } from 'lucide-react'
import type { LayoutProps } from './types'

export default function DesktopLayout({
  currentPage, activeTabs, user,
  onNavigate, onOpenStorePicker, showScrollTop, children,
}: LayoutProps) {
  return (
    <div
      data-theme="desktop"
      className="flex min-h-dvh bg-gray-50"
      style={{ '--nav-bottom-height': '0px' } as CSSProperties}
    >
      {activeTabs.length > 0 && (
        <aside className="flex flex-col w-56 fixed inset-y-0 left-0 bg-white border-r border-gray-100 z-20">
          <div className="h-1 w-full shrink-0" style={{ background: 'linear-gradient(90deg, var(--brand), var(--brand-dark))' }} />
          <div className="px-2 py-4 flex-1 flex flex-col gap-0.5 overflow-y-auto">
            {activeTabs.map(({ page, icon: Icon, label }) => {
              const active = currentPage === page
              return (
                <button
                  key={page}
                  onClick={() => onNavigate(page)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full transition-all ${
                    active
                      ? 'bg-green-50 text-green-700 font-semibold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-sm">{label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-600" />}
                </button>
              )
            })}
          </div>
          {user?.managedStores && user.managedStores.length > 1 && (
            <div className="px-2 pb-4 border-t border-gray-100 pt-3">
              <button
                onClick={onOpenStorePicker}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-all"
              >
                <Store className="w-4 h-4 shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs text-green-500">目前門市</p>
                  <p className="text-sm font-semibold truncate">{user.storeName}</p>
                </div>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}
        </aside>
      )}

      <main className={`flex-1 min-w-0 ${activeTabs.length > 0 ? 'ml-56' : ''}`}>
        {children}
      </main>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="回到頂端"
          className="fixed right-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all"
          style={{
            bottom: '16px',
            background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
          }}
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  )
}
