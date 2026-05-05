import React from 'react'

const WEATHER_META = {
  0: { label: 'NORMAL',  color: 'var(--green)',  bg: 'var(--green-glow)' },
  1: { label: 'AVISO',   color: 'var(--yellow)', bg: 'var(--yellow-glow)' },
  2: { label: 'PELIGRO', color: 'var(--red)',    bg: 'var(--red-glow)' },
}

const AQI_META = {
  1: { label: 'BUENO',     color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  2: { label: 'ACEPTABLE', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  3: { label: 'MODERADO',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  4: { label: 'MALO',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  5: { label: 'MUY MALO',  color: '#e879f9', bg: 'rgba(232,121,249,0.15)' },
}

function Metric({ label, value, unit, highlight }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '10px 12px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: highlight || 'var(--text)', fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {value ?? '—'}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 3 }}>{unit}</span>
      </span>
    </div>
  )
}

export default function IslandPanel({ data, mode }) {
  if (!data) return (
    <div style={{ padding: 24, color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
      Haz clic en una isla para ver sus datos
    </div>
  )

  const windDirs = ['N','NE','E','SE','S','SO','O','NO']
  const windDir  = windDirs[Math.round((data.wind_deg || 0) / 45) % 8]

  if (mode === 'air') {
    const aqiMeta = AQI_META[data.aqi] || { label: '—', color: 'var(--muted)', bg: 'transparent' }
    return (
      <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>{data.island}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.city}</div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 6,
            background: aqiMeta.bg, border: `1px solid ${aqiMeta.color}`,
            color: aqiMeta.color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
          }}>
            AQI {data.aqi ?? '—'} · {aqiMeta.label}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <Metric label="PM2.5"   value={data.pm2_5?.toFixed(1)} unit="µg/m³" highlight={data.pm2_5 > 25 ? (data.pm2_5 > 50 ? 'var(--red)' : 'var(--yellow)') : undefined} />
          <Metric label="PM10"    value={data.pm10?.toFixed(1)}  unit="µg/m³" highlight={data.pm10  > 50 ? (data.pm10  > 100 ? 'var(--red)' : 'var(--yellow)') : undefined} />
          <Metric label="NO₂"     value={data.no2?.toFixed(1)}   unit="µg/m³" highlight={data.no2   > 40 ? 'var(--yellow)' : undefined} />
          <Metric label="O₃"      value={data.o3?.toFixed(1)}    unit="µg/m³" highlight={data.o3    > 100 ? 'var(--yellow)' : undefined} />
          <Metric label="SO₂"     value={data.so2?.toFixed(1)}   unit="µg/m³" />
          <Metric label="CO"      value={data.co?.toFixed(0)}    unit="µg/m³" />
          <Metric label="NH₃"     value={data.nh3?.toFixed(1)}   unit="µg/m³" />
        </div>

        {data.air_alerts?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {data.air_alerts.map((a, i) => (
              <div key={i} style={{
                padding: '7px 12px', borderRadius: 6,
                background: 'var(--red-glow)', border: '1px solid var(--red)',
                fontSize: 11,
              }}>{a}</div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 10 }}>
          Actualizado: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('es-ES') : '—'}
        </div>
      </div>
    )
  }

  // Modo meteorológico
  const meta = WEATHER_META[data.alert_level ?? 0]
  return (
    <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>{data.island}</div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.city}</div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 6,
          background: meta.bg, border: `1px solid ${meta.color}`,
          color: meta.color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
        }}>{meta.label}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <Metric label="Temperatura"  value={data.temp?.toFixed(1)}     unit="°C"   highlight={data.alert_level === 2 ? 'var(--red)' : undefined} />
        <Metric label="Sensación"    value={data.feels_like?.toFixed(1)} unit="°C" />
        <Metric label="Viento"       value={`${data.wind_speed?.toFixed(1)} ${windDir}`} unit="km/h" highlight={data.wind_speed > 60 ? 'var(--yellow)' : undefined} />
        <Metric label="Humedad"      value={data.humidity}              unit="%"    highlight={data.humidity > 90 ? 'var(--yellow)' : undefined} />
        <Metric label="Presión"      value={data.pressure?.toFixed(0)}  unit="hPa" />
        <Metric label="Δ Presión"    value={data.pressure_drop > 0 ? `-${data.pressure_drop}` : '0.0'} unit="hPa" highlight={data.pressure_drop > 3 ? 'var(--yellow)' : undefined} />
        <Metric label="Nubosidad"    value={data.clouds}                unit="%"   />
        <Metric label="Visibilidad"  value={(data.visibility / 1000).toFixed(1)} unit="km" highlight={data.visibility < 1000 ? 'var(--yellow)' : undefined} />
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)', textTransform: 'capitalize', marginBottom: 14 }}>
        {data.weather_desc || '—'}
      </div>

      {data.alerts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.alerts.map((a, i) => (
            <div key={i} style={{
              padding: '7px 12px', borderRadius: 6,
              background: data.alert_level === 2 ? 'var(--red-glow)' : 'var(--yellow-glow)',
              border: `1px solid ${data.alert_level === 2 ? 'var(--red)' : 'var(--yellow)'}`,
              fontSize: 11,
            }}>{a}</div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14, color: 'var(--muted)', fontSize: 10 }}>
        Actualizado: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('es-ES') : '—'}
      </div>
    </div>
  )
}