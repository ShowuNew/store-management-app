import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Lock } from 'lucide-react'
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

const FM_GREEN = '#00a040'
const FM_GREEN_DARK = '#007d30'

function FamilyMartIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,8 95,42 5,42" fill="#fff" />
      <rect x="62" y="14" width="10" height="18" fill="#fff" />
      <rect x="14" y="42" width="72" height="50" fill="#fff" />
      <rect x="38" y="62" width="24" height="30" rx="12" fill={FM_GREEN} />
      <rect x="20" y="50" width="14" height="14" rx="3" fill={FM_GREEN} />
      <rect x="66" y="50" width="14" height="14" rx="3" fill={FM_GREEN} />
    </svg>
  )
}

export default function LoginPage({ onLogin }: Props) {
  const [storeCode, setStoreCode] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (!storeCode.trim()) {
      setError('請輸入店號')
      return
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('請輸入 4 位數字 PIN 碼')
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
    <div className="min-h-dvh flex flex-col" style={{ background: '#f4faf6' }}>

      {/* 頂部品牌區 */}
      <div
        className="flex flex-col items-center justify-center px-6 pt-16 pb-16 rounded-b-[40px]"
        style={{ background: FM_GREEN }}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-xl flex items-center justify-center"
            style={{ background: FM_GREEN_DARK }}>
            <FamilyMartIcon size={52} />
          </div>
          <p className="text-white/70 text-base font-semibold tracking-[0.2em] uppercase mb-1">FamilyMart</p>
          <h1 className="text-2xl font-bold text-white">店鋪工作日誌</h1>
        </motion.div>
      </div>

      {/* 表單區 */}
      <div className="flex-1 px-5 pt-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white rounded-3xl shadow-sm p-6"
        >
          <div className="h-1 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${FM_GREEN}, ${FM_GREEN_DARK})` }} />

          <h2 className="text-lg font-bold text-gray-800 mb-5">登入帳號</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-base rounded-xl border border-red-100 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* 店號 */}
          <div className="mb-4">
            <label className="text-base font-semibold text-gray-600 mb-2 block">店號</label>
            <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 bg-gray-50 focus-within:border-green-400 transition-colors" style={{ minHeight: '52px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FM_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mr-3">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 bg-transparent text-base text-gray-800 outline-none placeholder-gray-300 py-3"
                placeholder="請輸入店號（如 101234）"
                value={storeCode}
                onChange={e => { setStoreCode(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          {/* 身份 */}
          <div className="mb-4">
            <label className="text-base font-semibold text-gray-600 mb-2 block">身份</label>
            <div className="relative border-2 border-gray-100 rounded-2xl px-4 bg-gray-50 focus-within:border-green-400 transition-colors" style={{ minHeight: '52px' }}>
              <select
                className="w-full bg-transparent text-base text-gray-800 outline-none appearance-none py-3 h-full"
                style={{ minHeight: '52px' }}
                value={role}
                onChange={e => setRole(e.target.value as Role)}
              >
                {(Object.entries(roleLabels) as [Role, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* PIN 碼 */}
          <div className="mb-7">
            <label className="text-base font-semibold text-gray-600 mb-2 block">PIN 碼</label>
            <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 bg-gray-50 focus-within:border-green-400 transition-colors" style={{ minHeight: '52px' }}>
              <Lock className="w-[18px] h-[18px] shrink-0 mr-3" style={{ color: FM_GREEN }} />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="flex-1 bg-transparent text-base text-gray-800 outline-none placeholder-gray-300 py-3 tracking-[0.4em]"
                placeholder="• • • •"
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <span className="text-base text-gray-300 shrink-0">{pin.length}/4</span>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            className="w-full rounded-2xl text-white font-bold text-base"
            style={{
              background: `linear-gradient(135deg, ${FM_GREEN}, ${FM_GREEN_DARK})`,
              minHeight: '52px',
            }}
          >
            進入系統
          </motion.button>
        </motion.div>
      </div>

      <p className="py-8 text-center text-gray-400 text-base">© 2026 FamilyMart 店鋪工作日誌 v1.0</p>
    </div>
  )
}
