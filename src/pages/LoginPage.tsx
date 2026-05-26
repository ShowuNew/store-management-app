import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Lock, Store } from 'lucide-react'
import type { User, Role } from '../types'
import { supabase } from '../lib/supabase'
import { logAthParams } from '../lib/ath'

interface Props {
  onLogin: (user: User) => void
}

const loginRoles: Partial<Record<Role, string>> = {
  staff: '店員',
  manager: '店長',
  supervisor: '擔當',
  admin: '系統管理員',
}

const roleLabels: Record<Role, string> = {
  ...loginRoles,
  'sub-manager': '小店長',
} as Record<Role, string>

const FM_GREEN      = '#00a040'
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
  const [role, setRole]           = useState<Role>('staff')
  const [pin, setPin]             = useState('')
  const [error, setError]         = useState('')
  const [checking, setChecking]   = useState(false)

  // step 2 — pick store
  const [step, setStep]               = useState<'login' | 'pick-store'>('login')
  const [storeOptions, setStoreOptions] = useState<{ store_id: string; store_name: string }[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')

  useEffect(() => { logAthParams() }, [])

  const isHQ = role === 'supervisor' || role === 'admin'

  const writeLoginLog = (storeId: string) => {
    supabase.from('login_logs').insert({
      store_id: storeId,
      role,
      user_agent: navigator.userAgent,
    })
  }

  const doLogin = (storeId: string, storeName: string) => {
    writeLoginLog(storeId)
    onLogin({ id: '1', name: roleLabels[role], role, storeId, storeName })
  }

  const handleLogin = async () => {
    if (!isHQ && !/^\d{6}$/.test(storeCode.trim())) {
      setError('店號須為 6 位數字'); return
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('請輸入 4 位數字 PIN 碼'); return
    }

    if (role === 'manager') {
      setChecking(true)
      const { data: linked } = await supabase
        .from('manager_stores')
        .select('managed_store_id, managed_store_name')
        .eq('manager_store_id', storeCode.trim())
      setChecking(false)

      if (linked && linked.length > 0) {
        const { data: ownRow } = await supabase
          .from('stores').select('store_name')
          .eq('store_id', storeCode.trim()).maybeSingle()
        const ownName = ownRow?.store_name ?? `全家 ${storeCode.trim()} 店`

        setStoreOptions([
          { store_id: storeCode.trim(), store_name: ownName },
          ...linked.map((s: any) => ({ store_id: s.managed_store_id, store_name: s.managed_store_name })),
        ])
        setSelectedStoreId(storeCode.trim())
        setStep('pick-store')
        return
      }
    }

    const effectiveStoreId = isHQ ? 'HQ' : storeCode.trim()
    doLogin(effectiveStoreId, isHQ ? '總部管理' : `全家 ${storeCode.trim()} 店`)
  }

  const handlePickStore = () => {
    const selected = storeOptions.find(s => s.store_id === selectedStoreId)
    if (!selected) return
    writeLoginLog(selected.store_id)
    onLogin({
      id: '1', name: roleLabels[role], role,
      storeId: selected.store_id,
      storeName: selected.store_name,
      managedStores: storeOptions,
    })
  }

  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden" style={{ background: '#f4faf6' }}>

      {/* 頂部品牌區 */}
      <div
        className="flex flex-col items-center justify-center px-6 pt-12 pb-8 rounded-b-[40px]"
        style={{ background: FM_GREEN }}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 shadow-xl flex items-center justify-center"
            style={{ background: FM_GREEN_DARK }}>
            <FamilyMartIcon size={38} />
          </div>
          <p className="text-white/70 text-base font-semibold tracking-[0.2em] uppercase mb-1">FamilyMart</p>
          <h1 className="text-2xl font-bold text-white">店鋪工作日誌</h1>
        </motion.div>
      </div>

      {/* 表單區 */}
      <div className="flex-1 px-5 pt-8">
        <AnimatePresence mode="wait">

          {/* ── Step 1：登入 ── */}
          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-sm p-6"
            >
              <div className="h-1 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${FM_GREEN}, ${FM_GREEN_DARK})` }} />
              <h2 className="text-lg font-bold text-gray-800 mb-5">登入帳號</h2>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-base rounded-xl border border-red-100 flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}

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
                    {(Object.entries(loginRoles) as [Role, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 店號 */}
              {!isHQ && (
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
                      placeholder="請輸入店號"
                      maxLength={6}
                      value={storeCode}
                      onChange={e => { setStoreCode(e.target.value.replace(/\D/g, '')); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
              )}

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
                disabled={checking}
                className="w-full rounded-2xl text-white font-bold text-base"
                style={{
                  background: `linear-gradient(135deg, ${FM_GREEN}, ${FM_GREEN_DARK})`,
                  minHeight: '52px',
                  opacity: checking ? 0.7 : 1,
                }}
              >
                {checking ? '驗證中...' : '進入系統'}
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2：選擇門市 ── */}
          {step === 'pick-store' && (
            <motion.div
              key="pick-store"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-sm p-6"
            >
              <div className="h-1 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${FM_GREEN}, ${FM_GREEN_DARK})` }} />

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#f0fdf4' }}>
                  <Store className="w-5 h-5" style={{ color: FM_GREEN }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">選擇操作門市</h2>
                  <p className="text-base text-gray-400">登入帳號：{storeCode}</p>
                </div>
              </div>

              <div className="mb-7">
                <label className="text-base font-semibold text-gray-600 mb-2 block">門市</label>
                <div className="relative border-2 border-gray-100 rounded-2xl px-4 bg-gray-50 focus-within:border-green-400 transition-colors" style={{ minHeight: '52px' }}>
                  <select
                    className="w-full bg-transparent text-base text-gray-800 outline-none appearance-none py-3"
                    style={{ minHeight: '52px' }}
                    value={selectedStoreId}
                    onChange={e => setSelectedStoreId(e.target.value)}
                  >
                    {storeOptions.map(s => (
                      <option key={s.store_id} value={s.store_id}>
                        {s.store_id} {s.store_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('login'); setError('') }}
                  className="flex-1 rounded-2xl font-bold text-base bg-gray-100 text-gray-600"
                  style={{ minHeight: '52px' }}
                >
                  返回
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePickStore}
                  className="flex-1 rounded-2xl text-white font-bold text-base"
                  style={{ background: `linear-gradient(135deg, ${FM_GREEN}, ${FM_GREEN_DARK})`, minHeight: '52px' }}
                >
                  確認進入
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <p className="py-8 text-center text-gray-400 text-base">© 2026 FamilyMart 店鋪工作日誌 v1.0</p>
    </div>
  )
}
