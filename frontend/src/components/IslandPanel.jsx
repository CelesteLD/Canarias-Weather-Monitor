import React, { useEffect, useState } from 'react'

const WEATHER_META = {
  0: { label: 'NORMAL',  color: 'var(--green)',  bg: 'var(--green-glow)' },
  1: { label: 'AVISO',   color: 'var(--yellow)', bg: 'var(--yellow-glow)' },
  2: { label: 'PELIGRO', color: 'var(--red)',    bg: 'var(--red-glow)' },
}

const AQI_META = {
  1: { label: 'BUENO',     color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  2: { label: 'ACEPTABLE', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  3: { label: 'MODERADO',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  4: { label: 'MALO',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  5: { label: 'MUY MALO',  color: '#e879f9', bg: 'rgba(232,121,249,0.15)' },
}

function Metric({ label, value, unit, highlight, small }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: small ? '7px 10px' : '10px 12px',
      background: 'var(--flag-white)', border: '1px solid var(--border)', borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: highlight || 'var(--text)', fontSize: small ? 14 : 18, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {value ?? '—'}<span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>
      </span>
    </div>
  )
}

function ForecastChart({ forecast }) {
  if (!forecast?.length) return (
    <div style={{ padding: '12px', color: 'var(--muted)', fontSize: 11, textAlign: 'center' }}>Sin datos de forecast</div>
  )

  const temps  = forecast.map(f => f.temp)
  const rains  = forecast.map(f => f.rain_3h || 0)
  const minT   = Math.min(...temps) - 1
  const maxT   = Math.max(...temps) + 1
  const maxR   = Math.max(...rains, 1)
  const W      = 260
  const H      = 80
  const pad    = 24
  const slotW  = (W - pad * 2) / (forecast.length - 1)

  const tx = i => pad + i * slotW
  const ty = t => H - pad - ((t - minT) / (maxT - minT)) * (H - pad * 2)

  const linePath = forecast.map((f, i) => `${i === 0 ? 'M' : 'L'} ${tx(i).toFixed(1)},${ty(f.temp).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${tx(forecast.length-1).toFixed(1)},${H} L ${tx(0).toFixed(1)},${H} Z`

  const now = Date.now() / 1000

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        Forecast 24h (cada 3h)
      </div>
      <div style={{ background: 'var(--flag-white)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
          {/* Barras de lluvia */}
          {forecast.map((f, i) => {
            if (!f.rain_3h) return null
            const bh = (f.rain_3h / maxR) * (H - pad * 2)
            return (
              <rect key={i}
                x={tx(i) - 6} y={H - pad - bh} width={12} height={bh}
                fill="rgba(0,100,200,0.15)" rx="2"
              />
            )
          })}

          {/* Área temperatura */}
          <path d={areaPath} fill="rgba(0,154,68,0.07)" />
          <path d={linePath} fill="none" stroke="var(--flag-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos y etiquetas */}
          {forecast.map((f, i) => (
            <g key={i}>
              <circle cx={tx(i)} cy={ty(f.temp)} r="2.5" fill="var(--flag-green)" />
              <text x={tx(i)} y={ty(f.temp) - 6} textAnchor="middle"
                fill="#007a35" fontSize="8" fontFamily="monospace">
                {f.temp.toFixed(0)}°
              </text>
              {/* Hora */}
              <text x={tx(i)} y={H - 4} textAnchor="middle"
                fill="rgba(0,0,0,0.35)" fontSize="7.5" fontFamily="monospace">
                {new Date(f.dt * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </text>
              {/* Lluvia si hay */}
              {f.rain_3h > 0 && (
                <text x={tx(i)} y={H - 14} textAnchor="middle"
                  fill="#2563eb" fontSize="7" fontFamily="monospace">
                  {f.rain_3h.toFixed(1)}
                </text>
              )}
            </g>
          ))}

          {/* Línea de lluvia legend */}
          {rains.some(r => r > 0) && (
            <text x={W - 4} y={H - 14} textAnchor="end" fill="rgba(37,99,235,0.5)" fontSize="7" fontFamily="monospace">mm</text>
          )}
        </svg>

        {/* Iconos de descripción */}
        <div style={{ display: 'flex', gap: 2, marginTop: 4, overflowX: 'auto' }}>
          {forecast.map((f, i) => (
            <div key={i} style={{
              flex: '0 0 auto', width: 30, textAlign: 'center',
              color: 'var(--muted)', fontSize: 9, fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {f.wind_speed > 0 ? `💨${f.wind_speed.toFixed(0)}` : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function IslandPanel({ data, mode }) {
  const [forecast, setForecast] = useState([])

  useEffect(() => {
    if (!data?.island) return
    // Usar forecast embebido en los datos si está disponible
    if (data.forecast?.length) {
      setForecast(data.forecast)
    } else {
      fetch(`/api/forecast/${encodeURIComponent(data.island)}`)
        .then(r => r.json())
        .then(setForecast)
        .catch(() => {})
    }
  }, [data?.island, data?.timestamp])

  if (!data) return (
    <div style={{ padding: 24, color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
      Haz clic en una isla para ver sus datos
    </div>
  )

  const windDirs = ['N','NE','E','SE','S','SO','O','NO']
  const windDir  = windDirs[Math.round((data.wind_deg || 0) / 45) % 8]
  const sunrise  = data.sunrise ? new Date(data.sunrise * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'
  const sunset   = data.sunset  ? new Date(data.sunset  * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'

  if (mode === 'air') {
    const aqiMeta = AQI_META[data.aqi] || { label: '—', color: 'var(--muted)', bg: 'transparent' }
    return (
      <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>{data.island}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.city}</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 6, background: aqiMeta.bg, border: `1px solid ${aqiMeta.color}`, color: aqiMeta.color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>
            AQI {data.aqi ?? '—'} · {aqiMeta.label}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <Metric label="PM2.5"  value={data.pm2_5?.toFixed(1)} unit="µg/m³" highlight={data.pm2_5 > 50 ? 'var(--red)' : data.pm2_5 > 25 ? 'var(--yellow)' : undefined} />
          <Metric label="PM10"   value={data.pm10?.toFixed(1)}  unit="µg/m³" highlight={data.pm10  > 100 ? 'var(--red)' : data.pm10 > 50 ? 'var(--yellow)' : undefined} />
          <Metric label="NO₂"    value={data.no2?.toFixed(1)}   unit="µg/m³" highlight={data.no2   > 100 ? 'var(--red)' : data.no2 > 40 ? 'var(--yellow)' : undefined} />
          <Metric label="O₃"     value={data.o3?.toFixed(1)}    unit="µg/m³" highlight={data.o3    > 180 ? 'var(--red)' : data.o3 > 100 ? 'var(--yellow)' : undefined} />
          <Metric label="SO₂"    value={data.so2?.toFixed(1)}   unit="µg/m³" />
          <Metric label="CO"     value={data.co?.toFixed(0)}    unit="µg/m³" />
          <Metric label="NH₃"    value={data.nh3?.toFixed(1)}   unit="µg/m³" />
        </div>
        {data.air_alerts?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.air_alerts.map((a, i) => (
              <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: 'var(--red-glow)', border: '1px solid var(--red)', fontSize: 11 }}>{a}</div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 10 }}>
          Actualizado: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('es-ES') : '—'}
        </div>
      </div>
    )
  }

  const meta = WEATHER_META[data.alert_level ?? 0]
  return (
    <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>{data.island}</div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.city}</div>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.color}`, color: meta.color, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>
          {meta.label}
        </div>
      </div>

      {/* Métricas principales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
        <Metric label="Temperatura"  value={data.temp?.toFixed(1)}      unit="°C"   highlight={data.alert_level === 2 ? 'var(--red)' : undefined} />
        <Metric label="Sensación"    value={data.feels_like?.toFixed(1)} unit="°C"   />
        <Metric label="Viento"       value={`${data.wind_speed?.toFixed(1)} ${windDir}`} unit="km/h" highlight={data.wind_speed > 60 ? 'var(--yellow)' : undefined} />
        <Metric label="Racha"        value={data.wind_gust?.toFixed(1)}  unit="km/h" highlight={data.wind_gust > 72 ? 'var(--red)' : data.wind_gust > 60 ? 'var(--yellow)' : undefined} />
        <Metric label="Humedad"      value={data.humidity}               unit="%"    highlight={data.humidity > 90 ? 'var(--yellow)' : undefined} />
        <Metric label="Lluvia 1h"    value={data.rain_1h?.toFixed(1)}    unit="mm"   highlight={data.rain_1h > 10 ? 'var(--yellow)' : undefined} />
        <Metric label="Presión"      value={data.pressure?.toFixed(0)}   unit="hPa"  />
        <Metric label="Δ Presión"    value={data.pressure_drop > 0 ? `-${data.pressure_drop}` : '0.0'} unit="hPa" highlight={data.pressure_drop > 3 ? 'var(--yellow)' : undefined} />
        <Metric label="Visibilidad"  value={(data.visibility / 1000).toFixed(1)} unit="km" highlight={data.visibility < 1000 ? 'var(--yellow)' : undefined} />
        <Metric label="Nubosidad"    value={data.clouds}                 unit="%"    />
      </div>

      {/* Amanecer / Atardecer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
        <Metric small label="Amanecer" value={sunrise} unit="" />
        <Metric small label="Atardecer" value={sunset}  unit="" />
      </div>

      {/* Condición */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--flag-white)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--flag-green)', textTransform: 'capitalize', marginBottom: 10, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {data.weather_desc || '—'}
      </div>

      {/* Alertas */}
      {data.alerts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {data.alerts.map((a, i) => (
            <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: data.alert_level === 2 ? 'var(--red-glow)' : 'var(--yellow-glow)', border: `1px solid ${data.alert_level === 2 ? 'var(--red)' : 'var(--yellow)'}`, fontSize: 11 }}>{a}</div>
          ))}
        </div>
      )}

      {/* Forecast */}
      <ForecastChart forecast={forecast} />

      <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 10 }}>
        Actualizado: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('es-ES') : '—'}
      </div>
    </div>
  )
}