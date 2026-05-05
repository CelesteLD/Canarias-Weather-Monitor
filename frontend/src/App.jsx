import React, { useState } from 'react'
import { useWeatherData } from './hooks/useWeatherData'
import CanariasMap from './components/CanariasMap'
import IslandPanel from './components/IslandPanel'
import AlertFeed from './components/AlertFeed'

export default function App() {
  const { weather, alerts, lastUpdate, connected } = useWeatherData(15000)
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [mode, setMode] = useState('weather') // 'weather' | 'air'

  const selectedData = weather.find(w => w.island === selectedIsland) || null

  const weatherCounts = { 0: 0, 1: 0, 2: 0 }
  weather.forEach(w => { if (w.alert_level !== undefined) weatherCounts[w.alert_level]++ })

  const airAlerts = alerts.filter(a => a.air_alerts?.length > 0)
  const activeAlerts = mode === 'air'
    ? weather.flatMap(w => (w.air_alerts || []).map(msg => ({ island: w.island, message: msg, level: w.air_alert_level, timestamp: w.timestamp })))
    : alerts

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        padding: '18px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(12,20,36,0.95)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌊</div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>Canarias Weather Monitor</div>
            <div style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>Spark Structured Streaming · Tiempo Real</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

          {/* Toggle modo */}
          <div style={{
            display: 'flex', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 3,
          }}>
            {[
              { key: 'weather', icon: '🌤️', label: 'Meteorología' },
              { key: 'air',     icon: '🌫️', label: 'Calidad del Aire' },
            ].map(({ key, icon, label }) => (
              <button key={key} onClick={() => setMode(key)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                background: mode === key ? (key === 'air' ? '#4a044e' : '#0c4a6e') : 'transparent',
                color: mode === key ? (key === 'air' ? '#e879f9' : '#38bdf8') : 'var(--muted)',
                border: mode === key ? `1px solid ${key === 'air' ? '#a21caf' : '#0369a1'}` : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Contadores (solo en modo meteorológico) */}
          {mode === 'weather' && [
            { level: 2, label: 'Peligro', color: 'var(--red)',    bg: 'var(--red-glow)' },
            { level: 1, label: 'Avisos',  color: 'var(--yellow)', bg: 'var(--yellow-glow)' },
            { level: 0, label: 'Normal',  color: 'var(--green)',  bg: 'var(--green-glow)' },
          ].map(({ level, label, color, bg }) => (
            <div key={level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', borderRadius: 8, background: bg, border: `1px solid ${color}22` }}>
              <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20 }}>{weatherCounts[level]}</span>
              <span style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}

          {/* Estado conexión */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 6px ${connected ? 'var(--green)' : 'var(--red)'}`, animation: 'blink 2s ease-in-out infinite' }} />
            <span style={{ color: 'var(--muted)', fontSize: 10 }}>
              {connected ? `LIVE · ${lastUpdate?.toLocaleTimeString('es-ES') || ''}` : 'DESCONECTADO'}
            </span>
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <main style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gridTemplateRows: '1fr auto', gap: 1, overflow: 'hidden' }}>

        {/* Mapa */}
        <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 4px', color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Archipiélago Canario — {mode === 'air' ? 'Calidad del Aire' : 'Nivel de Alerta Meteorológica'}
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: '0 16px' }}>
            <CanariasMap
              weather={weather}
              selectedIsland={selectedIsland}
              onSelectIsland={setSelectedIsland}
              mode={mode}
            />
          </div>
          <div style={{ padding: '4px 16px 6px', color: 'var(--muted)', fontSize: 10, textAlign: 'center' }}>
            Haz clic en una isla · Scroll para zoom
          </div>

          {/* Barra de resumen */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weather.map(w => {
              const val   = mode === 'air' ? w.aqi : w.temp?.toFixed(0)
              const unit  = mode === 'air' ? '' : '°'
              const lvl   = mode === 'air' ? (w.air_alert_level ?? 0) : (w.alert_level ?? 0)
              const colors = ['var(--green)', 'var(--yellow)', 'var(--red)']
              return (
                <div key={w.island} onClick={() => setSelectedIsland(w.island)} style={{
                  padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--surface)',
                  border: `1px solid ${selectedIsland === w.island ? colors[lvl] : 'var(--border)'}`,
                  textAlign: 'center', transition: 'all 0.2s',
                }}>
                  <div style={{ color: colors[lvl], fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                    {val ?? '—'}{unit}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 9, marginTop: 2, fontFamily: 'var(--font-head)' }}>
                    {w.island.split(' ').slice(-1)[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel detalle */}
        <div style={{ borderBottom: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface2)' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Detalle de Isla
          </div>
          <IslandPanel data={selectedData} mode={mode} />
        </div>

        {/* Historial alertas */}
        <div style={{ overflowY: 'auto', background: 'var(--surface2)' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Historial de Alertas</span>
            {activeAlerts.length > 0 && (
              <span style={{ background: 'var(--red-glow)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '2px 7px', fontSize: 10 }}>
                {activeAlerts.length}
              </span>
            )}
          </div>
          <AlertFeed alerts={activeAlerts} />
        </div>
      </main>
    </div>
  )
}