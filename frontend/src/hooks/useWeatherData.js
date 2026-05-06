import { useState, useEffect, useCallback } from 'react'

const API = '/api'

export function useWeatherData(pollInterval = 15000) {
  const [weather, setWeather]   = useState([])
  const [alerts, setAlerts]     = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [connected, setConnected]   = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [wRes, aRes] = await Promise.all([
        fetch(`${API}/weather`),
        fetch(`${API}/alerts`),
      ])
      if (!wRes.ok || !aRes.ok) throw new Error('API error')
      const [wData, aData] = await Promise.all([wRes.json(), aRes.json()])
      setWeather(wData)
      setAlerts(aData)
      setLastUpdate(new Date())
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, pollInterval)
    return () => clearInterval(id)
  }, [fetchAll, pollInterval])

  return { weather, alerts, lastUpdate, connected }
}
