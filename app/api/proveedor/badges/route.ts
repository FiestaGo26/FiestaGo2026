import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/proveedor/badges?provider_id=X
 *
 * Devuelve contadores de items que requieren atención del proveedor,
 * para pintar badges rojos en el menú lateral del panel. Ligero:
 * usa count exact head-only para no cargar filas.
 *
 * Response: {
 *   bookings:       N  · reservas con status='pending' (por aceptar/rechazar)
 *   video_calls:    N  · video_call_requests con status='requested'
 *   messages:       N  · mensajes de cliente sin leer por el proveedor
 * }
 */
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  // Los 3 counts van en paralelo. count: 'exact', head: true → solo cuenta,
  // no descarga filas. Silencioso si alguno falla — el badge se queda a 0.
  const [bkRes, vcRes, msgRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId!)
      .eq('status', 'pending'),
    supabase
      .from('video_call_requests')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId!)
      .eq('status', 'requested'),
    // Mensajes: sin leer por el proveedor. La conversación pertenece al
    // proveedor y el mensaje lo mandó el cliente (sender_role='client').
    supabase
      .from('messages')
      .select('id, provider_conversations!inner(provider_id)', { count: 'exact', head: true })
      .eq('provider_conversations.provider_id', providerId!)
      .eq('sender_role', 'client')
      .is('read_at', null),
  ])

  return NextResponse.json({
    bookings:    bkRes.count  || 0,
    video_calls: vcRes.count  || 0,
    messages:    msgRes.count || 0,
  })
}
