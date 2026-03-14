import { useState } from 'react'
import { motion } from 'framer-motion'
import { Store, ChevronDown } from 'lucide-react'
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
    <div className="min-h-dvh flex flex-col" style={{ background: 'linear-gradient(160deg, #004d30 0%, #00a86b 60%, #00d47e 100%)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Store className="w-10 h-10" style={{ color: '#00a86b' }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">店鋪管理系統</h1>
          <p className="text-green-200 text-sm mt-1">便利商店數位化管理平台</p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="w-full bg-white rounded-3xl shadow-2xl p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-5">請選擇身份</h2>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* 店號 */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">店號</label>
            <div className="flex items-center border border-gray-200 rounded-2xl px-4 py-3 gap-3 bg-gray-50 focus-within:border-green-400 transition-colors">
              <Store className="w-4 h-4 text-gray-400 shrink-0" />
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
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">身份</label>
            <div className="relative border border-gray-200 rounded-2xl px-4 py-3 bg-gray-50">
              <select
                className="w-full bg-transparent text-sm text-gray-800 outline-none appearance-none"
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
            className="w-full py-4 rounded-2xl text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #00a86b, #00d47e)' }}
          >
            進入系統
          </motion.button>
        </motion.div>
      </div>

      <p className="pb-8 text-center text-green-300 text-xs">© 2026 便利商店管理系統 v1.0</p>
    </div>
  )
}
