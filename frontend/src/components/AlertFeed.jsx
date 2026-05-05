import React from 'react'

const LEVEL_STYLE = {
  0: { color: 'var(--green)',  border: 'rgba(34,197,94,0.3)' },
  1: { color: 'var(--yellow)', border: 'rgba(234,179,8,0.3)' },
  2: { color: 'var(--red)',    border: 'rgba(239,68,68,0.3)' },
}

export default function AlertFeed({ alerts }) {
  if (!alerts.length) return (
    <div style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
      Sin alertas activas
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px', overflowY: 'auto', maxHeight: 320 }}>
      {alerts.map((a, i) => {
        const style = LEVEL_STYLE[a.level ?? 0]
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            padding: '8px 12px',
            background: 'var(--surface)',
            border: `1px solid ${style.border}`,
            borderLeft: `3px solid ${style.color}`,
            borderRadius: 6,
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: style.color, fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-head)' }}>
                {a.island}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                {a.timestamp ? new Date(a.timestamp).toLocaleTimeString('es-ES') : ''}
              </span>
            </div>
            <span style={{ color: 'var(--text)', fontSize: 11 }}>{a.message}</span>
          </div>
        )
      })}
    </div>
  )
}
