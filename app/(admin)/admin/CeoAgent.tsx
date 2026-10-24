'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import GrowthPanel from './GrowthPanel'

// ─── Pestaña 🧠 CEO · agente IA que dirige FiestaGo ──────────────────────────
// Muestra los 5 pasos del agente (rol, contexto, tareas, rutinas, regla de
// oro), las dos rutinas programadas con botón "Ejecutar ahora", el último
// informe y la bandeja de propuestas pendientes de aprobar.

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

type Report = {
  id:         string
  created_at: string
  kind:       'daily' | 'weekly'
  headline:   string | null
  summary:    string | null
  highlights: Array<{ label: string; value: string; trend: 'up' | 'down' | 'flat' }> | null
  issues:     Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string }> | null
  emailed:    boolean
  error:      string | null
}

type Proposal = {
  id:         string
  created_at: string
  report_id:  string | null
  area:       string | null
  title:      string
  why:        string | null
  next_step:  string | null
  impact:     'alto' | 'medio' | 'bajo' | null
  effort:     'alto' | 'medio' | 'bajo' | null
  status:     'pending' | 'approved' | 'rejected' | 'executing' | 'done' | 'failed'
  action:     { type: string; limit: number; category: string; city: string; prompt: string } | null
  decided_by: string | null
  executed_at: string | null
  result:     any
}

type Settings = {
  autonomy:          'full' | 'approval'
  paused:            boolean
  max_wa_per_day:    number
  max_posts_per_day: number
  ads_budget_eur:    number
  supply_threshold:  number
  wa_braked_at:      string | null
  wa_brake_reason:   string | null
  social_autopublish: boolean
  social_max_per_day: number
}

const ACTION_LABELS: Record<string, string> = {
  whatsapp_outreach:       'WhatsApp · 1er contacto',
  whatsapp_followup:       'WhatsApp · seguimiento',
  whatsapp_remind_signups: 'WhatsApp · recordatorio alta',
  email_followup:          'Email · seguimiento',
  find_providers:          'Buscar proveedores',
  create_post:             'Crear post',
}

function actionSummary(a: NonNullable<Proposal['action']>) {
  const base = ACTION_LABELS[a.type] || a.type
  if (a.type === 'find_providers') return `${base} · ${a.category} en ${a.city} (${a.limit})`
  if (a.type === 'create_post') return (a as any).audience ? `${base} · ${(a as any).audience}` : base
  return `${base} · hasta ${a.limit}`
}

const C = {
  card:   '#111827',
  border: '#1F2937',
  violet: '#8B5CF6',
  text:   '#F0F4FF',
  muted:  '#9CA3AF',
  faint:  '#4B5563',
  ok:     '#10B981',
  warn:   '#F59E0B',
  bad:    '#EF4444',
}

const STEPS = [
  'Agente con rol de CEO',
  'Contexto: métricas reales de FiestaGo',
  'Lista de tareas (monetizar, captar, SEO, bugs…)',
  'Rutinas: parte diario + informe semanal',
  'Ejecuta solo lo que hace crecer (pagos nunca)',
]

const TASKS = [
  'monetizar reservas y comisiones',
  'captar y activar proveedores',
  'convertir la waitlist en clientes',
  'optimizar SEO y páginas para chatbots',
  'arrancar y mantener una newsletter',
  'mantener viva la cola de IG/TikTok',
  'experimentar, medir y aprender qué canal trae proveedores y clientes',
  'vigilar bugs, alertas e incidencias',
  'tenerte al día de lo que importa',
]

const ROUTINES = [
  { kind: 'daily'  as const, label: 'FiestaGo · operaciones diarias',     schedule: 'Cada día a las 07:52' },
  { kind: 'weekly' as const, label: 'FiestaGo · informe semanal del CEO', schedule: 'Cada lunes a las 09:17' },
]

function ago(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export default function CeoAgent() {
  const [reports,   setReports]   = useState<Report[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading,   setLoading]   = useState(false)
  const [running,   setRunning]   = useState<null | 'daily' | 'weekly'>(null)
  const [settings,  setSettings]  = useState<Settings | null>(null)
  const [experiments, setExperiments] = useState<any[]>([])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ceo', { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando')
      setReports(data.reports)
      setProposals(data.proposals)
      setSettings(data.settings || null)
      setExperiments(data.experiments || [])
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function run(kind: 'daily' | 'weekly') {
    setRunning(kind)
    try {
      const res = await fetch('/api/cron/ceo-agent', {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify({ kind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'La rutina falló')
      toast.success(data.emailed ? 'Informe listo y enviado por email' : 'Informe listo')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    }
    setRunning(null)
  }

  async function saveSettings(patch: Partial<Settings> & Record<string, unknown>) {
    try {
      const res = await fetch('/api/admin/ceo', {
        method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ settings: patch }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setSettings(data.settings)
      toast.success('Ajustes guardados')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function decide(id: string, status: Proposal['status']) {
    const prev = proposals
    setProposals(ps => ps.map(p => (p.id === id ? { ...p, status } : p)))
    const res = await fetch('/api/admin/ceo', {
      method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      setProposals(prev)
      toast.error('No se pudo guardar la decisión')
    }
  }

  const latest  = reports.find(r => !r.error) || null
  const pending = proposals.filter(p => p.status === 'pending')
  const decided = proposals.filter(p => p.status !== 'pending').slice(0, 10)
  const lastRun = (kind: 'daily' | 'weekly') => reports.find(r => r.kind === kind)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F9FAFB' }}>🧠 Agente CEO</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Dirige FiestaGo cada día y ejecuta las acciones de crecimiento. Los pagos siempre te los deja a ti.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
          {loading ? 'Cargando…' : '↻ Actualizar'}
        </button>
      </div>

      {/* Autonomía */}
      {settings && (
        <div style={{ background: C.card, border: `1px solid ${settings.paused ? C.bad : settings.autonomy === 'full' ? C.ok : C.border}`, borderRadius: 14, padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {settings.paused ? '⏸ En pausa: no ejecuta nada'
                : settings.autonomy === 'full' ? '⚙️ Autonomía total: ejecuta sin esperar tu OK'
                : '✋ Pide permiso antes de ejecutar'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Tope diario: {settings.max_wa_per_day} WhatsApps · {settings.max_posts_per_day} posts. Por WhatsApp: escribe PAUSA o SEGUIR.
            </div>
          </div>
          <label style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
            WhatsApps/día
            <input type="number" min={0} max={500} defaultValue={settings.max_wa_per_day}
              onBlur={e => { const v = Number(e.target.value); if (v !== settings.max_wa_per_day) saveSettings({ max_wa_per_day: v }) }}
              style={{ width: 64, background: '#0B0F19', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 6px' }} />
          </label>
          <button onClick={() => saveSettings({ autonomy: settings.autonomy === 'full' ? 'approval' : 'full' })}
            style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
            {settings.autonomy === 'full' ? 'Pedir permiso' : 'Dar autonomía total'}
          </button>
          <button onClick={() => saveSettings({ paused: !settings.paused })}
            style={{ background: settings.paused ? C.ok : C.bad, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {settings.paused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
        </div>
      )}

      <GrowthPanel experiments={experiments} settings={settings} reload={load} saveSettings={saveSettings} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Los 5 pasos */}
        <div style={{ background: C.card, border: `1px solid ${C.violet}55`, borderRadius: 14, padding: 16 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.violet, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.faint }}>{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Lista de tareas */}
        <div style={{ background: '#C2410C', borderRadius: 14, padding: 16, fontFamily: 'JetBrains Mono, monospace' }}>
          {TASKS.map(t => (
            <div key={t} style={{ fontSize: 12, color: '#FFF7ED', padding: '3px 0' }}>&gt; {t}</div>
          ))}
        </div>

        {/* Rutinas */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>Rutinas</div>
          {ROUTINES.map(r => {
            const last = lastRun(r.kind)
            return (
              <div key={r.kind} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.schedule} · {last ? `última ${ago(last.created_at)}` : 'aún no ha corrido'}</div>
                  </div>
                  <button onClick={() => run(r.kind)} disabled={running !== null}
                    style={{ background: C.violet, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', opacity: running && running !== r.kind ? 0.5 : 1 }}>
                    {running === r.kind ? 'Pensando…' : 'Ejecutar ahora'}
                  </button>
                </div>
                {last?.error && <div style={{ fontSize: 11, color: C.bad, marginTop: 6 }}>⚠ {last.error}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Último informe */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
        {!latest ? (
          <p style={{ fontSize: 13, color: C.muted }}>
            Todavía no hay informes. Pulsa «Ejecutar ahora» en una rutina. Si da error de tabla, aplica
            <code style={{ color: C.text }}> tools/migrations/migration-ceo-agent.sql</code> en Supabase.
          </p>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.violet }}>
              {latest.kind === 'weekly' ? 'Informe semanal' : 'Parte diario'} · {ago(latest.created_at)}{latest.emailed ? ' · enviado por email' : ''}
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: C.text, margin: '6px 0 8px' }}>{latest.headline}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#D1D5DB', whiteSpace: 'pre-line' }}>{latest.summary}</p>

            {!!latest.highlights?.length && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 14 }}>
                {latest.highlights.map(h => (
                  <div key={h.label} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{h.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 2 }}>
                      {h.value}{' '}
                      <span style={{ fontSize: 12, color: h.trend === 'up' ? C.ok : h.trend === 'down' ? C.bad : C.faint }}>
                        {h.trend === 'up' ? '▲' : h.trend === 'down' ? '▼' : '•'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!!latest.issues?.length && (
              <div style={{ marginTop: 14 }}>
                {latest.issues.map(i => (
                  <div key={i.title} style={{ fontSize: 13, color: '#D1D5DB', padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
                    <b style={{ color: i.severity === 'critical' ? C.bad : i.severity === 'warning' ? C.warn : C.muted }}>
                      {i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '🟠' : '🔵'} {i.title}
                    </b>{' '}— {i.detail}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Propuestas */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>
          Propuestas pendientes de tu OK {pending.length > 0 && <span style={{ color: C.violet }}>· {pending.length}</span>}
        </h3>
        {pending.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>Nada pendiente. El CEO te avisará cuando haya algo que decidir.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.map(p => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {p.area && <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.violet, border: `1px solid ${C.violet}55`, borderRadius: 6, padding: '2px 6px' }}>{p.area}</span>}
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>impacto {p.impact} · esfuerzo {p.effort}</span>
              </div>
              {p.why && <p style={{ fontSize: 13, color: '#D1D5DB', marginTop: 6 }}>{p.why}</p>}
              {p.next_step && <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}><b>Siguiente paso:</b> {p.next_step}</p>}
              {p.action && <p style={{ fontSize: 12, color: C.violet, marginTop: 4 }}>⚙️ Al aprobar se ejecuta: {actionSummary(p.action)}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => decide(p.id, 'approved')}
                  style={{ background: C.ok, color: '#04120C', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Aprobar</button>
                <button onClick={() => decide(p.id, 'rejected')}
                  style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>✕ Descartar</button>
              </div>
            </div>
          ))}
        </div>

        {decided.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: 6 }}>Actividad</div>
            {decided.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, padding: '5px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                <span title={p.status}>
                  {p.status === 'executing' ? '⏳' : p.status === 'done' ? '🏁' : p.status === 'failed' ? '⚠️' : p.status === 'approved' ? (p.action ? '🕒' : '✅') : '✕'}
                </span>
                <span style={{ flex: 1, minWidth: 180 }}>
                  {p.title}
                  {p.action && <span style={{ color: C.violet }}> · {actionSummary(p.action)}</span>}
                  {p.decided_by === 'ceo' && <span style={{ color: C.faint }}> · decidido por el CEO</span>}
                  {p.status === 'approved' && p.action && <span style={{ color: C.faint }}> · en cola</span>}
                  {p.status === 'failed' && <span style={{ color: C.bad }}> · falló{p.result?.http ? ` (HTTP ${p.result.http})` : ''}</span>}
                </span>
                {p.status === 'approved' && !p.action && (
                  <button onClick={() => decide(p.id, 'done')}
                    style={{ background: 'transparent', color: C.ok, border: `1px solid ${C.ok}55`, borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Marcar hecha</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
