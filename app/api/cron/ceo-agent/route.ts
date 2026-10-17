import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { runCeoRoutine, type CeoKind } from '@/lib/ceo-agent'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Rutinas del Agente CEO (ver lib/ceo-agent.ts).
//   body { kind: 'daily' }  → parte diario  (GitHub Actions 07:52 Madrid)
//   body { kind: 'weekly' } → informe lunes (GitHub Actions 09:17 Madrid)
// Auth: x-cron-secret o x-admin-password (para "Ejecutar ahora" del admin).

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind: CeoKind = body.kind === 'weekly' ? 'weekly' : 'daily'
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  try {
    const result = await runCeoRoutine(createAdminClient(), kind, {
      adminUrl: `${base}/admin?section=ceo`,
      email:    body.email !== false,
    })
    return NextResponse.json({ ok: true, kind, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en la rutina del CEO' }, { status: 500 })
  }
}
