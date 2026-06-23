import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { loadOrInitPrefs } from '@/lib/quote-prefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/quote-prefs?providerId=XXX
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()
  const prefs = await loadOrInitPrefs(supabase, providerId!)
  return NextResponse.json({ prefs })
}

// POST — guarda cambios. Body: { providerId, deposit_pct, validity_days,
// default_includes[], default_excludes[], default_conditions[],
// language_style, pricing_notes }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  // Normalización defensiva — el cliente puede mandar campos sueltos.
  const update: any = { updated_at: new Date().toISOString() }
  if (typeof body.deposit_pct === 'number') update.deposit_pct = Math.max(0, Math.min(100, body.deposit_pct | 0))
  if (typeof body.validity_days === 'number') update.validity_days = Math.max(1, Math.min(365, body.validity_days | 0))
  if (Array.isArray(body.default_includes))   update.default_includes   = body.default_includes.map(String).filter(Boolean).slice(0, 30)
  if (Array.isArray(body.default_excludes))   update.default_excludes   = body.default_excludes.map(String).filter(Boolean).slice(0, 30)
  if (Array.isArray(body.default_conditions)) update.default_conditions = body.default_conditions.map(String).filter(Boolean).slice(0, 30)
  if (typeof body.language_style === 'string' && ['cercano','profesional','muy_formal'].includes(body.language_style)) {
    update.language_style = body.language_style
  }
  if (typeof body.pricing_notes === 'string') update.pricing_notes = body.pricing_notes.slice(0, 4000)

  const supabase = createAdminClient()
  // Asegúrate de que existe la fila (upsert).
  await loadOrInitPrefs(supabase, providerId)
  const { error } = await supabase
    .from('provider_quote_prefs')
    .update(update)
    .eq('provider_id', providerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
