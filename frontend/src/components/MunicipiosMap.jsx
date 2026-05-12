import React, { useEffect, useRef, useState, useCallback } from 'react'

const CANARIAS_BOUNDS = [[27.4, -18.5], [29.5, -13.3]]

function tempToColor(temp) {
  if (temp === null || temp === undefined) return { fill: '#1e2a3a', stroke: '#2a3a5a', opacity: 0.35 }
  const stops = [
    { t: 14, r: 59,  g: 130, b: 246 },
    { t: 20, r: 34,  g: 197, b: 94  },
    { t: 26, r: 234, g: 179, b: 8   },
    { t: 32, r: 249, g: 115, b: 22  },
    { t: 38, r: 239, g: 68,  b: 68  },
  ]
  const clamped = Math.max(14, Math.min(38, temp))
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i+1].t) { lo = stops[i]; hi = stops[i+1]; break }
  }
  const t = (clamped - lo.t) / (hi.t - lo.t)
  const r = Math.round(lo.r + t * (hi.r - lo.r))
  const g = Math.round(lo.g + t * (hi.g - lo.g))
  const b = Math.round(lo.b + t * (hi.b - lo.b))
  return {
    fill:    `rgb(${Math.round(r*0.45)},${Math.round(g*0.45)},${Math.round(b*0.45)})`,
    stroke:  `rgb(${r},${g},${b})`,
    opacity: 0.8,
  }
}

export default function MunicipiosMap() {
  const mapRef      = useRef(null)
  const leafletRef  = useRef(null)
  const layersRef   = useRef({})
  const tempsRef    = useRef({})
  const [status, setStatus]           = useState('idle')
  const [lastBatch, setLastBatch]     = useState(null)
  const [lastUpdate, setLastUpdate]   = useState(null)
  const [nextInSecs, setNextInSecs]   = useState(null)
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [mapLoading, setMapLoading]   = useState(true)
  const [countdown, setCountdown]     = useState(null)
  const pollRef = useRef(null)

  function updateLayerStyles() {
    Object.entries(layersRef.current).forEach(([codigo, layer]) => {
      const data = tempsRef.current[parseInt(codigo)]
      const c    = tempToColor(data?.temp ?? null)
      layer.setStyle({ fillColor: c.fill, color: c.stroke, fillOpacity: c.opacity, weight: 0.8, opacity: 1 })
    })
  }

  // ── Activar worker al montar ──────────────────────────────────────────────
  useEffect(() => {
    // Activar worker al montar el componente
    fetch('/api/municipios/activate', { method: 'POST' })
      .then(r => r.json())
      .then(d => console.log('[MUNI] Worker activado, clientes:', d.clients))
      .catch(e => console.error('[MUNI] activate error:', e))

    return () => {
      // Desactivar worker al desmontar
      fetch('/api/municipios/deactivate', { method: 'POST' })
        .catch(() => {})
    }
  }, [])

  // ── Poll de temperaturas cada 5s ──────────────────────────────────────────
  const fetchTemps = useCallback(async () => {
    try {
      const res  = await fetch('/api/municipios/temps')
      const data = await res.json()
      setStatus(data.status)
      setLastBatch(data.last_batch)
      setNextInSecs(data.next_in_secs)
      setTotalLoaded(data.total)
      if (data.last_update) setLastUpdate(new Date(data.last_update + 'Z'))
      const newTemps = {}
      data.temps.forEach(t => { newTemps[t.codigo] = t })
      tempsRef.current = newTemps
      updateLayerStyles()
    } catch (e) {
      console.error('[MunicipiosMap] poll error:', e)
    }
  }, [])

  useEffect(() => {
    fetchTemps()
    pollRef.current = setInterval(fetchTemps, 5000)
    return () => clearInterval(pollRef.current)
  }, [fetchTemps])

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (nextInSecs === null) { setCountdown(null); return }
    setCountdown(nextInSecs)
    const id = setInterval(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [nextInSecs])

  // ── Inicializar mapa Leaflet ──────────────────────────────────────────────
  useEffect(() => {
    if (leafletRef.current) return
    const L = window.L
    if (!L) return

    const tryInit = () => {
      if (!mapRef.current || mapRef.current.offsetHeight === 0) {
        setTimeout(tryInit, 50); return
      }

      const map = L.map(mapRef.current, {
        zoomControl: true, attributionControl: true, minZoom: 7, maxZoom: 14,
      })
      map.fitBounds(CANARIAS_BOUNDS)
      leafletRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO © OSM', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)

      fetch('/municipios.geojson')
        .then(r => r.json())
        .then(gj => {
          L.geoJSON(gj, {
            style: feature => {
              const c = tempToColor(tempsRef.current[feature.properties.codigo]?.temp ?? null)
              return { fillColor: c.fill, color: c.stroke, weight: 0.8, fillOpacity: c.opacity, opacity: 1 }
            },
            onEachFeature: (feature, layer) => {
              const codigo = feature.properties.codigo
              layersRef.current[codigo] = layer
              layer.on({
                mouseover: e => {
                  e.target.setStyle({ weight: 2.5, fillOpacity: 0.95 })
                  const data = tempsRef.current[codigo]
                  const c    = tempToColor(data?.temp ?? null)
                  const tip  = data
                    ? `<div class="wtip-box" style="border-color:${c.stroke}">
                        <div style="color:${c.stroke};font-weight:700;font-size:12px">${data.nombre}</div>
                        <div style="color:rgba(255,255,255,0.45);font-size:10px;margin-bottom:3px">${data.isla}</div>
                        <div>🌡️ <b style="font-size:16px;color:${c.stroke}">${data.temp?.toFixed(1)}°C</b></div>
                        <div style="color:rgba(255,255,255,0.5);font-size:10px;margin-top:2px;text-transform:capitalize">${data.weather_desc || ''} · 💧${data.humidity}%</div>
                      </div>`
                    : `<div class="wtip-box"><b>${feature.properties.nombre}</b><br/><span style="color:#5a7090;font-size:10px">Sin datos aún</span></div>`
                  layer.bindTooltip(tip, { sticky: true, opacity: 1, className: 'wtip' }).openTooltip()
                },
                mouseout: e => {
                  const c = tempToColor(tempsRef.current[codigo]?.temp ?? null)
                  e.target.setStyle({ fillColor: c.fill, color: c.stroke, weight: 0.8, fillOpacity: c.opacity })
                  layer.closeTooltip()
                },
              })
            },
          }).addTo(map)

          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd', maxZoom: 19,
          }).addTo(map)

          setMapLoading(false)
        })
        .catch(e => { console.error('GeoJSON error:', e); setMapLoading(false) })
    }

    tryInit()
    return () => {
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; layersRef.current = {} }
    }
  }, [])

  useEffect(() => { updateLayerStyles() }, [totalLoaded])

  const statusLabel = {
    idle:       '⏸ En espera',
    fetching_A: '⬇️ Descargando lote A (1-44)...',
    fetching_B: '⬇️ Descargando lote B (45-88)...',
    waiting:    '✅ Actualizado',
  }[status] || status

  const fmtTime = dt => dt
    ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Status bar */}
      <div style={{
        flexShrink: 0, padding: '7px 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status.startsWith('fetching') ? 'var(--yellow)' : status === 'waiting' ? 'var(--green)' : 'var(--muted)',
              boxShadow: status.startsWith('fetching') ? '0 0 6px var(--yellow)' : status === 'waiting' ? '0 0 5px var(--green)' : 'none',
              animation: status.startsWith('fetching') ? 'blink 0.7s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{statusLabel}</span>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{totalLoaded}/88 municipios</span>
          {lastBatch && (
            <span style={{ color: 'var(--accent)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
              Último lote: {lastBatch === 'A' ? 'A (mun. 1–44)' : 'B (mun. 45–88)'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Última ingesta</div>
            <div style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{fmtTime(lastUpdate)}</div>
          </div>
          {countdown !== null && (
            <div style={{
              textAlign: 'center', padding: '4px 12px', borderRadius: 8,
              background: countdown < 10 ? 'var(--yellow-glow)' : 'var(--surface2)',
              border: `1px solid ${countdown < 10 ? 'var(--yellow)' : 'var(--border)'}`,
              minWidth: 90,
            }}>
              <div style={{ color: 'var(--muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próxima ingesta</div>
              <div style={{ color: countdown < 10 ? 'var(--yellow)' : 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
                {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {mapLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1000,
            background: 'rgba(5,10,20,0.82)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(56,189,248,0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cargando municipios...</span>
          </div>
        )}

        {!mapLoading && (
          <div style={{
            position: 'absolute', bottom: 28, left: 12, zIndex: 999,
            background: 'rgba(5,10,20,0.9)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 5 }}>TEMPERATURA</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'rgb(59,130,246)',  fontSize: 9, fontFamily: 'var(--font-mono)' }}>14°</span>
              <div style={{ width: 80, height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgb(59,130,246), rgb(34,197,94), rgb(234,179,8), rgb(249,115,22), rgb(239,68,68))' }} />
              <span style={{ color: 'rgb(239,68,68)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>38°</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, fontFamily: 'var(--font-mono)', marginTop: 3, textAlign: 'center' }}>°C</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .leaflet-container { background: #0d1b2e !important; }
        .wtip.leaflet-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        .wtip-box { font-family:monospace;font-size:12px;background:#0c1424;border:1px solid #3b6fba;border-radius:6px;padding:10px 14px;color:#e8edf5;min-width:150px;line-height:1.8; }
      `}</style>
    </div>
  )
}