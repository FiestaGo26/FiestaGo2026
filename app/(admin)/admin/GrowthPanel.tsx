'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

// ─── Motor de crecimiento del Agente CEO ─────────────────────────────────────
// Experimentos que el CEO abre y cierra solo (lib/ceo-growth.ts). Aquí
// Mariano aprueba o rechaza los anuncios propuestos, mete las métricas de
// Instagram/TikTok que no se pueden leer por API y reactiva WhatsApp si
// saltó el freno.

type Experiment = {
  id: string
  created_at: string
  slug: string
  audience: 'proveedores' | 'clientes'
  channel: string
  format: string
  hypothesis: string
  variant: string
  city: string
  category: string
  status: 'proposed' | 'running' | 'won' | 'lost' | 'stopped' | 'rejected'
  started_at: string | null
  ends_at: string | null
  budget_eur: number
  metrics: { live?: any; final?: any; manual?: any }
  learning: string
}

type Settings = {
  ads_budget_eur: number
  supply_threshold: number
  wa_braked_at: string | null
  wa_brake_reason: string | null
}

const C = {
  card: '#111827', border: '#1F2937', text: '#F0F4FF', muted: '#9CA3AF',
  ok: '#10B981', warn: '#F59E0B', bad: '#EF4444', violet: '#8B5CF6',
}

const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', tiktok: 'TikTok',
  meta_ads: 'Anuncios Instagram/Facebook', tiktok_ads: 'Anuncios TikTok', seo: 'SEO', otro: 'Otro',
}
const STATUS: Record<Experiment['status'], [string, string]> = {
  proposed: ['Propuesto · decides tú', C.warn],
  running:  ['En marcha', C.violet],
  won:      ['Ganador', C.ok],
  lost:     ['Perdedor', C.bad],
  stopped:  ['Parado', C.muted],
  rejected: ['Rechazado', C.muted],
}
const SOCIAL = ['instagram', 'tiktok', 'meta_ads', 'tiktok_ads']

function headers() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

function fmtDate(ts: string | null) {
  return ts ? new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'
}

function MetricsLine({ m }: { m: any }) {
  if (!m) return <span style={{ color: C.muted }}>Sin datos todavía</span>
  const parts: string[] = []
  if (m.contacted) parts.push(`${m.contacted} contactados`)
  if (m.reply_rate != null && m.contacted) parts.push(`${Math.round(m.reply_rate * 100)} % responden`)
  if (m.views) parts.push(`${m.views.toLocaleString('es-ES')} visualizaciones`)
  if (m.clicks) parts.push(`${m.clicks} clics`)
  if (m.followers_gained) parts.push(`+${m.followers_gained} seguidores`)
  parts.push(`${m.provider_signups || 0} altas de proveedor`)
  if (m.waitlist_signups) parts.push(`${m.waitlist_signups} emails`)
  if (m.bookings) parts.push(`${m.bookings} reservas`)
  if (m.spend_eur) parts.push(`${m.spend_eur} € gastados`)
  return (
    <span>
      {parts.join(' · ')}
      {!m.enough_data && <span style={{ color: C.warn }}> · aún sin datos suficientes</span>}
    </span>
  )
}

function ManualMetrics({ exp, onSaved }: { exp: Experiment; onSaved: () => void }) {
  const init = exp.metrics?.manual || {}
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<Record<string, string>>({
    views: String(init.views || ''), likes: String(init.likes || ''), comments: String(init.comments || ''),
    shares: String(init.shares || ''), clicks: String(init.clicks || ''), followers: String(init.followers || ''),
    spend_eur: String(init.spend_eur || ''),
  })
  const fields: Array<[string, string]> = [
    ['views', 'Visualizaciones'], ['likes', 'Me gusta'], ['comments', 'Comentarios'], ['shares', 'Compartidos'],
    ['clicks', 'Clics al enlace'], ['followers', 'Seguidores nuevos'],
    ...(exp.channel.endsWith('_ads') ? [['spend_eur', 'Gastado (€)'] as [string, string]] : []),
  ]
  async function save() {
    const res = await fetch('/api/admin/ceo', {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ experiment: { id: exp.id, op: 'metrics', manual: v } }),
    })
    if (!res.ok) { toast.error('No se pudieron guardar las métricas'); return }
    toast.success('Métricas guardadas')
    setOpen(false)
    onSaved()
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btn(C.border, C.text)}>
        {init.updated_at ? `Actualizar métricas (últimas: ${fmtDate(init.updated_at)})` : 'Meter métricas de la red'}
      </button>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
      {fields.map(([k, label]) => (
        <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted }}>
          {label}
          <input type="number" min={0} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}
            style={{ background: '#0B1220', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '6px 8px', fontSize: 14 }} />
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
        <button onClick={save} style={btn(C.violet, '#fff')}>Guardar</button>
        <button onClick={() => setOpen(false)} style={btn(C.border, C.muted)}>Cancelar</button>
      </div>
    </div>
  )
}

function btn(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
}

export default function GrowthPanel({ experiments, settings, reload, saveSettings }: {
  experiments: Experiment[]
  settings: Settings | null
  reload: () => void
  saveSettings: (patch: Record<string, unknown>) => Promise<void>
}) {
  const proposed = experiments.filter(e => e.status === 'proposed')
  const running = experiments.filter(e => e.status === 'running')
  const closed = experiments.filter(e => ['won', 'lost', 'stopped', 'rejected'].includes(e.status)).slice(0, 12)

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const committed = experiments
    .filter(e => e.channel.endsWith('_ads') && e.created_at >= monthStart && e.status !== 'rejected')
    .reduce((s, e) => s + Number(e.budget_eur || 0), 0)

  async function op(id: string, o: 'approve' | 'reject' | 'stop') {
    const res = await fetch('/api/admin/ceo', {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ experiment: { id, op: o } }),
    })
    if (!res.ok) { toast.error('No se pudo guardar'); return }
    toast.success(o === 'approve' ? 'Aprobado: lánzalo en la plataforma de anuncios' : o === 'reject' ? 'Rechazado' : 'Experimento parado')
    reload()
  }

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB' }}>📈 Crecimiento · experimentos</h2>
        <span style={{ fontSize: 12, color: C.muted }}>
          Proveedores primero; clientes solo donde haya {settings?.supply_threshold ?? 3}+ proveedores publicados por ciudad y categoría.
        </span>
      </div>

      {settings?.wa_braked_at && (
        <div style={{ ...card, borderColor: C.bad }}>
          <p style={{ color: C.bad, fontWeight: 700, fontSize: 14 }}>🛑 Freno de WhatsApp activado ({fmtDate(settings.wa_braked_at)})</p>
          <p style={{ color: C.text, fontSize: 13, margin: '6px 0 10px' }}>{settings.wa_brake_reason}. El CEO no envía WhatsApps hasta que lo reactives.</p>
          <button onClick={() => saveSettings({ wa_unbrake: true })} style={btn(C.bad, '#fff')}>Reactivar WhatsApp</button>
        </div>
      )}

      <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: C.text }}>
          Anuncios este mes: <b>{committed} €</b> de <b>{settings?.ads_budget_eur ?? 50} €</b>. El CEO solo los propone; tú decides y pagas.
        </div>
        <label style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
          Presupuesto mensual (€)
          <input type="number" min={0} defaultValue={settings?.ads_budget_eur ?? 50}
            onBlur={e => { const n = Number(e.target.value); if (n !== settings?.ads_budget_eur) saveSettings({ ads_budget_eur: n }) }}
            style={{ width: 80, background: '#0B1220', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '5px 8px' }} />
        </label>
      </div>

      {[...proposed, ...running].map(e => (
        <div key={e.id} style={{ ...card, borderColor: e.status === 'proposed' ? C.warn : C.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
              {e.audience === 'proveedores' ? 'Proveedores' : 'Clientes'} · {CHANNEL[e.channel] || e.channel}
              {e.format ? ` · ${e.format}` : ''}{e.city ? ` · ${e.city}` : ''}{e.category ? ` · ${e.category}` : ''}
              {e.budget_eur > 0 ? ` · ${e.budget_eur} €` : ''}
            </p>
            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[e.status][1] }}>{STATUS[e.status][0]}</span>
          </div>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>{e.hypothesis}</p>
          {e.variant && <p style={{ color: C.text, fontSize: 13, marginTop: 4 }}>Mensaje: {e.variant}</p>}
          {e.status === 'running' && (
            <p style={{ color: C.text, fontSize: 13, marginTop: 8 }}>
              {fmtDate(e.started_at)} → {fmtDate(e.ends_at)} · <MetricsLine m={e.metrics?.live} />
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {e.status === 'proposed' && <>
              <button onClick={() => op(e.id, 'approve')} style={btn(C.ok, '#fff')}>Aprobar</button>
              <button onClick={() => op(e.id, 'reject')} style={btn(C.border, C.text)}>Rechazar</button>
            </>}
            {e.status === 'running' && <button onClick={() => op(e.id, 'stop')} style={btn(C.border, C.text)}>Parar</button>}
          </div>
          {e.status === 'running' && SOCIAL.includes(e.channel) && <ManualMetrics exp={e} onSaved={reload} />}
        </div>
      ))}

      {!proposed.length && !running.length && (
        <p style={{ ...card, color: C.muted, fontSize: 13 }}>
          Aún no hay experimentos. El CEO los abrirá en su próxima rutina (ejecútala arriba si no quieres esperar).
        </p>
      )}

      {closed.length > 0 && (
        <div style={card}>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Lo aprendido</p>
          {closed.map(e => (
            <p key={e.id} style={{ fontSize: 13, color: C.muted, margin: '0 0 8px' }}>
              <span style={{ color: STATUS[e.status][1], fontWeight: 700 }}>{STATUS[e.status][0]}</span>
              {' · '}{CHANNEL[e.channel] || e.channel}{e.city ? ` · ${e.city}` : ''}{e.category ? ` · ${e.category}` : ''}
              {e.learning ? ` — ${e.learning}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
