// DB tables required (Supabase):
//
// CREATE TABLE supervisors (
//   employee_id VARCHAR(20) PRIMARY KEY,
//   name        VARCHAR(100) NOT NULL,
//   pin         VARCHAR(4) NOT NULL,
//   active      BOOLEAN DEFAULT true,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE supervisor_store_assignments (
//   id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
//   supervisor_employee_id VARCHAR(20) REFERENCES supervisors(employee_id) ON DELETE CASCADE,
//   store_id               VARCHAR(10) NOT NULL,
//   store_name             VARCHAR(100) NOT NULL,
//   valid_date             DATE NOT NULL,
//   imported_at            TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(supervisor_employee_id, store_id, valid_date)
// );

import { useState, useRef } from 'react'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import type { User } from '../../types'

interface Props {
  user: User
  onBack: () => void
}

interface Row {
  supervisorId: string
  storeId: string
  storeName: string
}

export default function SupervisorImportPage({ onBack }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: number; err: number } | null>(null)
  const [parseError, setParseError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): Row[] => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
    const parsed: Row[] = []
    for (const line of lines) {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',')
      if (cols.length < 3) continue
      const [supervisorId, storeId, storeName] = cols.map(c => c.trim().replace(/^"|"$/g, ''))
      if (supervisorId === '擔當編號' || supervisorId === 'employee_id') continue
      if (!supervisorId || !storeId || !storeName) continue
      parsed.push({ supervisorId, storeId, storeName })
    }
    return parsed
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setParseError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) { setParseError('找不到有效資料，請確認欄位為：擔當編號、店號、店名'); return }
        setRows(parsed)
      } catch {
        setParseError('檔案解析失敗')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    if (!rows.length || !date) return
    setImporting(true)
    setResult(null)

    const supervisorIds = [...new Set(rows.map(r => r.supervisorId))]
    await supabase
      .from('supervisor_store_assignments')
      .delete()
      .in('supervisor_employee_id', supervisorIds)
      .eq('valid_date', date)

    const payload = rows.map(r => ({
      supervisor_employee_id: r.supervisorId,
      store_id: r.storeId,
      store_name: r.storeName,
      valid_date: date,
    }))

    const { error } = await supabase.from('supervisor_store_assignments').insert(payload)
    setImporting(false)
    setResult({ ok: error ? 0 : rows.length, err: error ? rows.length : 0 })
  }

  const bySuper = rows.reduce<Record<string, Row[]>>((acc, r) => {
    acc[r.supervisorId] = [...(acc[r.supervisorId] ?? []), r]
    return acc
  }, {})

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="輪區匯入" subtitle="每日擔當轄區店鋪對應" onBack={onBack} />

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-2">匯入日期</p>
          <input
            type="date"
            className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-base text-gray-800 bg-gray-50 outline-none focus:border-green-400"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-2">CSV 檔案</p>
          <p className="text-xs text-gray-400 mb-3">欄位順序：擔當編號、店號、店名（逗號或 Tab 分隔）</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span>{fileName || '點此選擇檔案'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
          {parseError && <p className="mt-2 text-sm text-red-500">{parseError}</p>}
        </div>

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-3">預覽（共 {rows.length} 筆，{Object.keys(bySuper).length} 位擔當）</p>
            <div className="space-y-3">
              {Object.entries(bySuper).map(([supId, supRows]) => (
                <div key={supId}>
                  <p className="text-xs font-bold text-gray-600 mb-1">擔當 {supId}（{supRows.length} 間店）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {supRows.map(r => (
                      <span key={r.storeId} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                        {r.storeId} {r.storeName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${result.err > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            {result.err > 0
              ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              : <CheckCircle2  className="w-5 h-5 text-green-600 shrink-0" />
            }
            <p className={`text-sm font-semibold ${result.err > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {result.err > 0 ? '匯入失敗，請重試' : `成功匯入 ${result.ok} 筆`}
            </p>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!rows.length || importing}
          className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))' }}
        >
          {importing ? '匯入中...' : `確認匯入 ${date}`}
        </button>
      </div>
    </div>
  )
}
