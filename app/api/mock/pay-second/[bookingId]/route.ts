import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { markSecondPaymentPaid } from '@/lib/payments/mark-paid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Mock del cobro del segundo pago · SOLO ACTIVO EN MODO TEST.
 *
 * Marca el segundo pago como pagado sin cobrar dinero real y emite la
 * factura delegada del tramo si el proveedor tiene el consentimiento
 * activo. Con Stripe configurado esto lo hace el webhook
 * (payment_intent.succeeded) con las mismas funciones.
 *
 * OJO: este atajo NO registra consentimiento. El flujo bueno de pruebas
 * es /pago-restante, que sí lo registra aunque el cobro sea simulado.
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

  const result = await markSecondPaymentPaid(supabase, booking, { source: 'mock' })
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Error simulando el pago' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mock: true, amount: result.amount })
}
