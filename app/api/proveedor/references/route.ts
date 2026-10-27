import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { cleanReferences } from '@/lib/client-references'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/references?provider_id=... → sus referencias (con contacto)
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const { data } = await createAdminClient().from('providers').select('client_references').eq('id', providerId!).maybeSingle()
  return NextResponse.json({ references: data?.client_references || [] })
}

// PUT /api/proveedor/references — body: { provider_id, references }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response
  const references = cleanReferences(body.references)
  const { error } = await createAdminClient().from('providers').update({ client_references: references }).eq('id', body.provider_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ references })
}
