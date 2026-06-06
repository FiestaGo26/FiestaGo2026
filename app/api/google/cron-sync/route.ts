import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncBusyToAvailability } from '@/lib/google-sync'
import { watchCalendar, type GCalConnection } from '@/lib/google-calendar'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-cron-secret') === process.env.CRON_SECRET
}

// POST /api/google/cron-sync
//   - Sincroniza ocupado→service_availability de TODOS los proveedores conectados.
//   - Renueva los watches que caducan en <48h (Google los caduca a los ~7 días).
//
// Pensado para llamarse 1×/día desde GitHub Actions con CRON_SECRET.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = supabaseAdmin()
  const { data: conns } = await supabase
    .from('google_calendar_connections')
    .select('provider_id, calendar_id, access_token, refresh_token, token_expiry, watch_channel_id, watch_resource_id, watch_expiration')

  if (!conns || conns.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, renewed: 0, message: 'sin proveedores conectados' })
  }

  let synced = 0
  let renewed = 0
  const errors: { provider_id: string; step: string; error: string }[] = []

  const renewThreshold = Date.now() + 48 * 60 * 60 * 1000 // <48h por caducar

  for (const conn of conns as any[]) {
    // 1. Sincronización ocupado/libre
    try {
      await syncBusyToAvailability(conn.provider_id)
      synced++
    } catch (err: any) {
      errors.push({ provider_id: conn.provider_id, step: 'sync', error: err?.message || 'unknown' })
    }

    // 2. Renovación de watch si está cerca de caducar
    const watchExpiry = conn.watch_expiration ? new Date(conn.watch_expiration).getTime() : 0
    if (!watchExpiry || watchExpiry < renewThreshold) {
      try {
        const gconn: GCalConnection = {
          provider_id:   conn.provider_id,
          calendar_id:   conn.calendar_id,
          access_token:  conn.access_token,
          refresh_token: conn.refresh_token,
          token_expiry:  conn.token_expiry,
        }
        const w = await watchCalendar(gconn)
        await supabase
          .from('google_calendar_connections')
          .update({
            watch_channel_id:  w.channelId,
            watch_resource_id: w.resourceId,
            watch_expiration:  w.expiration,
            updated_at:        new Date().toISOString(),
          })
          .eq('provider_id', conn.provider_id)
        renewed++
      } catch (err: any) {
        errors.push({ provider_id: conn.provider_id, step: 'watch_renew', error: err?.message || 'unknown' })
      }
    }
  }

  return NextResponse.json({ ok: true, synced, renewed, errors })
}
