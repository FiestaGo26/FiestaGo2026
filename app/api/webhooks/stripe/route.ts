import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { markFirstPaymentPaid, markSecondPaymentPaid } from '@/lib/payments/mark-paid'
import { compileEvidenceForBooking } from '@/lib/disputes/evidence'
import { emailAdminDisputeOpened, emailAdminDisputeUpdated } from '@/lib/emails/disputes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Webhook de Stripe.
 *
 * Eventos que atendemos:
 *   · payment_intent.succeeded        → marca el tramo como cobrado
 *   · charge.dispute.created          → abre expediente y compila evidencia
 *   · charge.dispute.updated
 *   · charge.dispute.closed
 *   · charge.dispute.funds_withdrawn
 *
 * Al recibir una disputa nueva dejamos la evidencia ADJUNTA PERO SIN
 * ENVIAR (nada de submit: true automático). Razón: el envío es
 * irreversible y una evidencia mal montada no se puede corregir después.
 * Stripe la manda sola al llegar evidence_due_by, así que el peor caso es
 * que se envíe el borrador; el mejor, que Mariano lo revise antes.
 *
 * Configuración en Stripe: Developers → Webhooks → endpoint
 * https://fiestago.es/api/webhooks/stripe con esos cinco eventos. El
 * secreto va en STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET no configurada')
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Falta la firma de Stripe' }, { status: 400 })
  }

  // La firma se verifica sobre el cuerpo EN CRUDO. Si se parsea el JSON
  // antes, la verificación falla siempre.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err: any) {
    console.error('[stripe webhook] firma inválida:', err?.message)
    return NextResponse.json({ error: `Firma inválida: ${err?.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break

      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
      case 'charge.dispute.funds_withdrawn':
        await handleDisputeChanged(event.data.object as Stripe.Dispute, event.type)
        break

      default:
        // Un 200 a lo que no nos interesa evita que Stripe reintente en bucle.
        break
    }
  } catch (err: any) {
    // Devolvemos 500 para que Stripe reintente: perder un evento de
    // disputa cuesta el importe íntegro de la reserva.
    console.error(`[stripe webhook] error procesando ${event.type}:`, err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Pagos ──────────────────────────────────────────────────────────────

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const supabase = createAdminClient()
  const bookingId = pi.metadata?.booking_id
  const stage = (pi.metadata?.payment_stage as 'deposit' | 'balance') || null

  const booking = await resolveBookingByIntent(supabase, pi.id, bookingId)
  if (!booking) {
    console.error(`[stripe webhook] payment_intent ${pi.id} sin reserva identificable`)
    return
  }

  const resolvedStage = stage
    || (booking.second_payment_intent_id === pi.id ? 'balance' : 'deposit')

  const result = resolvedStage === 'deposit'
    ? await markFirstPaymentPaid(supabase, booking, { paymentIntentId: pi.id, source: 'stripe' })
    : await markSecondPaymentPaid(supabase, booking, { paymentIntentId: pi.id, source: 'stripe' })

  if (!result.ok) {
    console.error(`[stripe webhook] no se pudo marcar el pago ${resolvedStage} de ${booking.id}:`, result.error)
  }
}

// ─── Disputas ───────────────────────────────────────────────────────────

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const supabase = createAdminClient()
  const stripe = getStripe()

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id || null
  const piId = typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : dispute.payment_intent?.id || null

  // 1 · Resolver la reserva desde la metadata del PaymentIntent (y, si
  //     faltase, desde las columnas que guardamos al crear el intent).
  let bookingId: string | null = null
  let metadata: Record<string, string> = {}
  if (piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId)
      metadata = (pi.metadata || {}) as Record<string, string>
      bookingId = metadata.booking_id || null
    } catch (err: any) {
      console.error('[disputes] no se pudo leer el PaymentIntent:', err?.message)
    }
  }
  const booking = await resolveBookingByIntent(supabase, piId, bookingId)
  bookingId = booking?.id || bookingId || null

  // 2 · Abrir expediente. Lo primero, antes de nada que pueda fallar: si
  //     la compilación revienta, al menos la disputa queda registrada.
  const openedAt = dispute.created ? new Date(dispute.created * 1000).toISOString() : new Date().toISOString()
  const dueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
    : null

  const { error: insertError } = await supabase
    .from('dispute_events')
    .upsert({
      booking_id:            bookingId,
      stripe_dispute_id:     dispute.id,
      stripe_charge_id:      chargeId,
      stripe_payment_intent: piId,
      amount:                dispute.amount,
      currency:              dispute.currency,
      reason:                dispute.reason,
      status:                dispute.status,
      opened_at:             openedAt,
      evidence_due_by:       dueBy,
    }, { onConflict: 'stripe_dispute_id' })
    .select()
    .maybeSingle()

  if (insertError) {
    console.error('[disputes] no se pudo registrar la disputa:', insertError.message)
  }

  // 3 · Compilar y adjuntar la evidencia como BORRADOR.
  let evidenceAttached = false
  let evidenceErrors: string[] = []
  let hasConfirmation = false

  if (bookingId) {
    try {
      const { bundle, files, evidence } = await compileEvidenceForBooking(bookingId)
      hasConfirmation = Boolean(bundle.confirmation)
      evidenceErrors = files.errors || []

      // Sin submit: true. A propósito.
      await stripe.disputes.update(dispute.id, { evidence })
      evidenceAttached = true

      await supabase.from('dispute_events').update({
        evidence_payload: evidence as any,
        evidence_files:   files as any,
        notes: evidenceErrors.length
          ? `Evidencia adjuntada como borrador con incidencias: ${evidenceErrors.join(' · ')}`
          : 'Evidencia compilada y adjuntada como borrador. Pendiente de revisión y envío manual.',
      }).eq('stripe_dispute_id', dispute.id)
    } catch (err: any) {
      console.error('[disputes] compilación de evidencia fallida:', err)
      evidenceErrors.push(err?.message || 'error desconocido')
      await supabase.from('dispute_events').update({
        notes: `Fallo compilando la evidencia automáticamente: ${err?.message || 'error desconocido'}`,
      }).eq('stripe_dispute_id', dispute.id)
    }
  } else {
    evidenceErrors.push('No se pudo identificar la reserva a partir del cargo disputado.')
  }

  // 4 · Avisar a Mariano. El reloj de evidence_due_by ya está corriendo.
  try {
    await emailAdminDisputeOpened({
      disputeId:      dispute.id,
      amount:         dispute.amount,
      currency:       dispute.currency,
      reason:         dispute.reason,
      evidenceDueBy:  dueBy,
      bookingId,
      clientName:     booking?.client_name || null,
      eventDate:      booking?.event_date || null,
      providerName:   booking?.providers?.name || null,
      evidenceAttached,
      evidenceErrors,
      hasServiceConfirmation: hasConfirmation,
    })
  } catch (err: any) {
    console.error('[disputes] email de alerta fallido:', err?.message)
  }

  // Notificación en el panel, además del email.
  await supabase.from('notifications').insert({
    type:    'dispute_opened',
    title:   `🚨 Disputa abierta · ${(dispute.amount / 100).toFixed(2)} ${String(dispute.currency).toUpperCase()}`,
    message: `Motivo "${dispute.reason}". Evidencia ${evidenceAttached ? 'adjuntada como borrador' : 'PENDIENTE'}. Límite: ${dueBy ? new Date(dueBy).toLocaleString('es-ES') : 'sin fecha'}.`,
    data:    { dispute_id: dispute.id, booking_id: bookingId, amount: dispute.amount },
    action_url: `/admin/disputas?dispute=${dispute.id}`,
  }).catch(() => {})
}

async function handleDisputeChanged(dispute: Stripe.Dispute, eventType: string) {
  const supabase = createAdminClient()

  const updates: Record<string, any> = {
    status:   dispute.status,
    amount:   dispute.amount,
    currency: dispute.currency,
    reason:   dispute.reason,
  }
  if (dispute.evidence_details?.due_by) {
    updates.evidence_due_by = new Date(dispute.evidence_details.due_by * 1000).toISOString()
  }
  if (dispute.evidence_details?.submission_count && dispute.evidence_details.submission_count > 0) {
    // Stripe no nos dice cuándo se envió exactamente; si ya hay envíos y
    // no teníamos marca, la ponemos ahora para que el panel deje de
    // mostrarlo como pendiente.
    updates.evidence_submitted_at = new Date().toISOString()
  }
  if (eventType === 'charge.dispute.closed' || ['won', 'lost'].includes(dispute.status)) {
    updates.outcome = dispute.status
  }
  if (eventType === 'charge.dispute.funds_withdrawn') {
    updates.outcome = updates.outcome || 'funds_withdrawn'
  }

  const { data: existing } = await supabase
    .from('dispute_events')
    .select('id, booking_id, evidence_submitted_at')
    .eq('stripe_dispute_id', dispute.id)
    .maybeSingle()

  if (!existing) {
    // Llega un update de una disputa que nunca vimos abrirse (webhook
    // perdido, disputa creada antes de desplegar esto). La registramos.
    await handleDisputeCreated(dispute)
    return
  }

  if (existing.evidence_submitted_at) delete updates.evidence_submitted_at

  await supabase.from('dispute_events').update(updates).eq('id', existing.id)

  try {
    await emailAdminDisputeUpdated({
      disputeId: dispute.id,
      bookingId: existing.booking_id,
      status:    dispute.status,
      amount:    dispute.amount,
      currency:  dispute.currency,
      event:     eventType,
    })
  } catch (err: any) {
    console.error('[disputes] email de actualización fallido:', err?.message)
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Encuentra la reserva de un PaymentIntent. Primero por el id que viene
 * en la metadata; si falta (o la disputa es antigua), por las columnas
 * first_payment_intent_id / second_payment_intent_id, que escribimos al
 * crear el intent precisamente para este momento.
 */
async function resolveBookingByIntent(
  supabase: any,
  paymentIntentId: string | null,
  bookingId?: string | null,
): Promise<any | null> {
  if (bookingId) {
    const { data } = await supabase
      .from('bookings').select('*, providers(*)').eq('id', bookingId).maybeSingle()
    if (data) return data
  }
  if (!paymentIntentId) return null

  for (const column of ['first_payment_intent_id', 'second_payment_intent_id', 'stripe_payment_intent']) {
    const { data } = await supabase
      .from('bookings').select('*, providers(*)').eq(column, paymentIntentId).maybeSingle()
    if (data) return data
  }
  return null
}
