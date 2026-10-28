// ───────────────────────────────────────────────────────────────────────
// Latido del Agente CEO (función de segundo plano de Netlify: hasta 15 min,
// sin el corte de 30-60 s de las funciones normales).
//
// Lo dispara Supabase (pg_cron + pg_net) cada 10 minutos, puntual, en
// lugar de depender de los crons de GitHub, que se retrasan horas.
// En cada latido:
//   1. Si toca y aún no hay informe (diario desde las 07:00, semanal el
//      lunes desde las 09:00, hora de Madrid), ejecuta la rutina del CEO.
//   2. Ejecuta la cola de acciones aprobadas. La búsqueda de proveedores
//      corre aquí mismo (antes fallaba siempre por tiempo); el resto llama
//      a su endpoint de siempre.
// El workflow de GitHub "🧠 Agente CEO" sigue de respaldo: la rutina se
// salta si ya hay informe y las acciones se reclaman de forma atómica.
//
// Auth: cabecera x-tick-secret = CEO_TICK_SECRET (variable de Netlify).
// ───────────────────────────────────────────────────────────────────────

import { createAdminClient } from '../../lib/supabase'
import { runCeoRoutine, type CeoKind } from '../../lib/ceo-agent'
import { claimNextAction, completeAction } from '../../lib/ceo-actions'
import { runProviderSearch } from '../../lib/provider-search'
import { releaseHolds } from '../../lib/date-holds'
import { holdFollowups } from '../../lib/proposals'
import { remindIncompleteProfiles } from '../../lib/provider-completeness'
import { sendDailyPlan } from '../../lib/captacion'
import { publishNext } from '../../lib/social-publisher'

const MAX_ACTIONS = 20

function madridNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(new Date())
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const weekday = parts.find(p => p.type === 'weekday')?.value
  return { hour, monday: weekday === 'Mon' }
}

async function routineIfMissing(supabase: any, base: string) {
  const { hour, monday } = madridNow()
  const kind: CeoKind | null = monday && hour >= 9 ? 'weekly' : hour >= 7 ? 'daily' : null
  if (!kind) return 'antes de las 07:00, sin rutina'

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  const since = kind === 'weekly'
    ? new Date(Date.now() - 6 * 86400_000).toISOString()
    : new Date(`${today}T00:00:00+02:00`).toISOString()
  const { count } = await supabase.from('ceo_reports')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind).is('error', null).gte('created_at', since)
  if ((count ?? 0) > 0) return `${kind}: ya hay informe`

  const r = await runCeoRoutine(supabase, kind, { adminUrl: `${base}/admin?section=ceo`, email: true })
  return `${kind}: informe ${r.id}`
}

async function runQueue(supabase: any, base: string) {
  const log: string[] = []
  for (let i = 0; i < MAX_ACTIONS; i++) {
    const next: any = await claimNextAction(supabase)
    if (next.none) { log.push(`cola: ${next.reason}`); break }

    if (next.type === 'find_providers') {
      const res = await runProviderSearch(next.body)
      await completeAction(supabase, next.id, !res.error, {
        saved: res.saved, target: res.target, skippedDup: res.skippedDup, skippedNoWa: res.skippedNoWa,
        error: res.error, logs: res.logs.slice(-15),
      })
      log.push(`${next.title}: ${res.error ? `error ${res.error}` : `${res.saved} guardados`}`)
      continue
    }

    try {
      const resp = await fetch(base + next.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
        body: JSON.stringify(next.body),
        signal: AbortSignal.timeout(120_000),
      })
      const text = await resp.text()
      let body: unknown = text.slice(0, 3000)
      try { body = JSON.parse(text) } catch { /* HTML de error */ }
      await completeAction(supabase, next.id, resp.ok, { http: String(resp.status), body })
      log.push(`${next.title}: HTTP ${resp.status}`)
    } catch (err: any) {
      await completeAction(supabase, next.id, false, { error: err.message })
      log.push(`${next.title}: ${err.message}`)
    }
  }
  return log
}

export default async (req: Request) => {
  if (!process.env.CEO_TICK_SECRET || req.headers.get('x-tick-secret') !== process.env.CEO_TICK_SECRET) {
    console.log('[ceo-tick] rechazado:', process.env.CEO_TICK_SECRET ? 'clave incorrecta' : 'falta CEO_TICK_SECRET')
    return new Response('No autorizado', { status: 401 })
  }
  console.log('[ceo-tick] inicio')
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://fiestago.es').replace(/\/$/, '')
  const supabase = createAdminClient()
  const out: Record<string, unknown> = { at: new Date().toISOString() }
  try {
    out.routine = await routineIfMissing(supabase, base)
  } catch (err: any) {
    out.routine = `error: ${err.message}`
  }
  try {
    out.queue = await runQueue(supabase, base)
  } catch (err: any) {
    out.queue = `error: ${err.message}`
  }
  // Vídeo diario de HeyGen: desde las 08:00 lo crea si aún no existe (la
  // ruta se salta sola si ya hay vídeo hoy) y en cada latido recoge los
  // que estén terminados. GitHub sigue de respaldo.
  const cron = async (path: string) => {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
      body: '{}', signal: AbortSignal.timeout(120_000),
    })
    return `${r.status} ${(await r.text()).slice(0, 200)}`
  }
  try {
    // Como mucho 3 intentos al día (8, 11 y 14 h): si HeyGen falla, no
    // reintentamos cada 10 minutos gastando guiones
    if ([8, 11, 14].includes(madridNow().hour) && new Date().getUTCMinutes() < 10) {
      out.video_generate = await cron('/api/cron/content-daily-generate')
    }
    out.video_poll = await cron('/api/cron/content-daily-poll')
  } catch (err: any) {
    out.video = `error: ${err.message}`
  }

  // Redes: publica lo siguiente de cada cuenta (9:00-21:00 Madrid). El
  // publicador respeta el tope diario y deja 3 h entre piezas de la misma
  // cuenta; el workflow de GitHub queda de respaldo.
  const { hour } = madridNow()
  if (hour >= 9 && hour < 21) {
    try {
      out.social = await publishNext(supabase)
    } catch (err: any) {
      out.social = `error: ${err.message}`
    }
  }
  // Libera las fechas bloqueadas 48 h gratis que han caducado sin reserva
  try {
    out.holds_expired = await releaseHolds(supabase, { expired: true, status: 'expired' })
  } catch (err: any) {
    out.holds_expired = `error: ${err.message}`
  }
  // Seguimiento de ayuda a las ~20 h de cada petición (cliente) y aviso al
  // proveedor que aún no ha mandado su propuesta. Solo en horario de día.
  // Lunes a las 10: recordatorio a los proveedores con la ficha incompleta
  const mn = madridNow()
  if (mn.monday && mn.hour === 10 && new Date().getUTCMinutes() < 10) {
    try {
      out.profile_reminders = await remindIncompleteProfiles(supabase)
    } catch (err: any) {
      out.profile_reminders = `error: ${err.message}`
    }
  }
  // Lunes a viernes a las 8: plan de captación del día a Mariano (lib/captacion.ts)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date())
  if (!['Sat', 'Sun'].includes(wd) && mn.hour === 8 && new Date().getUTCMinutes() < 10) {
    try {
      out.captacion_plan = await sendDailyPlan(supabase)
    } catch (err: any) {
      out.captacion_plan = `error: ${err.message}`
    }
  }
  const madridHour = madridNow().hour
  if (madridHour >= 9 && madridHour < 21) {
    try {
      out.hold_followups = await holdFollowups(supabase)
    } catch (err: any) {
      out.hold_followups = `error: ${err.message}`
    }
  }
  // Las funciones de segundo plano no devuelven nada al cliente: lo
  // dejamos en los logs de Netlify (Functions → ceo-tick-background).
  console.log('[ceo-tick]', JSON.stringify(out))
  return new Response('ok')
}
