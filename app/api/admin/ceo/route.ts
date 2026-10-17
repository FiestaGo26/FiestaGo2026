import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/ceo
// Últimos informes del Agente CEO + sus propuestas.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()

  const [{ data: reports, error }, { data: proposals }] = await Promise.all([
    supabase.from('ceo_reports')
      .select('id, created_at, kind, headline, summary, highlights, issues, emailed, error')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('ceo_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: reports || [], proposals: proposals || [] })
}

// PATCH /api/admin/ceo   body: { id, status: 'approved' | 'rejected' | 'done' | 'pending' }
// Decisión de Mariano sobre una propuesta del CEO.
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!body.id || !['approved', 'rejected', 'done', 'pending'].includes(body.status)) {
    return NextResponse.json({ error: 'id y status válidos requeridos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ceo_proposals')
    .update({ status: body.status, decided_at: body.status === 'pending' ? null : new Date().toISOString() })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
