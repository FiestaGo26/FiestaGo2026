import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { publishNext, syncMetrics } from '@/lib/social-publisher'
import { checkBalances } from '@/lib/balance-watch'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Publicación automática en Instagram/TikTok y lectura de métricas
// (lib/social-publisher.ts). Lo llama .github/workflows/social.yml.
//   body { op: 'publish' } → publica como mucho una pieza
//   body { op: 'metrics' } → actualiza métricas de lo publicado
//   body { op: 'balances' } → avisa si queda poco saldo en fal.ai / HeyGen
// Auth: x-cron-secret o x-admin-password.

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()
  try {
    const result = body.op === 'metrics' ? await syncMetrics(supabase)
      : body.op === 'balances' ? await checkBalances(supabase)
      : await publishNext(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
