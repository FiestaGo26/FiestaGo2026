// ───────────────────────────────────────────────────────────────────────
// Motor de crecimiento del Agente CEO: medir → experimentar → aprender.
//
//   · Embudo por canal (30 días) para proveedores y para clientes, con el
//     origen real de cada alta (outreach o utm_* de lib/attribution.ts).
//   · Cuaderno de experimentos (marketing_experiments): cada uno prueba
//     UNA cosa (canal + formato + mensaje) con un público y se cierra con
//     un veredicto y lo aprendido. Lo aprendido vuelve al CEO cada día:
//     así se autoalimenta.
//   · Reglas duras que el modelo no puede saltarse (las aplica el código):
//       - Proveedores primero: experimentos de clientes solo donde hay
//         oferta publicada suficiente (supply_threshold).
//       - Anuncios: solo propuestas; nunca se gastan sin Mariano y la suma
//         del mes no pasa de ads_budget_eur.
//       - Sin datos suficientes no hay ganador ni perdedor.
//       - Freno de WhatsApp por bajas o fallos.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CeoSettings } from '@/lib/ceo-actions'

export const AUDIENCES = ['proveedores', 'clientes'] as const
export const CHANNELS = ['whatsapp', 'email', 'instagram', 'tiktok', 'meta_ads', 'tiktok_ads', 'seo', 'otro'] as const
export const AD_CHANNELS = ['meta_ads', 'tiktok_ads'] as const
const MAX_RUNNING = 6

type Channel = typeof CHANNELS[number]

function since(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

async function safe<T>(q: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await q
    return error ? [] : (data || [])
  } catch {
    return []
  }
}

const campaignOf = (acq: any): string => acq?.last?.utm_campaign || acq?.first?.utm_campaign || ''
const sourceOf = (acq: any): string => acq?.last?.utm_source || acq?.first?.utm_source || ''

// ─── Freno de WhatsApp ────────────────────────────────────────────

const OPTOUT_RE = /\b(baja|stop|no me (escrib|mand|molest|contact)|dej(a|ad|en) de (escrib|mand)|spam|bloque)/i

export async function waHealth(supabase: SupabaseClient) {
  const msgs = await safe<any>(
    supabase.from('whatsapp_messages')
      .select('direction, status, body, type')
      .gte('created_at', since(7))
      .limit(5000),
  )
  const outbound = msgs.filter(m => m.direction === 'outbound')
  const inbound = msgs.filter(m => m.direction === 'inbound')
  const failed = outbound.filter(m => m.status === 'failed').length
  const optouts = inbound.filter(m => OPTOUT_RE.test(String(m.body || ''))).length
  const n = outbound.length
  return {
    outbound_7d: n,
    inbound_7d: inbound.length,
    failed_7d: failed,
    optouts_7d: optouts,
    failed_rate: n ? failed / n : 0,
    optout_rate: n ? optouts / n : 0,
  }
}

/** Activa el freno si las tasas pasan los umbrales (con al menos 20 envíos). */
export async function checkWaBrake(supabase: SupabaseClient, settings: CeoSettings) {
  const h = await waHealth(supabase)
  if (settings.wa_braked_at || h.outbound_7d < 20) return { braked: !!settings.wa_braked_at, health: h }
  let reason = ''
  if (h.optout_rate > settings.wa_brake_optout) reason = `Bajas al ${(h.optout_rate * 100).toFixed(1)} % (${h.optouts_7d} de ${h.outbound_7d}) en 7 días`
  else if (h.failed_rate > settings.wa_brake_failed) reason = `Fallos de envío al ${(h.failed_rate * 100).toFixed(1)} % (${h.failed_7d} de ${h.outbound_7d}) en 7 días`
  if (!reason) return { braked: false, health: h }

  await supabase.from('ceo_settings').update({ wa_braked_at: new Date().toISOString(), wa_brake_reason: reason }).eq('id', 1)
  await supabase.from('agent_alerts').insert({
    severity: 'critical', source: 'ceo-growth',
    title: 'Freno de WhatsApp activado',
    detail: `${reason}. El Agente CEO no enviará más WhatsApps hasta que lo reactives en el panel.`,
    resolved: false,
  }).then(() => {}, () => {})
  return { braked: true, reason, health: h }
}

// ─── Métricas de un experimento ───────────────────────────────────

export async function experimentMetrics(supabase: SupabaseClient, exp: any) {
  const slug = exp.slug as string
  const [provsOutreach, provsUtm, waitUtm, bookUtm] = await Promise.all([
    safe<any>(supabase.from('providers').select('id, status, self_registered').eq('outreach_experiment', slug)),
    safe<any>(supabase.from('providers').select('id, status').or(`acquisition->last->>utm_campaign.eq.${slug},acquisition->first->>utm_campaign.eq.${slug}`)),
    safe<any>(supabase.from('waitlist').select('id').or(`acquisition->last->>utm_campaign.eq.${slug},acquisition->first->>utm_campaign.eq.${slug}`)),
    safe<any>(supabase.from('bookings').select('id, status, total_amount').or(`acquisition->last->>utm_campaign.eq.${slug},acquisition->first->>utm_campaign.eq.${slug}`)),
  ])

  let replied = 0
  if (provsOutreach.length) {
    const ids = provsOutreach.map(p => p.id)
    const inbound = await safe<any>(
      supabase.from('whatsapp_messages').select('provider_id').eq('direction', 'inbound').in('provider_id', ids.slice(0, 500)),
    )
    replied = new Set(inbound.map(m => m.provider_id)).size
  }

  const posts = await safe<any>(
    supabase.from('social_posts')
      .select('status, metric_views, metric_likes, metric_comments, metric_shares, metric_clicks')
      .eq('context->>experiment', slug),
  )
  const sum = (k: string) => posts.reduce((s, p) => s + Number(p[k] || 0), 0)
  const manual = exp.metrics?.manual || {}

  const contacted = provsOutreach.length
  const providerSignups = provsOutreach.filter(p => p.self_registered).length + provsUtm.length
  const confirmedBookings = bookUtm.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const conversions = providerSignups + waitUtm.length + bookUtm.length
  const views = sum('metric_views') + Number(manual.views || 0)

  // Umbrales mínimos para poder sacar conclusiones con tan poco volumen.
  const enough =
    exp.channel === 'whatsapp' || exp.channel === 'email' ? contacted >= 30
    : exp.channel === 'instagram' || exp.channel === 'tiktok' ? views >= 1000 || conversions >= 5
    : conversions >= 5

  return {
    contacted,
    replied,
    reply_rate: contacted ? +(replied / contacted).toFixed(3) : null,
    provider_signups: providerSignups,
    provider_approved: provsOutreach.filter(p => p.status === 'approved').length + provsUtm.filter(p => p.status === 'approved').length,
    waitlist_signups: waitUtm.length,
    bookings: bookUtm.length,
    bookings_confirmed: confirmedBookings.length,
    gmv: Math.round(confirmedBookings.reduce((s, b) => s + Number(b.total_amount || 0), 0)),
    posts: posts.length,
    posts_published: posts.filter(p => p.status === 'published').length,
    views,
    likes: sum('metric_likes') + Number(manual.likes || 0),
    comments: sum('metric_comments') + Number(manual.comments || 0),
    shares: sum('metric_shares') + Number(manual.shares || 0),
    clicks: sum('metric_clicks') + Number(manual.clicks || 0),
    followers_gained: Number(manual.followers || 0),
    spend_eur: Number(manual.spend_eur || 0),
    conversions,
    enough_data: enough,
    manual_updated_at: manual.updated_at || null,
  }
}

// ─── Snapshot de crecimiento para el CEO ──────────────────────────

export async function gatherGrowth(supabase: SupabaseClient, settings: CeoSettings) {
  const d30 = since(30)
  const [provs, wait, books, experiments, approved] = await Promise.all([
    safe<any>(supabase.from('providers')
      .select('status, contacted_via, outreach_at, self_registered, self_registered_at, acquisition, category, city')
      .or(`outreach_at.gte.${d30},self_registered_at.gte.${d30}`).limit(5000)),
    safe<any>(supabase.from('waitlist').select('source, acquisition, event_type, city').gte('created_at', d30)),
    safe<any>(supabase.from('bookings').select('status, total_amount, acquisition, city').gte('created_at', d30)),
    safe<any>(supabase.from('marketing_experiments').select('*').order('created_at', { ascending: false }).limit(40)),
    safe<any>(supabase.from('providers').select('category, city').eq('status', 'approved')),
  ])

  // Embudo de proveedores por canal
  const funnel: Record<string, { contacted: number; registered: number; approved: number }> = {}
  const bump = (k: string, f: 'contacted' | 'registered' | 'approved') => {
    funnel[k] ||= { contacted: 0, registered: 0, approved: 0 }
    funnel[k][f]++
  }
  for (const p of provs) {
    const outreach = p.contacted_via && p.outreach_at
    const ch = outreach ? `outreach_${p.contacted_via}` : (sourceOf(p.acquisition) || 'directo')
    if (outreach && p.outreach_at >= d30) bump(ch, 'contacted')
    if (p.self_registered && p.self_registered_at >= d30) bump(ch, 'registered')
    if (p.self_registered && p.self_registered_at >= d30 && p.status === 'approved') bump(ch, 'approved')
  }

  const bySource = (list: any[], fallback: (r: any) => string) =>
    list.reduce((m: Record<string, number>, r) => {
      const k = sourceOf(r.acquisition) || fallback(r)
      m[k] = (m[k] || 0) + 1
      return m
    }, {})

  // Oferta publicada por ciudad+categoría → dónde se puede captar clientes
  const coverage: Record<string, number> = {}
  for (const p of approved) {
    const k = `${String(p.city || '').trim()} · ${p.category}`
    coverage[k] = (coverage[k] || 0) + 1
  }
  const ready = Object.entries(coverage).filter(([, n]) => n >= settings.supply_threshold).map(([k, n]) => ({ cell: k, providers: n }))
  const gaps = Object.entries(coverage).filter(([, n]) => n < settings.supply_threshold).map(([k, n]) => ({ cell: k, providers: n }))

  const running = experiments.filter(e => e.status === 'running')
  const withMetrics = await Promise.all(running.map(async e => ({ e, m: await experimentMetrics(supabase, e) })))
  // Guardar las métricas frescas para el panel
  await Promise.all(withMetrics.map(({ e, m }) =>
    supabase.from('marketing_experiments')
      .update({ metrics: { ...e.metrics, live: m }, updated_at: new Date().toISOString() })
      .eq('id', e.id)))

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const adsThisMonth = experiments.filter(e =>
    (AD_CHANNELS as readonly string[]).includes(e.channel) && e.created_at >= monthStart && !['rejected'].includes(e.status))
  const adsCommitted = adsThisMonth.reduce((s, e) => s + Number(e.budget_eur || 0), 0)

  const wa = await checkWaBrake(supabase, settings)

  return {
    phase: ready.length ? 'proveedores + clientes donde hay oferta' : 'solo proveedores (aún no hay ninguna ciudad+categoría con oferta suficiente)',
    supply_threshold: settings.supply_threshold,
    supply_ready_for_clients: ready,
    supply_gaps: gaps.slice(0, 20),
    provider_funnel_30d: funnel,
    clients_30d: {
      waitlist_by_source: bySource(wait, r => r.source || 'desconocido'),
      bookings_by_source: bySource(books, () => 'directo'),
      bookings_confirmed: books.filter(b => b.status === 'confirmed' || b.status === 'completed').length,
    },
    experiments_running: withMetrics.map(({ e, m }) => ({
      slug: e.slug, audience: e.audience, channel: e.channel, format: e.format, variant: e.variant,
      hypothesis: e.hypothesis, city: e.city, category: e.category,
      started_at: e.started_at, ends_at: e.ends_at, overdue: e.ends_at && e.ends_at < new Date().toISOString(),
      metrics: m,
    })),
    experiments_proposed: experiments.filter(e => e.status === 'proposed').map(e => ({ slug: e.slug, channel: e.channel, budget_eur: e.budget_eur, hypothesis: e.hypothesis })),
    // La memoria: lo aprendido en experimentos cerrados
    learnings: experiments.filter(e => ['won', 'lost', 'stopped'].includes(e.status)).slice(0, 15).map(e => ({
      slug: e.slug, verdict: e.status, audience: e.audience, channel: e.channel, format: e.format, variant: e.variant,
      city: e.city, category: e.category, learning: e.learning,
      metrics: e.metrics?.final ? {
        contacted: e.metrics.final.contacted, reply_rate: e.metrics.final.reply_rate,
        provider_signups: e.metrics.final.provider_signups, conversions: e.metrics.final.conversions, views: e.metrics.final.views,
      } : null,
    })),
    ads: {
      monthly_budget_eur: settings.ads_budget_eur,
      committed_this_month_eur: adsCommitted,
      remaining_eur: Math.max(0, settings.ads_budget_eur - adsCommitted),
    },
    whatsapp_health: { braked: wa.braked, reason: settings.wa_brake_reason || (wa as any).reason || null, ...wa.health },
    limits: { max_running_experiments: MAX_RUNNING, running_now: running.length },
  }
}

export type GrowthSnapshot = Awaited<ReturnType<typeof gatherGrowth>>

// ─── Aplicar las decisiones del CEO ───────────────────────────────

export type ExperimentPlan = {
  key: string
  audience: string
  channel: string
  format: string
  hypothesis: string
  variant: string
  city: string
  category: string
  duration_days: number
  budget_eur: number
}
export type ExperimentClose = { slug: string; verdict: string; learning: string }

function slugFor(p: ExperimentPlan) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  const aud = p.audience === 'clientes' ? 'cli' : 'prov'
  return `${aud}-${p.channel}-${day}-${rand}`
}

export async function applyExperimentDecisions(
  supabase: SupabaseClient,
  settings: CeoSettings,
  growth: GrowthSnapshot,
  plans: ExperimentPlan[],
  closes: ExperimentClose[],
  reportId: string,
) {
  const log: string[] = []
  const keyToSlug: Record<string, string> = {}

  // 1 · Cierres
  for (const c of closes || []) {
    const { data: exp } = await supabase.from('marketing_experiments').select('*').eq('slug', c.slug).eq('status', 'running').maybeSingle()
    if (!exp) continue
    const m = await experimentMetrics(supabase, exp)
    let verdict = ['won', 'lost', 'stopped'].includes(c.verdict) ? c.verdict : 'stopped'
    let learning = String(c.learning || '').slice(0, 1000)
    if ((verdict === 'won' || verdict === 'lost') && !m.enough_data) {
      verdict = 'stopped'
      learning = `(Sin datos suficientes para un veredicto) ${learning}`
    }
    await supabase.from('marketing_experiments').update({
      status: verdict, learning, closed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      metrics: { ...exp.metrics, final: m },
    }).eq('id', exp.id)
    log.push(`Cerrado ${exp.slug}: ${verdict}`)
  }

  // 2 · Nuevos
  const readyCells = new Set(growth.supply_ready_for_clients.map(r => r.cell.toLowerCase()))
  const readyCities = new Set(growth.supply_ready_for_clients.map(r => r.cell.split(' · ')[0].toLowerCase()))
  const readyCats = new Set(growth.supply_ready_for_clients.map(r => r.cell.split(' · ')[1]))
  let running = growth.limits.running_now
  let adsLeft = growth.ads.remaining_eur

  for (const p of plans || []) {
    const audience = (AUDIENCES as readonly string[]).includes(p.audience) ? p.audience : ''
    const channel = (CHANNELS as readonly string[]).includes(p.channel) ? p.channel as Channel : ''
    if (!audience || !channel || !p.hypothesis) { log.push(`Descartado ${p.key}: datos incompletos`); continue }

    // Proveedores primero
    if (audience === 'clientes') {
      const city = p.city.trim().toLowerCase()
      const ok = city && p.category ? readyCells.has(`${city} · ${p.category}`)
        : city ? readyCities.has(city)
        : p.category ? readyCats.has(p.category)
        : readyCells.size > 0
      if (!ok) { log.push(`Descartado ${p.key}: sin oferta suficiente para captar clientes ahí`); continue }
    }

    const isAd = (AD_CHANNELS as readonly string[]).includes(channel)
    let budget = 0
    if (isAd) {
      budget = Math.max(0, Math.min(Number(p.budget_eur) || 0, adsLeft))
      if (budget <= 0) { log.push(`Descartado ${p.key}: sin presupuesto de anuncios este mes`); continue }
      adsLeft -= budget
    } else if (running >= MAX_RUNNING) {
      log.push(`Descartado ${p.key}: ya hay ${MAX_RUNNING} experimentos en marcha`)
      continue
    }

    const days = Math.min(Math.max(Math.round(Number(p.duration_days) || 14), 7), 28)
    const slug = slugFor(p)
    const now = Date.now()
    const { error } = await supabase.from('marketing_experiments').insert({
      slug, audience, channel,
      format: String(p.format || '').slice(0, 80),
      hypothesis: String(p.hypothesis).slice(0, 600),
      variant: String(p.variant || '').slice(0, 300),
      city: String(p.city || '').slice(0, 60),
      category: String(p.category || '').slice(0, 40),
      // Los anuncios nunca arrancan solos: esperan a Mariano
      status: isAd ? 'proposed' : 'running',
      started_at: isAd ? null : new Date(now).toISOString(),
      ends_at: isAd ? null : new Date(now + days * 86400_000).toISOString(),
      budget_eur: budget,
      report_id: reportId,
    })
    if (error) { log.push(`Error al crear ${p.key}: ${error.message}`); continue }
    keyToSlug[p.key] = slug
    if (!isAd) running++
    log.push(isAd
      ? `Propuesto (anuncio) ${slug}: ${channel === 'meta_ads' ? 'Instagram/Facebook Ads' : 'TikTok Ads'} · ${budget} € · ${audience}${p.city ? ` en ${p.city}` : ''} — ${String(p.variant || p.hypothesis).slice(0, 140)}`
      : `Iniciado ${slug}: ${audience} por ${channel}${p.format ? ` (${p.format})` : ''}${p.city ? ` en ${p.city}` : ''}${p.category ? ` · ${p.category}` : ''}`)
  }

  return { keyToSlug, log }
}
