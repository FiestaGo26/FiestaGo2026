/**
 * Registro del consentimiento del cliente en el checkout.
 *
 * Esta es la pieza central del expediente anti-chargeback: prueba qué
 * texto vio el cliente, cuándo lo aceptó y desde dónde. Se escribe SIEMPRE
 * antes de crear el PaymentIntent — si el consentimiento falla, no se
 * cobra. Un cobro sin consentimiento registrado es una disputa perdida de
 * antemano.
 */

import { createAdminClient } from '@/lib/supabase'
import { getClientIp, getUserAgent, isLocalIp, type HeaderSource } from '@/lib/net/client-ip'
import { ensureCurrentTermsVersion } from '@/lib/legal/terms-versions'
import { buildAdvanceForfeitClause, type ForfeitClauseInput } from '@/lib/legal/clauses'

export type PaymentStage = 'deposit' | 'balance'

export type BookingConsentRow = {
  id: string
  booking_id: string
  terms_version_id: string
  content_hash: string
  displayed_clause_text: string
  advance_forfeit_accepted: boolean
  accepted_at: string
  ip_address: string | null
  user_agent: string | null
  page_url: string | null
  accepted_locale: string | null
}

/**
 * Construye la cláusula que se muestra en pantalla para una reserva y un
 * tramo concretos. La usan tanto la página (para renderizarla visible en
 * el DOM) como el Server Action (para verificar que el texto aceptado es
 * el mismo que se mostró). Fuente única, sin margen de divergencia.
 */
export function clauseForBooking(booking: any, stage: PaymentStage): string {
  const input: ForfeitClauseInput = {
    providerName: booking?.providers?.name || 'tu proveedor',
    eventDate:    booking.event_date,
    amountNow: Number(
      stage === 'deposit' ? booking.first_payment_amount : booking.second_payment_amount
    ) || 0,
    secondAmount:  Number(booking.second_payment_amount || 0),
    secondDueDate: booking.second_payment_due_date || null,
    stage,
    // No hay FK bookings → provider_services, así que aplicamos la
    // política por defecto del resto del código (calcRefund y el PATCH
    // del panel del proveedor hacen lo mismo).
    cancellationPolicy: 'moderate',
  }
  return buildAdvanceForfeitClause(input)
}

export class ConsentError extends Error {}

/**
 * Escribe la fila de booking_consents. Lanza ConsentError si algo no
 * cuadra — el llamante debe abortar el cobro, no seguir.
 *
 * `displayedClauseText` es el texto que el navegador dice haber
 * renderizado. Lo comparamos con el que reconstruimos aquí: si no
 * coinciden (la reserva cambió mientras el cliente tenía la página
 * abierta, o alguien manipuló el formulario) rechazamos el pago y
 * pedimos recargar. Guardar como "texto mostrado" algo que no se mostró
 * es peor que no guardar nada.
 */
export async function recordBookingConsent(opts: {
  booking: any
  stage: PaymentStage
  headers: HeaderSource
  pageUrl: string
  locale?: string | null
  userId?: string | null
  acceptedGeneralTerms: boolean
  acceptedAdvanceForfeit: boolean
  displayedClauseText: string
}): Promise<BookingConsentRow> {
  const {
    booking, stage, headers, pageUrl, locale, userId,
    acceptedGeneralTerms, acceptedAdvanceForfeit, displayedClauseText,
  } = opts

  if (!acceptedGeneralTerms) {
    throw new ConsentError('Tienes que aceptar las condiciones de uso y la política de privacidad.')
  }
  if (!acceptedAdvanceForfeit) {
    throw new ConsentError('Tienes que aceptar la política de reembolso y la pérdida del anticipo para continuar.')
  }

  const expected = clauseForBooking(booking, stage)
  if (normalize(displayedClauseText) !== normalize(expected)) {
    throw new ConsentError(
      'Las condiciones de tu reserva han cambiado desde que abriste esta página. ' +
      'Recárgala para leer el texto actualizado antes de pagar.'
    )
  }

  const version = await ensureCurrentTermsVersion('terms')

  const ip = getClientIp(headers)
  const ua = getUserAgent(headers)
  if (isLocalIp(ip)) {
    // No bloqueamos el cobro por esto (en local siempre pasa), pero dejamos
    // rastro: una evidencia con ::1 no prueba nada y hay que detectarlo
    // antes de que llegue una disputa real.
    console.warn(`[consent] IP no pública al aceptar la reserva ${booking.id}: ${ip ?? 'null'}`)
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('booking_consents')
    .insert({
      booking_id:               booking.id,
      user_id:                  userId || booking.user_id || null,
      terms_version_id:         version.id,
      content_hash:             version.content_hash,
      displayed_clause_text:    expected,
      advance_forfeit_accepted: true,
      accepted_at:              new Date().toISOString(),
      ip_address:               ip,
      user_agent:               ua,
      page_url:                 pageUrl,
      accepted_locale:          locale || 'es-ES',
    })
    .select()
    .single()

  if (error || !data) {
    throw new ConsentError(
      `No se pudo registrar tu aceptación (${error?.message || 'sin detalle'}). ` +
      'No hemos cobrado nada. Inténtalo de nuevo en unos segundos.'
    )
  }

  return data as BookingConsentRow
}

/** Último consentimiento registrado de una reserva (para la evidencia). */
export async function getLatestConsent(bookingId: string): Promise<BookingConsentRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('booking_consents')
    .select('*')
    .eq('booking_id', bookingId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as BookingConsentRow) || null
}

function normalize(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim()
}
