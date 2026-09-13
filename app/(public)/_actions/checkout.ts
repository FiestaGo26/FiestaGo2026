'use server'

/**
 * Server Actions del checkout.
 *
 * Orden no negociable: primero se registra el consentimiento, después se
 * crea el PaymentIntent. Si el consentimiento falla, no se cobra. Un
 * cobro sin fila en booking_consents es una disputa perdida de antemano,
 * así que preferimos perder la venta.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { isStripeConfigured, isTestMode } from '@/lib/stripe'
import { ConsentError, recordBookingConsent, type PaymentStage } from '@/lib/payments/consent'
import { createBookingPaymentIntent } from '@/lib/payments/payment-intent'
import { markFirstPaymentPaid, markSecondPaymentPaid } from '@/lib/payments/mark-paid'

export type StartPaymentInput = {
  bookingId: string
  /** Email del titular, tal y como viaja en el enlace del email. */
  email: string
  stage: PaymentStage
  acceptedGeneralTerms: boolean
  acceptedAdvanceForfeit: boolean
  /** Texto de la cláusula tal y como se renderizó en el navegador. */
  displayedClauseText: string
  pageUrl: string
  locale?: string
}

export type StartPaymentResult =
  | { ok: true; mode: 'stripe'; clientSecret: string; paymentIntentId: string; amountCents: number }
  | { ok: true; mode: 'mock';   amount: number }
  | { ok: false; error: string }

export async function startBookingPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  const { bookingId, email, stage } = input

  if (!bookingId) return { ok: false, error: 'Falta la referencia de la reserva.' }

  const supabase = createAdminClient()
  // providers(*) completo: markSecondPaymentPaid necesita
  // consent_delegated_invoicing y los datos fiscales del proveedor para
  // emitir la factura del tramo.
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, providers(*)')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'Reserva no encontrada.' }

  // Auth soft por email (mismo patrón que las páginas de pago: el enlace
  // llega por email al titular). Si además hay sesión, tiene que ser la
  // del titular.
  if (email && String(email).toLowerCase() !== String(booking.client_email).toLowerCase()) {
    return { ok: false, error: 'El email no coincide con el titular de la reserva.' }
  }
  const user = await getAuthUser()
  if (user?.email && String(user.email).toLowerCase() !== String(booking.client_email).toLowerCase()) {
    return { ok: false, error: 'Tu sesión no corresponde al titular de esta reserva.' }
  }

  if (booking.status === 'cancelled') {
    return { ok: false, error: 'Esta reserva está cancelada.' }
  }

  const stageStatus = stage === 'deposit' ? booking.first_payment_status : booking.second_payment_status
  if (stageStatus === 'paid') {
    return { ok: false, error: 'Este pago ya está registrado como cobrado.' }
  }
  if (stage === 'balance' && ['cancelled', 'not_needed'].includes(stageStatus)) {
    return { ok: false, error: `Este pago está ${stageStatus}.` }
  }

  const amountEuros = Number(
    stage === 'deposit' ? booking.first_payment_amount : booking.second_payment_amount
  ) || 0
  if (amountEuros <= 0) {
    return { ok: false, error: 'No hay importe pendiente en este tramo.' }
  }

  // ── 1 · Consentimiento (antes de tocar Stripe) ───────────────────────
  let consentId: string
  try {
    const consent = await recordBookingConsent({
      booking,
      stage,
      headers: headers(),
      pageUrl: input.pageUrl,
      locale:  input.locale || 'es-ES',
      userId:  user?.id || null,
      acceptedGeneralTerms:   input.acceptedGeneralTerms,
      acceptedAdvanceForfeit: input.acceptedAdvanceForfeit,
      displayedClauseText:    input.displayedClauseText,
    })
    consentId = consent.id
  } catch (err: any) {
    if (err instanceof ConsentError) return { ok: false, error: err.message }
    console.error('[checkout] consentimiento:', err)
    return { ok: false, error: 'No pudimos registrar tu aceptación. No hemos cobrado nada.' }
  }

  // ── 2 · Cobro ────────────────────────────────────────────────────────
  if (isStripeConfigured()) {
    try {
      const intent = await createBookingPaymentIntent({ booking, stage, consentId })
      // Guardamos el id del intent ya, antes de que el cliente pague: si
      // el webhook llegase sin metadata podríamos resolver la reserva
      // igualmente desde esta columna.
      await supabase.from('bookings').update(
        stage === 'deposit'
          ? { first_payment_intent_id: intent.id }
          : { second_payment_intent_id: intent.id }
      ).eq('id', booking.id)

      return {
        ok: true,
        mode: 'stripe',
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.id,
        amountCents: intent.amountCents,
      }
    } catch (err: any) {
      console.error('[checkout] PaymentIntent:', err)
      return { ok: false, error: err?.message || 'No pudimos iniciar el pago con la tarjeta.' }
    }
  }

  if (isTestMode()) {
    // Modo test de FiestaGo: no hay cobro real, pero el consentimiento
    // queda registrado igual que en producción — así el flujo que se
    // prueba end-to-end es el de verdad.
    const result = stage === 'deposit'
      ? await markFirstPaymentPaid(supabase, booking, { source: 'mock' })
      : await markSecondPaymentPaid(supabase, booking, { source: 'mock' })
    if (!result.ok) return { ok: false, error: result.error || 'Error simulando el pago.' }
    return { ok: true, mode: 'mock', amount: result.amount || amountEuros }
  }

  return {
    ok: false,
    error: 'Los pagos con tarjeta no están disponibles ahora mismo. Escríbenos a contacto@fiestago.es.',
  }
}
