import React, { useEffect, useRef, useState } from 'react'

const CANARIAS_BOUNDS = [[27.4, -18.5], [29.5, -13.3]]
const ISLANDS = ['Tenerife','Gran Canaria','Lanzarote','Fuerteventura','La Palma','La Gomera','El Hierro']

const WEATHER_LEVEL = {
  0:    { fill: '#15803d', stroke: '#4ade80', fillOpacity: 0.55, hover: 0.78, label: 'Normal'  },
  1:    { fill: '#92400e', stroke: '#fbbf24', fillOpacity: 0.60, hover: 0.82, label: 'Aviso'   },
  2:    { fill: '#991b1b', stroke: '#f87171', fillOpacity: 0.68, hover: 0.88, label: 'Peligro' },
  null: { fill: '#1e3a5f', stroke: '#60a5fa', fillOpacity: 0.38, hover: 0.58, label: '—'       },
}

// AQI 1-5 → colores
const AQI_LEVEL = {
  1:    { fill: '#14532d', stroke: '#4ade80', fillOpacity: 0.55, hover: 0.78, label: 'Bueno'    },
  2:    { fill: '#1e3a5f', stroke: '#60a5fa', fillOpacity: 0.55, hover: 0.78, label: 'Aceptable'},
  3:    { fill: '#713f12', stroke: '#fb923c', fillOpacity: 0.60, hover: 0.82, label: 'Moderado' },
  4:    { fill: '#7c2d12', stroke: '#f87171', fillOpacity: 0.65, hover: 0.85, label: 'Malo'     },
  5:    { fill: '#4a044e', stroke: '#e879f9', fillOpacity: 0.70, hover: 0.88, label: 'Muy malo' },
  null: { fill: '#1e3a5f', stroke: '#60a5fa', fillOpacity: 0.38, hover: 0.58, label: '—'        },
}

function geojsonToLeafletPolygons(geometry) {
  const polygons = []
  if (geometry.type === 'Polygon') {
    polygons.push(geometry.coordinates[0].map(([lon, lat]) => [lat, lon]))
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates)
      polygons.push(poly[0].map(([lon, lat]) => [lat, lon]))
  }
  return polygons
}

export default function CanariasMap({ weather, onSelectIsland, selectedIsland, mode }) {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const layersRef  = useRef({})
  const weatherRef = useRef(weather)
  const modeRef    = useRef(mode)
  const [loading, setLoading] = useState(true)
  weatherRef.current = weather
  modeRef.current    = mode

  function getStyle(name, hover, selected) {
    const d = weatherRef.current.find(w => w.island === name)
    const c = modeRef.current === 'air'
      ? (AQI_LEVEL[d?.aqi ?? null] ?? AQI_LEVEL[null])
      : (WEATHER_LEVEL[d?.alert_level ?? null] ?? WEATHER_LEVEL[null])
    return {
      fillColor:   c.fill,
      color:       selected ? '#ffffff' : c.stroke,
      weight:      selected ? 2.5 : hover ? 2 : 1,
      fillOpacity: selected || hover ? c.hover : c.fillOpacity,
      opacity: 1,
    }
  }

  function tooltipHtml(name) {
    const d = weatherRef.current.find(w => w.island === name)
    if (modeRef.current === 'air') {
      const c = AQI_LEVEL[d?.aqi ?? null] ?? AQI_LEVEL[null]
      if (!d) return `<div class="wtip-box"><b>${name}</b></div>`
      return `<div class="wtip-box" style="border-color:${c.stroke}">
        <div style="color:${c.stroke};font-weight:700;font-size:13px">${name}</div>
        <div style="margin-top:4px">AQI <b style="color:${c.stroke}">${d.aqi ?? '—'}</b> · ${d.aqi_label ?? '—'}</div>
        <div style="color:var(--muted);font-size:11px;margin-top:2px">PM2.5: ${d.pm2_5 ?? '—'} · PM10: ${d.pm10 ?? '—'} µg/m³</div>
      </div>`
    }
    const c = WEATHER_LEVEL[d?.alert_level ?? null] ?? WEATHER_LEVEL[null]
    if (!d) return `<div class="wtip-box"><b>${name}</b></div>`
    return `<div class="wtip-box" style="border-color:${c.stroke}">
      <div style="color:${c.stroke};font-weight:700;font-size:13px">${name}</div>
      <div style="margin-top:4px">🌡️ <b>${d.temp?.toFixed(1)}°C</b> · <span style="text-transform:capitalize;color:var(--muted)">${d.weather_desc || ''}</span></div>
      <div style="color:var(--muted);font-size:11px;margin-top:2px">💨 ${d.wind_speed?.toFixed(1)} km/h · 💧 ${d.humidity}%</div>
    </div>`
  }

  useEffect(() => {
    if (leafletRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      zoomControl: true, attributionControl: true, minZoom: 6, maxZoom: 13,
    })
    map.fitBounds(CANARIAS_BOUNDS)
    leafletRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://openstreetmap.org">OSM</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map)

    fetch('/canarias.geojson').then(r => r.json()).then(gj => {
      for (const feature of gj.features) {
        const name = feature.properties.name || feature.properties.etiqueta
        if (!ISLANDS.includes(name)) continue

        const rings = geojsonToLeafletPolygons(feature.geometry)
        if (!rings.length) continue

        const islandPolys = []
        for (const ring of rings) {
          const poly = L.polygon(ring, getStyle(name, false, false))
          poly.on({
            click:     ()  => onSelectIsland(name),
            mouseover: e  => {
              islandPolys.forEach(p => p.setStyle(getStyle(name, true, false)))
              poly.bindTooltip(tooltipHtml(name), { sticky: true, opacity: 1, className: 'wtip' }).openTooltip()
            },
            mouseout:  e  => {
              islandPolys.forEach(p => p.setStyle(getStyle(name, false, selectedIsland === name)))
              poly.closeTooltip()
            },
          })
          poly.addTo(map)
          islandPolys.push(poly)
        }
        layersRef.current[name] = islandPolys
      }

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)

      setLoading(false)
    }).catch(() => setLoading(false))

    return () => { map.remove(); leafletRef.current = null; layersRef.current = {} }
  }, [])

  // Re-estilizar cuando cambia modo, datos o selección
  useEffect(() => {
    Object.entries(layersRef.current).forEach(([name, polys]) => {
      polys.forEach(p => p.setStyle(getStyle(name, false, selectedIsland === name)))
    })
  }, [weather, selectedIsland, mode])

  const legendMap = mode === 'air' ? AQI_LEVEL : WEATHER_LEVEL
  const legendKeys = mode === 'air' ? [1,2,3,4,5] : [0,1,2]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 440 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 440, borderRadius: 8 }} />

      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000, borderRadius: 8,
          background: 'rgba(5,10,20,0.82)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{ width: 28, height: 28, border: '3px solid rgba(56,189,248,0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cargando mapa...</span>
        </div>
      )}

      {/* Leyenda dinámica */}
      <div style={{
        position: 'absolute', bottom: 28, left: 12, zIndex: 999,
        background: 'rgba(5,10,20,0.9)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 6 }}>
          {mode === 'air' ? 'CALIDAD DEL AIRE' : 'NIVEL ALERTA'}
        </div>
        {legendKeys.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: legendMap[k].fill, border: `1.5px solid ${legendMap[k].stroke}` }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>{legendMap[k].label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-container { background: #0d1b2e !important; }
        .wtip.leaflet-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        .wtip-box { font-family:monospace;font-size:12px;background:#0c1424;border:1px solid #3b6fba;border-radius:6px;padding:10px 14px;color:#e8edf5;min-width:170px;line-height:1.8; }
      `}</style>
    </div>
  )
}