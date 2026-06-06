import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stopWatch } from '@/lib/google-calendar'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/google/disconnect  body: { provider_id }
// Desconecta Google Calendar de un proveedor: para el watch, borra la
// conexión y elimina los bloqueos importados de Google (deja intactos
// los manuales).
//
// SEGURIDAD: solo el propio proveedor autenticado puede desconectar
// el suyo (o un admin vía x-admin-password).
export async function POST(req: NextRequest) {
  let providerId: string | undefined
  try {
    providerId = (await req.clone().json())?.provider_id
  } catch {
    providerId = new URL(req.url).searchParams.get('provider_id') ?? undefined
  }
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  providerId = auth.data.id

  const supabase = supabaseAdmin()

  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('provider_id, calendar_id, access_token, refresh_token, token_expiry, watch_channel_id, watch_resource_id')
    .eq('provider_id', providerId)
    .maybeSingle()

  if (conn?.watch_channel_id && conn?.watch_resource_id) {
    await stopWatch(conn as any, conn.watch_channel_id as string, conn.watch_resource_id as string)
  }

  // Borrar bloqueos importados de Google de los servicios de este proveedor.
  const { data: services } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', providerId)
  const serviceIds = (services ?? []).map((s) => s.id as string)
  if (serviceIds.length) {
    await supabase
      .from('service_availability')
      .delete()
      .in('service_id', serviceIds)
      .eq('source', 'google')
  }

  await supabase.from('google_calendar_connections').delete().eq('provider_id', providerId)

  return NextResponse.json({ ok: true })
}
