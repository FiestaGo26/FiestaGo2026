import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-calendar'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/google/connect?provider_id=...
// Manda al proveedor a autorizar su Google Calendar.
//
// SEGURIDAD: validamos que la sesión Supabase del llamante corresponde
// al email del proveedor (o que es admin impersonando vía
// x-admin-password). Aunque el provider_id viene como query param, no
// es manipulable porque requireProviderAuth lo verifica contra la
// sesión autenticada.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  return NextResponse.redirect(getAuthUrl(auth.data.id))
}
