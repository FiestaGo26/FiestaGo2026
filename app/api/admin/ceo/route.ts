import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCeoSettings } from '@/lib/ceo-actions'
import { experimentMetrics } from '@/lib/ceo-growth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/ceo
// Últimos informes del Agente CEO + sus propuestas + ajustes de autonomía.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()

  const [{ data: reports, error }, { data: proposals }, settings, { data: experiments }] = await Promise.all([
    supabase.from('ceo_reports')
      .select('id, created_at, kind, headline, summary, highlights, issues, emailed, error')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('ceo_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60),
    getCeoSettings(supabase),
    supabase.from('marketing_experiments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: reports || [], proposals: proposals || [], settings, experiments: experiments || [] })
}

// PATCH /api/admin/ceo
//   body: { id, status: 'approved' | 'rejected' | 'done' | 'pending' }  → decisión sobre una propuesta
//   body: { settings: { autonomy?, paused?, max_wa_per_day?, max_posts_per_day? } } → ajustes
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  if (body.settings) {
    const s = body.settings
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (s.autonomy === 'full' || s.autonomy === 'approval') update.autonomy = s.autonomy
    if (typeof s.paused === 'boolean') update.paused = s.paused
    if (Number.isFinite(s.max_wa_per_day))    update.max_wa_per_day    = Math.min(Math.max(Math.round(s.max_wa_per_day), 0), 500)
    if (Number.isFinite(s.max_posts_per_day)) update.max_posts_per_day = Math.min(Math.max(Math.round(s.max_posts_per_day), 0), 10)
    if (Number.isFinite(s.ads_budget_eur))    update.ads_budget_eur    = Math.min(Math.max(Number(s.ads_budget_eur), 0), 100000)
    if (Number.isFinite(s.supply_threshold))  update.supply_threshold  = Math.min(Math.max(Math.round(s.supply_threshold), 1), 50)
    if (s.wa_unbrake === true) { update.wa_braked_at = null; update.wa_brake_reason = null }
    if (typeof s.social_autopublish === 'boolean') update.social_autopublish = s.social_autopublish
    if (Number.isFinite(s.social_max_per_day))     update.social_max_per_day = Math.min(Math.max(Math.round(s.social_max_per_day), 0), 10)
    const { error } = await supabase.from('ceo_settings').update(update).eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, settings: await getCeoSettings(supabase) })
  }

  // Experimentos de marketing
  //   { experiment: { id, op: 'approve' | 'reject' | 'stop' } }
  //   { experiment: { id, op: 'metrics', manual: { views, likes, comments, shares, clicks, followers, spend_eur } } }
  if (body.experiment) {
    const e = body.experiment
    const { data: exp } = await supabase.from('marketing_experiments').select('*').eq('id', e.id).maybeSingle()
    if (!exp) return NextResponse.json({ error: 'Experimento no encontrado' }, { status: 404 })
    const now = new Date().toISOString()
    let update: Record<string, unknown> | null = null

    if (e.op === 'approve' && exp.status === 'proposed') {
      update = { status: 'running', started_at: now, ends_at: new Date(Date.now() + 14 * 86400_000).toISOString() }
    } else if (e.op === 'reject' && exp.status === 'proposed') {
      update = { status: 'rejected', closed_at: now, learning: String(e.learning || 'Rechazado por Mariano').slice(0, 1000) }
    } else if (e.op === 'stop' && exp.status === 'running') {
      update = {
        status: 'stopped', closed_at: now,
        learning: String(e.learning || 'Parado por Mariano').slice(0, 1000),
        metrics: { ...exp.metrics, final: await experimentMetrics(supabase, exp) },
      }
    } else if (e.op === 'metrics') {
      const m = e.manual || {}
      const num = (v: unknown) => Math.max(0, Number(v) || 0)
      update = {
        metrics: {
          ...exp.metrics,
          manual: {
            views: num(m.views), likes: num(m.likes), comments: num(m.comments), shares: num(m.shares),
            clicks: num(m.clicks), followers: num(m.followers), spend_eur: num(m.spend_eur), updated_at: now,
          },
        },
      }
    }
    if (!update) return NextResponse.json({ error: 'Operación no válida para este experimento' }, { status: 400 })
    const { error } = await supabase.from('marketing_experiments').update({ ...update, updated_at: now }).eq('id', exp.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!body.id || !['approved', 'rejected', 'done', 'pending'].includes(body.status)) {
    return NextResponse.json({ error: 'id y status válidos requeridos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ceo_proposals')
    .update({
      status:     body.status,
      decided_at: body.status === 'pending' ? null : new Date().toISOString(),
      decided_by: body.status === 'pending' ? null : 'mariano',
    })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
