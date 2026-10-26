import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { profileCompleteness, MIN_PHOTOS } from '@/lib/provider-completeness'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/completeness?provider_id=... → lo que le falta a su ficha
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const [c] = await profileCompleteness(createAdminClient(), [providerId!])
  return NextResponse.json({ completeness: c || null, min_photos: MIN_PHOTOS })
}
