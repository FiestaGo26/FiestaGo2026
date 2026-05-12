import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 60   // Netlify Pro permite hasta 26s sync; con bg functions, hasta 15min
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/providers/bulk-approve
// body: { ids?: string[], onlyWithEmail?: boolean }
// Si pasa ids → aprueba esos. Si no, aprueba TODOS los pending con outreach_email + outreach_sent=false
//
// Para cada uno:
// - Si tiene outreach_email + outreach_sent=false → envía outreach + marca outreach_sent=true (sigue pending)
// - Si ya tiene outreach_sent=true → no hace nada (debe aprobarse manualmente uno a uno tras el registro)
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const explicitIds: string[] = Array.isArray(body.ids) ? body.ids : []
  const onlyWithEmail: boolean = body.onlyWithEmail !== false

  // Construir la lista de candidatos
  let query = supabase
    .from('providers')
    .select('id, name, email, outreach_email, outreach_sent, status')
    .eq('status', 'pending')
    .eq('outreach_sent', false)
    .not('outreach_email', 'is', null)
  if (onlyWithEmail) query = query.not('email', 'is', null)
  if (explicitIds.length) query = query.in('id', explicitIds)

  const { data: candidates, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates || !candidates.length) {
    return NextResponse.json({ ok: 0, failed: 0, total: 0, errors: [], note: 'No hay proveedores que cumplan el filtro' })
  }

  // Procesar en paralelo controlado (10 a la vez)
  const CONCURRENCY = 10
  let ok = 0
  let failed = 0
  const errors: any[] = []
  const okIds: string[] = []

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const chunk = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(chunk.map(async (p) => {
      const r = await emailProviderOutreach(p)
      if (!r.ok) throw new Error(r.error || 'fallo desconocido')
      return p.id
    }))
    results.forEach((res, idx) => {
      const p = chunk[idx]
      if (res.status === 'fulfilled') { ok++; okIds.push(p.id) }
      else { failed++; errors.push({ id: p.id, name: p.name, error: res.reason?.message || String(res.reason) }) }
    })
  }

  // Marcar como enviados todos los OK en una sola query
  if (okIds.length) {
    await supabase
      .from('providers')
      .update({
        outreach_sent: true,
        outreach_at:   new Date().toISOString(),
        tag:           'Contactado',
      })
      .in('id', okIds)
  }

  return NextResponse.json({
    total:   candidates.length,
    ok,
    failed,
    errors:  errors.slice(0, 20),  // máx 20 errores en respuesta
  })
}
