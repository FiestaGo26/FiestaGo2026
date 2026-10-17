import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { claimNextAction, completeAction } from '@/lib/ceo-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cola de ejecución del Agente CEO (ver lib/ceo-actions.ts). La usa el
// workflow ceo-agent.yml en bucle:
//   { op: 'next' }                         → reclama la siguiente acción
//   { op: 'complete', id, ok, result }     → guarda cómo fue
// El workflow llama al endpoint de la acción entre medias, así cada
// paso tiene su propio presupuesto de 60s en Netlify.

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  if (body.op === 'complete') {
    if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await completeAction(supabase, body.id, !!body.ok, body.result ?? null)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json(await claimNextAction(supabase))
}
