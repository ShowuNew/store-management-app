import { ArrowLeft, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  onLogout?: () => void
  rightElement?: React.ReactNode
}

export default function PageHeader({ title, subtitle, onBack, onLogout, rightElement }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!onBack) return
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [onBack])

  return (
    <>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        {/* FamilyMart 品牌綠色頂條 */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #00a040, #007d30)' }} />
        <div className="flex items-center px-4 py-3.5">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="返回"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 mr-3 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0.5 leading-snug line-clamp-2">{subtitle}</p>
            )}
          </div>
          {rightElement}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="登出"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 ml-2 shrink-0"
            >
              <LogOut className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* 浮動返回鍵 — 往下滾超過 80px 才出現，方便單手操作 */}
      {onBack && scrolled && (
        <button
          onClick={onBack}
          aria-label="返回"
          className="fixed z-30 flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-sm font-bold text-gray-700 transition-all"
          style={{
            bottom: '84px',   // 底部 nav (64px) + 間距
            left: '16px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      )}
    </>
  )
}
