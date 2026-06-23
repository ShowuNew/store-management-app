import type { CSSProperties } from 'react'
import { ArrowUp, Store } from 'lucide-react'
import BottomNav, { managerBottomTabs } from '../BottomNav'
import AdminBottomNav from '../AdminBottomNav'
import type { LayoutProps } from './types'

export default function MobileLayout({
  currentPage, activeTabs, isAdminNav, isManager, user,
  onNavigate, onOpenStorePicker, showScrollTop, children,
}: LayoutProps) {
  const showAdminBottomNav = isAdminNav
  const showBottomNav = !isAdminNav && activeTabs.length > 0

  return (
    <div
      className="flex min-h-dvh bg-gray-50"
      style={{ '--nav-bottom-height': '64px' } as CSSProperties}
    >
      <main className="flex-1 min-w-0">
        <div className={activeTabs.length > 0 ? 'pb-16' : ''}>
          {children}
        </div>
      </main>

      {showBottomNav && (
        <BottomNav
          currentPage={currentPage}
          onNavigate={onNavigate}
          tabs={isManager ? managerBottomTabs : undefined}
        />
      )}
      {showAdminBottomNav && (
        <AdminBottomNav currentPage={currentPage} onNavigate={onNavigate} />
      )}

      {user?.managedStores && user.managedStores.length > 1 && showBottomNav && (
        <button
          onClick={onOpenStorePicker}
          aria-label="切換門市"
          className="fixed left-4 z-40 flex items-center gap-1.5 px-3 h-10 rounded-full shadow-lg bg-white border border-green-200 text-green-700 transition-all"
          style={{ bottom: '76px' }}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold max-w-[80px] truncate">{user.storeName}</span>
        </button>
      )}

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="回到頂端"
          className="fixed right-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all"
          style={{
            bottom: (showBottomNav || showAdminBottomNav) ? '76px' : '16px',
            background: 'linear-gradient(135deg, #00a040, #007d30)',
          }}
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  )
}
