import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { runCeoRoutine, type CeoKind } from '@/lib/ceo-agent'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Rutinas del Agente CEO (ver lib/ceo-agent.ts).
//   body { kind: 'daily' }  → parte diario  (GitHub Actions 07:52 Madrid)
//   body { kind: 'weekly' } → informe lunes (GitHub Actions 09:17 Madrid)
//   body { if_missing: true } → solo si aún no hay informe hoy / esta semana
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
  const supabase = createAdminClient()

  // if_missing: el workflow llama a menudo porque los crons de GitHub se
  // retrasan o se saltan; solo corre si hoy (Madrid) aún no hay informe
  // de este tipo (para el semanal: en los últimos 6 días).
  if (body.if_missing) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
    const since = kind === 'weekly'
      ? new Date(Date.now() - 6 * 86400_000).toISOString()
      : new Date(`${today}T00:00:00+02:00`).toISOString()
    const { count } = await supabase
      .from('ceo_reports')
      .select('id', { count: 'exact', head: true })
      .eq('kind', kind)
      .is('error', null)
      .gte('created_at', since)
    if ((count ?? 0) > 0) return NextResponse.json({ ok: true, kind, skipped: true, reason: 'ya hay informe' })
  }

  try {
    const result = await runCeoRoutine(supabase, kind, {
      adminUrl: `${base}/admin?section=ceo`,
      email:    body.email !== false,
    })
    return NextResponse.json({ ok: true, kind, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en la rutina del CEO' }, { status: 500 })
  }
}
