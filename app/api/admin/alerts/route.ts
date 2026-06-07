import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/alerts?resolved=false
// Lista alertas del agente y sistemas afines. Útil para detectar
// fallos silenciosos (columnas faltantes, APIs caídas, env vars
// erróneas) sin tener que perseguir logs de GitHub Actions.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const resolvedFilter = url.searchParams.get('resolved')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)

  const supabase = createAdminClient()
  let query = supabase.from('agent_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (resolvedFilter === 'false') query = query.eq('resolved', false)
  if (resolvedFilter === 'true')  query = query.eq('resolved', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Conteo por severidad para badge en el panel
  const { data: counts } = await supabase
    .from('agent_alerts')
    .select('severity, resolved')
    .eq('resolved', false)

  const summary = {
    unresolved_total:    counts?.length ?? 0,
    unresolved_critical: counts?.filter((c: any) => c.severity === 'critical').length ?? 0,
    unresolved_error:    counts?.filter((c: any) => c.severity === 'error').length ?? 0,
    unresolved_warning:  counts?.filter((c: any) => c.severity === 'warning').length ?? 0,
  }

  return NextResponse.json({ alerts: data || [], summary })
}

// PATCH /api/admin/alerts   body: { id, resolved: true/false }
// Marca alerta como resuelta o reactiva.
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('agent_alerts')
    .update({ resolved: !!body.resolved })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
