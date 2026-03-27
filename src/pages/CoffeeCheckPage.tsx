import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, CheckCircle2, MapPin, Coffee } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useGeolocation } from '../hooks/useGeolocation'
import type { User } from '../types'

interface Props { user: User; onBack: () => void }

interface DrinkCheck {
  temp:      string   // °C input
  tempOk:    boolean
  weight:    string   // g input
  weightOk:  boolean
}

const defaultDrink = (): DrinkCheck => ({ temp: '', tempOk: true, weight: '', weightOk: true })

export default function CoffeeCheckPage({ user, onBack }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [machineNo, setMachineNo]   = useState('')
  const [medHotSet, setMedHotSet]   = useState<DrinkCheck>(defaultDrink())
  const [medLatte,  setMedLatte]    = useState<DrinkCheck>(defaultDrink())
  const [note,      setNote]        = useState('')
  const [saving,    setSaving]      = useState(false)
  const [saved,     setSaved]       = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [gpsInfo,   setGpsInfo]     = useState<string | null>(null)

  const { getPosition } = useGeolocation()

  const overallOk = medHotSet.tempOk && medHotSet.weightOk && medLatte.tempOk && medLatte.weightOk

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)

    // GPS
    let gpsFields: { gps_lat?: number; gps_lng?: number; gps_accuracy?: number } = {}
    try {
      const pos = await getPosition()
      gpsFields = { gps_lat: pos.lat, gps_lng: pos.lng, gps_accuracy: pos.accuracy }
      setGpsInfo(`±${Math.round(pos.accuracy)} 公尺`)
    } catch {
      setGpsInfo(null)
    }

    const payload = {
      store_id:   user.storeId,
      store_name: user.storeName,
      staff_name: user.name,
      check_date: todayStr,
      machine_no: machineNo.trim(),
      medium_hot_set_temp:      medHotSet.temp !== '' ? parseFloat(medHotSet.temp) : null,
      medium_hot_set_temp_ok:   medHotSet.tempOk,
      medium_hot_set_weight:    medHotSet.weight !== '' ? parseFloat(medHotSet.weight) : null,
      medium_hot_set_weight_ok: medHotSet.weightOk,
      medium_latte_temp:        medLatte.temp !== '' ? parseFloat(medLatte.temp) : null,
      medium_latte_temp_ok:     medLatte.tempOk,
      medium_latte_weight:      medLatte.weight !== '' ? parseFloat(medLatte.weight) : null,
      medium_latte_weight_ok:   medLatte.weightOk,
      overall_ok: overallOk,
      note: note.trim(),
      ...gpsFields,
    }

    const { error } = await supabase.from('coffee_check_records').insert(payload)
    if (error) {
      setSaveError(`儲存失敗：${error.message}`)
      setSaving(false)
      return
    }
    setSaved(true)
    setSaving(false)
  }

  const reset = () => {
    setMachineNo(''); setMedHotSet(defaultDrink()); setMedLatte(defaultDrink())
    setNote(''); setSaved(false); setSaveError(null); setGpsInfo(null)
  }

  // ── 飲品輸入區塊 ──
  const DrinkSection = ({
    label, data, onChange,
  }: {
    label: string
    data: DrinkCheck
    onChange: (d: DrinkCheck) => void
  }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-base font-bold text-gray-700">【{label}】</p>

      {/* 溫度 */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-400 block mb-1">溫度（°C）</label>
          <div className="flex items-center border-2 rounded-xl px-3 py-2 gap-2"
            style={{ borderColor: data.tempOk ? '#86efac' : '#fca5a5', background: data.tempOk ? '#f0fdf4' : '#fef2f2' }}>
            <input
              type="number" inputMode="decimal"
              placeholder="例：77.8"
              value={data.temp}
              onChange={e => onChange({ ...data, temp: e.target.value })}
              className="flex-1 outline-none bg-transparent text-base font-bold text-gray-800"
            />
            <span className="text-base text-gray-400 shrink-0">°C</span>
          </div>
        </div>
        <div className="shrink-0 mt-5">
          <button
            onClick={() => onChange({ ...data, tempOk: !data.tempOk })}
            className="px-4 py-2.5 rounded-xl text-base font-bold border-2 transition-all"
            style={{
              borderColor: data.tempOk ? '#10b981' : '#ef4444',
              background:  data.tempOk ? '#f0fdf4' : '#fef2f2',
              color:       data.tempOk ? '#10b981' : '#ef4444',
            }}
          >
            {data.tempOk ? '✓ 正常' : '✗ 異常'}
          </button>
        </div>
      </div>

      {/* 重量 */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-400 block mb-1">重量（g）</label>
          <div className="flex items-center border-2 rounded-xl px-3 py-2 gap-2"
            style={{ borderColor: data.weightOk ? '#86efac' : '#fca5a5', background: data.weightOk ? '#f0fdf4' : '#fef2f2' }}>
            <input
              type="number" inputMode="decimal"
              placeholder="例：311.9"
              value={data.weight}
              onChange={e => onChange({ ...data, weight: e.target.value })}
              className="flex-1 outline-none bg-transparent text-base font-bold text-gray-800"
            />
            <span className="text-base text-gray-400 shrink-0">g</span>
          </div>
        </div>
        <div className="shrink-0 mt-5">
          <button
            onClick={() => onChange({ ...data, weightOk: !data.weightOk })}
            className="px-4 py-2.5 rounded-xl text-base font-bold border-2 transition-all"
            style={{
              borderColor: data.weightOk ? '#10b981' : '#ef4444',
              background:  data.weightOk ? '#f0fdf4' : '#fef2f2',
              color:       data.weightOk ? '#10b981' : '#ef4444',
            }}
          >
            {data.weightOk ? '✓ 正常' : '✗ 異常'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-gray-50">
      <PageHeader title="咖啡機自檢" subtitle="Coffee Self-Check" onBack={onBack} />

      <div className="px-4 py-4 space-y-4 pb-20">
        {/* 日期 + 店名 */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#fdf4ff' }}>
            <Coffee className="w-5 h-5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">{user.storeName}</p>
            <p className="text-sm text-gray-400">{todayStr}・{user.name}</p>
          </div>
        </div>

        {/* 機號 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-base font-semibold text-gray-500 block mb-2">自檢機號</label>
          <input
            type="text"
            placeholder="例：02"
            value={machineNo}
            onChange={e => setMachineNo(e.target.value)}
            className="w-full text-base font-bold border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-purple-400 bg-gray-50"
          />
        </div>

        {/* 中熱套式 */}
        <DrinkSection label="中熱套式" data={medHotSet} onChange={setMedHotSet} />

        {/* 中熱拿鐵 */}
        <DrinkSection label="中熱拿鐵" data={medLatte}  onChange={setMedLatte}  />

        {/* 整體結論 */}
        <div
          className="rounded-2xl px-4 py-4 text-center font-bold text-base shadow-sm"
          style={{
            background: overallOk ? '#f0fdf4' : '#fef2f2',
            color:      overallOk ? '#16a34a' : '#dc2626',
          }}
        >
          {overallOk ? '✅ 本次自檢無異常' : '⚠️ 本次自檢有異常，請填寫備註'}
        </div>

        {/* 備註 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-base font-semibold text-gray-500 block mb-2">備註（選填）</label>
          <textarea
            rows={3}
            placeholder="異常說明或備注事項..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full text-base border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-purple-400 bg-gray-50 resize-none"
          />
        </div>

        {/* GPS 資訊 */}
        {gpsInfo && (
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-2xl">
            <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-600 font-medium">GPS 定位成功（精度 {gpsInfo}）</p>
          </div>
        )}

        {/* Error */}
        {saveError && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
            <p className="text-red-600 text-base font-semibold">{saveError}</p>
          </div>
        )}

        {/* Save / Done */}
        {!saved ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: saving ? 0.7 : 1 }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'GPS 定位中，儲存中...' : '儲存自檢紀錄'}
          </motion.button>
        ) : (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-5 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
            <p className="text-green-700 font-bold text-base">自檢紀錄已儲存</p>
            {gpsInfo && <p className="text-green-500 text-sm">📍 {gpsInfo}</p>}
            <button onClick={reset} className="text-base text-green-500 underline">新增另一筆</button>
          </div>
        )}
      </div>
    </div>
  )
}
