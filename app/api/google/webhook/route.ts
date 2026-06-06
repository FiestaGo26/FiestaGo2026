import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncBusyToAvailability } from '@/lib/google-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/google/webhook
// Google llama aquí cuando cambia el calendario de un proveedor conectado.
// La notificación NO trae el cuerpo del cambio: solo cabeceras con el canal.
// Identificamos al proveedor por el channel id y re-sincronizamos.
export async function POST(req: NextRequest) {
  const channelId = req.headers.get('x-goog-channel-id')
  const resourceState = req.headers.get('x-goog-resource-state')

  // 'sync' = handshake inicial al crear el watch; no hay cambios que procesar.
  if (resourceState === 'sync' || !channelId) {
    return new NextResponse(null, { status: 200 })
  }

  try {
    const { data } = await supabaseAdmin()
      .from('google_calendar_connections')
      .select('provider_id')
      .eq('watch_channel_id', channelId)
      .maybeSingle()

    if (data?.provider_id) {
      await syncBusyToAvailability(data.provider_id as string)
    }
  } catch (e) {
    console.error('[google webhook] error', e)
    // Devolvemos 200 igualmente para que Google no reintente en bucle.
  }

  return new NextResponse(null, { status: 200 })
}
