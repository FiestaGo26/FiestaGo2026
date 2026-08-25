import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Mock del cobro del PRIMER pago (anticipo o 100% al reservar) · SOLO
 * EN MODO TEST.
 *
 * Marca el primer pago como pagado sin cobrar dinero real. Cuando
 * Stripe esté vivo se elimina este endpoint y el cobro se marca desde
 * el webhook Stripe checkout.session.completed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  if (process.env.FIESTAGO_TEST_MODE !== 'true') {
    return NextResponse.json({
      error: 'Este endpoint solo funciona en modo test. Configura Stripe para pagos reales.',
    }, { status: 403 })
  }

  const { bookingId } = await params

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, first_payment_status, first_payment_amount, client_name, event_date, provider_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }
  if (booking.first_payment_status === 'paid') {
    return NextResponse.json({ error: 'El primer pago ya está marcado como pagado' }, { status: 400 })
  }

  const now = new Date().toISOString()
  await supabase.from('bookings').update({
    first_payment_status:  'paid',
    first_payment_paid_at: now,
  }).eq('id', bookingId)

  await supabase.from('notifications').insert({
    type:    'mock_first_payment',
    title:   `✓ Primer pago MOCK recibido · ${booking.client_name}`,
    message: `${booking.client_name} completó el primer pago (modo TEST, ${booking.first_payment_amount}€) — evento ${booking.event_date}`,
    data:    { booking_id: bookingId, amount: booking.first_payment_amount, test_mode: true },
    action_url: `/admin?booking=${bookingId}`,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    mock: true,
    amount: booking.first_payment_amount,
    message: 'Primer pago simulado. Ahora el proveedor puede confirmar la reserva y se emitirá la factura automáticamente.',
  })
}
