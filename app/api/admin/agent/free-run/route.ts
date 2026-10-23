import { NextRequest, NextResponse } from 'next/server'
import { runProviderSearch } from '@/lib/provider-search'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// POST /api/admin/agent/free-run
//   body: { category, city, count? }
// Buscador 100% gratis (OSM + DuckDuckGo). Lógica en lib/provider-search.ts.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await runProviderSearch(body)
  if (result.error) {
    return NextResponse.json({ error: result.error, logs: result.logs }, { status: result.error === 'Categoría inválida' ? 400 : 500 })
  }
  return NextResponse.json(result)
}
