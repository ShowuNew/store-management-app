import type { ComponentType, ReactNode } from 'react'
import type { User, Page } from '../../types'

export interface TabDef {
  page: Page
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
}

export interface LayoutProps {
  currentPage: Page
  activeTabs: TabDef[]
  isAdminNav: boolean
  isManager: boolean
  user: User
  onNavigate: (page: Page) => void
  onOpenStorePicker: () => void
  showScrollTop: boolean
  children: ReactNode
}
