export type Role = 'staff' | 'manager' | 'supervisor' | 'admin'

export type Page =
  | 'login'
  | 'dashboard'
  | 'daily-work'
  | 'hygiene'
  | 'inspection'
  | 'anomaly'
  | 'equipment'

export interface User {
  id: string
  name: string
  role: Role
  storeId: string
  storeName: string
}
