import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { callList, recordOutcome, OUTCOMES, type Outcome } from '@/lib/captacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const auth = (req: NextRequest) => req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD

// GET /api/admin/captacion?zone=asturias|valencia|all → llamadas y visitas de hoy
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const zone = (new URL(req.url).searchParams.get('zone') || 'all') as 'asturias' | 'valencia' | 'all'
  const supabase = createAdminClient()
  const items = await callList(supabase, { zone, limit: 80 })
  const { data: done } = await supabase.from('providers').select('call_status').neq('call_status', 'pendiente').limit(5000)
  const totals = (done || []).reduce((m: Record<string, number>, r: any) => ({ ...m, [r.call_status]: (m[r.call_status] || 0) + 1 }), {})
  return NextResponse.json({ items, totals, outcomes: OUTCOMES })
}

// POST /api/admin/captacion — body { kind, id, outcome, note?, next_at? }
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  try {
    const r = await recordOutcome(createAdminClient(), { kind: b.kind === 'org' ? 'org' : 'provider', id: String(b.id || ''), outcome: b.outcome as Outcome, note: b.note, next_at: b.next_at || null })
    return NextResponse.json(r)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
