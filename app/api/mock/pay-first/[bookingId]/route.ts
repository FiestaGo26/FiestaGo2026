import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { markFirstPaymentPaid } from '@/lib/payments/mark-paid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Mock del cobro del PRIMER pago (anticipo o 100% al reservar) · SOLO
 * EN MODO TEST.
 *
 * Marca el primer pago como pagado sin cobrar dinero real. Con Stripe
 * configurado este endpoint sobra: el cobro se marca desde el webhook
 * (payment_intent.succeeded), que usa exactamente las mismas funciones
 * de lib/payments/mark-paid.
 *
 * OJO: este atajo NO registra consentimiento. El flujo bueno de pruebas
 * es la propia página /pago-inicial, que sí escribe en booking_consents
 * aunque el cobro sea simulado.
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

  const result = await markFirstPaymentPaid(supabase, booking, { source: 'mock' })
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Error simulando el pago' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mock: true,
    amount: result.amount,
    message: 'Primer pago simulado. Ahora el proveedor puede confirmar la reserva y se emitirá la factura automáticamente.',
  })
}
