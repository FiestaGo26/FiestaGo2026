import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCeoSettings } from '@/lib/ceo-actions'

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

  const [{ data: reports, error }, { data: proposals }, settings] = await Promise.all([
    supabase.from('ceo_reports')
      .select('id, created_at, kind, headline, summary, highlights, issues, emailed, error')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('ceo_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60),
    getCeoSettings(supabase),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: reports || [], proposals: proposals || [], settings })
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
    const { error } = await supabase.from('ceo_settings').update(update).eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, settings: await getCeoSettings(supabase) })
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
