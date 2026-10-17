// ───────────────────────────────────────────────────────────────────────
// Agente CEO de FiestaGo. Inspirado en el patrón "agente con rol de CEO":
//   1. Rol de CEO       → SYSTEM prompt con el mandato del negocio
//   2. Contexto         → snapshot de métricas reales de Supabase
//   3. Lista de tareas  → MANDATE (monetizar, SEO, captación, bugs...)
//   4. Rutinas          → cron diario (07:52) + semanal (lunes 09:17)
//   5. Ejecución        → acciones del catálogo (lib/ceo-actions.ts) que
//                         se ejecutan solas con autonomía 'full', o
//                         esperan tu OK con 'approval'. Pagos y todo lo
//                         que no está en el catálogo quedan para Mariano.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { notifyCeoWhatsapp } from '@/lib/ceo-whatsapp'
import { ACTION_TYPES, CEO_CATEGORIES, CEO_CITIES, actionCatalogForPrompt, getCeoSettings, sanitizeAction } from '@/lib/ceo-actions'

const MODEL = process.env.CEO_MODEL || 'claude-opus-5-5'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

export type CeoKind = 'daily' | 'weekly'

// La "lista de tareas" del CEO. Es lo que revisa en cada rutina.
export const MANDATE: Array<{ key: string; label: string }> = [
  { key: 'monetizacion', label: 'Monetizar: reservas, comisiones y ticket medio' },
  { key: 'captacion',    label: 'Captar y activar proveedores (pendientes, registrados sin aprobar)' },
  { key: 'clientes',     label: 'Convertir la waitlist en clientes con evento' },
  { key: 'seo',          label: 'Optimizar SEO y páginas que leen los chatbots de IA' },
  { key: 'newsletter',   label: 'Arrancar y mantener una newsletter' },
  { key: 'marketing',    label: 'Mantener viva la cola de contenido de IG/TikTok' },
  { key: 'bugs',         label: 'Vigilar bugs, alertas e incidencias abiertas' },
  { key: 'reporte',      label: 'Tenerte al día de lo que importa, sin ruido' },
]

export const ROUTINES = [
  { kind: 'daily'  as const, label: 'FiestaGo · operaciones diarias', schedule: 'Cada día a las 07:52 (Madrid)' },
  { kind: 'weekly' as const, label: 'FiestaGo · informe semanal del CEO', schedule: 'Cada lunes a las 09:17 (Madrid)' },
]

// ─── Snapshot de métricas ─────────────────────────────────────────
// Cada consulta va envuelta: si una tabla no existe aún (migración sin
// aplicar), el CEO lo ve como null en vez de romper toda la rutina.

async function count(
  q: PromiseLike<{ count: number | null; error: any }>,
): Promise<number | null> {
  try {
    const { count: c, error } = await q
    return error ? null : (c ?? 0)
  } catch {
    return null
  }
}

async function rows<T = any>(q: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await q
    return error ? [] : (data || [])
  } catch {
    return []
  }
}

function sinceIso(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

export async function gatherSnapshot(supabase: SupabaseClient, kind: CeoKind) {
  const windowDays = kind === 'weekly' ? 7 : 1
  const since = sinceIso(windowDays)
  const head = { count: 'exact' as const, head: true }

  const [
    providersTotal, providersApproved, providersPending, providersSelfRegPending,
    providersNew, waitlistTotal, waitlistNew, viewsWindow,
    socialPending, alertsOpen, incidentsOpen,
  ] = await Promise.all([
    count(supabase.from('providers').select('id', head)),
    count(supabase.from('providers').select('id', head).eq('status', 'approved')),
    count(supabase.from('providers').select('id', head).eq('status', 'pending')),
    count(supabase.from('providers').select('id', head).eq('status', 'pending').eq('self_registered', true)),
    count(supabase.from('providers').select('id', head).gte('created_at', since)),
    count(supabase.from('waitlist').select('id', head)),
    count(supabase.from('waitlist').select('id', head).gte('created_at', since)),
    count(supabase.from('provider_views').select('id', head).gte('created_at', since)),
    count(supabase.from('social_posts').select('id', head).eq('status', 'pending')),
    count(supabase.from('agent_alerts').select('id', head).eq('resolved', false)),
    count(supabase.from('incidents').select('id', head).in('status', ['open', 'investigating'])),
  ])

  const bookings = await rows(
    supabase.from('bookings')
      .select('status, total_amount, commission_amt, created_at')
      .gte('created_at', sinceIso(30)),
  )
  const inWindow  = bookings.filter((b: any) => b.created_at >= since)
  const confirmed = (list: any[]) => list.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const sum = (list: any[], k: string) => list.reduce((s, b) => s + Number(b[k] || 0), 0)

  const alerts = await rows(
    supabase.from('agent_alerts')
      .select('severity, title, source, created_at')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(8),
  )

  const lastVideo = await rows(
    supabase.from('content_videos')
      .select('scheduled_for, heygen_status, published_at')
      .order('scheduled_for', { ascending: false })
      .limit(1),
  )

  const [waOutreachEligible, waOutbound7d] = await Promise.all([
    count(supabase.from('providers').select('id', head)
      .or('outreach_sent.is.null,outreach_sent.eq.false')
      .or('whatsapp_invalid.is.null,whatsapp_invalid.eq.false')
      .eq('status', 'pending')
      .or('phone.not.is.null,outreach_whatsapp.not.is.null')),
    count(supabase.from('whatsapp_messages').select('id', head).eq('direction', 'outbound').gte('created_at', sinceIso(7))),
  ])
  const lastWaOutbound = await rows(
    supabase.from('whatsapp_messages').select('created_at').eq('direction', 'outbound')
      .order('created_at', { ascending: false }).limit(1),
  )

  // Lo que el CEO ejecutó últimamente y cómo salió, para que aprenda.
  const recentActions = await rows(
    supabase.from('ceo_proposals')
      .select('title, action, status, result, executed_at')
      .not('action', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
  )

  // Propuestas que siguen sin decidir: el CEO no debe repetirlas.
  const openProposals = await rows(
    supabase.from('ceo_proposals')
      .select('title, area, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(15),
  )

  return {
    generated_at: new Date().toISOString(),
    window_days:  windowDays,
    providers: {
      total:                 providersTotal,
      approved:              providersApproved,
      pending:               providersPending,
      self_registered_pending: providersSelfRegPending,
      new_in_window:         providersNew,
    },
    bookings: {
      in_window:             inWindow.length,
      confirmed_in_window:   confirmed(inWindow).length,
      pending_in_window:     inWindow.filter((b: any) => b.status === 'pending').length,
      gmv_30d:               Math.round(sum(confirmed(bookings), 'total_amount')),
      commissions_30d:       Math.round(sum(confirmed(bookings), 'commission_amt')),
    },
    demand: {
      waitlist_total:        waitlistTotal,
      waitlist_new_in_window: waitlistNew,
      provider_views_in_window: viewsWindow,
    },
    marketing: {
      social_posts_pending_approval: socialPending,
      last_daily_video:      lastVideo[0] || null,
    },
    whatsapp: {
      providers_never_contacted_with_phone: waOutreachEligible,
      outbound_messages_7d:  waOutbound7d,
      last_outbound_at:      lastWaOutbound[0]?.created_at || null,
    },
    recent_actions: recentActions.map((a: any) => ({
      title: a.title, type: a.action?.type, limit: a.action?.limit, status: a.status,
      executed_at: a.executed_at,
      result: a.result ? JSON.stringify(a.result).slice(0, 300) : null,
    })),
    health: {
      open_alerts:           alertsOpen,
      open_incidents:        incidentsOpen,
      latest_alerts:         alerts,
    },
    open_proposals: openProposals,
  }
}

export type CeoSnapshot = Awaited<ReturnType<typeof gatherSnapshot>>

// ─── El cerebro: Claude con rol de CEO ────────────────────────────

const SYSTEM = `Eres el CEO de FiestaGo (fiestago.es), un marketplace español de proveedores de bodas, cumpleaños, comuniones y eventos. El dueño es Mariano; tú le reportas a él.

Tu trabajo es dirigir el negocio día a día con esta lista de tareas:
${MANDATE.map(m => `- ${m.label}`).join('\n')}

Cómo trabajas:
- Te basas SOLO en las métricas del snapshot que recibes. Si un dato es null, la tabla no está disponible: dilo, no lo inventes.
- Solo le escribes a Mariano si algo importa. Nada de relleno ni de felicitaciones vacías.
- Puedes EJECUTAR tú mismo estas acciones (campo "action" de cada propuesta):
${actionCatalogForPrompt()}
  Para find_providers indica category (${CEO_CATEGORIES.join(', ')}) y city (${CEO_CITIES.join(', ')}). Para create_post escribe en "prompt" el encargo del post (tema, tono, formato) y nunca menciones fechas ya pasadas. En los campos que no apliquen pon 0 o "".
- Pagos, cobros, reembolsos y cambios de precio NUNCA los ejecutas: usa type "none" y quedan como tarea para Mariano. Igual con lo que no esté en el catálogo (cambios en la web, publicar en redes, hablar con clientes).
- Usa el modo de autonomía que recibes: con "full" tus acciones se ejecutan sin esperar; con "approval" esperan su OK. Hay topes diarios de WhatsApps y posts; no los superes.
- Mira "recent_actions": si algo falló o no dio resultado, no lo repitas igual; ajusta o propón otra cosa.
- Propón como máximo 5 acciones, priorizadas por impacto en el crecimiento del marketplace (más proveedores activos, más demanda, más reservas). No repitas propuestas que ya están en "open_proposals".
- Escribe en español de España, tono directo y cercano, tuteando.`

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'highlights', 'issues', 'proposals'],
  properties: {
    headline: { type: 'string', description: 'Titular de una línea, máximo 90 caracteres' },
    summary:  { type: 'string', description: 'Mensaje a Mariano, 3-6 frases' },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'trend'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          trend: { type: 'string', enum: ['up', 'down', 'flat'] },
        },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'detail'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          title:    { type: 'string' },
          detail:   { type: 'string' },
        },
      },
    },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'title', 'why', 'next_step', 'impact', 'effort', 'action'],
        properties: {
          area:      { type: 'string', enum: MANDATE.map(m => m.key) },
          title:     { type: 'string' },
          why:       { type: 'string' },
          next_step: { type: 'string', description: 'Qué harías exactamente si Mariano lo aprueba' },
          impact:    { type: 'string', enum: ['alto', 'medio', 'bajo'] },
          effort:    { type: 'string', enum: ['alto', 'medio', 'bajo'] },
          action: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'limit', 'category', 'city', 'prompt'],
            properties: {
              type:     { type: 'string', enum: [...ACTION_TYPES, 'none'] },
              limit:    { type: 'integer' },
              category: { type: 'string' },
              city:     { type: 'string' },
              prompt:   { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const

export type CeoReport = {
  headline:   string
  summary:    string
  highlights: Array<{ label: string; value: string; trend: 'up' | 'down' | 'flat' }>
  issues:     Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string }>
  proposals:  Array<{ area: string; title: string; why: string; next_step: string; impact: string; effort: string; action: any; auto?: boolean }>
}

export async function thinkAsCeo(kind: CeoKind, snapshot: CeoSnapshot, autonomy: string, caps: string): Promise<CeoReport> {
  const routine = kind === 'weekly'
    ? 'Rutina SEMANAL (lunes): resume la semana, compara con lo esperado y fija las 3 prioridades de esta semana.'
    : 'Rutina DIARIA: revisa las últimas 24h y decide qué ejecutar hoy para hacer crecer el marketplace.'

  const resp = await client().messages.create({
    model:      MODEL,
    max_tokens: 16000,
    output_config: {
      // Esfuerzo contenido: la función tiene que caber en el timeout de Netlify.
      effort: kind === 'weekly' ? 'medium' : 'low',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `${routine}\n\n[Modo de autonomía] ${autonomy} · ${caps}\n\n[Snapshot de métricas]\n${JSON.stringify(snapshot, null, 2)}`,
    }],
  })

  if (resp.stop_reason === 'refusal') throw new Error('El modelo rechazó generar el informe')
  if (resp.stop_reason === 'max_tokens') throw new Error('Informe truncado (max_tokens)')

  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim()
  return JSON.parse(raw) as CeoReport
}

// ─── Email del informe ────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function emailCeoReport(kind: CeoKind, report: CeoReport, adminUrl: string) {
  const to = process.env.ADMIN_EMAIL || 'contacto@fiestago.es'
  const tag = kind === 'weekly' ? 'Informe semanal' : 'Parte diario'
  const subject = `🧠 CEO FiestaGo · ${tag} · ${report.headline}`.slice(0, 160)
  const arrow = (t: string) => (t === 'up' ? '▲' : t === 'down' ? '▼' : '•')

  const text = [
    report.headline, '',
    report.summary, '',
    ...(report.highlights.length ? ['Métricas:', ...report.highlights.map(h => `${arrow(h.trend)} ${h.label}: ${h.value}`), ''] : []),
    ...(report.issues.length ? ['Problemas:', ...report.issues.map(i => `[${i.severity}] ${i.title} — ${i.detail}`), ''] : []),
    ...(report.proposals.length
      ? ['Acciones:', ...report.proposals.map((p, n) => `${n + 1}. ${p.auto ? '[LO EJECUTO YO] ' : '[TE TOCA] '}${p.title}\n   Por qué: ${p.why}\n   Siguiente paso: ${p.next_step}`), '']
      : []),
    `Revisa, pausa o decide en ${adminUrl}`,
  ].join('\n')

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1A1612">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7C3AED;margin:0 0 6px">🧠 CEO FiestaGo · ${tag}</p>
  <h1 style="font-size:22px;margin:0 0 14px">${esc(report.headline)}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(report.summary)}</p>
  ${report.highlights.length ? `<table style="width:100%;border-collapse:collapse;margin:0 0 18px">${report.highlights.map(h => `
    <tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px">${esc(h.label)}</td>
    <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-weight:700">${arrow(h.trend)} ${esc(h.value)}</td></tr>`).join('')}</table>` : ''}
  ${report.issues.length ? `<h2 style="font-size:16px;margin:0 0 8px">Problemas</h2>${report.issues.map(i => `
    <p style="font-size:14px;line-height:1.5;margin:0 0 8px"><b>${i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '🟠' : '🔵'} ${esc(i.title)}</b><br>${esc(i.detail)}</p>`).join('')}` : ''}
  ${report.proposals.length ? `<h2 style="font-size:16px;margin:18px 0 8px">Acciones</h2>${report.proposals.map((p, n) => `
    <div style="border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin:0 0 10px">
      <p style="margin:0 0 4px;font-size:15px;font-weight:700">${n + 1}. ${esc(p.title)} <span style="font-size:11px;font-weight:700;color:${p.auto ? '#059669' : '#B45309'}">${p.auto ? 'LO EJECUTO YO' : 'TE TOCA'}</span></p>
      <p style="margin:0 0 4px;font-size:13px;color:#555">${esc(p.why)}</p>
      <p style="margin:0;font-size:13px"><b>Siguiente paso:</b> ${esc(p.next_step)} · impacto ${p.impact} · esfuerzo ${p.effort}</p>
    </div>`).join('')}` : ''}
  <p style="margin:22px 0 0"><a href="${adminUrl}" style="background:#7C3AED;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Abrir panel del CEO</a></p>
</div>`

  return sendEmail({ to, subject, text, html })
}

// ─── Rutina completa ──────────────────────────────────────────────

export async function runCeoRoutine(supabase: SupabaseClient, kind: CeoKind, opts: { adminUrl: string; email?: boolean }) {
  const snapshot = await gatherSnapshot(supabase, kind)
  const settings = await getCeoSettings(supabase)
  const autonomy = settings.paused ? 'approval (agente en pausa: no se ejecutará nada)' : settings.autonomy
  const caps = `topes diarios: ${settings.max_wa_per_day} WhatsApps, ${settings.max_posts_per_day} posts`

  let report: CeoReport
  try {
    report = await thinkAsCeo(kind, snapshot, autonomy, caps)
  } catch (err: any) {
    await supabase.from('ceo_reports').insert({ kind, snapshot, model: MODEL, error: err.message })
    throw err
  }

  const { data: saved, error } = await supabase
    .from('ceo_reports')
    .insert({
      kind,
      headline:   report.headline,
      summary:    report.summary,
      highlights: report.highlights,
      issues:     report.issues,
      snapshot,
      model:      MODEL,
    })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo guardar el informe: ${error.message}`)

  if (report.proposals.length) {
    const toInsert = report.proposals.map((p, i) => {
        const action = sanitizeAction(p.action)
        // Autonomía total: lo ejecutable queda aprobado por el propio CEO.
        const auto = !!action && settings.autonomy === 'full'
        return {
          ...p,
          action,
          report_id:  saved.id,
          position:   i + 1,
          status:     auto ? 'approved' : 'pending',
          decided_by: auto ? 'ceo' : null,
          decided_at: auto ? new Date().toISOString() : null,
        }
      })
    await supabase.from('ceo_proposals').insert(toInsert)
    report.proposals.forEach((p, i) => { p.auto = toInsert[i].status === 'approved' })
  }

  // El parte diario solo llega al email si hay algo que mirar; el
  // semanal llega siempre.
  const worthEmail = kind === 'weekly' || report.issues.some(i => i.severity !== 'info') || report.proposals.length > 0
  let emailed = false
  if (opts.email !== false && worthEmail) {
    const send = await emailCeoReport(kind, report, opts.adminUrl)
    emailed = send.ok
    if (emailed) await supabase.from('ceo_reports').update({ emailed: true }).eq('id', saved.id)
  }

  // Decisiones al móvil por WhatsApp (si ADMIN_WHATSAPP_NUMBER está puesto)
  let whatsapp: Awaited<ReturnType<typeof notifyCeoWhatsapp>> | null = null
  if (opts.email !== false && report.proposals.length) {
    whatsapp = await notifyCeoWhatsapp(supabase, report.headline, report.proposals.filter(p => p.auto).map(p => p.title))
  }

  return { id: saved.id as string, report, emailed, whatsapp }
}
