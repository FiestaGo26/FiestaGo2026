'use client'

// Pestaña Visitas: quién entra en la web, de dónde viene, qué mira y cuántos
// llegan a pedir presupuesto y a reservar (el embudo real, para compararlo con
// las simulaciones). Datos de /api/admin/visitas (sin cookies ni datos personales).

import { useEffect, useState } from 'react'

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

const C = { card: '#111827', border: '#1F2937', text: '#F0F4FF', muted: '#9CA3AF', accent: '#06B6D4' }
const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }
const n = (x: number) => (x || 0).toLocaleString('es-ES')
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10} %` : '—')

export default function Visitas() {
  const [days, setDays] = useState(30)
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setD(null); setError('')
    fetch(`/api/admin/visitas?days=${days}`, { headers: adminHeaders() })
      .then(r => r.json()).then(x => x.error ? setError(x.error) : setD(x)).catch(e => setError(String(e)))
  }, [days])

  const max = Math.max(1, ...((d?.by_day || []).map((x: any) => x.visitors)))
  const f = d?.funnel || {}
  const steps: Array<[string, number]> = [
    ['Visitantes', f.visitantes], ['Ven una ficha o montan su celebración', f.ven_ficha_o_montan],
    ['Piden presupuesto', f.piden_presupuesto], ['Reciben la propuesta', f.reciben_propuesta], ['Reservan (pagan la señal)', f.reservan],
  ]

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Visitas de la web</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
        Sin cookies ni datos personales: cada visitante se cuenta una vez al día. Empezó a medir el 31-10-2026.
        Para saber qué publicación o campaña trae gente, añade al enlace <code>?utm_source=instagram&amp;utm_campaign=comuniones</code>.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[7, 30, 90].map(x => (
          <button key={x} onClick={() => setDays(x)} style={{ background: days === x ? C.accent : '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Últimos {x} días
          </button>
        ))}
      </div>
      {error && <p style={{ color: '#F87171' }}>{error}</p>}
      {!d && !error && <p style={{ color: C.muted }}>Cargando…</p>}
      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
            {[['Visitantes', d.visitors], ['Páginas vistas', d.pageviews], ['Piden presupuesto', f.piden_presupuesto], ['Reservan', f.reservan]].map(([t, v]) => (
              <div key={t as string} style={card}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 26, color: C.text, fontWeight: 800 }}>{n(v as number)}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 8 }}>Embudo</div>
            {steps.map(([t, v], i) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span>{t}</span>
                <span><b>{n(v)}</b>{i > 0 && <span style={{ color: C.muted }}> · {pct(v, steps[i - 1][1])} del paso anterior</span>}</span>
              </div>
            ))}
            <p style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Presupuestos, propuestas y reservas salen de la base de datos (personas distintas por email) en el mismo periodo. En la simulación 15, de los que pedían presupuesto reservaba el 55,9 %.</p>
          </div>

          <div style={card}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 8 }}>Visitantes por día</div>
            {(d.by_day || []).length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Todavía no hay visitas registradas.</p>}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {(d.by_day || []).map((x: any) => (
                <div key={x.day} title={`${x.day}: ${x.visitors} visitantes, ${x.views} páginas`} style={{ flex: 1, background: C.accent, height: `${(x.visitors / max) * 100}%`, minHeight: 2, borderRadius: 2 }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {[
              ['De dónde vienen', d.sources, (x: any) => x.source, (x: any) => x.visitors],
              ['Páginas más vistas', d.pages, (x: any) => x.page, (x: any) => x.views],
              ['Campañas (utm)', d.campaigns, (x: any) => [x.utm_source, x.utm_medium, x.utm_campaign].filter(Boolean).join(' · '), (x: any) => x.visitors],
              ['Dispositivo', d.devices, (x: any) => x.device, (x: any) => x.visitors],
              ['Zona (fichas y Monta tu celebración)', d.zones, (x: any) => x.zone === 'asturias' ? 'Asturias' : 'Valencia', (x: any) => x.visitors],
            ].map(([title, rows, k, v]: any) => (
              <div key={title} style={card}>
                <div style={{ color: C.text, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                {(!rows || rows.length === 0) && <p style={{ color: C.muted, fontSize: 13 }}>Sin datos todavía.</p>}
                {(rows || []).map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text, padding: '3px 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{k(r)}</span><b>{n(v(r))}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
