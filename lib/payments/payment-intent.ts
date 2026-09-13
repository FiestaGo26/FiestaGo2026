/**
 * Creación del PaymentIntent de una reserva.
 *
 * Tres decisiones que existen solo por las disputas:
 *
 *  1. statement_descriptor_suffix: 'FIESTAGO'. El cliente ve el cargo en
 *     su extracto hasta ocho meses después de reservar. Si lee el nombre
 *     de la sociedad y no lo reconoce, abre disputa por fraude sin
 *     pensarlo — y esa disputa se pierde aunque el servicio sea perfecto.
 *
 *  2. metadata completa (booking_id, consent_id, service_date,
 *     payment_stage, provider_id). Cuando llega el webhook de disputa,
 *     el único hilo que tenemos del charge al expediente es esta
 *     metadata.
 *
 *  3. request_three_d_secure: 'any'. Forzamos SCA en los dos tramos. Con
 *     3DS superado la responsabilidad por fraude se traslada al emisor;
 *     sin él, una disputa por fraude se pierde de oficio.
 *
 * El segundo tramo NO se cobra off-session con la tarjeta guardada: se
 * manda un enlace y el cliente autentica con su banco. Ver
 * lib/emails/second-payment.ts y el cron de recordatorios.
 */

import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import type { PaymentStage } from '@/lib/payments/consent'

export type CreatedIntent = {
  id: string
  clientSecret: string
  amountCents: number
}

export function amountForStage(booking: any, stage: PaymentStage): number {
  const euros = stage === 'deposit'
    ? Number(booking.first_payment_amount || 0)
    : Number(booking.second_payment_amount || 0)
  return Math.round(euros * 100)
}

export async function createBookingPaymentIntent(opts: {
  booking: any
  stage: PaymentStage
  consentId: string
}): Promise<CreatedIntent> {
  const { booking, stage, consentId } = opts
  const stripe = getStripe()

  const amountCents = amountForStage(booking, stage)
  if (amountCents <= 0) {
    throw new Error('El importe de este tramo es 0 — no hay nada que cobrar.')
  }

  const providerName = booking?.providers?.name || 'proveedor'
  const description = stage === 'deposit'
    ? `FiestaGo · anticipo reserva con ${providerName} (evento ${booking.event_date})`
    : `FiestaGo · pago restante reserva con ${providerName} (evento ${booking.event_date})`

  const params: Stripe.PaymentIntentCreateParams = {
    amount:   amountCents,
    currency: 'eur',
    description,
    receipt_email: booking.client_email || undefined,
    // El cliente reconoce "FIESTAGO" en el extracto ocho meses después.
    statement_descriptor_suffix: 'FIESTAGO',
    payment_method_types: ['card'],
    payment_method_options: {
      card: { request_three_d_secure: 'any' },
    },
    metadata: {
      booking_id:    String(booking.id),
      consent_id:    String(consentId),
      service_date:  isoDate(booking.event_date),
      payment_stage: stage,
      provider_id:   booking.provider_id ? String(booking.provider_id) : '',
      client_email:  booking.client_email || '',
    },
  }

  // Doble clic o reintento del navegador no crea dos cobros. Cada
  // consentimiento nuevo genera clave nueva, así que un reintento legítimo
  // tras un fallo sí crea su PaymentIntent.
  const idempotencyKey = `booking:${booking.id}:${stage}:${consentId}`

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create(params, { idempotencyKey })
  } catch (err: any) {
    // Stripe rechaza statement_descriptor_suffix si la cuenta no tiene
    // configurado el prefijo abreviado (Settings → Public details). Antes
    // que dejar el checkout caído por un ajuste del dashboard, cobramos sin
    // sufijo y lo gritamos en los logs: el descriptor hay que arreglarlo,
    // porque es lo que evita disputas por "no reconozco este cargo".
    const message = String(err?.message || '')
    if (!/statement_descriptor/i.test(message)) throw err

    console.error(
      '[stripe] La cuenta rechaza statement_descriptor_suffix. Configura el prefijo ' +
      'abreviado en Stripe → Settings → Public details para que el cargo aparezca como ' +
      `FIESTAGO en el extracto. Cobrando sin sufijo. Detalle: ${message}`
    )
    delete params.statement_descriptor_suffix
    intent = await stripe.paymentIntents.create(params, { idempotencyKey: `${idempotencyKey}:nodesc` })
  }

  if (!intent.client_secret) {
    throw new Error('Stripe no devolvió client_secret para el PaymentIntent')
  }

  return { id: intent.id, clientSecret: intent.client_secret, amountCents }
}

/** YYYY-MM-DD en ISO, tolerante a date o timestamp. */
export function isoDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}
