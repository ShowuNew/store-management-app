import { useState } from 'react'
import { motion } from 'framer-motion'
import { Store, ChevronDown, Lock } from 'lucide-react'
import type { User, Role } from '../types'

interface Props {
  onLogin: (user: User) => void
}

const roleLabels: Record<Role, string> = {
  staff: '店員',
  manager: '店長',
  supervisor: '督導',
  admin: '系統管理員',
}

// FamilyMart 品牌色
const FM_GREEN = '#00a040'
const FM_GREEN_DARK = '#007d30'

export default function LoginPage({ onLogin }: Props) {
  const [storeCode, setStoreCode] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (!storeCode.trim()) {
      setError('請輸入店號')
      return
    }
    onLogin({
      id: '1',
      name: roleLabels[role],
      role,
      storeId: storeCode.trim(),
      storeName: `全家 ${storeCode.trim()} 店`,
    })
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white">

      {/* 頂部品牌區 */}
      <div className="flex flex-col items-center justify-center px-6 pt-14 pb-10"
        style={{ background: FM_GREEN }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          {/* Logo 雙色塊 */}
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg overflow-hidden flex border-2 border-white/30">
            <div className="flex-1 h-full flex items-center justify-center" style={{ background: '#fff' }}>
              <div className="w-4 h-8 rounded-sm" style={{ background: FM_GREEN }} />
            </div>
            <div className="flex-1 h-full flex items-center justify-center" style={{ background: '#007d30' }}>
              <div className="w-4 h-8 rounded-sm bg-white/80" />
            </div>
          </div>
          <p className="text-white/80 text-xs font-medium tracking-widest uppercase mb-1">FamilyMart</p>
          <h1 className="text-xl font-bold text-white">店鋪工作日誌</h1>
        </motion.div>
      </div>

      {/* 圓角銜接 */}
      <div className="h-6 rounded-t-3xl -mt-3 bg-white z-10 relative" />

      {/* 表單區 */}
      <div className="flex-1 px-6 -mt-3">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className="text-lg font-bold text-gray-800 mb-6">登入帳號</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2">
              <span className="text-base">⚠️</span> {error}
            </div>
          )}

          {/* 店號 */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">店號</label>
            <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-3.5 gap-3 bg-gray-50 focus-within:border-green-400 transition-colors"
              style={{ '--tw-border-opacity': 1 } as React.CSSProperties}>
              <Store className="w-4 h-4 shrink-0" style={{ color: FM_GREEN }} />
              <input
                type="text"
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-300"
                placeholder="請輸入店號（如 101234）"
                value={storeCode}
                onChange={e => { setStoreCode(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          {/* 身份 */}
          <div className="mb-8">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">身份</label>
            <div className="relative border-2 border-gray-100 rounded-2xl px-4 py-3.5 bg-gray-50 focus-within:border-green-400 transition-colors">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: FM_GREEN }} />
              <select
                className="w-full bg-transparent text-sm text-gray-800 outline-none appearance-none pl-6"
                value={role}
                onChange={e => setRole(e.target.value as Role)}
              >
                {(Object.entries(roleLabels) as [Role, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-md shadow-green-200"
            style={{ background: `linear-gradient(135deg, ${FM_GREEN}, ${FM_GREEN_DARK})` }}
          >
            進入系統
          </motion.button>
        </motion.div>
      </div>

      <p className="pb-8 text-center text-gray-300 text-xs">© 2026 FamilyMart 店鋪工作日誌 v1.0</p>
    </div>
  )
}
