import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { exchangeCode, verifyState, watchCalendar } from '@/lib/google-calendar'
import { syncBusyToAvailability } from '@/lib/google-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/google/callback?code=...&state=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://fiestago.es'

  const error = searchParams.get('error')
  if (error) {
    return NextResponse.redirect(`${base}/proveedor?gcal=error`)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerId = state ? verifyState(state) : null
  if (!code || !providerId) {
    return NextResponse.redirect(`${base}/proveedor?gcal=error`)
  }

  try {
    const { tokens, email } = await exchangeCode(code)

    const supabase = supabaseAdmin()
    await supabase.from('google_calendar_connections').upsert({
      provider_id: providerId,
      google_email: email,
      calendar_id: 'primary',
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    })

    // Alta de notificaciones push (watch) — best effort.
    try {
      const conn = {
        provider_id: providerId,
        calendar_id: 'primary',
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      }
      const w = await watchCalendar(conn)
      await supabase
        .from('google_calendar_connections')
        .update({
          watch_channel_id: w.channelId,
          watch_resource_id: w.resourceId,
          watch_expiration: w.expiration,
        })
        .eq('provider_id', providerId)
    } catch (e) {
      console.error('[google callback] watch falló (no crítico)', e)
    }

    // Primera sincronización de ocupado/libre.
    try {
      await syncBusyToAvailability(providerId)
    } catch (e) {
      console.error('[google callback] sync inicial falló', e)
    }

    return NextResponse.redirect(`${base}/proveedor?gcal=ok`)
  } catch (e) {
    console.error('[google callback] error', e)
    return NextResponse.redirect(`${base}/proveedor?gcal=error`)
  }
}
