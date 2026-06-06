import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/google/status?provider_id=...
// Devuelve si el proveedor tiene Google Calendar conectado y datos básicos.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('google_calendar_connections')
    .select('google_email, calendar_id, last_synced_at, watch_expiration')
    .eq('provider_id', auth.data.id)
    .maybeSingle()

  return NextResponse.json({
    connected:      !!data,
    google_email:   data?.google_email || null,
    calendar_id:    data?.calendar_id || null,
    last_synced_at: data?.last_synced_at || null,
    watch_until:    data?.watch_expiration || null,
  })
}
