import React, { useState } from 'react'
import { useWeatherData } from './hooks/useWeatherData'
import CanariasMap from './components/CanariasMap'
import IslandPanel from './components/IslandPanel'
import AlertFeed from './components/AlertFeed'
import MunicipiosMap from './components/MunicipiosMap'

const ISLAND_SHORT = {
  'Tenerife':      'Tenerife',
  'Gran Canaria':  'G. Canaria',
  'Lanzarote':     'Lanzarote',
  'Fuerteventura': 'Fuertev.',
  'La Palma':      'La Palma',
  'La Gomera':     'La Gomera',
  'El Hierro':     'El Hierro',
}

const TABS = [
  { key: 'weather', icon: '🌤️', label: 'Meteorología' },
  { key: 'air',     icon: '🌫️', label: 'Calidad Aire' },
  { key: 'temp',    icon: '🌡️', label: 'Temperatura Municipios' },
]

export default function App() {
  const { weather, alerts, lastUpdate, connected } = useWeatherData(15000)
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [mode, setMode] = useState('weather')

  const selectedData = weather.find(w => w.island === selectedIsland) || null

  const weatherCounts = { 0: 0, 1: 0, 2: 0 }
  weather.forEach(w => { if (w.alert_level !== undefined) weatherCounts[w.alert_level]++ })

  const activeAlerts = mode === 'air'
    ? weather.flatMap(w => (w.air_alerts || []).map(msg => ({
        island: w.island, message: msg,
        level: w.air_alert_level, timestamp: w.timestamp,
      })))
    : alerts

  const isTempMode = mode === 'temp'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink: 0, padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        background: 'rgba(245,240,232,0.97)', backdropFilter: 'blur(12px)',
        zIndex: 100, gap: 12,
      }}>

        {/* Izquierda: logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/icon.png"
            alt="Canarias Weather Monitor"
            style={{ width: 60, height: 60, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Canarias Weather Monitor</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Spark Structured Streaming · Tiempo Real</div>
          </div>
        </div>

        {/* Centro: solo tabs */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--flag-white)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            {TABS.map(({ key, icon, label }) => {
              const active = mode === key
              const palette = {
                weather: { bg: 'var(--flag-green)',  text: '#ffffff', border: 'var(--flag-green)'  },
                air:     { bg: 'var(--flag-yellow)', text: '#5a4000', border: '#c49000'             },
                temp:    { bg: '#1a1a1a',             text: '#ffffff', border: '#1a1a1a'             },
              }
              const p = palette[key]
              return (
                <button key={key} onClick={() => setMode(key)} style={{
                  padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  background: active ? p.bg : 'transparent',
                  color: active ? p.text : 'var(--muted)',
                  border: active ? `1px solid ${p.border}` : '1px solid transparent',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}>
                  {icon} {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Derecha: contadores + conexión */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>

          {/* Contadores meteorología */}
          {!isTempMode && mode === 'weather' && [
            { level: 2, label: 'Peligro', color: 'var(--red)',    bg: 'var(--red-glow)' },
            { level: 1, label: 'Avisos',  color: 'var(--yellow)', bg: 'var(--yellow-glow)' },
            { level: 0, label: 'Normal',  color: 'var(--green)',  bg: 'var(--green-glow)' },
          ].map(({ level, label, color, bg }) => (
            <div key={level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 10px', borderRadius: 7, background: bg, border: `1px solid ${color}33` }}>
              <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{weatherCounts[level]}</span>
              <span style={{ color: 'var(--muted)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}

          {/* Contadores calidad del aire */}
          {!isTempMode && mode === 'air' && [
            { aqi: 1, label: 'Bueno',     color: '#008a3a', bg: 'rgba(0,138,58,0.1)'   },
            { aqi: 2, label: 'Aceptable', color: '#2c6fad', bg: 'rgba(44,111,173,0.1)' },
            { aqi: 3, label: 'Moderado',  color: '#b57800', bg: 'rgba(181,120,0,0.12)' },
            { aqi: 4, label: 'Malo',      color: '#c0392b', bg: 'rgba(192,57,43,0.1)'  },
            { aqi: 5, label: 'Muy malo',  color: '#6c3483', bg: 'rgba(108,52,131,0.1)' },
          ].map(({ aqi, label, color, bg }) => {
            const count = weather.filter(w => w.aqi === aqi).length
            return (
              <div key={aqi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 7px', borderRadius: 6, background: bg, border: `1px solid ${color}33` }}>
                <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{count}</span>
                <span style={{ color: 'var(--muted)', fontSize: 7, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            )
          })}

          {/* LIVE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 5px ${connected ? 'var(--green)' : 'var(--red)'}`, animation: 'blink 2s ease-in-out infinite' }} />
            <span style={{ color: 'var(--muted)', fontSize: 10, whiteSpace: 'nowrap' }}>
              {connected ? `LIVE · ${lastUpdate?.toLocaleTimeString('es-ES') || ''}` : 'DESCONECTADO'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Panel temperatura municipios (pantalla completa) ── */}
      {isTempMode && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <MunicipiosMap active={true} />
        </div>
      )}

      {/* ── Layout meteorología / calidad aire ── */}
      {!isTempMode && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Mapa + barra inferior */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
            <div style={{ padding: '7px 14px 2px', color: 'var(--muted)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>
              Archipiélago Canario — {mode === 'air' ? 'Calidad del Aire' : 'Nivel de Alerta Meteorológica'}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '0 12px' }}>
              <CanariasMap weather={weather} selectedIsland={selectedIsland} onSelectIsland={setSelectedIsland} mode={mode} />
            </div>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '2px 0', flexShrink: 0 }}>
              Clic en una isla · Scroll para zoom
            </div>

            {/* Barra resumen */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, background: 'var(--flag-white)' }}>
              {weather.map(w => {
                const val    = mode === 'air' ? (w.aqi ?? '—') : (w.temp?.toFixed(0) ?? '—')
                const unit   = mode === 'air' ? '' : '°'
                const lvl    = mode === 'air' ? (w.air_alert_level ?? 0) : (w.alert_level ?? 0)
                // Bandera canaria: verde=normal, amarillo=aviso, rojo=peligro
                const flagColors = [
                  { text: 'var(--flag-green)', border: 'var(--flag-green)', bg: 'rgba(0,154,68,0.08)' },
                  { text: '#8a6500',           border: 'var(--flag-yellow)', bg: 'rgba(255,204,0,0.18)' },
                  { text: 'var(--red)',        border: 'var(--red)',         bg: 'var(--red-glow)' },
                ]
                const fc   = flagColors[lvl] ?? flagColors[0]
                const isSel = selectedIsland === w.island
                return (
                  <div key={w.island} onClick={() => setSelectedIsland(w.island)} style={{
                    padding: '7px 4px', borderRadius: 7, cursor: 'pointer',
                    background: isSel ? fc.bg : 'var(--surface)',
                    border: `1px solid ${isSel ? fc.border : 'var(--border)'}`,
                    textAlign: 'center', transition: 'all 0.2s',
                    boxShadow: isSel ? `0 0 0 2px ${fc.border}44` : 'none',
                  }}>
                    <div style={{ color: fc.text, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{val}{unit}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 1, fontFamily: 'var(--font-head)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ISLAND_SHORT[w.island] ?? w.island}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{ width: 'clamp(280px, 25vw, 400px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Detalle de Isla
              </div>
              <IslandPanel data={selectedData} mode={mode} />
            </div>
            <div style={{ flex: '0 0 auto', maxHeight: '35%', overflowY: 'auto', background: 'var(--surface)' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                <span>Historial de Alertas</span>
                {activeAlerts.length > 0 && (
                  <span style={{ background: 'var(--red-glow)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>{activeAlerts.length}</span>
                )}
              </div>
              <AlertFeed alerts={activeAlerts} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}