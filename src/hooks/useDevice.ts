import { useState, useEffect } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

const TABLET_MQ  = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
const DESKTOP_MQ = window.matchMedia('(min-width: 1024px)')

function getDevice(): DeviceType {
  if (DESKTOP_MQ.matches) return 'desktop'
  if (TABLET_MQ.matches)  return 'tablet'
  return 'mobile'
}

export function useDevice(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(getDevice)

  useEffect(() => {
    const onChange = () => setDevice(getDevice())
    TABLET_MQ.addEventListener('change', onChange)
    DESKTOP_MQ.addEventListener('change', onChange)
    return () => {
      TABLET_MQ.removeEventListener('change', onChange)
      DESKTOP_MQ.removeEventListener('change', onChange)
    }
  }, [])

  return device
}
