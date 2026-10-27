import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { cleanVenue } from '@/lib/venue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/venue?provider_id=... → tipo de local y qué incluye
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const { data } = await createAdminClient().from('providers').select('category, venue_type, venue_features').eq('id', providerId!).maybeSingle()
  return NextResponse.json(data || {})
}

// PUT /api/proveedor/venue — body: { provider_id, venue_type, venue_features }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response
  const clean = cleanVenue(body.venue_type, body.venue_features)
  const { error } = await createAdminClient().from('providers').update(clean).eq('id', body.provider_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clean)
}
