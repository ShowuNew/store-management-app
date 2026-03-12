import { useState } from 'react'
import { motion } from 'framer-motion'
import { Store, Lock, User as UserIcon, ChevronDown } from 'lucide-react'
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
  const [employeeNo, setEmployeeNo] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!storeCode || !employeeNo || !password) {
      setError('請填寫所有欄位')
      return
    }
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    onLogin({
      id: '1',
      name: employeeNo === 'A001' ? '阿澤' : employeeNo === 'A002' ? '宏名' : '店員',
      role,
      storeId: storeCode,
      storeName: `全家 ${storeCode} 店`,
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
          <h2 className="text-lg font-bold text-gray-800 mb-5">登入帳號</h2>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {[
            { label: '店鋪編號', icon: Store, value: storeCode, setter: setStoreCode, placeholder: '請輸入店鋪編號（如 101234）', type: 'text' },
            { label: '員工編號', icon: UserIcon, value: employeeNo, setter: setEmployeeNo, placeholder: '請輸入員工編號', type: 'text' },
            { label: '密碼', icon: Lock, value: password, setter: setPassword, placeholder: '請輸入密碼', type: 'password' },
          ].map(({ label, icon: Icon, value, setter, placeholder, type }) => (
            <div className="mb-4" key={label}>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{label}</label>
              <div className="flex items-center border border-gray-200 rounded-2xl px-4 py-3 gap-3 bg-gray-50 focus-within:border-green-400 transition-colors">
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type={type}
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-300"
                  placeholder={placeholder}
                  value={value}
                  onChange={e => setter(e.target.value)}
                />
              </div>
            </div>
          ))}

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
            disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-opacity"
            style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00a86b, #00d47e)', opacity: loading ? 0.8 : 1 }}
          >
            {loading ? '登入中...' : '登入'}
          </motion.button>

          <p className="text-center text-xs text-gray-300 mt-4">測試帳號：任意店鋪編號 + 員工編號 A001 + 任意密碼</p>
        </motion.div>
      </div>

      <p className="pb-8 text-center text-green-300 text-xs">© 2026 便利商店管理系統 v1.0</p>
    </div>
  )
}
