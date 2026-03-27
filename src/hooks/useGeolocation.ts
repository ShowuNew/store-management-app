import { useState, useCallback } from 'react'

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const getPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      setLoading(true)
      setError(null)
      if (!navigator.geolocation) {
        const msg = '此裝置不支援 GPS'
        setError(msg); setLoading(false); reject(new Error(msg)); return
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const geo: GeoPosition = {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setPosition(geo); setLoading(false); resolve(geo)
        },
        err => {
          const msg = err.code === 1 ? '已拒絕位置存取授權' : 'GPS 定位失敗，請確認裝置定位設定'
          setError(msg); setLoading(false); reject(new Error(msg))
        },
        { timeout: 10000, enableHighAccuracy: true }
      )
    })
  }, [])

  return { position, error, loading, getPosition }
}
