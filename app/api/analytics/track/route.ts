import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_EVENTS = ['profile_view', 'service_view', 'booking_started', 'booking_completed', 'contact_clicked']

// POST /api/analytics/track
// body: { provider_id, event_type, service_id?, session_id? }
// Inserta un evento de tracking para que el proveedor lo vea en su panel.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { provider_id, event_type, service_id, session_id } = body || {}

    if (!provider_id || !event_type) {
      return NextResponse.json({ ok: false, error: 'provider_id y event_type requeridos' }, { status: 400 })
    }
    if (!VALID_EVENTS.includes(event_type)) {
      return NextResponse.json({ ok: false, error: 'event_type inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Dedup: si la misma session+provider+event ocurrió en los últimos 30 min, no contar de nuevo
    if (session_id) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('provider_views')
        .select('id')
        .eq('provider_id', provider_id)
        .eq('event_type', event_type)
        .eq('session_id', session_id)
        .gte('created_at', thirtyMinAgo)
        .limit(1)
        .maybeSingle()
      if (recent) return NextResponse.json({ ok: true, deduped: true })
    }

    const userAgent = req.headers.get('user-agent') || null
    const referrer  = req.headers.get('referer')     || null

    await supabase.from('provider_views').insert({
      provider_id,
      event_type,
      service_id:  service_id || null,
      session_id:  session_id || null,
      user_agent:  userAgent,
      referrer,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'error' }, { status: 500 })
  }
}
