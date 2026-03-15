import { ArrowLeft, LogOut } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  onLogout?: () => void
  rightElement?: React.ReactNode
}

export default function PageHeader({ title, subtitle, onBack, onLogout, rightElement }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
      {/* FamilyMart 品牌綠色頂條 */}
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #00a040, #007d30)' }} />
    <div className="flex items-center px-4 py-3.5">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 mr-3 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-gray-800 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {rightElement}
      {onLogout && (
        <button
          onClick={onLogout}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 ml-2 shrink-0"
        >
          <LogOut className="w-5 h-5 text-gray-500" />
        </button>
      )}
    </div>
    </div>
  )
}
