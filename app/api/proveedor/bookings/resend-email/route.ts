import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import {
  emailClientBookingReceived,
  emailClientBookingConfirmed,
  emailProviderNewBooking,
  emailAdminNewBooking,
} from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * POST /api/proveedor/bookings/resend-email
 *
 * Reenvía un correo asociado a una reserva. Útil cuando el cliente
 * borró el email, no le llegó, o quiere el enlace de pago restante
 * otra vez.
 *
 * body: {
 *   providerId,
 *   bookingId,
 *   kind: 'client_received' | 'client_confirmed' | 'provider_new' | 'admin_new'
 * }
 *
 * Autoriza al proveedor dueño de la reserva o al admin.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const bookingId: string  = body.bookingId
  const kind: string       = body.kind || 'client_received'

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings').select('*')
    .eq('id', bookingId).eq('provider_id', providerId).maybeSingle()
  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { data: provider } = await supabase
    .from('providers').select('id, name, email, phone, slug, category, city')
    .eq('id', providerId).maybeSingle()
  if (!provider) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  try {
    switch (kind) {
      case 'client_received':
        await emailClientBookingReceived(booking, provider)
        break
      case 'client_confirmed':
        await emailClientBookingConfirmed(booking, provider)
        break
      case 'provider_new':
        await emailProviderNewBooking(booking, provider)
        break
      case 'admin_new':
        await emailAdminNewBooking(booking, provider)
        break
      default:
        return NextResponse.json({ error: `kind desconocido: ${kind}` }, { status: 400 })
    }
    return NextResponse.json({ ok: true, kind })
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Error reenviando email',
    }, { status: 500 })
  }
}
