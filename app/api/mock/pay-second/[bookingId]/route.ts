import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateDelegatedInvoice } from '@/lib/invoicing/generator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Mock del cobro del segundo pago · SOLO ACTIVO EN MODO TEST.
 *
 * Marca el segundo pago como pagado sin cobrar dinero real. Sirve para
 * poder recorrer el flujo end-to-end antes de tener Stripe integrado.
 * Cuando Stripe esté vivo, este endpoint se elimina y el pago se marca
 * como pagado desde el webhook de Stripe payment_intent.succeeded.
 *
 * Efectos:
 *   1. bookings.second_payment_status = 'paid'
 *   2. bookings.second_payment_paid_at = ahora
 *   3. Si el proveedor tiene consent_delegated_invoicing = true,
 *      emite la factura Verifactu delegada por el segundo tramo
 *      (la del anticipo ya se emitió al confirmar la reserva).
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
  const { email } = await req.json().catch(() => ({}))

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, providers(*)')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }
  if (email && String(email).toLowerCase() !== String(booking.client_email).toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (['paid', 'cancelled', 'not_needed'].includes(booking.second_payment_status)) {
    return NextResponse.json({
      error: `Este pago ya está ${booking.second_payment_status}`,
    }, { status: 400 })
  }

  const now = new Date().toISOString()

  await supabase.from('bookings').update({
    second_payment_status:  'paid',
    second_payment_paid_at: now,
  }).eq('id', bookingId)

  // Emitir factura delegada del segundo tramo si el proveedor lo tiene activo.
  // Opción A: el segundo pago es ÍNTEGRAMENTE del proveedor — la Garantía
  // ya se cobró completa con el anticipo, así que aquí el importe delegado
  // coincide con secondAmount tal cual.
  const provider = booking.providers
  const secondAmount = Number(booking.second_payment_amount || 0)
  if (provider?.consent_delegated_invoicing && secondAmount > 0) {
    const result = await generateDelegatedInvoice(supabase as any, booking, provider, {
      amount: secondAmount,
      concept: `Resto por servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`,
    })
    if (result.error) {
      console.error('delegated invoice (second payment) failed:', result.error)
    }
  }

  // Notificación al admin para trazabilidad
  await supabase.from('notifications').insert({
    type:    'mock_second_payment',
    title:   `✓ Segundo pago MOCK recibido · ${booking.client_name}`,
    message: `${booking.client_name} completó el segundo pago (modo TEST, ${secondAmount}€) — evento ${booking.event_date}`,
    data:    { booking_id: bookingId, amount: secondAmount, test_mode: true },
    action_url: `/admin?booking=${bookingId}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, mock: true, amount: secondAmount })
}
