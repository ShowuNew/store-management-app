export type Role = 'staff' | 'manager' | 'sub-manager' | 'supervisor' | 'admin'

export type Page =
  | 'login'
  | 'dashboard'
  | 'daily-work'
  | 'hygiene'
  | 'inspection'
  | 'anomaly'
  | 'equipment'
  | 'stats'
  | 'admin-dashboard'
  | 'admin-records'
  | 'admin-anomaly'
  | 'admin-stats'
  | 'mystery-manage'
  | 'sub-manager-manage'
  | 'coffee-check'
  | 'c15-check'
  | 'admin-store-status'

export interface User {
  id: string
  name: string
  role: Role
  storeId: string
  storeName: string
}
