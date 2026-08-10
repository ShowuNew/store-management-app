import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Role } from '../types'

type PermMap = Record<string, boolean>

const PermissionContext = createContext<PermMap>({})

const roleToGroup: Record<Role, string> = {
  staff:          'sat_group',
  manager:        'manager_group',
  'sub-manager':  'manager_group',
  supervisor:     'supervisor_group',
  admin:          'admin_group',
}

export function PermissionProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const [permMap, setPermMap] = useState<PermMap>({})

  useEffect(() => {
    const group = roleToGroup[role]
    supabase
      .from('group_permissions')
      .select('feature_code, is_enabled')
      .eq('group_name', group)
      .then(({ data }) => {
        if (!data) return
        setPermMap(Object.fromEntries(data.map(p => [p.feature_code, p.is_enabled])))
      })
  }, [role])

  return <PermissionContext.Provider value={permMap}>{children}</PermissionContext.Provider>
}

export const usePermissions = () => useContext(PermissionContext)
